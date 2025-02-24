import {
    CancellationToken,
    commands,
    Disposable,
    ExtensionContext,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext
} from 'vscode';
import {  debounce, splitVersion } from '../../utils/files.utils';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import { showErrorNotification } from '../../utils/notification.urils';
import { EXTENSION_PUBLISH_VIEW_PUBLISH_ACTION_NAME } from '../constants/common.constants';
import {
    PUBLISH_INPUT_DRAFT_PATTERN,
    PUBLISH_INPUT_RELEASE_PATTERN,
    PUBLISH_JS_PATH,
    PUBLISH_NO_PREVIOUS_VERSION,
    PUBLISH_STATUSES,
    PUBLISH_WEBVIEW
} from '../constants/publish.constants';
import { CrudService } from '../cruds/publish.crud';
import { WorkfolderPath } from '../models/common.model';
import { ConfigurationFileLike } from '../models/configuration.model';
import {
    PackageId,
    PublishDto,
    PublishFields,
    PublishViewData,
    PublishWebviewDto,
    PublishWebviewMessages,
    PublishWebviewPayload,
    VersionId,
    VersionStatus
} from '../models/publish.model';
import { ConfigurationFileService } from '../services/configuration-file.service';
import { configurationService } from '../services/configuration.service';
import { SecretStorageService } from '../services/secret-storage.service';
import { WorkspaceService } from '../services/workspace.service';
import { capitalize } from '../../utils/path.utils';

export class PublishViewProvider extends Disposable implements WebviewViewProvider {
    private _view?: WebviewView;
    private _disposables: Disposable[] = [];
    private readonly _crudService: CrudService;
    private readonly _publishViewData: Map<WorkfolderPath, PublishViewData> = new Map();
    private readonly debouncedUpdateLabels = debounce((data, version)=>this.updateLabels(data, version));

    constructor(
        private readonly context: ExtensionContext,
        private readonly workfolderPaths: WorkfolderPath[],
        private readonly secretStorageService: SecretStorageService,
        private readonly configurationFileService: ConfigurationFileService,
        private readonly workfolderService: WorkspaceService
    ) {
        super(() => this.dispose());
        this._crudService = new CrudService();
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        this._view.onDidChangeVisibility(() => {
            if (!this._view) {
                return;
            }
            this.activate(this._view.visible);
        });

        this.workfolderPaths.forEach((workfolderPath) => {
            const configFile: ConfigurationFileLike | undefined =
                this.configurationFileService.getConfigurationFile(workfolderPath);
            this.restoreConfigPackageId(workfolderPath, configFile);
        });

        this.activate(true);
    }

    private activate(active: boolean): void {
        if (active) {
            this.subscribeChanges();
            this.restoreLocalFields(this.workfolderService.activeWorkfolderPath);
        } else {
            this.dispose();
        }
    }

    public dispose() {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
        this.workfolderService.unsubscribe(PUBLISH_WEBVIEW);
        this.configurationFileService.unsubscribe(PUBLISH_WEBVIEW);
    }

