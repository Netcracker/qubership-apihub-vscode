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

import { TreeItem, Uri } from 'vscode';
import { OPEN_SPEC_COMMAND } from '../common/constants/command.constants';

export class SpecificationItem extends TreeItem {
    constructor(
        public readonly label: string,
        private readonly uri: Uri
    ) {
        super(uri);
        this.tooltip = this.label;
        this.command = {
            command: OPEN_SPEC_COMMAND,
            title: 'Open Specification',
            arguments: [this.uri]
        };
    }
}
