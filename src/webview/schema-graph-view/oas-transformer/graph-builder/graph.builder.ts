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

// Copied from qubership-apihub-ui SchemaGraphView\oasToClassDiagramService.ts

import type { OriginLeafs } from '@netcracker/qubership-apihub-api-unifier';
import {
    JSON_SCHEMA_NODE_SYNTHETIC_TYPE_ANY,
    JSON_SCHEMA_NODE_TYPE_ARRAY,
    JSON_SCHEMA_NODE_TYPE_OBJECT,
    JSON_SCHEMA_PROPERTY_ALL_OF,
    JSON_SCHEMA_PROPERTY_ANY_OF,
    JSON_SCHEMA_PROPERTY_ONE_OF,
    OPEN_API_PROPERTY_COMPONENTS,
    OPEN_API_PROPERTY_SCHEMAS
} from '@netcracker/qubership-apihub-api-unifier';
import type { CombinerType } from '@netcracker/qubership-apihub-api-visitor';
import type { OpenAPIV3 } from 'openapi-types';
import {
    PRIMITIVE_TYPES,
    PROPERTY_TYPE_LEAF,
    RELATION_TYPE_PROPERTY_TO_CLASS_REFERENCE,
    SCHEMA_TYPE
} from '../../schema-graph.constants';
import {
    SchemaClass,
    SchemaGraphContent,
    SchemaIncludeGroupRelation,
    SchemaProperty,
    SchemaRelation
} from '../../schema-graph.model';
import { declarationPathsToString } from '../utils/transformer.utils';
import { resolveSharedSchemaNames, schemaHashWithTitle } from '../../utils/schema.utils';
import { BuildPropertyResult, SchemaWithPrimitive } from './graph-builder.model';

const extractTargetValue: (
    schema: OpenAPIV3.SchemaObject | undefined,
    path?: OpenAPIV3.SchemaObject[]
) => {
    schema: OpenAPIV3.SchemaObject;
    depth: number;
} = (schema, path = []) => {
    if (!schema) {
        const fooSchema: OpenAPIV3.SchemaObject = {};
        Object.assign(fooSchema, { type: JSON_SCHEMA_NODE_SYNTHETIC_TYPE_ANY });
        return {
            //abuse. for better solution we should remove denormalize from visitor and manually skip defaults
            schema: fooSchema,
            depth: path.length
        };
    }
    if (path.includes(schema)) {
        return {
            schema: schema,
            depth: Number.POSITIVE_INFINITY
        };
    }
    const { type } = schema;
    if (type === JSON_SCHEMA_NODE_TYPE_ARRAY) {
        return extractTargetValue(schema.items as OpenAPIV3.SchemaObject, [...path, schema]);
    }
    return {
        schema: schema,
        depth: path.length
    };
};

const collectCombinerNames: (schema: OpenAPIV3.SchemaObject) => string | undefined = (schema) => {
    const schemaRecord = schema as Record<PropertyKey, unknown>;
    const combs = [JSON_SCHEMA_PROPERTY_ONE_OF, JSON_SCHEMA_PROPERTY_ANY_OF].flatMap((com) =>
        com in schemaRecord && Array.isArray(schemaRecord[com]) ? [com] : []
    );
    return combs.length !== 0 ? combs.join(', ') : undefined;
};

const typeNmr: (schema: OpenAPIV3.SchemaObject, alternativeTitle?: string) => string = (schema, alternativeTitle) =>
    schema.title ?? alternativeTitle ?? collectCombinerNames(schema) ?? schema.type ?? 'unknown';

const propertyTypeNmr: (schema: OpenAPIV3.SchemaObject) => string = (schema) =>
    schema.title ??
    collectCombinerNames(schema) ??
    (schema.format && schema.type ? `${schema.type}<${schema.format}>` : undefined) ??
    schema.type ??
    'unknown';

const hasCombiners: (schema: OpenAPIV3.SchemaObject) => boolean = (schema) => {
    return (
        JSON_SCHEMA_PROPERTY_ANY_OF in schema ||
        JSON_SCHEMA_PROPERTY_ONE_OF in schema ||
        JSON_SCHEMA_PROPERTY_ALL_OF in schema
    );
};

export class GraphBuilder {
    private fooRootPropertyKey = 'fooPrp';
    private propertyNameForNonObjectProperties = '-';
    private propertyNameForPrimitives = '';
    private classes: SchemaClass[] = [];
    private relations: (SchemaRelation | SchemaIncludeGroupRelation)[] = [];

