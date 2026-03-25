import { ODataSchemaConfig } from '../config/types';
import { Model, ModelStatic } from 'sequelize';
/**
 * Metadata generator that produces EDMX from schema configuration
 */
export declare class MetadataGenerator {
    private schema;
    private models;
    private cachedEdmx;
    private cachedEnrichedSchema;
    private basePath;
    constructor(schema: ODataSchemaConfig, models: Record<string, ModelStatic<Model>>, basePath: string);
    /**
     * Generate EDMX metadata document
     */
    generateEdmx(): string;
    /**
     * Get enriched schema (cached)
     */
    getEnrichedSchema(): ODataSchemaConfig;
    /**
     * Invalidate cached metadata
     */
    invalidateCache(): void;
    /**
     * Get the current schema (may be enriched from models)
     */
    getSchema(): ODataSchemaConfig;
    /**
     * Enrich schema with information from Sequelize models
     */
    private enrichSchemaFromModels;
    /**
     * Find entity name by Sequelize model name
     */
    private findEntityByModel;
    /**
     * Determine multiplicity from Sequelize association
     */
    private getMultiplicityFromAssociation;
    /**
     * Create association definition from Sequelize association
     */
    private createAssociationFromSequelize;
}
//# sourceMappingURL=generator.d.ts.map