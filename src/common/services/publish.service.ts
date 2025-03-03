import { commands, Disposable, env, Event, EventEmitter, StatusBarAlignment, StatusBarItem, Uri, window } from 'vscode';
import { SpecificationFileTreeProvider } from '../../specification-tree/specification-tree-provider';
import {
    bundledFileDataWithDependencies,
    convertBundleDataToFiles,
    createBuildConfigFiles
} from '../../utils/document.utils';
import { convertPreviousVersion, packToZip, specificationItemToFile } from '../../utils/files.utils';
import { showErrorNotification } from '../../utils/notification.urils';
import { getFilePath, isItemApispecFile } from '../../utils/path.utils';
import { EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME, PACKAGES } from '../constants/common.constants';
import {
    PUBLISH_BUTTON_LINK_MESSAGE,
    PUBLISH_DATA_NAME,
    PUBLISH_SUCCESSFUL_MESSAGE,
    STATUS_BAR_TEXT,
    STATUS_REFETCH_INTERVAL,
    STATUS_REFETCH_MAX_ATTEMPTS
} from '../constants/publish.constants';
import { CrudService } from '../cruds/crud.service';
import { BundleData } from '../models/bundle.model';
import { WorkfolderPath } from '../models/common.model';
import {
    BuildConfig,
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
import { ConfigurationFileService } from './configuration-file.service';
import { ConfigurationService } from './configuration.service';

export class PublishService extends Disposable {
    private readonly _crudService: CrudService;
    private readonly _statusBarItem: StatusBarItem;
    private _disposables: Disposable[] = [];
    private readonly _onPublish: EventEmitter<boolean> = new EventEmitter();
    public readonly onPublish: Event<boolean> = this._onPublish.event;
    private _isPublishProgress = false;

    constructor(
        private readonly fileTreeProvider: SpecificationFileTreeProvider,
        private readonly configurationService: ConfigurationService,
        private readonly configurationFileService: ConfigurationFileService
    ) {
        super(() => this.dispose());
        this._crudService = new CrudService();
        this._disposables.push(this._crudService);
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
        this._statusBarItem.text = STATUS_BAR_TEXT;
    }

    public get isPublishProgress(): boolean{
        return this._isPublishProgress;
    }

    public async publish(workfolderPath: WorkfolderPath, data: PublishDto): Promise<void> {
        this._onPublish.fire(true);
        this._isPublishProgress = true;
        this._statusBarItem.show();

        const values: SpecificationItem[] = await this.fileTreeProvider.getFilesForPublish();
        const host = this.configurationService.hostUrl;
        const token = await this.configurationService.getToken();
        this.validateAndPulbish(host, token, values, data)
            .then(() => {
                const { packageId, version } = data;
                this.configurationFileService.updateConfigurationFile(
                    workfolderPath,
                    packageId,
                    values.map((value) => value.uri.fsPath)
                );
                window
                    .showInformationMessage(PUBLISH_SUCCESSFUL_MESSAGE, PUBLISH_BUTTON_LINK_MESSAGE)
                    .then((selection) => {
                        if (selection === PUBLISH_BUTTON_LINK_MESSAGE) {
                            env.openExternal(Uri.parse(`${host}/portal/${PACKAGES}/${packageId}/${version}/`));
                        }
                    });
            })
            .catch((err) => {
                console.error(err.message, err.stack);
                showErrorNotification(err.message);
            })
            .finally(() => {
                this._statusBarItem.hide();
                this._onPublish.fire(false);
                this._isPublishProgress = false;
            });
    }

    public dispose() {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
    }

    private async validateAndPulbish(
        host: string,
        authorization: string,
        items: SpecificationItem[],
        publishData: PublishDto
    ): Promise<PublishStatusDto> {
        if (!host) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            throw new Error('Error: Empty Url');
        }
        if (!authorization) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            throw new Error('Error: Empty Token');
        }
        if (!items?.length) {
            throw new Error('Error: Files not selected for publishing');
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
