"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExpands = buildExpands;
exports.resolveNavigationPath = resolveNavigationPath;
exports.getNavigationTarget = getNavigationTarget;
exports.isNavigationCollection = isNavigationCollection;
/**
 * Merge an array of ExpandOptions, combining nested expands for duplicate properties.
 * OData v2 clients emit e.g. "trees/treeType,trees/treeVariety" which parses into
 * two ExpandOptions both with property="trees" — they must be merged before building
 * Sequelize includes to avoid duplicate association errors.
 */
function mergeExpands(expands) {
    const map = new Map();
    for (const e of expands) {
        const existing = map.get(e.property);
        if (existing) {
            existing.nested = mergeExpands([...(existing.nested ?? []), ...(e.nested ?? [])]);
        }
        else {
            map.set(e.property, { ...e, nested: e.nested ? mergeExpands(e.nested) : undefined });
        }
    }
    return Array.from(map.values());
}
/**
 * Build Sequelize includes from $expand options
 */
function buildExpands(expands, entityName, schema, models) {
    const merged = mergeExpands(expands);
    const includes = [];
    for (const expand of merged) {
        const include = buildSingleExpand(expand, entityName, schema, models);
        if (include) {
            includes.push(include);
        }
    }
    return includes;
}
/**
 * Build a single include from expand option
 */
function buildSingleExpand(expand, entityName, schema, models) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return null;
    }
    const navProp = entity.navigationProperties?.[expand.property];
    if (!navProp) {
        return null;
    }
    const targetEntity = schema.entities[navProp.target];
    if (!targetEntity) {
        return null;
    }
    const targetModelName = targetEntity.model || navProp.target;
    const targetModel = models[targetModelName];
    if (!targetModel) {
        return null;
    }
    const include = {
        model: targetModel,
        as: expand.property,
    };
    // Handle $select within expand
    if (expand.select && expand.select.length > 0) {
        include.attributes = expand.select;
    }
    // Handle nested expands
    if (expand.nested && expand.nested.length > 0) {
        include.include = buildExpands(expand.nested, navProp.target, schema, models);
    }
    return include;
}
/**
 * Resolve navigation property path to target entity and build includes
 */
function resolveNavigationPath(path, entityName, schema, models) {
    let currentEntity = entityName;
    const includes = [];
    let currentIncludeLevel = includes;
    for (const segment of path) {
        const entity = schema.entities[currentEntity];
        if (!entity) {
            return null;
        }
        const navProp = entity.navigationProperties?.[segment];
        if (!navProp) {
            return null;
        }
        const targetEntity = schema.entities[navProp.target];
        if (!targetEntity) {
            return null;
        }
        const targetModelName = targetEntity.model || navProp.target;
        const targetModel = models[targetModelName];
        if (!targetModel) {
            return null;
        }
        const include = {
            model: targetModel,
            as: segment,
        };
        currentIncludeLevel.push(include);
        // Set up for next level
        currentEntity = navProp.target;
        include.include = [];
        currentIncludeLevel = include.include;
    }
    return { includes, targetEntity: currentEntity };
}
/**
 * Get the target entity type from a navigation property
 */
function getNavigationTarget(entityName, navigationProperty, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return null;
    }
    const navProp = entity.navigationProperties?.[navigationProperty];
    if (!navProp) {
        return null;
    }
    return navProp.target;
}
/**
 * Check if a navigation property returns a collection
 */
function isNavigationCollection(entityName, navigationProperty, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return false;
    }
    const navProp = entity.navigationProperties?.[navigationProperty];
    if (!navProp) {
        return false;
    }
    return navProp.multiplicity === '*';
}
//# sourceMappingURL=expand-handler.js.map