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

import { bundle, BundleContext, Resolver } from 'api-ref-bundler';
import { promises as fs } from 'fs';
import { load } from 'js-yaml';
import path from 'path';

function getFileDirectory(filePath: string): string {
    return path.dirname(filePath) + path.sep;
}

export const bundledFileDataWithDependencies = async (
    filePath: string,
    onError: (message: string, ctx?: BundleContext) => void
): Promise<{ data?: object; dependencies: string[] }> => {
    const dependencies: string[] = [];
    const errors: string[] = [];

    const resolver: Resolver = async (sourcePath: string) => {
        if (sourcePath !== filePath) {
            dependencies.push(sourcePath);
        }

        const path = filePath === sourcePath ? sourcePath : getFileDirectory(filePath) + sourcePath;
        const data = await fs.readFile(path, 'utf8');

        try {
            return load(data) as object;
        } catch (error) {
            errors.push(String(error));
            return {};
        }
    };

    const bundledFileData = await bundle(filePath, resolver, { hooks: { onError } });
    const data = bundledFileData && Object.keys(bundledFileData).length ? bundledFileData : undefined;

    if (!data && errors.length) {
        onError(errors.join('\n'));
    }

    return { data, dependencies };
};
