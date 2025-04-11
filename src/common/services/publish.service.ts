import { commands, Disposable, env, Event, EventEmitter, StatusBarAlignment, StatusBarItem, Uri, window } from 'vscode';
import { SpecificationFileTreeProvider } from '../specification-tree/specification-tree-provider';
import {
    bundledFileDataWithDependencies,
    convertBundleDataToFiles,
    createBuildConfigFiles
} from '../../utils/document.utils';
import { convertPreviousVersion, packToZip, specificationItemToFile } from '../../utils/files.utils';
import { getFilePath, isItemApispecFile } from '../../utils/path.utils';
import { delay } from '../../utils/publish.utils';
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
import { WorkfolderPath } from '../models/common.model';
import {
    BuildConfig,
    PackageId,
    PublishConfig,
    PublishStatus,
    PublishStatusDto,
    PublishViewData,
    VersionId,
    VersionStatus
} from '../models/publish.model';
import { SpecificationItem } from '../models/specification-item';
import { ConfigurationFileService } from './configuration-file.service';
import { EnvironmentStorageService } from './environment-storage.service';

export class PublishService extends Disposable {
    private readonly _crudService: CrudService;
    private readonly _statusBarItem: StatusBarItem;
    private _disposables: Disposable[] = [];
    private readonly _onPublish: EventEmitter<boolean> = new EventEmitter();
    public readonly onPublish: Event<boolean> = this._onPublish.event;
    private _isPublishProgress = false;

    constructor(
        private readonly fileTreeProvider: SpecificationFileTreeProvider,
        private readonly environmentStorageService: EnvironmentStorageService,
        private readonly configurationFileService: ConfigurationFileService
    ) {
        super(() => this.dispose());
        this._crudService = new CrudService();
        this._disposables.push(this._crudService);
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
        this._statusBarItem.text = STATUS_BAR_TEXT;
    }

    public get isPublishProgress(): boolean {
        return this._isPublishProgress;
    }

    public async publish(workfolderPath: WorkfolderPath, data: PublishViewData): Promise<void> {
        this.startPublishProgress();

        try {
            const filesToPublish = await this.fileTreeProvider.getFilesForPublish();
            const { host, token } = await this.environmentStorageService.getEnvironment();

            await this.validateAndPublish(host, token, filesToPublish, data);

            this.updateConfigurationFile(workfolderPath, data.packageId, filesToPublish);
            this.showSuccessMessage(host, data.packageId, data.version);
        } catch (error) {
            this.handlePublishError(error);
        } finally {
            this.endPublishProgress();
        }
    }

    public dispose(): void {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
    }

    private startPublishProgress(): void {
        this._statusBarItem.show();
        this.updatePublishProgress(true);
    }

    private endPublishProgress(): void {
        this._statusBarItem.hide();
        this.updatePublishProgress(false);
    }

    private updatePublishProgress(value: boolean): void {
        this._isPublishProgress = value;
        this._onPublish.fire(value);
    }

    private async validateAndPublish(
        host: string,
        authorization: string,
        items: SpecificationItem[],
        publishData: PublishViewData
    ): Promise<PublishStatusDto> {
        this.validateInputs(host, authorization, items, publishData);

        const { packageId, version, status, previousVersion, labels } = publishData;

        const apiSpecItems = items.filter(isItemApispecFile);
        const additionalItems = items.filter((item) => !isItemApispecFile(item));

        const publishingFiles = await this.bundleItems(apiSpecItems);
        publishingFiles.push(...additionalItems.map(specificationItemToFile));

        const zipData = await this.createZip(publishingFiles);

        const publishFileNames = items.map((item) => getFilePath(item.workspacePath, item.resourceUri?.fsPath ?? ''));
        const additionalFileNames = publishingFiles.map((file) => file.name);

        const publishConfig = await this.publishApispec(
            host,
            publishFileNames,
            additionalFileNames,
            zipData,
            packageId,
            status,
            version,
            previousVersion,
            Array.from(labels),
            authorization
        );

        return this.getPublishStatus(host, packageId, publishConfig.publishId, authorization);
    }

    private validateInputs(
        host: string,
        authorization: string,
        items: SpecificationItem[],
        publishData: PublishViewData
    ): void {
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
        const { packageId, version, status, previousVersion } = publishData;
        if (!packageId || !version || !status || !previousVersion) {
            throw new Error('Fill all required fields');
        }
    }

    private async bundleItems(items: SpecificationItem[]): Promise<File[]> {
        const bundleErrors: string[] = [];
        const dataWithDependencies = await Promise.all(
            items.map((path) => bundledFileDataWithDependencies(path, (err) => bundleErrors.push(err)))
        );

        if (bundleErrors.length) {
            console.error('Errors: ' + bundleErrors.join(', '));
        }

        return convertBundleDataToFiles(dataWithDependencies);
    }

    private async createZip(files: File[]): Promise<Blob> {
        try {
            return await packToZip(files);
        } catch (error) {
            console.error(error);
            throw new Error('Pack to zip error');
        }
    }

    private async publishApispec(
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
        const buildConfig = createBuildConfigFiles(publishFileNames, allFileNames);
        const normalizedPreviousVersion = convertPreviousVersion(previousVersion);

        const config: BuildConfig = {
            packageId,
            status,
            version,
            previousVersion: normalizedPreviousVersion,
            files: buildConfig,
            metadata: versionLabels?.length ? { versionLabels } : {}
        };

        const formData = new FormData();
        formData.append('sources', blobData, PUBLISH_DATA_NAME);
        formData.append('config', JSON.stringify({ ...config, sources: undefined }));

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
            const publishStatus = await this._crudService.getStatus(host, authorization, packageId, publishId);
            if (publishStatus.status === PublishStatus.COMPLETE) {
                return publishStatus;
            }
            if (publishStatus.status === PublishStatus.ERROR) {
                throw new Error(publishStatus.message);
            }
            attempts++;
            await delay(STATUS_REFETCH_INTERVAL);
        }
        throw new Error('Waiting time exceeded');
    }

    private updateConfigurationFile(
        workfolderPath: WorkfolderPath,
        packageId: PackageId,
        files: SpecificationItem[]
    ): void {
        this.configurationFileService.updateConfigurationFile(
            workfolderPath,
            packageId,
            files.map((file) => file.uri.fsPath)
        );
    }

    private showSuccessMessage(host: string, packageId: PackageId, version: VersionId): void {
        window.showInformationMessage(PUBLISH_SUCCESSFUL_MESSAGE, PUBLISH_BUTTON_LINK_MESSAGE).then((selection) => {
            if (selection === PUBLISH_BUTTON_LINK_MESSAGE) {
                env.openExternal(Uri.parse(`${host}/portal/${PACKAGES}/${packageId}/${version}/`));
            }
        });
    }

    private handlePublishError(error: unknown): void {
        const errorMessage = (error as Error)?.message || 'An unknown error occurred';
        console.error(errorMessage, (error as Error)?.stack);
        window.showErrorMessage(errorMessage);
    }
}