    private readonly schemaHashToNodeMap = new Map<string, SchemaWithPrimitive>();
    private readonly propertiesContainerStack: SchemaClass[] = [];
    private readonly propertyStack: SchemaProperty[] = [];
    private readonly rollbackStack: (() => void)[] = [];
    private readonly combinerStack: CombinerType[] = [];

    constructor(private readonly cycledJso: Record<PropertyKey, unknown>) {}

    get root(): boolean {
        return this.propertyStack.length === 0;
    }

    private fillSharedSchemas(schema: OpenAPIV3.SchemaObject, sharedSchemas: OpenAPIV3.SchemaObject[]): void {
        const sharedSchemaObjectNames = resolveSharedSchemaNames(schema);
        sharedSchemaObjectNames?.forEach((sharedSchemaName) => {
            const sharedSchema = (this.cycledJso[OPEN_API_PROPERTY_COMPONENTS] as OpenAPIV3.ComponentsObject)?.[
                OPEN_API_PROPERTY_SCHEMAS
            ]?.[sharedSchemaName] as OpenAPIV3.SchemaObject;
            if (!sharedSchemas.includes(sharedSchema)) {
                sharedSchemas.push(sharedSchema);
            }
        });
    }

    private getOrCreateSchema(schema: OpenAPIV3.SchemaObject, alternativeTitle?: string): SchemaWithPrimitive {
        const hash = schemaHashWithTitle(schema);
        const node = this.schemaHashToNodeMap.get(hash);
        if (node) {
            if (!node.schema.sameHashObjects.includes(schema)) {
                node.schema.sameHashObjects.push(schema);
            }
            return { ...node, isNew: false };
        }
        const { schema: targetSchema, depth } = extractTargetValue(schema);
        const isPrimitive = PRIMITIVE_TYPES.has(targetSchema.type ?? '');
        const newNode: SchemaClass = {
            kind: SCHEMA_TYPE,
            key: hash,
            sameHashObjects: [schema],
            sharedSchemaObjects: [],
            deprecated: !!schema.deprecated,
            name: typeNmr(schema, alternativeTitle),
            fooName: false,
            properties: [],
            isClass: !collectCombinerNames(schema) && !isPrimitive
        };
        this.fillSharedSchemas(schema, newNode.sharedSchemaObjects);
        this.classes.push(newNode);
        if (isPrimitive && !hasCombiners(schema)) {
            const propertyNode: SchemaProperty = {
                key: this.createPropertyKey(newNode, this.fooRootPropertyKey),
                name: this.propertyNameForPrimitives,
                fooName: true,
                propertyType:
                    schema === targetSchema
                        ? targetSchema.type
                        : typeNmr(targetSchema) + (depth === Number.POSITIVE_INFINITY ? '[]...' : '[]'.repeat(depth)),
                propertyTypeDeprecated: !!targetSchema.deprecated,
                deprecated: !resolveSharedSchemaNames(targetSchema) && !!targetSchema.deprecated,
                kind: PROPERTY_TYPE_LEAF,
                required: false,
                schemaObject: schema,
                sharedSchemaObjects: []
            };
            this.fillSharedSchemas(schema, propertyNode.sharedSchemaObjects);
            newNode.properties?.push(propertyNode);
            const result = { schema: newNode, primitive: propertyNode, isNew: true };
            this.schemaHashToNodeMap.set(hash, result);
            return result;
        } else {
            const result = { schema: newNode, primitive: undefined, isNew: true };
            this.schemaHashToNodeMap.set(hash, result);
            return result;
        }
    }

    private createSchemaKey(_: OpenAPIV3.SchemaObject, declarationPaths: OriginLeafs): string {
        return declarationPathsToString(declarationPaths); // wrong!!! but it unique
    }

    private createPropertyKey(owner: SchemaClass, propertyName: string): string {
        return `${owner.key}[${propertyName}]`;
    }

    build(): SchemaGraphContent {
        return {
            classes: [...this.classes],
            relations: [...this.relations]
        };
    }

    back(): void {
        this.rollbackStack.pop()?.();
    }

    get lastAvailableSchema(): SchemaClass | undefined {
        return this.propertiesContainerStack.reduceRight(
            (res, v) => {
                if (res) {
                    return res;
                }
                if (v.kind === SCHEMA_TYPE) {
                    return v;
                }
                return undefined;
            },
            undefined as SchemaClass | undefined
        );
    }

    createRootSchema(schema: OpenAPIV3.SchemaObject, alternativeTitle: string): void {
        const { schema: schemaNode, primitive } = this.getOrCreateSchema(schema, alternativeTitle);
        this.propertiesContainerStack.push(schemaNode);
        if (primitive) {
            this.propertyStack.push(primitive);
        }
        this.rollbackStack.push(() => {
            if (primitive) {
                this.propertyStack.pop();
            }
            this.propertiesContainerStack.pop();
        });
    }