    private subscribeChanges(): void {
        if (!this._view) {
            return;
        }
        this._view.webview.onDidReceiveMessage(
            (message: PublishWebviewDto) => {
                switch (message.command) {
                    case PublishWebviewMessages.PUBLISH: {
                        this.publish(message.payload as PublishDto);
                        break;
                    }
                    case PublishWebviewMessages.UPDATE_FIELD: {
                        this.updateField(message.payload as PublishWebviewPayload);
                        break;
                    }
                    case PublishWebviewMessages.REQUEST_VERSIONS: {
                        this.loadVersions();
                        break;
                    }
                    case PublishWebviewMessages.DELETE: {
                        this.deleteWebviewLabels((message.payload as PublishWebviewPayload).value as string);
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
    }

    private restoreLocalFields(workfolderPath: WorkfolderPath): void {
        this.restoreConfigPackageId(workfolderPath, this.configurationFileService.getConfigurationFile(workfolderPath));
        const { version, status, previousVersion, labels } = this.getPublishViewData(workfolderPath);

        this.updateWebviewField(PublishFields.VERSION, version);
        this.updateWebviewField(PublishFields.STATUS, status);
        this.updateVersionPattern(status);

        const options = Array.from(new Set([PUBLISH_NO_PREVIOUS_VERSION, previousVersion])).filter((value) => !!value);
        this.updateWebviewOptions(PublishFields.PREVIOUS_VERSION, options);
        this.updateWebviewField(PublishFields.PREVIOUS_VERSION, previousVersion);
        this.updateWebviewLabels(labels);
    }

    private updateField(payload: PublishWebviewPayload): void {
        const workfolderPath = this.workfolderService.activeWorkfolderPath;
        const pulbishViewData = this.getPublishViewData(workfolderPath);
        switch (payload.field) {
            case PublishFields.PACKAGE_ID: {
                pulbishViewData.packageId = payload.value as PackageId;
                break;
            }
            case PublishFields.VERSION: {
                const version = payload.value as VersionId;
                pulbishViewData.version = version;
                this.debouncedUpdateLabels(pulbishViewData, version);
                break;
            }
            case PublishFields.STATUS: {
                const status: VersionStatus = payload.value as VersionStatus;
                pulbishViewData.status = status;
                this.updateVersionPattern(status);
                break;
            }
            case PublishFields.PREVIOUS_VERSION: {
                pulbishViewData.previousVersion = payload.value as string;
                break;
            }
            case PublishFields.LABELS: {
                const labels = pulbishViewData.labels;
                labels.add(payload.value as string);
                this.updateWebviewLabels(labels);
                break;
            }
        }
    }

    private restoreLocalPackageId(workfolderPath: WorkfolderPath): void {
        const { packageId } = this.getPublishViewData(workfolderPath);
        this.updatePacakgeId(workfolderPath, packageId);
    }

    private restoreConfigPackageId(
        workfolderPath: WorkfolderPath,
        configFile: ConfigurationFileLike | undefined
    ): void {
        const pulbishViewData = this.getPublishViewData(workfolderPath);

        const newConfigFileId = configFile?.id ?? '';
        if (pulbishViewData.configId === newConfigFileId) {
            this.restoreLocalPackageId(workfolderPath);
            return;
        }

        pulbishViewData.configId = newConfigFileId;
        const pacakgeId: PackageId = configFile?.pacakgeId ?? '';
        this.updatePacakgeId(workfolderPath, pacakgeId);
    }

    private updatePacakgeId(workfolderPath: WorkfolderPath, value: PackageId): void {
        const pulbishViewData = this.getPublishViewData(workfolderPath);
        pulbishViewData.packageId = value;

        if (workfolderPath === this.workfolderService.activeWorkfolderPath) {
            this.updateWebviewField(PublishFields.PACKAGE_ID, value);
        }
    }

    public showLoading(): void {
        this.updateWebviewLoading(true);
    }

    public hideLoading(): void {
        this.updateWebviewLoading(false);
    }

    private updateWebviewLoading(isLoading: boolean): void {
        this.updateWebview(PublishWebviewMessages.UPDATE_FIELD, PublishFields.PUBLISH_BUTTON, isLoading.toString());
    }

    private updateWebviewField(field: PublishFields, value: string | string[]): void {
        this.updateWebview(PublishWebviewMessages.UPDATE_FIELD, field, value);
    }

    private updateWebviewOptions(field: PublishFields, value: string[]): void {
        this.updateWebview(PublishWebviewMessages.UPDATE_OPTIONS, field, value);
    }

    private updateWebviewPattern(field: PublishFields, value: string): void {
        this.updateWebview(PublishWebviewMessages.UPDATE_PATTERN, field, value);
    }

    private updateWebview(command: PublishWebviewMessages, field: PublishFields, value: string | string[]): void {
        this._view?.webview.postMessage({
            command: command,
            payload: {
                field,
                value
            }
        });
    }

    private async loadVersions(): Promise<void> {
        const { packageId } = this.getPublishViewData(this.workfolderService.activeWorkfolderPath);
        if (!packageId) {
            showErrorNotification('Packag ID is empty');
            return;
        }
        const host: string = configurationService.hostUrl ?? '';
        const token: string = (await this.secretStorageService.getToken()) ?? '';
        if (!host || !token) {
            showErrorNotification('Host or token is empty');
            return;
        }
        const options = [PUBLISH_NO_PREVIOUS_VERSION];
        try {
            const versions = await this._crudService.getVersions(host, token, packageId);
            options.push(...versions.versions.map((ver) => splitVersion(ver.version).version));
        } catch (error) {}

        this.updateWebviewOptions(PublishFields.PREVIOUS_VERSION, options);
    }

    private updateVersionPattern(status: VersionStatus): void {
        switch (status) {
            case VersionStatus.ARCHIVED:
            case VersionStatus.DRAFT: {
                this.updateWebviewPattern(PublishFields.VERSION, PUBLISH_INPUT_DRAFT_PATTERN);
                break;
            }
            case VersionStatus.RELEASE: {
                this.updateWebviewPattern(PublishFields.VERSION, PUBLISH_INPUT_RELEASE_PATTERN);
                break;
            }
        }
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
        const host: string = configurationService.hostUrl ?? '';
        const token: string = (await this.secretStorageService.getToken()) ?? '';
        if (!host || !token) {
            showErrorNotification('Host or token is empty');
            return;
        }
        try {
            const versions = await this._crudService.getLabels(host, token, packageId, version);
            versions.versions
                .map((version) => version.versionLabels)
                .flat()
                .forEach((version) => labels.add(version));
            this.updateWebviewLabels(labels);
        } catch (error) {}
    }

    private publish(dto: PublishDto): void {
        commands.executeCommand(EXTENSION_PUBLISH_VIEW_PUBLISH_ACTION_NAME, dto);
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

    private getHtmlForWebview(webview: Webview): string {
        const scriptUri = webview.asWebviewUri(getJsScript(this.context.extensionUri, PUBLISH_JS_PATH));
        const elementsUri = webview.asWebviewUri(getElements(this.context.extensionUri));
        const styleUri = webview.asWebviewUri(getStyle(this.context.extensionUri));
        const codiconsUri = webview.asWebviewUri(getCodicon(this.context.extensionUri));
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
                        <vscode-label for="packageId" required>Package:</vscode-label>
                        <vscode-textfield id="packageId" pattern="{1,}"/>
                    </p>
                    <p>
                        <vscode-label for="version" required>Version:</vscode-label>
                        <vscode-textfield id="version" placeholder="${PUBLISH_INPUT_DRAFT_PATTERN}" pattern="${PUBLISH_INPUT_DRAFT_PATTERN}"/>
                    </p>
                    <p>
                        <vscode-label for="status" required>Status:</vscode-label>
                        <vscode-single-select id="status">${statusOptions}</vscode-single-select>
                    </p>
                    <p>
                        <vscode-label for="labels" id="labelForLables">Labels:</vscode-label>
                        <vscode-textfield id="labels" placeholder="↵"></vscode-textfield>
                    </p>
                    <p>
                        <vscode-label for="previousVersion" required>Previous release version:</vscode-label>
                        <vscode-single-select id="previousVersion" combobox>
                            <vscode-option>${PUBLISH_NO_PREVIOUS_VERSION}</vscode-option>
                        </vscode-single-select>
                    </p>
                    <p>
                        <vscode-button class="publish-button" id="publish-button">Publish</vscode-button>
                    </p>
                </vscode-form-group>
                <script nonce="${nonce}"
                    src="${elementsUri}"
                    type="module"
                ></script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>
            `;
    }
}
