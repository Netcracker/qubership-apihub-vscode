import {
    CancellationToken,
    commands,
    ExtensionContext,
    Webview,
    WebviewView,
    WebviewViewResolveContext,
    window
} from 'vscode';
import { debounce, splitVersion } from '../../utils/files.utils';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import { capitalize } from '../../utils/path.utils';
import { convertOptionsToDto } from '../../utils/publish.utils';
import {
    ABORTED_ERROR_CODE,
    EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME,
    EXTENSION_PUBLISH_VIEW_NAME,
    MAIN_JS_PATH
} from '../constants/common.constants';
import {
    PUBLISH_INPUT_DRAFT_PATTERN,
    PUBLISH_JS_PATH,
    PUBLISH_LOADING_OPTION,
    PUBLISH_NO_PREVIOUS_VERSION,
    PUBLISH_STATUSES,
    PUBLISH_WEBVIEW
} from '../constants/publish.constants';
import { CrudService } from '../cruds/crud.service';
import { CrudError, WorkfolderPath } from '../models/common.model';
import { ConfigurationFileLike } from '../models/configuration.model';
import {
    PackageId,
    PublishFields,
    PublishViewData,
    PublishViewPackageIdData,
    PublishWebviewDto,
    PublishWebviewMessages,
    VersionId,
    VersionStatus
} from '../models/publish.model';
import { WebviewMessages, WebviewPayload } from '../models/webview.model';
import { ConfigurationFileService } from '../services/configuration-file.service';
import { EnvironmentStorageService } from '../services/environment-storage.service';
import { PublishService } from '../services/publish.service';
import { WorkspaceService } from '../services/workspace.service';
import { WebviewBase } from './webview-base';

export class PublishViewProvider extends WebviewBase<PublishFields> {
    private readonly _publishViewData: Map<WorkfolderPath, PublishViewData> = new Map();
    private readonly updateLabelsDebounced = debounce((data: PublishViewData, version: VersionId) =>
        this.wrapInProgress(async () => await this.updateLabels(data, version))
    );
    private readonly updatePackageIdDebounced = debounce((workfolderPath: WorkfolderPath) =>
        this.wrapInProgress(async () => await this.loadPackageId(workfolderPath))
    );

    constructor(
        private readonly context: ExtensionContext,
        private readonly crudService: CrudService,
        private readonly environmentStorageService: EnvironmentStorageService,
        private readonly configurationFileService: ConfigurationFileService,
        private readonly workfolderService: WorkspaceService,
        private readonly publishService: PublishService
    ) {
        super(() => this.dispose());
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken
    ): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        this._view.onDidChangeVisibility(() => {
            this.activate(this._view?.visible ?? false);
        });

