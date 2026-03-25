"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpdate = handleUpdate;
exports.handleMerge = handleMerge;
exports.handleCreateLink = handleCreateLink;
exports.handleDeleteLink = handleDeleteLink;
const json_serializer_1 = require("../../serializers/json-serializer");
const errors_1 = require("../../utils/errors");
const etag_1 = require("../../utils/etag");
/**
 * Handle OData update operations (PUT requests - full replace)
 */
async function handleUpdate(req, res, handler, entityName, keys, schema, query, basePath, models) {
    const odataReq = req;
    const ctx = {
        req: req,
        res: res,
        query,
        entityName,
        models,
        user: req.user,
        keys,
        data: {},
        correlationId: odataReq.correlationId,
        logger: odataReq.logger,
    };
    const body = req.body;
    if (!body || typeof body !== 'object') {
        throw new errors_1.ODataError(400, 'Request body is required');
    }
    // Check if entity is read-only
    const entity = schema.entities[entityName];
    if (entity?.readOnly) {
        throw new errors_1.ODataError(405, `${entityName} is read-only`);
    }
    // ETag validation for optimistic concurrency
    const ifMatch = req.headers['if-match'];
    if (ifMatch) {
        // Use a clean query without $select so timestamp fields are always included
        const etagCtx = { ...ctx, query: { ...ctx.query, $select: undefined } };
        const existingEntity = await handler.handleReadSingle(etagCtx);
        if (existingEntity) {
            const currentETag = (0, etag_1.generateETag)(existingEntity);
            if (!(0, etag_1.validateETag)(ifMatch, currentETag)) {
                throw new errors_1.ODataError(412, 'Precondition failed - ETag mismatch');
            }
        }
    }
    try {
        const updateData = transformUpdateData(body, entityName, schema);
        const result = await handler.handleUpdate(ctx, updateData);
        if (result === null) {
            throw new errors_1.ODataError(404, `${entityName} not found`);
        }
        // Generate new ETag
        const newETag = (0, etag_1.generateETag)(result);
        const serialized = (0, json_serializer_1.serializeEntity)(result, entityName, schema, basePath, query.$select);
        res.status(200).header('ETag', newETag).json(serialized);
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error updating ${entityName}`, error);
    }
}
/**
 * Handle OData merge operations (MERGE/PATCH requests - partial update)
 */
async function handleMerge(req, res, handler, entityName, keys, schema, query, basePath, models) {
    const odataReq = req;
    const ctx = {
        req: req,
        res: res,
        query,
        entityName,
        models,
        user: req.user,
        keys,
        data: {},
        correlationId: odataReq.correlationId,
        logger: odataReq.logger,
    };
    const body = req.body;
    if (!body || typeof body !== 'object') {
        throw new errors_1.ODataError(400, 'Request body is required');
    }
    // Check if entity is read-only
    const entity = schema.entities[entityName];
    if (entity?.readOnly) {
        throw new errors_1.ODataError(405, `${entityName} is read-only`);
    }
    // ETag validation for optimistic concurrency
    const ifMatch = req.headers['if-match'];
    if (ifMatch) {
        // Use a clean query without $select so timestamp fields are always included
        const etagCtx = { ...ctx, query: { ...ctx.query, $select: undefined } };
        const existingEntity = await handler.handleReadSingle(etagCtx);
        if (existingEntity) {
            const currentETag = (0, etag_1.generateETag)(existingEntity);
            if (!(0, etag_1.validateETag)(ifMatch, currentETag)) {
                throw new errors_1.ODataError(412, 'Precondition failed - ETag mismatch');
            }
        }
    }
    try {
        const updateData = transformUpdateData(body, entityName, schema);
        const result = await handler.handleMerge(ctx, updateData);
        if (result === null) {
            throw new errors_1.ODataError(404, `${entityName} not found`);
        }
        // Generate new ETag
        const newETag = (0, etag_1.generateETag)(result);
        // MERGE typically returns 204 No Content, but we can return the entity
        // Based on Prefer header
        const prefer = req.headers['prefer'];
        if (prefer === 'return=representation') {
            const serialized = (0, json_serializer_1.serializeEntity)(result, entityName, schema, basePath, query.$select);
            res.status(200).header('ETag', newETag).json(serialized);
        }
        else {
            res.status(204).header('ETag', newETag).send();
        }
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error updating ${entityName}`, error);
    }
}
/**
 * Handle link creation (POST to $links)
 */
async function handleCreateLink(req, res, handler, entityName, keys, navigationProperty, schema, models, sequelize) {
    const body = req.body;
    if (!body || !body.uri) {
        throw new errors_1.ODataError(400, 'Request body must contain uri property');
    }
    const entity = schema.entities[entityName];
    const navProp = entity?.navigationProperties?.[navigationProperty];
    if (!navProp) {
        throw new errors_1.ODataError(404, `Navigation property ${navigationProperty} not found`);
    }
    // Parse the URI to get target entity keys
    const targetUri = body.uri;
    const targetKeys = parseEntityUri(targetUri, navProp.target, schema);
    if (!targetKeys) {
        throw new errors_1.ODataError(400, 'Invalid target entity URI');
    }
    // Find the association
    const association = findAssociationForNav(entityName, navigationProperty, schema);
    if (!association?.referentialConstraint) {
        throw new errors_1.ODataError(400, 'Cannot create link for this navigation property');
    }
    const { principal, dependent } = association.referentialConstraint;
    // Determine which entity to update
    if (dependent.entity === entityName) {
        // Update this entity's foreign key
        const model = models[entity?.model || entityName];
        const where = {};
        for (const key of entity?.keys || []) {
            where[key] = keys[key];
        }
        await model.update({ [dependent.property]: targetKeys[principal.property] }, { where });
    }
    else {
        // Update target entity's foreign key
        const targetEntity = schema.entities[navProp.target];
        const model = models[targetEntity?.model || navProp.target];
        await model.update({ [dependent.property]: keys[principal.property] }, { where: targetKeys });
    }
    res.status(204).send();
}
/**
 * Handle link deletion (DELETE to $links)
 */
