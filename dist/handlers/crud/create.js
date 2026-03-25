"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreate = handleCreate;
exports.handleDeepCreate = handleDeepCreate;
exports.handleNavigationCreate = handleNavigationCreate;
const json_serializer_1 = require("../../serializers/json-serializer");
const errors_1 = require("../../utils/errors");
const uri_parser_1 = require("../../parser/uri-parser");
/**
 * Handle OData create operations (POST requests)
 */
async function handleCreate(req, res, handler, entityName, schema, query, basePath, models) {
    const odataReq = req;
    const ctx = {
        req: req,
        res: res,
        query,
        entityName,
        models,
        user: req.user,
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
    try {
        // Validate and transform input data
        const createData = transformInputData(body, entityName, schema);
        const result = await handler.handleCreate(ctx, createData);
        // Build Location header
        const keys = extractKeys(result, entityName, schema);
        const location = (0, uri_parser_1.buildEntityUri)(basePath, entityName, keys, schema);
        const serialized = (0, json_serializer_1.serializeEntity)(result, entityName, schema, basePath, query.$select);
        res.status(201).header('Location', location).json(serialized);
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        // Check for unique constraint violations
        const errorMessage = error.message || '';
        if (errorMessage.includes('UNIQUE') ||
            errorMessage.includes('duplicate') ||
            errorMessage.includes('already exists')) {
            throw new errors_1.ODataError(409, `Entity already exists`, error);
        }
        throw new errors_1.ODataError(500, `Error creating ${entityName}`, error);
    }
}
/**
 * Handle deep create (POST with nested entities)
 */
async function handleDeepCreate(req, res, handler, entityName, schema, query, basePath, models, sequelize) {
    const body = req.body;
    if (!body || typeof body !== 'object') {
        throw new errors_1.ODataError(400, 'Request body is required');
    }
    // Use transaction for deep create
    const transaction = await sequelize.transaction();
    try {
        const odataReq = req;
        // Create context with transaction
        const ctx = {
            req: req,
            res: res,
            query,
            entityName,
            models,
            user: req.user,
            data: {},
            transaction, // Pass transaction to handler
            correlationId: odataReq.correlationId,
            logger: odataReq.logger,
        };
        const createData = transformInputData(body, entityName, schema);
        const result = await handler.handleCreate(ctx, createData);
        await transaction.commit();
        const keys = extractKeys(result, entityName, schema);
        const location = (0, uri_parser_1.buildEntityUri)(basePath, entityName, keys, schema);
        const serialized = (0, json_serializer_1.serializeEntity)(result, entityName, schema, basePath, query.$select);
        res.status(201).header('Location', location).json(serialized);
    }
    catch (error) {
        await transaction.rollback();
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error creating ${entityName}`, error);
    }
}
/**
 * Handle POST to navigation property (create related entity)
 */
async function handleNavigationCreate(req, res, parentHandler, parentEntityName, parentKeys, navigationProperty, schema, query, basePath, models, handlers) {
    const parentEntity = schema.entities[parentEntityName];
    const navProp = parentEntity?.navigationProperties?.[navigationProperty];
    if (!navProp) {
        throw new errors_1.ODataError(404, `Navigation property ${navigationProperty} not found`);
    }
    const targetEntityName = navProp.target;
    const targetHandler = handlers[targetEntityName];
    if (!targetHandler) {
        throw new errors_1.ODataError(500, `Handler not found for ${targetEntityName}`);
    }
    // Get the association to determine the foreign key
    const association = findAssociation(parentEntityName, targetEntityName, schema);
    if (!association) {
        throw new errors_1.ODataError(400, `Cannot create ${targetEntityName} via ${navigationProperty}`);
    }
    const body = req.body;
    if (!body || typeof body !== 'object') {
        throw new errors_1.ODataError(400, 'Request body is required');
    }
    // Add foreign key to create data
    const createData = {
        ...transformInputData(body, targetEntityName, schema),
    };
    // Set foreign key from parent keys
    if (association.referentialConstraint) {
        const { principal, dependent } = association.referentialConstraint;
        if (dependent.entity === targetEntityName) {
            createData[dependent.property] = parentKeys[principal.property];
        }
    }
    const odataReq = req;
    const ctx = {
        req: req,
        res: res,
        query,
        entityName: targetEntityName,
        models,
        user: req.user,
        data: {},
        correlationId: odataReq.correlationId,
        logger: odataReq.logger,
    };
    try {
        const result = await targetHandler.handleCreate(ctx, createData);
        const keys = extractKeys(result, targetEntityName, schema);
        const location = (0, uri_parser_1.buildEntityUri)(basePath, targetEntityName, keys, schema);
        const serialized = (0, json_serializer_1.serializeEntity)(result, targetEntityName, schema, basePath, query.$select);
        res.status(201).header('Location', location).json(serialized);
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error creating ${targetEntityName}`, error);
    }
}
/**
 * Transform input data according to schema
 */
function transformInputData(data, entityName, schema) {
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
        // Check if property exists in schema
        const propDef = entity.properties[key];
        const navProp = entity.navigationProperties?.[key];
        if (propDef) {
            // Transform value based on type
            transformed[propDef.column || key] = transformValue(value, propDef.type);
        }
        else if (navProp) {
            // Navigation property - include for deep create
            if (Array.isArray(value)) {
                transformed[key] = value.map((item) => transformInputData(item, navProp.target, schema));
            }
            else if (value && typeof value === 'object') {
                transformed[key] = transformInputData(value, navProp.target, schema);
            }
        }
        else {
            // Unknown property - pass through
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
            // Parse OData date format: /Date(timestamp)/ or ISO string
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
        case 'Edm.Byte':
        case 'Edm.SByte':
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
        case 'Edm.Binary':
            if (typeof value === 'string') {
                return Buffer.from(value, 'base64');
            }
            return value;
        default:
            return value;
    }
}
/**
 * Extract primary key values from entity data
 */
function extractKeys(data, entityName, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return {};
    }
    const keys = {};
    for (const keyName of entity.keys) {
        const prop = entity.properties[keyName];
        const columnName = prop?.column || keyName;
        // Try both property name and column name
        keys[keyName] = data[keyName] ?? data[columnName];
    }
    return keys;
}
/**
 * Find association between two entities
 */
function findAssociation(entity1, entity2, schema) {
    if (!schema.associations) {
        return null;
    }
    for (const [, assoc] of Object.entries(schema.associations)) {
        const entities = assoc.ends.map((e) => e.entity);
        if (entities.includes(entity1) && entities.includes(entity2)) {
            return assoc;
        }
    }
    return null;
}
//# sourceMappingURL=create.js.map