    createAlternativeCombinerPropertyAndConnection(
        combinerIndex: number,
        schema: OpenAPIV3.SchemaObject
    ): BuildPropertyResult {
        return this.createPropertyAndConnection(
            this.propertyNameForNonObjectProperties,
            `${this.combinerStack.at(-1)}-${combinerIndex.toString()}`,
            schema,
            true
        );
    }

    createRootArrayPropertyAndConnection(schema: OpenAPIV3.SchemaObject): BuildPropertyResult {
        const lastSchema = this.lastAvailableSchema;
        if (lastSchema) {
            Object.assign(lastSchema, { isClass: false });
        }
        return this.createPropertyAndConnection(
            this.propertyNameForPrimitives,
            this.fooRootPropertyKey,
            schema,
            true,
            true
        );
    }

    createPropertyAndConnection(
        propertyName: string,
        propertyKey: string,
        schema: OpenAPIV3.SchemaObject,
        foo: boolean,
        extraDepth = false
    ): BuildPropertyResult {
        let nestedResult: BuildPropertyResult = { hasDeepSchema: schema.type === JSON_SCHEMA_NODE_TYPE_ARRAY };
        const propertiesContainer = this.propertiesContainerStack.at(-1);
        const lastSchema = this.lastAvailableSchema;
        let rollback: () => void = () => {
            /*nothing*/
        };
        if (propertiesContainer && lastSchema) {
            const { schema: valueForTests, depth } = extractTargetValue(schema);
            const propertyNode: SchemaProperty = {
                key: this.createPropertyKey(propertiesContainer, propertyKey),
                name: propertyName,
                fooName: foo,
                propertyType:
                    propertyTypeNmr(valueForTests) +
                    (depth === Number.POSITIVE_INFINITY ? '[]...' : '[]'.repeat(depth + (extraDepth ? 1 : 0))),
                required: lastSchema.sameHashObjects.some((s) => (s.required ?? []).includes(propertyName)),
                propertyTypeDeprecated: !!schema.deprecated || !!valueForTests.deprecated,
                deprecated: !resolveSharedSchemaNames(schema) && !!schema.deprecated,
                kind: PROPERTY_TYPE_LEAF,
                schemaObject: schema,
                sharedSchemaObjects: []
            };
            this.fillSharedSchemas(schema, propertyNode.sharedSchemaObjects);
            this.propertyStack.push(propertyNode);
            propertiesContainer.properties?.push(propertyNode);
            nestedResult = this.createNestedSchemaAndConnection(schema);
            const innerRollback = this.rollbackStack.pop();
            rollback = () => {
                this.propertyStack.pop();
                innerRollback?.();
            };
        }
        this.rollbackStack.push(rollback);
        return nestedResult;
    }

    createNestedSchemaAndConnection(schema: OpenAPIV3.SchemaObject): BuildPropertyResult {
        let rollback: () => void = () => {
            /*nothing*/
        };
        let nestedResult: BuildPropertyResult = {
            hasDeepSchema: schema.type === JSON_SCHEMA_NODE_TYPE_ARRAY || schema.type === JSON_SCHEMA_NODE_TYPE_OBJECT
        };
        const lastProperty = this.propertyStack.at(-1);
        if (
            lastProperty &&
            (resolveSharedSchemaNames(schema) || schema.type === JSON_SCHEMA_NODE_TYPE_OBJECT || hasCombiners(schema))
        ) {
            const { schema: schemaNode, primitive, isNew } = this.getOrCreateSchema(schema);
            this.propertiesContainerStack.push(schemaNode);
            if (primitive) {
                this.propertyStack.push(primitive);
            }
            this.relations.push({
                kind: RELATION_TYPE_PROPERTY_TO_CLASS_REFERENCE,
                primary: true,
                referenceClassKey: schemaNode.key,
                leafPropertyKey: lastProperty.key
            });
            rollback = () => {
                if (primitive) {
                    this.propertyStack.pop();
                }
                return this.propertiesContainerStack.pop();
            };
            nestedResult = { hasDeepSchema: isNew };
        }
        //else is a problem cause if object have nesting owner will we wrong
        this.rollbackStack.push(rollback);
        return nestedResult;
    }

    createCombiner(combinerType: CombinerType): void {
        this.combinerStack.push(combinerType);
        this.rollbackStack.push(() => this.combinerStack.pop());
    }
}
