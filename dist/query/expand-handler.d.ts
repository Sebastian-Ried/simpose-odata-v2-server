import { ExpandOption, ODataSchemaConfig } from '../config/types';
import { Model, ModelStatic, IncludeOptions } from 'sequelize';
/**
 * Build Sequelize includes from $expand options
 */
export declare function buildExpands(expands: ExpandOption[], entityName: string, schema: ODataSchemaConfig, models: Record<string, ModelStatic<Model>>): IncludeOptions[];
/**
 * Resolve navigation property path to target entity and build includes
 */
export declare function resolveNavigationPath(path: string[], entityName: string, schema: ODataSchemaConfig, models: Record<string, ModelStatic<Model>>): {
    includes: IncludeOptions[];
    targetEntity: string;
} | null;
/**
 * Get the target entity type from a navigation property
 */
export declare function getNavigationTarget(entityName: string, navigationProperty: string, schema: ODataSchemaConfig): string | null;
/**
 * Check if a navigation property returns a collection
 */
export declare function isNavigationCollection(entityName: string, navigationProperty: string, schema: ODataSchemaConfig): boolean;
//# sourceMappingURL=expand-handler.d.ts.map