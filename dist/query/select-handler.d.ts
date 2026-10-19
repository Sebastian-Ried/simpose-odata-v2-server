import { ODataSchemaConfig } from '../config/types';
/**
 * Build Sequelize attributes from $select options.
 *
 * `modelAttributes` are the Sequelize model's attribute names. When given, a
 * timestamp is mapped to the name the model actually uses: a model with
 * `createdAt: 'created_at'` has the attribute `created_at`, even if the
 * schema calls the property `createdAt`.
 */
export declare function buildSelect(select: string[], entityName: string, schema: ODataSchemaConfig, modelAttributes?: string[]): string[];
/**
 * Build attribute exclusion list
 */
export declare function buildExclude(exclude: string[], entityName: string, schema: ODataSchemaConfig): string[];
/**
 * Check if $select includes specific property
 */
export declare function isPropertySelected(property: string, select: string[] | undefined, entityName: string, schema: ODataSchemaConfig): boolean;
/**
 * Filter result object to only include selected properties
 */
export declare function filterSelectedProperties(data: Record<string, unknown>, select: string[] | undefined, entityName: string, schema: ODataSchemaConfig): Record<string, unknown>;
/**
 * Get all property names for an entity (excluding navigation properties)
 */
export declare function getAllPropertyNames(entityName: string, schema: ODataSchemaConfig): string[];
/**
 * Get all navigation property names for an entity
 */
export declare function getAllNavigationPropertyNames(entityName: string, schema: ODataSchemaConfig): string[];
//# sourceMappingURL=select-handler.d.ts.map