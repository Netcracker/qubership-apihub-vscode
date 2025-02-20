import {
    CancellationToken,
    ExtensionContext,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext
} from 'vscode';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import {
    ENVIRONMENT_JS_PATH,
    ENVIRONMENT_URL_PATTERN,
    EnvironmentWebviewMessages
} from '../constants/enviroment.constants';
import { EnvironmentWebviewTypes } from '../models/enviroment.model';
import { WebviewMessage } from '../models/webview.model';
import { configurationService } from '../services/configuration.service';
import { SecretStorageService } from '../services/secret-storage.service';

export class EnvironmentViewProvider implements WebviewViewProvider {
    public _view?: WebviewView;
    private readonly _context: ExtensionContext;
    private readonly _secretStorageService: SecretStorageService;

    constructor(readonly context: ExtensionContext, readonly secretStorageService: SecretStorageService) {
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

        webviewView.webview.onDidReceiveMessage(
            (data: WebviewMessage<EnvironmentWebviewMessages, EnvironmentWebviewTypes>) => {
                switch (data.command) {
                    case EnvironmentWebviewMessages.UDPATE_URL: {
                        this.updateHost(data.payload);
                        break;
                    }
                    case EnvironmentWebviewMessages.UPDATE_TOKEN: {
                        this.updateToken(data.payload);
                        break;
                    }
                    case EnvironmentWebviewMessages.REQUEST_URL: {
                        this.requestHost();
                        break;
                    }
                    case EnvironmentWebviewMessages.REQUEST_TOKEN: {
                        this.requestToken();
                        break;
                    }
                }
            }
        );
    }

    private updateHost(host: string): void {
        const fixedHost = host ? host.replace(/\/$/, '') : '';
        configurationService.hostUrl = fixedHost;
    }

    private updateToken(token: string): void {
        this._secretStorageService.storeToken(token ?? '');
    }

    private requestHost(): void {
        const host: string = configurationService.hostUrl ?? '';
        this.postMessage({
            command: EnvironmentWebviewMessages.UDPATE_URL,
            payload: host
        });
    }

    private async requestToken(): Promise<void> {
        const token: string = (await this._secretStorageService.getToken()) ?? '';
        this.postMessage({
            command: EnvironmentWebviewMessages.UPDATE_TOKEN,
            payload: token
        });
    }

    public postMessage(data: WebviewMessage<EnvironmentWebviewMessages, EnvironmentWebviewTypes>): void {
        this._view?.webview.postMessage(data);
    }

    private getHtmlForWebview(webview: Webview): string {
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
                        <vscode-label for="url" required>APIHUB URL:</vscode-label>
                        <vscode-textfield id="url" placeholder="${ENVIRONMENT_URL_PATTERN}" pattern="${ENVIRONMENT_URL_PATTERN}"/>
                    </p>
                    <p>
                        <vscode-label for="token" required>Authentication Token:</vscode-label>
                        <vscode-textfield id="token" type="password">
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
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
        </html>`;
    }
}
