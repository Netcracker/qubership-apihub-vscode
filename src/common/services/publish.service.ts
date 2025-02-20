import { commands, Disposable, env, StatusBarAlignment, StatusBarItem, Uri, window } from 'vscode';
import { SpecificationFileTreeProvider } from '../../specification-tree/specification-tree-provider';
import {
    bundledFileDataWithDependencies,
    convertBundleDataToFiles,
    createBuildConfigFiles
} from '../../utils/document.utils';
import { isItemApispecFile, packToZip, specificationItemToFile, splitVersion } from '../../utils/files.utils';
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
        publishingFiles: SpecificationItem[],
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
        if (!publishingFiles?.length) {
            throw new PublishError(
                'Please select some files',
                PublishErrorTypes.INFO,
                'Go to documentation',
                'https://github.com/'
            );
        }
        const packageId = publishData.packageId;
        const version = publishData?.version;
        const status = publishData?.status;
        const previousVersion = publishData?.previousVersion;

        if (!packageId || !version || !status || !previousVersion) {
            throw new Error('Fill all required fields');
        }

        const bundleErrors: string[] = [];
        const dataWithDependencies: BundleData[] = await Promise.all(
            publishingFiles
                .filter(isItemApispecFile)
                .map((path) => bundledFileDataWithDependencies(path, (err) => bundleErrors.push(err)))
        );

        if (bundleErrors.length) {
            throw new Error('Errors: ' + bundleErrors.join(', '));
        }

        if (!dataWithDependencies) {
            throw new Error('Internal error');
        }

        let files: File[] = convertBundleDataToFiles(dataWithDependencies);
        const publishFileNames: string[] = dataWithDependencies.map((data) => data.fileName);

        const noApispecFiles: File[] = publishingFiles
            .filter((item) => !isItemApispecFile(item))
            .map(specificationItemToFile);
        files.push(...noApispecFiles);
        //todo fix
        publishFileNames.push(...noApispecFiles.map((data) => data.name));

        let zipData: Blob;
        try {
            zipData = await packToZip(files);
        } catch (error) {
            console.error(error);
            throw new Error('Pack to zip error');
        }

        const allFileNames: string[] = files.map((file) => file.name);
        const normalizePreviousVersion = this.convertPreviousVersion(previousVersion);

        const publishConfig: PublishConfig = await this.publishApispec(
            host,
            createBuildConfigFiles(publishFileNames, allFileNames),
            zipData,
            packageId,
            status,
            version,
            normalizePreviousVersion,
            authorization
        );

        return this.getPublishStatus(host, packageId, publishConfig.publishId, authorization);
    }

    private publishApispec(
        host: string,
        buildConfig: BuildConfigFile[],
        blobData: Blob,
        packageId: PackageId,
        status: VersionStatus,
        versionId: VersionId,
        previousVersion: VersionId,
        authorization: string
    ): Promise<PublishConfig> {
        return this._crudService.publishApispec(
            host,
            buildConfig,
            blobData,
            packageId,
            status,
            versionId,
            previousVersion,
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
