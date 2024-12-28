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

// Copied from apihub-ui SchemaGraphView\visitor-utils.ts

import type { DeferredHash } from '@netcracker/qubership-apihub-api-unifier';
import { parseRef } from '@netcracker/qubership-apihub-api-unifier';
import type { OpenAPIV3 } from 'openapi-types';
import { VISITOR_FLAG_HASH, VISITOR_FLAG_INLINE_REFS } from '../schema-graph.constants';
import { HashWithTitle } from '../schema-graph.model';

export const resolveSharedSchemaNames: (schema: OpenAPIV3.SchemaObject) => string[] | undefined = (schema) => {
    const schemaAsRecord = schema as Record<PropertyKey, unknown>;
    const inlined: string[] = (schemaAsRecord[VISITOR_FLAG_INLINE_REFS] as string[]) ?? [];
    const result = inlined.flatMap((ref) => {
        const name = parseRef(ref).jsonPath.at(-1)?.toString();
        return name ? [name] : [];
    });
    return result.length ? result : undefined;
};

export function calculateTolerantHash(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ParameterObject): string {
    if (!(VISITOR_FLAG_HASH in schema)) {
        throw Error('Tolerant hash is not defined');
    }
    return (schema[VISITOR_FLAG_HASH] as DeferredHash)();
}

export const schemaHashWithTitle: (schema: OpenAPIV3.SchemaObject) => HashWithTitle = (schema) => {
    return calculateTolerantHash(schema) + schema.title;
};
