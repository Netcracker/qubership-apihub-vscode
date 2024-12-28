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

import { BundleContext } from 'api-ref-bundler';
import path from 'path';
import { ExtensionContext, TextDocument, Uri, ViewColumn, commands, window, workspace } from 'vscode';
import { OPEN_SPEC_COMMAND, SCHEMA_VIEW_INIT_COMMAND } from './common/constants/command.constants';
import { bundledFileDataWithDependencies } from './document/document.utils';
import { RootSpecificationsProvider } from './root-specifications-view/root-specifications.provider';
import { GraphPanelWebview } from './webview/graph-panel.webview';

export function activate(context: ExtensionContext) {
    const rootPath = workspace.workspaceFolders?.length ? workspace.workspaceFolders[0].uri.fsPath : undefined;
    if (rootPath) {
        context.subscriptions.push(
            commands.registerCommand(OPEN_SPEC_COMMAND, async (resource: Uri) => {
                await window.showTextDocument(resource, { viewColumn: ViewColumn.One });
                commands.executeCommand(SCHEMA_VIEW_INIT_COMMAND);
            })
        );
        window.createTreeView('root-specifications', {
            treeDataProvider: new RootSpecificationsProvider(rootPath)
        });
    }

    const disposableInit = commands.registerCommand(SCHEMA_VIEW_INIT_COMMAND, async () => {
        const document: TextDocument | undefined = window.activeTextEditor?.document;

        if (!document) {
            window.showInformationMessage('There is no active text file');
            return;
        }

        const onError = (message: string, ctx?: BundleContext) => {
            if (graphPanel && !ctx) {
                graphPanel.postErrorMessage(message);
            }
            window.showErrorMessage(message);
            console.error(message, ctx);
        };

        const { data } = await bundledFileDataWithDependencies(document.fileName, onError);

        if (!data) return;

        let graphPanel: GraphPanelWebview | undefined;

        const disposableSave = workspace.onDidSaveTextDocument(async (event) => {
            if (document.uri.path !== event.uri.path) return;

            const { data } = await bundledFileDataWithDependencies(document.fileName, onError);

            if (graphPanel && data) {
                graphPanel.postDataMessage(data);
            }
        });

        context.subscriptions.push(disposableSave);

        if (graphPanel) {
            graphPanel.postDataMessage(data);
            graphPanel.reveal();
        } else {
            graphPanel = new GraphPanelWebview(context.extensionPath, path.basename(document.fileName), () => {
                graphPanel = undefined;
                disposableSave.dispose();
            });
            graphPanel.postDataMessage(data);

            context.subscriptions.push(graphPanel);
        }
    });

    context.subscriptions.push(disposableInit);
}

export function deactivate() {}
