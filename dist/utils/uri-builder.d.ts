import { ODataSchemaConfig } from '../config/types';
/**
 * Build canonical URI for an entity
 */
export declare function buildEntityUri(basePath: string, entityName: string, keys: Record<string, unknown>, schema: ODataSchemaConfig): string;
/**
 * Build URI for navigation property
 */
export declare function buildNavigationUri(basePath: string, entityName: string, keys: Record<string, unknown>, navigationProperty: string, schema: ODataSchemaConfig): string;
/**
 * Build URI for $links
 */
export declare function buildLinksUri(basePath: string, entityName: string, keys: Record<string, unknown>, navigationProperty: string, schema: ODataSchemaConfig): string;
/**
 * Parse entity URI to extract entity name and keys
 */
export declare function parseEntityUri(uri: string): {
    entityName: string;
    keys: Record<string, unknown>;
} | null;
//# sourceMappingURL=uri-builder.d.ts.map