        this.activate(true);
    }

    public dispose(): void {
        super.dispose();
        this.workfolderService.unsubscribe(PUBLISH_WEBVIEW);
        this.configurationFileService.unsubscribe(PUBLISH_WEBVIEW);
    }

    private activate(active: boolean): void {
        if (!active) {
            this.dispose();
            return;
        }
        this.subscribeChanges();
        this.restoreLocalFields(this.workfolderService.activeWorkfolderPath);
    }

    private subscribeChanges(): void {
        if (!this._view) {
            return;
        }
        this._view.webview.onDidReceiveMessage(
            (message: PublishWebviewDto) => {
                switch (message.command) {
                    case PublishWebviewMessages.PUBLISH: {
                        this.publish();
                        break;
                    }
                    case WebviewMessages.UPDATE_FIELD: {
                        this.updateField(message.payload as WebviewPayload<PublishFields>);
                        break;
                    }
                    case WebviewMessages.REQUEST_OPTIONS: {
                        this.requestField(message.payload as WebviewPayload<PublishFields>);
                        break;
                    }
                    case WebviewMessages.DELETE: {
                        this.deleteWebviewLabels((message.payload as WebviewPayload<PublishFields>).value as string);
                        break;
                    }
                }
            },
            this,
            this._disposables
        );

        this.workfolderService.subscribe(PUBLISH_WEBVIEW, (workfolderPath: string) =>
            this.restoreLocalFields(workfolderPath)
        );

        this.configurationFileService.subscribe(PUBLISH_WEBVIEW, (workfolderPath: string) => {
            const configFile: ConfigurationFileLike | undefined =
                this.configurationFileService.getConfigurationFile(workfolderPath);
            this.restoreConfigPackageId(workfolderPath, configFile);
        });
        this.environmentStorageService.onDidChangeConfiguration(
            () => {
                this.disableDependentFields();
                const activeWorkfolderPath = this.workfolderService.activeWorkfolderPath;
                this.loadPackageId(activeWorkfolderPath);
            },
            this,
            this._disposables
        );
        this.disableAllField(this.publishService.isPublishProgress);
        this.publishService.onPublish(
            (isPublishProgress) => {
                this.disableAllField(isPublishProgress);
                if (!isPublishProgress) {
                    this.wrapInProgress(async () => await this.loadPreviousVersions());
                }
            },
            this,
            this._disposables
        );
    }

    private restoreLocalFields(workfolderPath: WorkfolderPath): void {
        const configurationFileLike = this.configurationFileService.getConfigurationFile(workfolderPath);
        this.restoreConfigPackageId(workfolderPath, configurationFileLike);
        const publishData = this.getPublishViewData(workfolderPath);
        const { packageId, version, status, previousVersion, labels } = publishData;
        this.disableDependentFields(true);
        if (packageId) {
            this.updatePackageIdDebounced(workfolderPath);
        }

        this.updateWebviewField(PublishFields.VERSION, version);
        this.updateWebviewField(PublishFields.STATUS, status);
        this.updateVersionPattern(publishData, status);

        const options = Array.from(new Set([PUBLISH_NO_PREVIOUS_VERSION, previousVersion])).filter((value) => !!value);
        this.updateWebviewOptions(PublishFields.PREVIOUS_VERSION, convertOptionsToDto(options, previousVersion));
        this.updateWebviewField(PublishFields.PREVIOUS_VERSION, previousVersion);
        this.updateWebviewLabels(labels);
    }

    private updateField(payload: WebviewPayload<PublishFields>): void {
        const workfolderPath = this.workfolderService.activeWorkfolderPath;
        const publishViewData = this.getPublishViewData(workfolderPath);
        switch (payload.field) {
            case PublishFields.PACKAGE_ID: {
                publishViewData.packageId = payload.value as PackageId;
                this.disableDependentFields(true);
                this.updatePackageIdDebounced(workfolderPath);
                break;
            }
            case PublishFields.VERSION: {
                const version = payload.value as VersionId;
                publishViewData.version = version;
                this.updateLabelsDebounced(publishViewData, version);
                break;
            }
            case PublishFields.STATUS: {
                const status: VersionStatus = payload.value as VersionStatus;
                publishViewData.status = status;
                this.updateVersionPattern(publishViewData, status);
                break;
            }
            case PublishFields.PREVIOUS_VERSION: {
                publishViewData.previousVersion = payload.value as string;
                break;
            }
            case PublishFields.LABELS: {
                const labels = publishViewData.labels;
                labels.add(payload.value as string);
                this.updateWebviewLabels(labels);
                break;
            }
        }
    }

    private disableDependentFields(disable: boolean = true): void {
        this.updateWebviewDisable(PublishFields.VERSION, disable);
        this.updateWebviewDisable(PublishFields.STATUS, disable);
        this.updateWebviewDisable(PublishFields.LABELS, disable);
        this.updateWebviewDisable(PublishFields.PREVIOUS_VERSION, disable);
        this.updateWebviewDisable(PublishFields.PUBLISH_BUTTON, disable);
    }

    private disableAllField(disable: boolean = true): void {
        this.updateWebviewDisable(PublishFields.PACKAGE_ID, disable);
        this.disableDependentFields(disable);
    }

    private requestField(payload: WebviewPayload<PublishFields>): void {
        switch (payload.field) {
            case PublishFields.PREVIOUS_VERSION: {
                this.wrapInProgress(async () => await this.loadPreviousVersions());
                break;
            }
        }
    }

    private restoreConfigPackageId(
        workfolderPath: WorkfolderPath,
        configFile: ConfigurationFileLike | undefined
    ): void {
        const publishViewData = this.getPublishViewData(workfolderPath);

        const newConfigFileId = configFile?.id ?? '';
        if (publishViewData.configId === newConfigFileId) {
            const { packageId } = publishViewData;
            this.updateWebviewPackageId(workfolderPath, packageId);
            return;
        }

        publishViewData.configId = newConfigFileId;
        const packageId: PackageId = configFile?.packageId ?? '';
        publishViewData.packageId = packageId;
        this.updateWebviewPackageId(workfolderPath, packageId);
    }

    private updateWebviewPackageId(workfolderPath: WorkfolderPath, packageId: PackageId): void {
        if (workfolderPath !== this.workfolderService.activeWorkfolderPath) {
            return;
        }
        this.updateWebviewField(PublishFields.PACKAGE_ID, packageId);
        this.disableDependentFields(true);
        if (packageId) {
            this.updatePackageIdDebounced(workfolderPath);
        }
    }

    private async loadPackageId(workfolderPath: WorkfolderPath): Promise<void> {
        const publishData = this.getPublishViewData(workfolderPath);
        const { packageId } = publishData;
        if (!packageId) {
            this.updateWebviewInvalid(PublishFields.PACKAGE_ID, true);
            return;
        }
        const { host, token } = await this.environmentStorageService.getEnvironment();
        if (!host || !token) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            return;
        }

        await this.crudService
            .getPackageId(host, token, packageId)
            .then((packageIdData: PublishViewPackageIdData) => {
                if (packageIdData.kind === 'package') {
                    return packageIdData;
                }
                const errorMessage = `Package Id does not exist`;
                window.showErrorMessage(errorMessage);
                throw new Error(errorMessage);
            })
            .then((packageIdData: PublishViewPackageIdData) => {
                publishData.releaseVersionPattern = packageIdData.releaseVersionPattern;
                const pattern = this.getPattern(publishData, publishData.status);
                this.updateWebviewPattern(PublishFields.VERSION, pattern);
                this.disableDependentFields(this.publishService.isPublishProgress || false);
                this.updateWebviewInvalid(PublishFields.PACKAGE_ID, false);
                this.wrapInProgress(async () => await this.loadPreviousVersions());
            })
            .catch((error) => {
                const crudError = error as CrudError;
                switch (crudError.status) {
                    case ABORTED_ERROR_CODE: {
                        break;
                    }
                    default: {
                        this.updateWebviewInvalid(PublishFields.PACKAGE_ID, true);
                    }
                }
            });
    }

    private async loadPreviousVersions(): Promise<void> {
        const { packageId, previousVersion } = this.getPublishViewData(this.workfolderService.activeWorkfolderPath);
        if (!packageId) {
            return;
        }
        const { host, token } = await this.environmentStorageService.getEnvironment();
        if (!host || !token) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            return;
        }
        const options = [PUBLISH_NO_PREVIOUS_VERSION];

        await this.crudService
            .getVersions(host, token, packageId)
            .then((dto) => options.push(...dto.versions.map((version) => splitVersion(version.version).version)))
            .catch();

        this.updateWebviewOptions(PublishFields.PREVIOUS_VERSION, convertOptionsToDto(options, previousVersion));
    }

    private updateVersionPattern(publishData: PublishViewData, status: VersionStatus): void {
        this.updateWebviewPattern(PublishFields.VERSION, this.getPattern(publishData, status));
    }

    private deleteWebviewLabels(label: string): void {
        const workfolderPath = this.workfolderService.activeWorkfolderPath;
        const { labels } = this.getPublishViewData(workfolderPath);
        labels.delete(label);
        this.updateWebviewField(PublishFields.LABELS, Array.from(labels));
    }

    private updateWebviewLabels(labels: Set<string>): void {
        this.updateWebviewField(PublishFields.LABELS, Array.from(labels));
    }

    private async updateLabels(data: PublishViewData, version: VersionId): Promise<void> {
        if (!version) {
            return;
        }
        const { packageId, labels } = data;
        if (!packageId || labels.size) {
            return;
        }
        const { host, token } = await this.environmentStorageService.getEnvironment();
        if (!host || !token) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            return;
        }
        await this.crudService
            .getLabels(host, token, packageId, version)
            .then((versions) => {
                versions.versions
                    .map((version) => version.versionLabels)
                    .flat()
                    .forEach((version) => labels.add(version));
                this.updateWebviewLabels(labels);
            })
            .catch();
    }

    private publish(): void {
        const workfolderPath = this.workfolderService.activeWorkfolderPath;
        const data = this.getPublishViewData(workfolderPath);
        const { packageId, version, previousVersion, status } = data;
        if (!packageId) {
            this.updateWebviewRequired(PublishFields.PACKAGE_ID);
            return;
        }
        if (!version) {
            this.updateWebviewRequired(PublishFields.VERSION);
            return;
        }
        const pattern = this.getPattern(data, status);
        const regexp = new RegExp(pattern);
        if (!regexp.test(version)) {
            return;
        }

        if (!previousVersion) {
            this.updateWebviewRequired(PublishFields.PREVIOUS_VERSION);
            return;
        }

        this.publishService.publish(this.workfolderService.activeWorkfolderPath, data);
    }

    private getPattern(publishData: PublishViewData, status: VersionStatus): string {
        switch (status) {
            case VersionStatus.ARCHIVED:
            case VersionStatus.DRAFT: {
                return PUBLISH_INPUT_DRAFT_PATTERN;
            }
            case VersionStatus.RELEASE: {
                const { releaseVersionPattern } = publishData;
                return releaseVersionPattern;
            }
        }
    }

    private getPublishViewData(workfolderPath: WorkfolderPath): PublishViewData {
        let publishData = this._publishViewData.get(workfolderPath);
        if (publishData) {
            return publishData;
        }
        publishData = new PublishViewData();
        this._publishViewData.set(workfolderPath, publishData);
        return publishData;
    }

    private wrapInProgress(callback: () => Promise<void>): void {
        window.withProgress(
            { location: { viewId: EXTENSION_PUBLISH_VIEW_NAME }, title: PUBLISH_LOADING_OPTION },
            async () => await callback()
        );
    }

    private getHtmlForWebview(webview: Webview): string {
        const extensionUri = this.context.extensionUri;

        const mainJsUrl = webview.asWebviewUri(getJsScript(extensionUri, MAIN_JS_PATH));
        const scriptUri = webview.asWebviewUri(getJsScript(extensionUri, PUBLISH_JS_PATH));
        const elementsUri = webview.asWebviewUri(getElements(extensionUri));
        const styleUri = webview.asWebviewUri(getStyle(extensionUri));
        const codiconsUri = webview.asWebviewUri(getCodicon(extensionUri));
        const nonce = getNonce();

        const statusOptions = PUBLISH_STATUSES.map(
            (data) => `<vscode-option value="${data}">${capitalize(data)}</vscode-option>`
        );

        return `
            <!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>APIHUB Publish view</title>
                <link href="${codiconsUri}" rel="stylesheet" id="vscode-codicon-stylesheet"/>
                <link href="${styleUri}" rel="stylesheet"/>
			</head>
			<body>
                <vscode-form-group variant="vertical">
                    <p>
                        <vscode-label for="${PublishFields.PACKAGE_ID}" required>Package Id:</vscode-label>
                        <vscode-textfield id="${PublishFields.PACKAGE_ID}" pattern=".{1,}"/>
                    </p>
                    <p>
                        <vscode-label for="${PublishFields.VERSION}" required>Version:</vscode-label>
                        <vscode-textfield id="${PublishFields.VERSION}" placeholder="${PUBLISH_INPUT_DRAFT_PATTERN}" pattern="${PUBLISH_INPUT_DRAFT_PATTERN}"/>
                    </p>
                    <p>
                        <vscode-label for="${PublishFields.STATUS}" required>Status:</vscode-label>
                        <vscode-single-select id="${PublishFields.STATUS}">${statusOptions}</vscode-single-select>
                    </p>
                    <p>
                        <vscode-label for="${PublishFields.LABELS}" id="labelForLabels">Labels:</vscode-label>
                        <vscode-textfield id="${PublishFields.LABELS}" placeholder="↵"></vscode-textfield>
                    </p>
                    <p>
                        <vscode-label for="${PublishFields.PREVIOUS_VERSION}" required>Previous release version:</vscode-label>
                        <vscode-single-select id="${PublishFields.PREVIOUS_VERSION}" combobox>
                            <vscode-option selected>${PUBLISH_NO_PREVIOUS_VERSION}</vscode-option>
                        </vscode-single-select>
                    </p>
                    <p>
                        <vscode-button class="publish-button" id="${PublishFields.PUBLISH_BUTTON}">Publish</vscode-button>
                    </p>
                </vscode-form-group>
                <script nonce="${nonce}"
                    src="${elementsUri}"
                    type="module"
                ></script>
                <script nonce="${nonce}" src="${mainJsUrl}"></script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>
            `;
    }
}
