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

import fs from 'fs';
import { TreeDataProvider, TreeItem, Uri, window } from 'vscode';
import { SpecificationItem } from './specification-item';
import { IGNORE_DIRS, OPENAPI_SPEC_KEY_REGEXP, SPECS_EXTENSIONS } from './specification.constants';

export class RootSpecificationsProvider implements TreeDataProvider<SpecificationItem> {
    constructor(private readonly workspaceRoot: string) {}

    getTreeItem(element: SpecificationItem): TreeItem {
        return element;
    }

    getChildren(): Thenable<SpecificationItem[]> {
        if (!this.workspaceRoot) {
            window.showInformationMessage('No specifications in empty workspace');
            return Promise.resolve([]);
        }

        if (this.pathExists(this.workspaceRoot)) {
            return Promise.resolve(this.readSpecificationFiles(this.workspaceRoot));
        } else {
            window.showInformationMessage(`Invalid path for ${this.workspaceRoot}`);
            return Promise.resolve([]);
        }
    }

    private readSpecificationFiles(dirPath: string): SpecificationItem[] {
        const specItems: SpecificationItem[] = [];
        const dirents = fs.readdirSync(dirPath, { withFileTypes: true });

        dirents.forEach((dirent) => {
            const { name, parentPath } = dirent;
            const path = `${parentPath}\\${name}`;

            if (dirent.isDirectory() && !IGNORE_DIRS.includes(name)) {
                specItems.push(...this.readSpecificationFiles(path));
            } else if (dirent.isFile() && this.isSpecificationFile(name, path)) {
                specItems.push(new SpecificationItem(name, Uri.file(path)));
            }
        });

        return specItems;
    }

    private isSpecificationFile(fileName: string, path: string): boolean {
        const extension = fileName.split('.').pop();
        if (SPECS_EXTENSIONS.includes(extension ?? '')) {
            return !!fs.readFileSync(path, 'utf8').match(OPENAPI_SPEC_KEY_REGEXP);
        }
        return false;
    }

    private pathExists(p: string): boolean {
        try {
            fs.accessSync(p);
        } catch {
            return false;
        }
        return true;
    }
}
