import { ParsedQuery, ODataSchemaConfig } from '../config/types';
import { Model, ModelStatic, FindOptions, WhereOptions, Sequelize } from 'sequelize';
/**
 * Query builder for constructing Sequelize queries from OData options
 */
export declare class QueryBuilder {
    private schema;
    private models;
    private sequelize;
    constructor(schema: ODataSchemaConfig, models: Record<string, ModelStatic<Model>>, sequelize: Sequelize);
    /**
     * Build Sequelize FindOptions from parsed OData query
     */
    buildFindOptions(entityName: string, query: ParsedQuery, additionalWhere?: WhereOptions): FindOptions;
    /**
     * Build FindOptions for a single entity lookup
     */
    buildFindOneOptions(entityName: string, keys: Record<string, unknown>, query: ParsedQuery): FindOptions;
    /**
     * Build count query options
     */
    buildCountOptions(entityName: string, query: ParsedQuery, additionalWhere?: WhereOptions): FindOptions;
    /**
     * Get the Sequelize model for an entity
     */
    getModel(entityName: string): ModelStatic<Model> | undefined;
    /**
     * Ensure includes exist for associations referenced in filters.
     * Adds minimal includes (attributes: []) so the JOIN is present without
     * fetching unnecessary data.
     */
    private ensureFilterIncludes;
    /**
     * Get primary key values from entity data
     */
    extractKeys(entityName: string, data: Record<string, unknown>): Record<string, unknown>;
    /**
     * Build WHERE clause for entity keys
     */
    buildKeyWhere(entityName: string, keys: Record<string, unknown>): WhereOptions;
}
/**
 * Create a query builder instance
 */
export declare function createQueryBuilder(schema: ODataSchemaConfig, models: Record<string, ModelStatic<Model>>, sequelize: Sequelize): QueryBuilder;
//# sourceMappingURL=query-builder.d.ts.map