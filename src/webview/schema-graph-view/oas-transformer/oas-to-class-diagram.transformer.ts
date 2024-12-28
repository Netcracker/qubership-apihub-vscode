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

// Copied from apihub-ui SchemaGraphView\oasToClassDiagramService.ts

import {
    denormalize,
    DenormalizeOptions,
    JSON_SCHEMA_PROPERTY_ALL_OF,
    JSON_SCHEMA_PROPERTY_ANY_OF,
    JSON_SCHEMA_PROPERTY_ONE_OF,
    normalize,
    NormalizeOptions
} from '@netcracker/qubership-apihub-api-unifier';
import { OpenApiWalker, PROPERTY_ALIAS_ADDITIONAL_PROPERTIES } from '@netcracker/qubership-apihub-api-visitor';
import { GraphBuilder } from './graph-builder/graph.builder';
import {
    VISITOR_FLAG_DEFAULTS,
    VISITOR_FLAG_HASH,
    VISITOR_FLAG_INLINE_REFS,
    VISITOR_FLAG_ORIGINS,
    VISITOR_FLAG_TITLE
} from '../schema-graph.constants';
import { SchemaGraphContent, VisitorNavigationDetails } from '../schema-graph.model';
import { declarationPathsToString } from './utils/transformer.utils';

const walker = new OpenApiWalker();

export function transformOasToEffectiveClassDiagram(
    document: object,
    navigationDetails: VisitorNavigationDetails
): SchemaGraphContent {
    const graphScopePath = navigationDetails.scopeDeclarationPath.join('/');
    const rootSchemaSyntheticName: string[] = [];

    const options: NormalizeOptions = {
        syntheticTitleFlag: VISITOR_FLAG_TITLE,
        originsFlag: VISITOR_FLAG_ORIGINS,
        hashFlag: VISITOR_FLAG_HASH,
        defaultsFlag: VISITOR_FLAG_DEFAULTS,
        inlineRefsFlag: VISITOR_FLAG_INLINE_REFS,
        unify: true,
        allowNotValidSyntheticChanges: true,
        validate: true
    };
    const invertOptions: DenormalizeOptions = {
        ...options,
        originsAlreadyDefined: true,
        hashFlag: undefined,
        ignoreSymbols: [VISITOR_FLAG_HASH, VISITOR_FLAG_INLINE_REFS]
    };
    delete invertOptions.inlineRefsFlag;
    const cycledJsoSpec = denormalize(normalize(document, options), invertOptions);
    const builder = new GraphBuilder(cycledJsoSpec as Record<PropertyKey, unknown>);

    walker.walkPathsOnNormalizedSource(
        cycledJsoSpec,
        {
            responseStart: ({ responseCode, valueAlreadyVisited }) => {
                if (valueAlreadyVisited) {
                    return false;
                }
                rootSchemaSyntheticName.push(`Response ${responseCode}`);
                return true;
            },
            responseEnd: ({ valueAlreadyVisited }) => {
                if (valueAlreadyVisited) {
                    return;
                }
                rootSchemaSyntheticName.pop();
            },
            headerStart: ({ header, declarationPaths }) => {
                rootSchemaSyntheticName.push(`Header ${header}`);
                return graphScopePath === declarationPathsToString(declarationPaths);
            },
            headerEnd: () => {
                rootSchemaSyntheticName.pop();
            },
            parameterStart: ({ value, declarationPaths }) => {
                rootSchemaSyntheticName.push(`Parameter ${value.name}`);
                return graphScopePath === declarationPathsToString(declarationPaths);
            },
            parameterEnd: () => {
                rootSchemaSyntheticName.pop();
            },
            mediaTypeStart: ({ declarationPaths, mediaType }) => {
                rootSchemaSyntheticName.push(`(${mediaType})`);
                return graphScopePath === declarationPathsToString(declarationPaths);
            },
            mediaTypeEnd: () => {
                rootSchemaSyntheticName.pop();
            },
            requestBodyStart: ({ valueAlreadyVisited }) => {
                if (valueAlreadyVisited) {
                    return false;
                }
                rootSchemaSyntheticName.push('Request');
                return true;
            },
            requestBodyEnd: ({ valueAlreadyVisited }) => {
                if (valueAlreadyVisited) {
                    return;
                }
                rootSchemaSyntheticName.pop();
            },

            schemaRootStart: ({ value, valueAlreadyVisited }) => {
                const last = rootSchemaSyntheticName.at(-1);
                const prev = rootSchemaSyntheticName.at(-2);
                const alternative = prev ? `${prev} ${last}` : (last ?? '');
                builder.createRootSchema(value, alternative);
                return !valueAlreadyVisited;
            },
            schemaRootEnd: () => builder.back(),
            schemaPropertyStart: ({ propertyName, value }) => {
                const { hasDeepSchema } = builder.createPropertyAndConnection(
                    propertyName === PROPERTY_ALIAS_ADDITIONAL_PROPERTIES ? 'additionalProperties' : propertyName,
                    `'${propertyName}'`,
                    value,
                    propertyName === PROPERTY_ALIAS_ADDITIONAL_PROPERTIES
                );
                return hasDeepSchema;
            },
            schemaPropertyEnd: () => builder.back(),
            schemaItemsStart: ({ value }) => {
                if (builder.root) {
                    const { hasDeepSchema } = builder.createRootArrayPropertyAndConnection(value);
                    return hasDeepSchema;
                } else {
                    const { hasDeepSchema } = builder.createNestedSchemaAndConnection(value);
                    return hasDeepSchema;
                }
            },
            schemaItemsEnd: () => builder.back(),
            combinerStart: ({ combinerType, valueAlreadyVisited }) => {
                switch (combinerType) {
                    case JSON_SCHEMA_PROPERTY_ONE_OF:
                    case JSON_SCHEMA_PROPERTY_ANY_OF:
                        builder.createCombiner(combinerType);
                        return !valueAlreadyVisited;
                    case JSON_SCHEMA_PROPERTY_ALL_OF:
                        builder.createCombiner(combinerType);
                        return false;
                }
            },
            combinerEnd: () => builder.back(),
            combinerItemStart: ({ value, combinerItemIndex }) => {
                const { hasDeepSchema } = builder.createAlternativeCombinerPropertyAndConnection(
                    combinerItemIndex,
                    value
                );
                return hasDeepSchema;
            },
            combinerItemEnd: () => builder.back()
        },
        { originsFlag: VISITOR_FLAG_ORIGINS }
    );
    return builder.build();
}
