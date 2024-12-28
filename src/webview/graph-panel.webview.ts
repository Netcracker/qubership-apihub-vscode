/**
 * Copyright 2024-2025 NetCracker Technology Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import { Disposable, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import { EXTENSION_NAME, EXTENSION_TITLE, WEBVIEW_INITIATED_EVENT } from '../common/constants/common.constants';
import { DataMessage, ErrorMessage, EventMessage, Message, MessageType } from '../common/models/message.model';
import { buildHtmlContent } from './html-content.builder';
import {
    SCHEMA_VIEW_INIT_JS_PATH,
    SCHEMA_VIEW_JS_FOLDER,
    TEMAPLTE_CSS_PATH,
    TEMAPLTE_FOLDER_PATH,
    TEMAPLTE_HTML_PATH
} from './path.constants';

export class GraphPanelWebview extends Disposable {
    private readonly _panel: WebviewPanel;
    private readonly _webviewReady: Promise<void>;
    private _webviewResolver: () => void;
    private _disposables: Disposable[] = [];

    constructor(
        extensionPath: string,
        title: string,
        private readonly _onDidDispose: () => void
    ) {
        super(() => this.dispose());

        this._webviewReady = new Promise((resolve) => (this._webviewResolver = resolve));

        this._panel = window.createWebviewPanel(EXTENSION_NAME, `${title} ${EXTENSION_TITLE}`, ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                Uri.file(path.join(extensionPath, SCHEMA_VIEW_JS_FOLDER)),
                Uri.file(path.join(extensionPath, path.normalize(TEMAPLTE_FOLDER_PATH)))
            ]
        });
        this._panel.onDidDispose(() => this.dispose(), this, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            (message: EventMessage) => {
                if (message.content === WEBVIEW_INITIATED_EVENT) {
                    this._webviewResolver();
                }
            },
            this,
            this._disposables
        );

        const scriptUri = this._panel.webview.asWebviewUri(
            Uri.file(path.join(extensionPath, path.normalize(SCHEMA_VIEW_INIT_JS_PATH)))
        );
        const cssUri = this._panel.webview.asWebviewUri(
            Uri.file(path.join(extensionPath, path.normalize(TEMAPLTE_CSS_PATH)))
        );
        const templatePath = path.join(extensionPath, path.normalize(TEMAPLTE_HTML_PATH));
        this._panel.webview.html = buildHtmlContent(templatePath, scriptUri, cssUri);
    }

    public dispose() {
        this._panel.dispose();
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];
        this._onDidDispose();
    }

    public reveal() {
        this._panel.reveal(ViewColumn.Two);
    }

    public postErrorMessage(content: string) {
        const message: ErrorMessage = {
            type: MessageType.ERROR,
            content
        };
        this.postWebviewMessage(message);
    }

    public postDataMessage(content: object) {
        const message: DataMessage = {
            type: MessageType.DATA,
            content
        };
        this.postWebviewMessage(message);
    }

    private postWebviewMessage<T>(message: Message<T>) {
        this._webviewReady.then(() => this._panel.webview.postMessage(message));
    }
}
