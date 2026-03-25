import { UriSegment, ODataSchemaConfig } from '../config/types';
/**
 * Parse OData URI path into segments
 */
export declare function parseUri(path: string, schema: ODataSchemaConfig): UriSegment[];
/**
 * Build canonical URI for an entity
 */
export declare function buildEntityUri(basePath: string, entityName: string, keys: Record<string, unknown>, schema: ODataSchemaConfig): string;
//# sourceMappingURL=uri-parser.d.ts.map