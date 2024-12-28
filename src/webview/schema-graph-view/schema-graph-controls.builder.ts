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

import { OperationSection, OperationSectionPathItem } from './open-api-visitor/operation-structure.model';
import { getSectionTitle } from './open-api-visitor/operation-structure.utils';

function createOptionElement(value: string, title: string): HTMLOptionElement {
    const element = document.createElement('option');
    const content = document.createTextNode(title);

    element.value = value;
    element.appendChild(content);

    return element;
}

export function buildOperaitionOptionElements(sections: OperationSection[]): HTMLOptionElement[] {
    return sections.map((section) => {
        const { kind, code, mediaType, isSingleMediaType, scopeDeclarationPath } = section;

        return createOptionElement(
            scopeDeclarationPath.toString(),
            getSectionTitle(kind, code, mediaType, isSingleMediaType)
        );
    });
}

export function buildPathItemOptionElements(pathItems: OperationSectionPathItem[]): HTMLOptionElement[] {
    return pathItems.map((item) => {
        const { httpMethod, path, summary } = item;
        const id = `${path}-${httpMethod}`;

        return createOptionElement(id, `${summary ?? ''} (${httpMethod}) ${path}`);
    });
}