async function handleDeleteLink(req, res, handler, entityName, keys, navigationProperty, targetKeys, schema, models) {
    const entity = schema.entities[entityName];
    const navProp = entity?.navigationProperties?.[navigationProperty];
    if (!navProp) {
        throw new errors_1.ODataError(404, `Navigation property ${navigationProperty} not found`);
    }
    const association = findAssociationForNav(entityName, navigationProperty, schema);
    if (!association?.referentialConstraint) {
        throw new errors_1.ODataError(400, 'Cannot delete link for this navigation property');
    }
    const { principal, dependent } = association.referentialConstraint;
    // Set foreign key to null
    if (dependent.entity === entityName) {
        const model = models[entity?.model || entityName];
        const where = {};
        for (const key of entity?.keys || []) {
            where[key] = keys[key];
        }
        await model.update({ [dependent.property]: null }, { where });
    }
    else if (targetKeys) {
        const targetEntity = schema.entities[navProp.target];
        const model = models[targetEntity?.model || navProp.target];
        await model.update({ [dependent.property]: null }, { where: targetKeys });
    }
    res.status(204).send();
}
/**
 * Transform update data according to schema
 */
function transformUpdateData(data, entityName, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return data;
    }
    const transformed = {};
    for (const [key, value] of Object.entries(data)) {
        // Skip OData metadata properties
        if (key.startsWith('__')) {
            continue;
        }
        // Skip key properties (can't update keys)
        if (entity.keys.includes(key)) {
            continue;
        }
        const propDef = entity.properties[key];
        if (propDef) {
            transformed[propDef.column || key] = transformValue(value, propDef.type);
        }
        else if (!entity.navigationProperties?.[key]) {
            // Unknown property that's not a navigation - pass through
            transformed[key] = value;
        }
    }
    return transformed;
}
/**
 * Transform a single value based on EDM type
 */
function transformValue(value, edmType) {
    if (value === null || value === undefined) {
        return value;
    }
    switch (edmType) {
        case 'Edm.DateTime':
        case 'Edm.DateTimeOffset':
            if (typeof value === 'string') {
                const match = value.match(/\/Date\((-?\d+)\)\//);
                if (match) {
                    return new Date(parseInt(match[1], 10));
                }
                return new Date(value);
            }
            return value;
        case 'Edm.Int16':
        case 'Edm.Int32':
        case 'Edm.Int64':
            if (typeof value === 'string') {
                return parseInt(value, 10);
            }
            return value;
        case 'Edm.Single':
        case 'Edm.Double':
        case 'Edm.Decimal':
            if (typeof value === 'string') {
                return parseFloat(value);
            }
            return value;
        case 'Edm.Boolean':
            if (typeof value === 'string') {
                return value.toLowerCase() === 'true';
            }
            return value;
        default:
            return value;
    }
}
/**
 * Parse entity URI to extract keys
 */
function parseEntityUri(uri, entityName, schema) {
    // Extract keys from URI like /Entity(key) or /Entity(key1=value1,key2=value2)
    const match = uri.match(/([^(]+)\(([^)]+)\)/);
    if (!match) {
        return null;
    }
    const keyString = match[2];
    const entity = schema.entities[entityName];
    if (!entity) {
        return null;
    }
    const keys = {};
    if (keyString && !keyString.includes('=')) {
        // Single key value
        if (entity.keys.length === 1) {
            let value = keyString;
            if (keyString.startsWith("'") && keyString.endsWith("'")) {
                value = keyString.slice(1, -1);
            }
            else if (/^\d+$/.test(keyString)) {
                value = parseInt(keyString, 10);
            }
            keys[entity.keys[0]] = value;
        }
    }
    else if (keyString) {
        // Multiple keys
        const pairs = keyString.split(',');
        for (const pair of pairs) {
            const [name, rawValue] = pair.split('=');
            if (name && rawValue) {
                let value = rawValue;
                if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
                    value = rawValue.slice(1, -1);
                }
                else if (/^\d+$/.test(rawValue)) {
                    value = parseInt(rawValue, 10);
                }
                keys[name.trim()] = value;
            }
        }
    }
    return Object.keys(keys).length > 0 ? keys : null;
}
/**
 * Find association for a navigation property
 */
function findAssociationForNav(entityName, navigationProperty, schema) {
    const entity = schema.entities[entityName];
    const navProp = entity?.navigationProperties?.[navigationProperty];
    if (!navProp || !schema.associations) {
        return null;
    }
    return schema.associations[navProp.relationship] || null;
}
//# sourceMappingURL=update.js.map