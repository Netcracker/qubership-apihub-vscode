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

import { WEBVIEW_INITIATED_EVENT } from './common/constants/common.constants';
import { DataMessage, ErrorMessage, MessageType } from './common/models/message.model';
import { SchemaGraphView } from './webview/schema-graph-view/schema-graph-view.container';

const vscode = acquireVsCodeApi();
const schemaGraphView = new SchemaGraphView();

window.addEventListener('message', (event: MessageEvent<DataMessage | ErrorMessage>) => {
    const { type, content } = event.data || {};

    switch (type) {
        case MessageType.DATA: {
            schemaGraphView.setSchemaGraphContent(content);
            break;
        }
        case MessageType.ERROR: {
            schemaGraphView.setErrorOverlay(content);
            break;
        }
    }
});

vscode.postMessage({ type: MessageType.EVENT, content: WEBVIEW_INITIATED_EVENT });
