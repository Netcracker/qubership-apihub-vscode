import {
    CancellationToken,
    commands,
    ExtensionContext,
    Webview,
    WebviewView,
    WebviewViewResolveContext,
    window
} from 'vscode';
import { splitVersion } from '../../utils/files.utils';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import { capitalize } from '../../utils/path.utils';
import { convertOptionsToDto } from '../../utils/publishing.utils';
import {
    ABORTED_ERROR_CODE,
    EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME,
    EXTENSION_PUBLISH_VIEW_NAME,
    MAIN_JS_PATH
} from '../constants/common.constants';
import {
    PUBLISHING_INPUT_DRAFT_PATTERN,
    PUBLISHING_JS_PATH,
    PUBLISHING_LOADING_OPTION,
    PUBLISHING_NO_PREVIOUS_VERSION,
    PUBLISHING_STATUSES,
    PUBLISHING_WEBVIEW
} from '../constants/publishing.constants';
import { CrudService } from '../cruds/crud.service';
import { CrudError, WorkfolderPath } from '../models/common.model';
import { ConfigurationFileLike } from '../models/configuration.model';
import {
    PackageId,
    PublishingFields,
    PublishingViewData,
    PublishingViewPackageIdData,
    PublishingWebviewDto,
    PublishingWebviewMessages,
    VersionId,
    VersionStatus
} from '../models/publishing.model';
import { WebviewMessages, WebviewPayload } from '../models/webview.model';
import { ConfigurationFileService } from '../services/configuration-file.service';
import { EnvironmentStorageService } from '../services/environment-storage.service';
import { PublishingService } from '../services/publishing.service';
import { WorkspaceService } from '../services/workspace.service';
import { WebviewBase } from './webview-base';
import { debounce } from '../../utils/common.utils';

export class PublishingViewProvider extends WebviewBase<PublishingFields> {
    private readonly _publishingViewData: Map<WorkfolderPath, PublishingViewData> = new Map();
    private readonly updateLabelsDebounced = debounce((data: PublishingViewData, version: VersionId) =>
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
        private readonly publishingService: PublishingService
    ) {
        super(() => this.dispose());
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken
    ): Thenable<void> | void {
        this._view = webviewView;
        this.initializeWebview(webviewView);
        this.activate(true);
    }

    public dispose(): void {
        super.dispose();
        this.workfolderService.unsubscribe(PUBLISHING_WEBVIEW);
        this.configurationFileService.unsubscribe(PUBLISHING_WEBVIEW);
    }

    private initializeWebview(webviewView: WebviewView): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.onDidChangeVisibility(() => {
            this.activate(this._view?.visible ?? false);
        });
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

