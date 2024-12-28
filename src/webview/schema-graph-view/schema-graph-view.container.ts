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

import { ClassViewComponent, EVENT_SELECTION_CHANGE } from '@netcracker/qubership-apihub-class-view';
import { JsonPath, SchemaGraphMeta } from './schema-graph.model';
import { selectClassShape } from './utils/class-view.utils';
import { transformOasToEffectiveClassDiagram } from './oas-transformer/oas-to-class-diagram.transformer';
import { collectOpenApiData } from './open-api-visitor/open-api.visitor';
import { OperationSection, OperationSectionPathItem } from './open-api-visitor/operation-structure.model';
import {
    compareOperationSectionPathItems,
    flatRequests,
    flatResponses
} from './open-api-visitor/operation-structure.utils';
import { buildOperaitionOptionElements, buildPathItemOptionElements } from './schema-graph-controls.builder';

export class SchemaGraphView {
    private readonly _classView: ClassViewComponent<SchemaGraphMeta>;
    private readonly _selectElementPathItems: HTMLSelectElement | null;
    private readonly _selectElementContext: HTMLSelectElement | null;
    private readonly _errorOverlay: HTMLElement | null;
    private oasDocument: object;
    private operationPathItems: OperationSectionPathItem[] = [];

    constructor() {
        this._classView = new ClassViewComponent<SchemaGraphMeta>();
        this._selectElementPathItems = <HTMLSelectElement>document.getElementById('pathItems');
        this._selectElementContext = <HTMLSelectElement>document.getElementById('context');
        this._errorOverlay = document.getElementById('error-overlay');

        this.initClassView();
        this.initSelectContextListener();
        this.initSelectPathItemsListener();
    }

    public setSchemaGraphContent(oasDocument: object) {
        this.oasDocument = oasDocument;

        this.setErrorOverlay();

        const operationPathItems = this.buildOperationPathItems();
        if (!compareOperationSectionPathItems(this.operationPathItems, operationPathItems)) {
            this.operationPathItems = operationPathItems;

            if (this._selectElementPathItems && this._selectElementContext) {
                this.setElementContent(
                    this._selectElementPathItems,
                    buildPathItemOptionElements(this.operationPathItems)
                );
                this.setElementContent(
                    this._selectElementContext,
                    buildOperaitionOptionElements(this.operationPathItems[0].data)
                );
            }
        }

        this._classView.content = this.oasDocumentToSchema(this.splitScopeDeclarationPath(this._selectElementContext));
    }

    public setErrorOverlay(content?: string) {
        if (this._errorOverlay && content) {
            this._errorOverlay.innerHTML = content;
            this._errorOverlay.style.display = 'block';
        } else if (this._errorOverlay) {
            this._errorOverlay.innerHTML = '';
            this._errorOverlay.style.display = '';
        }
    }

    private oasDocumentToSchema(path?: JsonPath) {
        if (!this.oasDocument) return {};

        const scopeDeclarationPath = path ?? this.operationPathItems[0].data[0].scopeDeclarationPath;

        return transformOasToEffectiveClassDiagram(this.oasDocument, {
            scopeDeclarationPath,
            declarationPath: []
        });
    }

    private initClassView() {
        this._classView.style.position = 'absolute';
        this._classView.style.top = '0';
        this._classView.style.left = '0';
        this._classView.style.right = '0';
        this._classView.style.bottom = '0';
        this._classView.classShapeFunction = selectClassShape;
        this._classView.addEventListener(EVENT_SELECTION_CHANGE, (event) => {
            console.log(event);
        });

        document.body?.appendChild(this._classView);
    }

    private initSelectPathItemsListener() {
        this._selectElementPathItems?.addEventListener('change', (event) => {
            const idParts = (event.target as HTMLInputElement)?.value?.split('-');
            const pathItem = this.operationPathItems.find(
                (item) => idParts[0] === item.path && idParts[1] === item.httpMethod
            );

            if (this._selectElementContext && pathItem) {
                this.setElementContent(this._selectElementContext, buildOperaitionOptionElements(pathItem?.data));
                this._classView.content = this.oasDocumentToSchema(pathItem.data[0].scopeDeclarationPath);
            }
        });
    }

    private initSelectContextListener() {
        this._selectElementContext?.addEventListener('change', (event) => {
            this._classView.content = this.oasDocumentToSchema(
                this.splitScopeDeclarationPath(event.target as HTMLInputElement)
            );
        });
    }

    private buildOperationPathItems(): OperationSectionPathItem[] {
        if (!this.oasDocument) return [];

        const pathItems = collectOpenApiData(this.oasDocument);

        return pathItems.map<OperationSectionPathItem>((pathItem) => {
            const { path, httpMethod, data, summary } = pathItem;
            const { requests, responses } = data;
            const operations: OperationSection[] = [];

            operations.push(...flatRequests(requests));
            operations.push(...flatResponses(responses));

            return {
                path,
                summary,
                httpMethod,
                data: operations
            };
        });
    }

    private setElementContent(element: HTMLElement, content: HTMLElement[]) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        element.append(...content);
    }

    private splitScopeDeclarationPath<T extends { value: string }>(obj?: T | null): JsonPath {
        return obj ? obj.value.split(',') : [];
    }
}
