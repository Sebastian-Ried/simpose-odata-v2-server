"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataGenerator = void 0;
const edmx_builder_1 = require("./edmx-builder");
const type_mapping_1 = require("./type-mapping");
/**
 * Metadata generator that produces EDMX from schema configuration
 */
class MetadataGenerator {
    schema;
    models;
    cachedEdmx = null;
    cachedEnrichedSchema = null;
    basePath;
    constructor(schema, models, basePath) {
        this.schema = schema;
        this.models = models;
        this.basePath = basePath;
    }
    /**
     * Generate EDMX metadata document
     */
    generateEdmx() {
        if (this.cachedEdmx) {
            return this.cachedEdmx;
        }
        // Performance: Cache enriched schema separately
        const enrichedSchema = this.getEnrichedSchema();
        this.cachedEdmx = (0, edmx_builder_1.buildEdmx)(enrichedSchema, this.basePath);
        return this.cachedEdmx;
    }
    /**
     * Get enriched schema (cached)
     */
    getEnrichedSchema() {
        if (this.cachedEnrichedSchema) {
            return this.cachedEnrichedSchema;
        }
        this.cachedEnrichedSchema = this.enrichSchemaFromModels();
        return this.cachedEnrichedSchema;
    }
    /**
     * Invalidate cached metadata
     */
    invalidateCache() {
        this.cachedEdmx = null;
        this.cachedEnrichedSchema = null;
    }
    /**
     * Get the current schema (may be enriched from models)
     */
    getSchema() {
        return this.schema;
    }
    /**
     * Enrich schema with information from Sequelize models
     */
    enrichSchemaFromModels() {
        const enriched = {
            ...this.schema,
            entities: { ...this.schema.entities },
        };
        for (const [entityName, entity] of Object.entries(enriched.entities)) {
            const modelName = entity.model || entityName;
            const model = this.models[modelName];
            if (!model) {
                continue;
            }
            // Auto-detect properties from model if not fully specified
            const attributes = model.getAttributes();
            const enrichedProperties = { ...entity.properties };
            for (const [attrName, attr] of Object.entries(attributes)) {
                if (!enrichedProperties[attrName]) {
                    // Auto-infer property from Sequelize attribute
                    const edmType = (0, type_mapping_1.sequelizeToEdmType)(attr.type);
                    enrichedProperties[attrName] = {
                        type: edmType,
                        nullable: attr.allowNull ?? true,
                    };
                    // Add maxLength for string types
                    const typeObj = attr.type;
                    if (typeObj.constructor?.name === 'STRING' ||
                        typeObj.key === 'STRING') {
                        if (typeObj._length) {
                            enrichedProperties[attrName].maxLength = typeObj._length;
                        }
                    }
                    // Add precision/scale for decimal types
                    if (typeObj.constructor?.name === 'DECIMAL' ||
                        typeObj.key === 'DECIMAL') {
                        if (typeObj._precision) {
                            enrichedProperties[attrName].precision = typeObj._precision;
                        }
                        if (typeObj._scale) {
                            enrichedProperties[attrName].scale = typeObj._scale;
                        }
                    }
                }
            }
            // Update entity with enriched properties
            enriched.entities[entityName] = {
                ...entity,
                properties: enrichedProperties,
            };
            // Auto-detect associations if not specified
            const associations = model.associations || {};
            const enrichedNavProps = { ...entity.navigationProperties };
            for (const [assocName, assoc] of Object.entries(associations)) {
                if (!enrichedNavProps[assocName]) {
                    const targetEntityName = this.findEntityByModel(assoc.target.name, enriched);
                    if (targetEntityName) {
                        const multiplicity = this.getMultiplicityFromAssociation(assoc);
                        const relationshipName = `${entityName}_${assocName}`;
                        enrichedNavProps[assocName] = {
                            target: targetEntityName,
                            relationship: relationshipName,
                            multiplicity,
                        };
                        // Create association if not exists
                        if (!enriched.associations) {
                            enriched.associations = {};
                        }
                        if (!enriched.associations[relationshipName]) {
                            enriched.associations[relationshipName] = this.createAssociationFromSequelize(entityName, targetEntityName, assoc);
                        }
                    }
                }
            }
            enriched.entities[entityName].navigationProperties = enrichedNavProps;
        }
        return enriched;
    }
    /**
     * Find entity name by Sequelize model name
     */
    findEntityByModel(modelName, schema) {
        for (const [entityName, entity] of Object.entries(schema.entities)) {
            if ((entity.model || entityName) === modelName) {
                return entityName;
            }
        }
        return null;
    }
    /**
     * Determine multiplicity from Sequelize association
     */
    getMultiplicityFromAssociation(assoc) {
        const assocType = assoc.associationType;
        switch (assocType) {
            case 'BelongsTo':
                return assoc.foreignKeyConstraint === 'CASCADE' ? '1' : '0..1';
            case 'HasOne':
                return '0..1';
            case 'HasMany':
            case 'BelongsToMany':
                return '*';
            default:
                return '*';
        }
    }
    /**
     * Create association definition from Sequelize association
     */
    createAssociationFromSequelize(sourceEntity, targetEntity, assoc) {
        const assocType = assoc.associationType;
        let sourceMultiplicity = '*';
        let targetMultiplicity = '*';
        switch (assocType) {
            case 'BelongsTo':
                sourceMultiplicity = '*';
                targetMultiplicity = assoc.foreignKeyConstraint === 'CASCADE' ? '1' : '0..1';
                break;
            case 'HasOne':
                sourceMultiplicity = '1';
                targetMultiplicity = '0..1';
                break;
            case 'HasMany':
                sourceMultiplicity = '1';
                targetMultiplicity = '*';
                break;
            case 'BelongsToMany':
                sourceMultiplicity = '*';
                targetMultiplicity = '*';
                break;
        }
        const association = {
            ends: [
                { entity: sourceEntity, multiplicity: sourceMultiplicity },
                { entity: targetEntity, multiplicity: targetMultiplicity },
            ],
        };
        // Add referential constraint for BelongsTo associations
        if (assocType === 'BelongsTo' && assoc.foreignKey && assoc.targetKey) {
            association.referentialConstraint = {
                principal: {
                    entity: targetEntity,
                    property: assoc.targetKey,
                },
                dependent: {
                    entity: sourceEntity,
                    property: assoc.foreignKey,
                },
            };
        }
        return association;
    }
}
exports.MetadataGenerator = MetadataGenerator;
//# sourceMappingURL=generator.js.map