        this._view.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this), this, this._disposables);

        this.workfolderService.subscribe(PUBLISHING_WEBVIEW, (workfolderPath) => this.restoreLocalFields(workfolderPath));

        this.configurationFileService.subscribe(PUBLISHING_WEBVIEW, (workfolderPath) => {
            const configFile = this.configurationFileService.getConfigurationFile(workfolderPath);
            this.restoreConfigPackageId(workfolderPath, configFile);
        });

        this.environmentStorageService.onDidChangeConfiguration(
            () => {
                this.disableDependentFields();
                this.loadPackageId(this.workfolderService.activeWorkfolderPath);
            },
            this,
            this._disposables
        );

        this.publishingService.onPublish(
            (isPublishingProgress) => {
                this.disableAllFields(isPublishingProgress);
                if (!isPublishingProgress) {
                    this.wrapInProgress(async () => await this.loadPreviousVersions());
                }
            },
            this,
            this._disposables
        );

        this.disableAllFields(this.publishingService.isPublishingProgress);
    }

    private handleWebviewMessage(message: PublishingWebviewDto): void {
        switch (message.command) {
            case PublishingWebviewMessages.PUBLISH:
                this.publish();
                break;
            case WebviewMessages.UPDATE_FIELD:
                this.updateField(message.payload as WebviewPayload<PublishingFields>);
                break;
            case WebviewMessages.REQUEST_OPTIONS:
                this.requestField(message.payload as WebviewPayload<PublishingFields>);
                break;
            case WebviewMessages.DELETE:
                this.deleteWebviewLabels((message.payload as WebviewPayload<PublishingFields>).value as string);
                break;
        }
    }

    private restoreLocalFields(workfolderPath: WorkfolderPath): void {
        const configurationFileLike = this.configurationFileService.getConfigurationFile(workfolderPath);
        this.restoreConfigPackageId(workfolderPath, configurationFileLike);
        const publishingData = this.getPublishingViewData(workfolderPath);
        const { packageId, version, status, previousVersion, labels } = publishingData;
        this.disableDependentFields(true);
        if (packageId) {
            this.updatePackageIdDebounced(workfolderPath);
        }

        this.updateWebviewField(PublishingFields.VERSION, version);
        this.updateWebviewField(PublishingFields.STATUS, status);
        this.updateVersionPattern(publishingData, status);

        const options = Array.from(new Set([PUBLISHING_NO_PREVIOUS_VERSION, previousVersion])).filter((value) => !!value);
        this.updateWebviewOptions(PublishingFields.PREVIOUS_VERSION, convertOptionsToDto(options, previousVersion));
        this.updateWebviewField(PublishingFields.PREVIOUS_VERSION, previousVersion);
        this.updateWebviewLabels(labels);
    }

    private updateField(payload: WebviewPayload<PublishingFields>): void {
        const workfolderPath = this.workfolderService.activeWorkfolderPath;
        const publishingViewData = this.getPublishingViewData(workfolderPath);
        switch (payload.field) {
            case PublishingFields.PACKAGE_ID: {
                publishingViewData.packageId = payload.value as PackageId;
                this.disableDependentFields(true);
                this.updatePackageIdDebounced(workfolderPath);
                break;
            }
            case PublishingFields.VERSION: {
                const version = payload.value as VersionId;
                publishingViewData.version = version;
                this.updateLabelsDebounced(publishingViewData, version);
                break;
            }
            case PublishingFields.STATUS: {
                const status: VersionStatus = payload.value as VersionStatus;
                publishingViewData.status = status;
                this.updateVersionPattern(publishingViewData, status);
                break;
            }
            case PublishingFields.PREVIOUS_VERSION: {
                publishingViewData.previousVersion = payload.value as string;
                break;
            }
            case PublishingFields.LABELS: {
                const labels = publishingViewData.labels;
                labels.add(payload.value as string);
                this.updateWebviewLabels(labels);
                break;
            }
        }
    }

    private disableDependentFields(disable: boolean = true): void {
        const fields = [
            PublishingFields.VERSION,
            PublishingFields.STATUS,
            PublishingFields.LABELS,
            PublishingFields.PREVIOUS_VERSION,
            PublishingFields.PUBLISHING_BUTTON
        ];
        fields.forEach((field) => this.updateWebviewDisable(field, disable));
    }

    private disableAllFields(disable: boolean = true): void {
        this.updateWebviewDisable(PublishingFields.PACKAGE_ID, disable);
        this.disableDependentFields(disable);
    }

    private requestField(payload: WebviewPayload<PublishingFields>): void {
        switch (payload.field) {
            case PublishingFields.PREVIOUS_VERSION: {
                this.wrapInProgress(async () => await this.loadPreviousVersions());
                break;
            }
        }
    }

    private restoreConfigPackageId(
        workfolderPath: WorkfolderPath,
        configFile: ConfigurationFileLike | undefined
    ): void {
        const publishingViewData = this.getPublishingViewData(workfolderPath);

        const newConfigFileId = configFile?.id ?? '';
        if (publishingViewData.configId === newConfigFileId) {
            const { packageId } = publishingViewData;
            this.updateWebviewPackageId(workfolderPath, packageId);
            return;
        }

        publishingViewData.configId = newConfigFileId;
        const packageId: PackageId = configFile?.packageId ?? '';
        publishingViewData.packageId = packageId;
        this.updateWebviewPackageId(workfolderPath, packageId);
    }

    private updateWebviewPackageId(workfolderPath: WorkfolderPath, packageId: PackageId): void {
        if (workfolderPath !== this.workfolderService.activeWorkfolderPath) {
            return;
        }
        this.updateWebviewField(PublishingFields.PACKAGE_ID, packageId);
        this.disableDependentFields(true);
        if (packageId) {
            this.updatePackageIdDebounced(workfolderPath);
        }
    }

    private async loadPackageId(workfolderPath: WorkfolderPath): Promise<void> {
        const publishingData = this.getPublishingViewData(workfolderPath);
        const { packageId } = publishingData;
        if (!packageId) {
            this.updateWebviewInvalid(PublishingFields.PACKAGE_ID, true);
            return;
        }
        const { host, token } = await this.environmentStorageService.getEnvironment();
        if (!host || !token) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            return;
        }

        await this.crudService
            .getPackageId(host, token, packageId)
            .then((packageIdData: PublishingViewPackageIdData) => {
                if (packageIdData.kind === 'package') {
                    return packageIdData;
                }
                const errorMessage = `Package Id does not exist`;
                window.showErrorMessage(errorMessage);
                throw new Error(errorMessage);
            })
            .then((packageIdData: PublishingViewPackageIdData) => {
                publishingData.releaseVersionPattern = packageIdData.releaseVersionPattern;
                const pattern = this.getPattern(publishingData, publishingData.status);
                this.updateWebviewPattern(PublishingFields.VERSION, pattern);
                this.disableDependentFields(this.publishingService.isPublishingProgress || false);
                this.updateWebviewInvalid(PublishingFields.PACKAGE_ID, false);
                this.wrapInProgress(async () => await this.loadPreviousVersions());
            })
            .catch((error) => {
                const crudError = error as CrudError;
                switch (crudError.status) {
                    case ABORTED_ERROR_CODE: {
                        break;
                    }
                    default: {
                        this.updateWebviewInvalid(PublishingFields.PACKAGE_ID, true);
                    }
                }
            });
    }

    private async loadPreviousVersions(): Promise<void> {
        const { packageId, previousVersion } = this.getPublishingViewData(this.workfolderService.activeWorkfolderPath);
        if (!packageId) {
            return;
        }
        const { host, token } = await this.environmentStorageService.getEnvironment();
        if (!host || !token) {
            commands.executeCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME);
            return;
        }
        const options = [PUBLISHING_NO_PREVIOUS_VERSION];

        await this.crudService
            .getVersions(host, token, packageId)
            .then((dto) => options.push(...dto.versions.map((version) => splitVersion(version.version).version)))
            .catch();

        this.updateWebviewOptions(PublishingFields.PREVIOUS_VERSION, convertOptionsToDto(options, previousVersion));
    }

    private updateVersionPattern(publishingData: PublishingViewData, status: VersionStatus): void {
        this.updateWebviewPattern(PublishingFields.VERSION, this.getPattern(publishingData, status));
    }

    private deleteWebviewLabels(label: string): void {
        const workfolderPath = this.workfolderService.activeWorkfolderPath;
        const { labels } = this.getPublishingViewData(workfolderPath);
        labels.delete(label);
        this.updateWebviewField(PublishingFields.LABELS, Array.from(labels));
    }

    private updateWebviewLabels(labels: Set<string>): void {
        this.updateWebviewField(PublishingFields.LABELS, Array.from(labels));
    }

    private async updateLabels(data: PublishingViewData, version: VersionId): Promise<void> {
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
            .then((publishingVersionDto) => {
                publishingVersionDto.versions
                    .filter((publishingVersion) => splitVersion(publishingVersion.version).version === version)
                    .map((version) => version.versionLabels)
                    .flat()
                    .forEach((version) => labels.add(version));
                this.updateWebviewLabels(labels);
            })
            .catch();
    }

    private publish(): void {
        const workfolderPath = this.workfolderService.activeWorkfolderPath;
        const data = this.getPublishingViewData(workfolderPath);
        const { packageId, version, previousVersion, status } = data;
        if (!packageId) {
            this.updateWebviewRequired(PublishingFields.PACKAGE_ID);
            return;
        }
        if (!version) {
            this.updateWebviewRequired(PublishingFields.VERSION);
            return;
        }
        const pattern = this.getPattern(data, status);
        const regexp = new RegExp(pattern);
        if (!regexp.test(version)) {
            return;
        }

        if (!previousVersion) {
            this.updateWebviewRequired(PublishingFields.PREVIOUS_VERSION);
            return;
        }

        this.publishingService.publish(this.workfolderService.activeWorkfolderPath, data);
    }

    private getPattern(publishingData: PublishingViewData, status: VersionStatus): string {
        switch (status) {
            case VersionStatus.ARCHIVED:
            case VersionStatus.DRAFT: {
                return PUBLISHING_INPUT_DRAFT_PATTERN;
            }
            case VersionStatus.RELEASE: {
                const { releaseVersionPattern } = publishingData;
                return releaseVersionPattern;
            }
        }
    }

    private getPublishingViewData(workfolderPath: WorkfolderPath): PublishingViewData {
        let publishingData = this._publishingViewData.get(workfolderPath);
        if (publishingData) {
            return publishingData;
        }
        publishingData = new PublishingViewData();
        this._publishingViewData.set(workfolderPath, publishingData);
        return publishingData;
    }

    private wrapInProgress(callback: () => Promise<void>): void {
        window.withProgress(
            { location: { viewId: EXTENSION_PUBLISH_VIEW_NAME }, title: PUBLISHING_LOADING_OPTION },
            async () => await callback()
        );
    }

    private getHtmlForWebview(webview: Webview): string {
        const extensionUri = this.context.extensionUri;

        const mainJsUrl = webview.asWebviewUri(getJsScript(extensionUri, MAIN_JS_PATH));
        const scriptUri = webview.asWebviewUri(getJsScript(extensionUri, PUBLISHING_JS_PATH));
        const elementsUri = webview.asWebviewUri(getElements(extensionUri));
        const styleUri = webview.asWebviewUri(getStyle(extensionUri));
        const codiconsUri = webview.asWebviewUri(getCodicon(extensionUri));
        const nonce = getNonce();

        const statusOptions = PUBLISHING_STATUSES.map(
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
                        <vscode-label for="${PublishingFields.PACKAGE_ID}" required>Package Id:</vscode-label>
                        <vscode-textfield id="${PublishingFields.PACKAGE_ID}" pattern=".{1,}"/>
                    </p>
                    <p>
                        <vscode-label for="${PublishingFields.VERSION}" required>Version:</vscode-label>
                        <vscode-textfield id="${PublishingFields.VERSION}" placeholder="${PUBLISHING_INPUT_DRAFT_PATTERN}" pattern="${PUBLISHING_INPUT_DRAFT_PATTERN}"/>
                    </p>
                    <p>
                        <vscode-label for="${PublishingFields.STATUS}" required>Status:</vscode-label>
                        <vscode-single-select id="${PublishingFields.STATUS}">${statusOptions}</vscode-single-select>
                    </p>
                    <p>
                        <vscode-label for="${PublishingFields.LABELS}" id="labelForLabels">Labels:</vscode-label>
                        <vscode-textfield id="${PublishingFields.LABELS}" placeholder="↵"></vscode-textfield>
                    </p>
                    <p>
                        <vscode-label for="${PublishingFields.PREVIOUS_VERSION}" required>Previous release version:</vscode-label>
                        <vscode-single-select id="${PublishingFields.PREVIOUS_VERSION}" combobox>
                            <vscode-option selected>${PUBLISHING_NO_PREVIOUS_VERSION}</vscode-option>
                        </vscode-single-select>
                    </p>
                    <p>
                        <vscode-button class="publishing-button" id="${PublishingFields.PUBLISHING_BUTTON}">Publish</vscode-button>
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
