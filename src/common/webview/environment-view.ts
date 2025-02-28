import { CancellationToken, commands, ExtensionContext, Webview, WebviewView, WebviewViewResolveContext } from 'vscode';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import { EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME, MAIN_JS_PATH } from '../constants/common.constants';
import { ENVIRONMENT_JS_PATH } from '../constants/enviroment.constants';
import { EnvironmentWebviewFields } from '../models/enviroment.model';
import { WebviewMessage, WebviewMessages, WebviewPayload, WebviewPayloadType } from '../models/webview.model';
import { configurationService } from '../services/configuration.service';
import { SecretStorageService } from '../services/secret-storage.service';
import { WebviewBase } from './webview-base';

export class EnvironmentViewProvider extends WebviewBase<EnvironmentWebviewFields> {
    private readonly _context: ExtensionContext;
    private readonly _secretStorageService: SecretStorageService;

    constructor(readonly context: ExtensionContext, readonly secretStorageService: SecretStorageService) {
        super();
        this._context = context;
        this._secretStorageService = secretStorageService;
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext<ExtensionContext>,
        _token: CancellationToken
    ): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data: WebviewMessage<WebviewMessages, WebviewPayloadType>) => {
            switch (data.command) {
                case WebviewMessages.UPDATE_FIELD: {
                    this.updateField(data.payload as WebviewPayload<EnvironmentWebviewFields>);
                    break;
                }
                case WebviewMessages.REQUEST_FIELD: {
                    this.requestField(data.payload as WebviewPayload<EnvironmentWebviewFields>);
                    break;
                }
            }
        });
        this._disposables.push(
            commands.registerCommand(EXTENSION_ENVIRONMENT_VIEW_VALIDATION_ACTION_NAME, () => {
                this.updateWebviewRequired(EnvironmentWebviewFields.URL);
                this.updateWebviewRequired(EnvironmentWebviewFields.TOKEN);
            })
        );
    }

    private updateField(payload: WebviewPayload<EnvironmentWebviewFields>): void {
        switch (payload.field) {
            case EnvironmentWebviewFields.URL: {
                const host = payload.value as string;
                const fixedHost = host ? host.replace(/\/$/, '') : '';
                configurationService.hostUrl = fixedHost;
                break;
            }
            case EnvironmentWebviewFields.TOKEN: {
                this._secretStorageService.storeToken(payload.value as string ?? '');
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

    private requestHost(): void {
        const host: string = configurationService.hostUrl ?? '';
        this.updateWebviewField(EnvironmentWebviewFields.URL, host);
    }

    private async requestToken(): Promise<void> {
        const token: string = (await this._secretStorageService.getToken()) ?? '';
        this.updateWebviewField(EnvironmentWebviewFields.TOKEN, token);
    }

    private getHtmlForWebview(webview: Webview): string {
        const mainJsUrl = webview.asWebviewUri(getJsScript(this.context.extensionUri, MAIN_JS_PATH));
        const scriptUri = webview.asWebviewUri(getJsScript(this._context.extensionUri, ENVIRONMENT_JS_PATH));
        const styleUri = webview.asWebviewUri(getStyle(this._context.extensionUri));
        const elementsUri = webview.asWebviewUri(getElements(this._context.extensionUri));
        const codiconsUri = webview.asWebviewUri(getCodicon(this._context.extensionUri));
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
