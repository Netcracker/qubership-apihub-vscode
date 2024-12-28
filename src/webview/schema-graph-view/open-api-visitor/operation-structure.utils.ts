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

import {
    OPEN_API_SECTION_PARAMETERS,
    OPEN_API_SECTION_REQUESTS,
    OPEN_API_SECTION_RESPONSES
} from './operation-structure.constants';
import {
    MediaType,
    OpenApiVisitorData,
    OpenApiVisitorDataWithSection,
    OperationSection,
    OperationSectionPathItem,
    ResponseCode
} from './operation-structure.model';

function sortModels(models: OpenApiVisitorData[]): OpenApiVisitorData[] {
    return models.sort((model1, model2) => model1.title.localeCompare(model2.title));
}

export function flatResponses(
    responses: Record<ResponseCode, Record<MediaType, OpenApiVisitorDataWithSection>>
): OperationSection[] {
    const result: OperationSection[] = [];
    Object.entries(responses).forEach(([code, response]) => {
        Object.entries(response).forEach(([mediaType, content]) => {
            result.push({
                sectionKey: `response-${code}-${mediaType}`,
                kind: OPEN_API_SECTION_RESPONSES,
                code: code,
                mediaType: mediaType,
                isSingleMediaType: Object.keys(response).length === 1,
                scopeDeclarationPath: content.scopeDeclarationPath,
                declarationPath: content.declarationPath,
                models: sortModels(content.data)
            });
        });
    });
    return result;
}

export function flatRequests(responses: Record<MediaType, OpenApiVisitorDataWithSection>): OperationSection[] {
    const result: OperationSection[] = [];
    Object.entries(responses).forEach(([mediaType, content]) => {
        result.push({
            sectionKey: `request-${mediaType}`,
            kind: OPEN_API_SECTION_REQUESTS,
            mediaType: mediaType,
            isSingleMediaType: Object.keys(responses).length === 1,
            scopeDeclarationPath: content.scopeDeclarationPath,
            declarationPath: content.declarationPath,
            models: sortModels(content.data)
        });
    });
    return result;
}

export function getSectionTitle(
    kind: typeof OPEN_API_SECTION_PARAMETERS | typeof OPEN_API_SECTION_REQUESTS | typeof OPEN_API_SECTION_RESPONSES,
    code?: ResponseCode,
    mediaType?: MediaType,
    isSingleMediaType?: boolean
): string {
    if (kind === OPEN_API_SECTION_PARAMETERS) {
        return 'Parameters';
    }
    if (kind === OPEN_API_SECTION_REQUESTS) {
        return `Requests ${!isSingleMediaType ? `(${mediaType})` : ''}`;
    }
    if (kind === OPEN_API_SECTION_RESPONSES) {
        return `Response ${code} ${!isSingleMediaType ? `(${mediaType})` : ''}`;
    }

    return '';
}

function compareOperationSectionPathItem(
    a: Omit<OperationSectionPathItem, 'data'>,
    b: Omit<OperationSectionPathItem, 'data'>
): boolean {
    return a.path === b.path && a.httpMethod === b.httpMethod;
}

function compareOperationSection(a: Omit<OperationSection, 'models'>, b: Omit<OperationSection, 'models'>): boolean {
    return (
        a.sectionKey === b.sectionKey &&
        a.kind === b.kind &&
        a.code === b.code &&
        a.mediaType === b.mediaType &&
        a.isSingleMediaType === b.isSingleMediaType &&
        a.scopeDeclarationPath.toString() === b.scopeDeclarationPath.toString() &&
        a.declarationPath.toString() === b.declarationPath.toString()
    );
}

export function compareOperationSectionPathItems(
    a: OperationSectionPathItem[],
    b: OperationSectionPathItem[]
): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        const pathItem1 = a[i];
        const pathItem2 = b[i];

        if (!compareOperationSectionPathItem(pathItem1, pathItem2)) {
            return false;
        }

        const data1 = pathItem1.data;
        const data2 = pathItem2.data;

        if (data1.length !== data2.length) return false;

        for (let j = 0; j < a.length; j++) {
            const operation1 = data1[j];
            const operation2 = data2[j];

            if (!compareOperationSection(operation1, operation2)) {
                return false;
            }
        }
    }

    return true;
}
