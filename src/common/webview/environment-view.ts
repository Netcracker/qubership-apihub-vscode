import { CancellationToken, commands, ExtensionContext, Webview, WebviewView, WebviewViewResolveContext, window } from 'vscode';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import {
    ABORTED_ERROR_CODE,
    EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME,
    MAIN_JS_PATH
} from '../constants/common.constants';
import { ENVIRONMENT_JS_PATH } from '../constants/enviroment.constants';
import { CrudService, RequestNames } from '../cruds/crud.service';
import { CrudError } from '../models/common.model';
import {
    EnvironmentWebviewDto,
    EnvironmentWebviewFields,
    EnvironmentWebviewMessages
} from '../models/enviroment.model';
import { WebviewMessages, WebviewPayload } from '../models/webview.model';
import { WebviewBase } from './webview-base';
import { SecretStorageService } from '../services/secret-storage.service';

export class EnvironmentViewProvider extends WebviewBase<EnvironmentWebviewFields> {
    constructor(
        private readonly context: ExtensionContext,
        private readonly crudService: CrudService,
        private readonly secretStorageService: SecretStorageService
    ) {
        super();
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext<ExtensionContext>,
        _token: CancellationToken
    ): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data: EnvironmentWebviewDto) => {
            this.crudService.abort(RequestNames.GET_SYSTEM_INFO);
            this.cleanInvalidFields();
            switch (data.command) {
                case WebviewMessages.UPDATE_FIELD: {
                    this.updateField(data.payload as WebviewPayload<EnvironmentWebviewFields>);
                    break;
                }
                case WebviewMessages.REQUEST_FIELD: {
                    this.requestField(data.payload as WebviewPayload<EnvironmentWebviewFields>);
                    break;
                }
                case EnvironmentWebviewMessages.TEST_CONNECTION: {
                    this.testConnection();
                    break;
                }
            }
        });
        this._disposables.push(
            commands.registerCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME, () => {
                webviewView.show();
                this.updateWebviewRequired(EnvironmentWebviewFields.URL);
                this.updateWebviewRequired(EnvironmentWebviewFields.TOKEN);
            })
        );
    }

    private async testConnection(): Promise<void> {
        this.cleanInvalidFields();
        this.setLoadingTestConnection();

        const host = await this.secretStorageService.getHost();
        const token = await this.secretStorageService.getToken();

        await this.crudService
            .getSystemInfo(host, token)
            .then(() => this.setSuccessfulTestConnection())
            .catch((error) => {
                const crudError = error as CrudError;
                switch (crudError.status) {
                    case ABORTED_ERROR_CODE: {
                        break;
                    }
                    case 401: {
                        this.updateWebviewInvalid(EnvironmentWebviewFields.TOKEN);
                        this.setFailureTestConnection();
                        break;
                    }
                    default: {
                        this.updateWebviewInvalid(EnvironmentWebviewFields.URL);
                        this.setFailureTestConnection();
                        break;
                    }
                }
            });
    }

    private async updateField(payload: WebviewPayload<EnvironmentWebviewFields>): Promise<void> {
        switch (payload.field) {
            case EnvironmentWebviewFields.URL: {
                const host = (payload.value as string)?.trim();
                let normalizedUrl = '';
                let isValid = true;
                try {
                    normalizedUrl = new URL(host).origin;
                } catch {
                    isValid = false;
                }
                this.secretStorageService.setHost(normalizedUrl);

                this.updateWebviewInvalid(EnvironmentWebviewFields.URL, !isValid || !host?.length);
                break;
            }
            case EnvironmentWebviewFields.TOKEN: {
                const token = (payload.value as string)?.trim();
                this.secretStorageService.setToken(token ?? '');

                this.updateWebviewRequired(EnvironmentWebviewFields.TOKEN);
                break;
            }
        }
    }

    private requestField(payload: WebviewPayload<EnvironmentWebviewFields>): void {
        switch (payload.field) {
            case EnvironmentWebviewFields.URL: {
                this.requestHost();
                break;
            }
            case EnvironmentWebviewFields.TOKEN: {
                this.requestToken();
                break;
            }
        }
    }

    private async requestHost(): Promise<void> {
        const host: string = await this.secretStorageService.getHost();
        this.updateWebviewField(EnvironmentWebviewFields.URL, host);
    }

    private async requestToken(): Promise<void> {
        const token: string = (await this.secretStorageService.getToken()) ?? '';
        this.updateWebviewField(EnvironmentWebviewFields.TOKEN, token);
    }

    private cleanTestConnection(): void {
        this.updateWebviewIcon(EnvironmentWebviewFields.TEST_CONNECTION_ICON, '');
        this.updateWebviewSpin(EnvironmentWebviewFields.TEST_CONNECTION_ICON, false);
    }

    private cleanInvalidFields(): void {
        this.cleanTestConnection();
        this.updateWebviewInvalid(EnvironmentWebviewFields.TOKEN, false);
        this.updateWebviewInvalid(EnvironmentWebviewFields.URL, false);
    }

    private setSuccessfulTestConnection(): void {
        this.cleanTestConnection();
        this.updateWebviewIcon(EnvironmentWebviewFields.TEST_CONNECTION_ICON, 'check');
    }

    private setLoadingTestConnection(): void {
        this.cleanTestConnection();
        this.updateWebviewIcon(EnvironmentWebviewFields.TEST_CONNECTION_ICON, 'loading');
        this.updateWebviewSpin(EnvironmentWebviewFields.TEST_CONNECTION_ICON);
    }

    private setFailureTestConnection(): void {
        this.cleanTestConnection();
        this.updateWebviewIcon(EnvironmentWebviewFields.TEST_CONNECTION_ICON, 'close');
    }

    private getHtmlForWebview(webview: Webview): string {
        const extensionUri = this.context.extensionUri;

        const mainJsUrl = webview.asWebviewUri(getJsScript(extensionUri, MAIN_JS_PATH));
        const scriptUri = webview.asWebviewUri(getJsScript(extensionUri, ENVIRONMENT_JS_PATH));
        const styleUri = webview.asWebviewUri(getStyle(extensionUri));
        const elementsUri = webview.asWebviewUri(getElements(extensionUri));
        const codiconsUri = webview.asWebviewUri(getCodicon(extensionUri));
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>APIHUB Enviroment view</title>
                <link href="${codiconsUri}" rel="stylesheet" id="vscode-codicon-stylesheet"/>
                <link href="${styleUri}" rel="stylesheet"/>
            </head>
            <body>
                <vscode-form-group variant="vertical">
                    <p>
                        <vscode-label for="${EnvironmentWebviewFields.URL}" required>APIHUB URL:</vscode-label>
                        <vscode-textfield id="${EnvironmentWebviewFields.URL}"/>
                    </p>
                    <p>
                        <vscode-label for="${EnvironmentWebviewFields.TOKEN}" required>Authentication Token:</vscode-label>
                        <vscode-textfield id="${EnvironmentWebviewFields.TOKEN}" type="password">
                            <vscode-icon
                                id="eye-icon"
                                slot="content-after"
                                name="eye"
                                title="clear-all"
                                action-icon
                            ></vscode-icon>
                        </vscode-textfield>
                    </p>
                    <p class="environment-connection">
                        <a href="" id="${EnvironmentWebviewFields.TEST_CONNECTION_BUTTON}">Test Connection</a>
                        <vscode-icon class='environment-connection-icon' id="${EnvironmentWebviewFields.TEST_CONNECTION_ICON}"></vscode-icon>
                    </p>
                </vscode-form-group>
                <script nonce="${nonce}"
                    src="${elementsUri}"
                    type="module"
                ></script>
                <script nonce="${nonce}" src="${mainJsUrl}"></script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
        </html>`;
    }
}
