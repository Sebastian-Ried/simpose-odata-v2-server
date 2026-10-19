"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSelect = buildSelect;
exports.buildExclude = buildExclude;
exports.isPropertySelected = isPropertySelected;
exports.filterSelectedProperties = filterSelectedProperties;
exports.getAllPropertyNames = getAllPropertyNames;
exports.getAllNavigationPropertyNames = getAllNavigationPropertyNames;
const TIMESTAMP_ALIASES = {
    updatedAt: ['updatedAt', 'updated_at'],
    updated_at: ['updatedAt', 'updated_at'],
    createdAt: ['createdAt', 'created_at'],
    created_at: ['createdAt', 'created_at'],
};
/**
 * Build Sequelize attributes from $select options.
 *
 * `modelAttributes` are the Sequelize model's attribute names. When given, a
 * timestamp is mapped to the name the model actually uses: a model with
 * `createdAt: 'created_at'` has the attribute `created_at`, even if the
 * schema calls the property `createdAt`.
 */
function buildSelect(select, entityName, schema, modelAttributes) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return select;
    }
    const toAttribute = (name) => {
        if (!modelAttributes || modelAttributes.includes(name)) {
            return name;
        }
        return TIMESTAMP_ALIASES[name]?.find((alias) => modelAttributes.includes(alias)) ?? name;
    };
    const properties = [];
    const add = (name) => {
        const attribute = toAttribute(name);
        if (attribute && !properties.includes(attribute)) {
            properties.push(attribute);
        }
    };
    for (const item of select) {
        // Handle nested selection (Property/SubProperty)
        const baseProp = item.split('/')[0];
        // Check if it's a regular non-virtual property
        if (entity.properties[baseProp] && !entity.properties[baseProp].virtual) {
            // Add the base property (Sequelize doesn't support nested property selection)
            add(baseProp);
        }
        // Navigation properties are handled by $expand
    }
    // Always include primary keys
    for (const key of entity.keys) {
        add(key);
    }
    // Always include timestamp fields for consistent ETag generation
    const timestampFields = ['updatedAt', 'updated_at', 'createdAt', 'created_at'];
    for (const ts of timestampFields) {
        if (entity.properties[ts]) {
            add(ts);
        }
    }
    return properties;
}
/**
 * Build attribute exclusion list
 */
function buildExclude(exclude, entityName, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return exclude;
    }
    // Filter to only include valid properties
    return exclude.filter((prop) => entity.properties[prop]);
}
/**
 * Check if $select includes specific property
 */
function isPropertySelected(property, select, entityName, schema) {
    // If no $select, all properties are selected
    if (!select || select.length === 0) {
        return true;
    }
    const entity = schema.entities[entityName];
    if (!entity) {
        return select.includes(property);
    }
    // Keys are always selected
    if (entity.keys.includes(property)) {
        return true;
    }
    // Check direct property selection
    if (select.includes(property)) {
        return true;
    }
    // Check if property is part of a path (Property/SubProperty)
    for (const item of select) {
        if (item.startsWith(`${property}/`)) {
            return true;
        }
    }
    return false;
}
/**
 * Filter result object to only include selected properties
 */
function filterSelectedProperties(data, select, entityName, schema) {
    // If no $select, return all properties
    if (!select || select.length === 0) {
        return data;
    }
    const entity = schema.entities[entityName];
    if (!entity) {
        return data;
    }
    const result = {};
    // Always include keys
    for (const key of entity.keys) {
        if (data[key] !== undefined) {
            result[key] = data[key];
        }
    }
    // Include selected properties
    for (const prop of select) {
        const baseProp = prop.split('/')[0];
        if (data[baseProp] !== undefined) {
            result[baseProp] = data[baseProp];
        }
    }
    return result;
}
/**
 * Get all property names for an entity (excluding navigation properties)
 */
function getAllPropertyNames(entityName, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return [];
    }
    return Object.keys(entity.properties);
}
/**
 * Get all navigation property names for an entity
 */
function getAllNavigationPropertyNames(entityName, schema) {
    const entity = schema.entities[entityName];
    if (!entity || !entity.navigationProperties) {
        return [];
    }
    return Object.keys(entity.navigationProperties);
}
//# sourceMappingURL=select-handler.js.map