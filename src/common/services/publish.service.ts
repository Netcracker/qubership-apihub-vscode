import { commands, Disposable, env, StatusBarAlignment, StatusBarItem, Uri, window } from 'vscode';
import { SpecificationFileTreeProvider } from '../../specification-tree/specification-tree-provider';
import {
    bundledFileDataWithDependencies,
    convertBundleDataToFiles,
    createBuildConfigFiles
} from '../../utils/document.utils';
import { convertPreviousVersion, packToZip, specificationItemToFile } from '../../utils/files.utils';
import { showErrorNotification } from '../../utils/notification.urils';
import { getFilePath, isItemApispecFile } from '../../utils/path.utils';
import {
    EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME,
    EXTENSION_PUBLISH_VIEW_PUBLISH_ACTION_NAME
} from '../constants/common.constants';
import {
    PUBLISH_DATA_NAME,
    STATUS_BAR_TEXT,
    STATUS_REFETCH_INTERVAL,
    STATUS_REFETCH_MAX_ATTEMPTS
} from '../constants/publish.constants';
import { CrudService } from '../cruds/publish.crud';
import { BundleData } from '../models/bundle.model';
import { PublishError, PublishErrorTypes } from '../models/publish-error.model';
import {
    BuildConfig,
    BuildConfigFile,
    PackageId,
    PublishCommandData,
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

export class PublishService extends Disposable {
    private readonly _crudService: CrudService;
    private _disposables: Disposable[] = [];
    private _statusBarItem: StatusBarItem;

    constructor(
        private readonly publishViewProvider: PublishViewProvider,
        private readonly fileTreeProvider: SpecificationFileTreeProvider,
        private readonly secretStorageService: SecretStorageService,
        private readonly configurationFileService: ConfigurationFileService
    ) {
        super(() => this.dispose());
        this._crudService = new CrudService();
        this._disposables.push(this._crudService);
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
        this._statusBarItem.text = STATUS_BAR_TEXT;

        this.registerPublishCommand();
    }

    private registerPublishCommand(): void {
        this._disposables.push(
            commands.registerCommand(
                EXTENSION_PUBLISH_VIEW_PUBLISH_ACTION_NAME,
                async (publishData: PublishCommandData) => {
                    this.publishViewProvider.showLoading();
                    this._statusBarItem.show();

                    const values: SpecificationItem[] = await this.fileTreeProvider.getFilesForPublish();
                    const host = configurationService.hostUrl;
                    const token = await this.secretStorageService.getToken();
                    const { data, workfolderPath } = publishData;
                    this.publish(host, token, values, data)
                        .then((value: PublishStatusDto) => {
                            const { packageId, version } = data;
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
                }
            )
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
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            throw new PublishError(
                'Please enter APIHUB Url',
                PublishErrorTypes.INFO,
                'Go to documentation',
                'https://github.com/'
            );
        }
        if (!authorization) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
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
        version: VersionId,
        previousVersion: VersionId,
        versionLabels: string[],
        authorization: string
    ): Promise<PublishConfig> {
        const buildConfig: BuildConfigFile[] = createBuildConfigFiles(publishFileNames, allFileNames);
        const normalizePreviousVersion = convertPreviousVersion(previousVersion);

        const config: BuildConfig = {
            packageId,
            status,
            version,
            previousVersion: normalizePreviousVersion,
            files: buildConfig,
            metadata: versionLabels?.length ? { versionLabels } : {}
        };
        const formData = new FormData();

        blobData && formData.append('sources', blobData, PUBLISH_DATA_NAME);

        const publishConfig = {
            ...config,
            sources: undefined
        };

        formData.append('config', JSON.stringify(publishConfig));

        return this._crudService.publishApispec(host, packageId, authorization, formData);
    }

    private async getPublishStatus(
        host: string,
        packageId: PackageId,
        publishId: string,
        authorization: string,
        maxAttempts = STATUS_REFETCH_MAX_ATTEMPTS
    ): Promise<PublishStatusDto> {
        let attempts = 0;
        while (attempts < maxAttempts) {
            const publishStatus: PublishStatusDto = await this._crudService.getStatus(
                host,
                authorization,
                packageId,
                publishId
            );
            if (publishStatus.status === PublishStatus.COMPLETE) {
                return publishStatus;
            }
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, STATUS_REFETCH_INTERVAL));
        }
        throw new Error('Waiting time exceeded');
    }
}
