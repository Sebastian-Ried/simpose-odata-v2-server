import { ODataSchemaConfig } from './types';
/**
 * Validation error for schema configuration
 */
export declare class SchemaValidationError extends Error {
    path?: string | undefined;
    constructor(message: string, path?: string | undefined);
}
/**
 * Load and validate OData schema configuration
 */
export declare function loadSchema(schemaOrPath: string | ODataSchemaConfig): ODataSchemaConfig;
/**
 * Auto-infer schema from Sequelize models
 */
export declare function inferSchemaFromModels(models: Record<string, import('sequelize').ModelStatic<import('sequelize').Model>>, existingSchema?: Partial<ODataSchemaConfig>): ODataSchemaConfig;
//# sourceMappingURL=schema-loader.d.ts.map