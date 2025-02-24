import { commands, Disposable, env, StatusBarAlignment, StatusBarItem, Uri, window } from 'vscode';
import { SpecificationFileTreeProvider } from '../../specification-tree/specification-tree-provider';
import {
    bundledFileDataWithDependencies,
    convertBundleDataToFiles,
    createBuildConfigFiles
} from '../../utils/document.utils';
import {
    packToZip,
    specificationItemToFile,
    splitVersion
} from '../../utils/files.utils';
import { showErrorNotification } from '../../utils/notification.urils';
import { EXTENSION_PUBLISH_VIEW_PUBLISH_ACTION_NAME } from '../constants/common.constants';
import { PUBLISH_NO_PREVIOUS_VERSION, STATUS_BAR_TEXT } from '../constants/publish.constants';
import { CrudService } from '../cruds/publish.crud';
import { BundleData } from '../models/bundle.model';
import { PublishError, PublishErrorTypes } from '../models/publish-error.model';
import {
    BuildConfigFile,
    PackageId,
    PublishConfig,
    PublishDto,
    PublishStatus,
    PublishStatusDto,
    VersionId,
    VersionStatus
} from '../models/publish.model';
import { SpecificationItem } from '../models/specification-item';
import { PublishViewProvider } from '../webview/publish-view';
import { ConfigurationFileService } from './configuration-file.service';
import { configurationService } from './configuration.service';
import { SecretStorageService } from './secret-storage.service';
import { isItemApispecFile, getFilePath } from '../../utils/path.utils';

export class PublishService implements Disposable {
    private readonly _crudService: CrudService;
    private _disposables: Disposable[] = [];
    private _statusBarItem: StatusBarItem;

    constructor(
        private readonly publishViewProvider: PublishViewProvider,
        private readonly fileTreeProvider: SpecificationFileTreeProvider,
        private readonly secretStorageService: SecretStorageService,
        private readonly configurationFileService: ConfigurationFileService
    ) {
        this._crudService = new CrudService();
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
        this._statusBarItem.text = STATUS_BAR_TEXT;

        this.registerPublishCommand();
    }

    private registerPublishCommand(): void {
        this._disposables.push(
            commands.registerCommand(EXTENSION_PUBLISH_VIEW_PUBLISH_ACTION_NAME, async (data: PublishDto) => {
                this.publishViewProvider.showLoading();
                this._statusBarItem.show();

                const values: SpecificationItem[] = await this.fileTreeProvider.getFilesForPublish();
                const host = configurationService.hostUrl;
                const token = await this.secretStorageService.getToken();

                this.publish(host, token, values, data)
                    .then((value: PublishStatusDto) => {
                        const { workfolderPath, packageId, version } = data;
                        this.configurationFileService.updateConfigurationFile(
                            workfolderPath,
                            packageId,
                            values.map((value) => value.uri.fsPath)
                        );
                        window
                            .showInformationMessage(
                                'Package version was successfully published in APIHUB Portal. Check it out.',
                                'Check it out'
                            )
                            .then((selection) => {
                                if (selection === 'Check it out') {
                                    env.openExternal(Uri.parse(`${host}/portal/packages/${packageId}/${version}/`));
                                }
                            });
                    })
                    .catch((err) => {
                        console.error(err.message, err.stack);
                        showErrorNotification(err.message);
                    })
                    .finally(() => {
                        this._statusBarItem.hide();
                        this.publishViewProvider.hideLoading();
                    });
            })
        );
    }

    public dispose() {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
    }

    public async publish(
        host: string,
        authorization: string,
        items: SpecificationItem[],
        publishData: PublishDto
    ): Promise<PublishStatusDto> {
        if (!host) {
            throw new PublishError(
                'Please enter APIHUB Url',
                PublishErrorTypes.INFO,
                'Go to documentation',
                'https://github.com/'
            );
        }
        if (!authorization) {
            throw new PublishError(
                'Please enter Token',
                PublishErrorTypes.INFO,
                'Go to documentation',
                'https://github.com/'
            );
        }
        if (!items?.length) {
            throw new PublishError(
                'Please select some files',
                PublishErrorTypes.INFO,
                'Go to documentation',
                'https://github.com/'
            );
        }
        const { packageId, version, status, previousVersion, labels } = publishData;

        if (!packageId || !version || !status || !previousVersion) {
            throw new Error('Fill all required fields');
        }

        const apiSpecItems: SpecificationItem[] = items.filter(isItemApispecFile);
        const additionalItems: SpecificationItem[] = items.filter((item) => !isItemApispecFile(item));

        const publishingfiles: File[] = await this.bundlingItems(apiSpecItems);
        publishingfiles.push(...additionalItems.map(specificationItemToFile));

        let zipData: Blob;
        try {
            zipData = await packToZip(publishingfiles);
        } catch (error) {
            console.error(error);
            throw new Error('Pack to zip error');
        }

        const publishFileNames: string[] = items.map((item) =>
            getFilePath(item.workspacePath, item.resourceUri?.fsPath ?? '')
        );
        const additionalFileNames: string[] = publishingfiles.map((file) => file.name);

        const publishConfig: PublishConfig = await this.publishApispec(
            host,
            publishFileNames,
            additionalFileNames,
            zipData,
            packageId,
            status,
            version,
            previousVersion,
            labels,
            authorization
        );

        return this.getPublishStatus(host, packageId, publishConfig.publishId, authorization);
    }

    private async bundlingItems(items: SpecificationItem[]): Promise<File[]> {
        const bundleErrors: string[] = [];
        const dataWithDependencies: BundleData[] = await Promise.all(
            items.map((path) => bundledFileDataWithDependencies(path, (err) => bundleErrors.push(err)))
        );

        if (bundleErrors.length) {
            throw new Error('Errors: ' + bundleErrors.join(', '));
        }

        return convertBundleDataToFiles(dataWithDependencies);
    }

    private publishApispec(
        host: string,
        publishFileNames: string[],
        allFileNames: string[],
        blobData: Blob,
        packageId: PackageId,
        status: VersionStatus,
        versionId: VersionId,
        previousVersion: VersionId,
        versionLabels: string[],
        authorization: string
    ): Promise<PublishConfig> {
        const buildConfig: BuildConfigFile[] = createBuildConfigFiles(publishFileNames, allFileNames);
        const normalizePreviousVersion = this.convertPreviousVersion(previousVersion);
        return this._crudService.publishApispec(
            host,
            buildConfig,
            blobData,
            packageId,
            status,
            versionId,
            normalizePreviousVersion,
            versionLabels,
            authorization
        );
    }

    private async getPublishStatus(
        host: string,
        packageId: PackageId,
        publishId: string,
        authorization: string,
        maxAttempts = 10
    ): Promise<PublishStatusDto> {
        let attempts = 0;
        while (attempts < maxAttempts) {
            const publishStatus: PublishStatusDto = await this._crudService.getStatus(
                host,
                packageId,
                publishId,
                authorization
            );
            if (publishStatus.status === PublishStatus.COMPLETE) {
                return publishStatus;
            }
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        throw new Error('Waiting time exceeded');
    }

    private convertPreviousVersion(version: VersionId): string {
        if (version === PUBLISH_NO_PREVIOUS_VERSION) {
            return '';
        }
        return splitVersion(version).version;
    }
}
