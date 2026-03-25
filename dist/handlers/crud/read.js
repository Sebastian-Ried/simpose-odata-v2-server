"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRead = handleRead;
exports.handleCount = handleCount;
exports.handleNavigationRead = handleNavigationRead;
exports.handlePropertyValue = handlePropertyValue;
const json_serializer_1 = require("../../serializers/json-serializer");
const errors_1 = require("../../utils/errors");
const etag_1 = require("../../utils/etag");
/**
 * Handle OData read operations (GET requests)
 */
async function handleRead(req, res, handler, entityName, keys, schema, query, basePath, models) {
    const odataReq = req;
    // Create hook context
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
    try {
        if (keys) {
            // Single entity read
            const result = await handler.handleReadSingle(ctx);
            if (result === null) {
                throw new errors_1.ODataError(404, `${entityName} not found`);
            }
            const entityData = result;
            const serialized = (0, json_serializer_1.serializeEntity)(entityData, entityName, schema, basePath, query.$select);
            // Set ETag response header so UI5 uses our timestamp-based ETag
            // (prevents Express from auto-generating one from the response body)
            const etag = (0, etag_1.generateETag)(entityData);
            res.status(200).header('ETag', etag).json(serialized);
        }
        else {
            // Entity set read
            const { results, count } = await handler.handleRead(ctx);
            const serialized = (0, json_serializer_1.serializeEntitySet)(results, entityName, schema, basePath, query.$select, count, query.$inlinecount === 'allpages');
            res.status(200).json(serialized);
        }
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error reading ${entityName}`, error);
    }
}
/**
 * Handle $count requests
 */
async function handleCount(req, res, handler, entityName, schema, query, models) {
    const odataReq = req;
    const ctx = {
        req: req,
        res: res,
        query: {
            ...query,
            // Remove pagination for count - we want total count
            $top: undefined,
            $skip: undefined,
        },
        entityName,
        models,
        user: req.user,
        data: {},
        correlationId: odataReq.correlationId,
        logger: odataReq.logger,
    };
    try {
        // Get count from handler (which uses proper DB count)
        const { count } = await handler.handleRead({
            ...ctx,
            query: { ...ctx.query, $inlinecount: 'allpages' },
        });
        // Use the database count, not results.length
        const totalCount = count ?? 0;
        res.status(200).type('text/plain').send(String(totalCount));
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error counting ${entityName}`, error);
    }
}
/**
 * Handle navigation property read
 */
async function handleNavigationRead(req, res, handler, entityName, keys, navigationProperty, schema, query, basePath, models) {
    const odataReq = req;
    // Forward any $expand from the request as nested expand on the navigation property
    // so that e.g. GET /Properties('X')/trees?$expand=treeType,treeVariety works correctly.
    // The remaining query options ($filter, $orderby, etc.) come from the request and apply
    // to the parent entity fetch — for single-key navigation reads this has no practical effect.
    const navExpand = query.$expand && query.$expand.length > 0
        ? [{ property: navigationProperty, nested: query.$expand }]
        : [{ property: navigationProperty }];
    const ctx = {
        req: req,
        res: res,
        query: {
            $expand: navExpand,
        },
        entityName,
        models,
        user: req.user,
        keys,
        data: {},
        correlationId: odataReq.correlationId,
        logger: odataReq.logger,
    };
    try {
        const result = await handler.handleReadSingle(ctx);
        if (result === null) {
            throw new errors_1.ODataError(404, `${entityName} not found`);
        }
        const entity = schema.entities[entityName];
        const navProp = entity?.navigationProperties?.[navigationProperty];
        if (!navProp) {
            throw new errors_1.ODataError(404, `Navigation property ${navigationProperty} not found`);
        }
        const navData = result[navigationProperty];
        if (navData === undefined || navData === null) {
            if (navProp.multiplicity === '*') {
                // Empty collection
                const serialized = (0, json_serializer_1.serializeEntitySet)([], navProp.target, schema, basePath);
                res.status(200).json(serialized);
            }
            else {
                throw new errors_1.ODataError(404, `Related ${navProp.target} not found`);
            }
            return;
        }
        if (Array.isArray(navData)) {
            const serialized = (0, json_serializer_1.serializeEntitySet)(navData, navProp.target, schema, basePath, query.$select);
            res.status(200).json(serialized);
        }
        else {
            const serialized = (0, json_serializer_1.serializeEntity)(navData, navProp.target, schema, basePath, query.$select);
            res.status(200).json(serialized);
        }
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error reading ${navigationProperty}`, error);
    }
}
/**
 * Handle property value read ($value)
 */
async function handlePropertyValue(req, res, handler, entityName, keys, propertyName, schema, query, models) {
    const odataReq = req;
    const ctx = {
        req: req,
        res: res,
        query: {
            ...query,
            $select: [propertyName],
        },
        entityName,
        models,
        user: req.user,
        keys,
        data: {},
        correlationId: odataReq.correlationId,
        logger: odataReq.logger,
    };
    try {
        const result = await handler.handleReadSingle(ctx);
        if (result === null) {
            throw new errors_1.ODataError(404, `${entityName} not found`);
        }
        const value = result[propertyName];
        if (value === undefined) {
            throw new errors_1.ODataError(404, `Property ${propertyName} not found`);
        }
        // Return raw value
        if (value === null) {
            res.status(204).send();
        }
        else if (typeof value === 'string') {
            res.status(200).type('text/plain').send(value);
        }
        else if (Buffer.isBuffer(value)) {
            res.status(200).type('application/octet-stream').send(value);
        }
        else {
            res.status(200).type('text/plain').send(String(value));
        }
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error reading property ${propertyName}`, error);
    }
}
//# sourceMappingURL=read.js.map