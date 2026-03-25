import { ParsedQuery } from '../config/types';
/**
 * Parse all OData query options from URL query string
 */
export declare function parseQueryOptions(query: Record<string, string | undefined>): ParsedQuery;
/**
 * Query option parsing error
 */
export declare class QueryOptionError extends Error {
    option: string;
    constructor(option: string, message: string);
}
/**
 * Validate and normalize query options for an entity
 */
export declare function validateQueryOptions(options: ParsedQuery, entityName: string, schema: import('../config/types').ODataSchemaConfig): ParsedQuery;
//# sourceMappingURL=query-options.d.ts.map