import { ODataSchemaConfig } from '../config/types';
/**
 * Serialize an entity set to OData V2 JSON format
 */
export declare function serializeEntitySet(results: Record<string, unknown>[], entityName: string, schema: ODataSchemaConfig, basePath: string, select?: string[], count?: number, includeCount?: boolean): object;
/**
 * Serialize a single entity to OData V2 JSON format
 */
export declare function serializeEntity(entity: Record<string, unknown>, entityName: string, schema: ODataSchemaConfig, basePath: string, select?: string[]): object;
/**
 * Serialize a primitive value for function import results
 */
export declare function serializeValue(value: unknown, edmType: string): unknown;
/**
 * Serialize error response
 */
export declare function serializeError(code: string, message: string, innerError?: {
    message: string;
    type: string;
    stacktrace?: string;
}): object;
//# sourceMappingURL=json-serializer.d.ts.map