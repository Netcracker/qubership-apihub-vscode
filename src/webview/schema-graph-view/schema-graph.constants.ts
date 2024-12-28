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
    JSON_SCHEMA_NODE_SYNTHETIC_TYPE_ANY,
    JSON_SCHEMA_NODE_SYNTHETIC_TYPE_NOTHING,
    JSON_SCHEMA_NODE_TYPE_BOOLEAN,
    JSON_SCHEMA_NODE_TYPE_INTEGER,
    JSON_SCHEMA_NODE_TYPE_NUMBER,
    JSON_SCHEMA_NODE_TYPE_STRING
} from '@netcracker/qubership-apihub-api-unifier';

export const SCHEMA_TYPE = 'schema';

export const PRIMITIVE_TYPES = new Set([
    JSON_SCHEMA_NODE_TYPE_BOOLEAN,
    JSON_SCHEMA_NODE_TYPE_INTEGER,
    JSON_SCHEMA_NODE_TYPE_NUMBER,
    JSON_SCHEMA_NODE_TYPE_STRING,
    JSON_SCHEMA_NODE_SYNTHETIC_TYPE_NOTHING,
    JSON_SCHEMA_NODE_SYNTHETIC_TYPE_ANY
]);

export const VISITOR_FLAG_TITLE = Symbol('$title');
export const VISITOR_FLAG_DEFAULTS = Symbol('$defaults');
export const VISITOR_FLAG_ORIGINS = Symbol('$origins');
export const VISITOR_FLAG_HASH = Symbol('$hash');
export const VISITOR_FLAG_INLINE_REFS = Symbol('$inline');

export const PROPERTY_TYPE_LEAF = 'property';
export const PROPERTY_TYPE_GROUP = 'group';

export const RELATION_TYPE_PROPERTY_TO_CLASS_REFERENCE = 'property-to-class-reference';
export const RELATION_TYPE_INCLUDE_PROPERTIES_GROUP = 'include-group';
