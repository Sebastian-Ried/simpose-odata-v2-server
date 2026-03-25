"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHookContext = createHookContext;
exports.cloneContext = cloneContext;
exports.getContextData = getContextData;
exports.setContextData = setContextData;
exports.getModel = getModel;
exports.isAuthenticated = isAuthenticated;
exports.getUser = getUser;
exports.addQueryFilter = addQueryFilter;
exports.getHeader = getHeader;
exports.getQueryParam = getQueryParam;
exports.getRequestBody = getRequestBody;
exports.getLogger = getLogger;
/**
 * Create a hook context for request processing
 */
function createHookContext(req, res, query, entityName, models, keys, correlationId, logger) {
    return {
        req: req,
        res: res,
        query,
        entityName,
        models,
        user: req.user,
        keys,
        data: {},
        correlationId,
        logger,
    };
}
/**
 * Clone a hook context with modified properties
 */
function cloneContext(ctx, overrides) {
    return {
        ...ctx,
        query: { ...ctx.query },
        data: { ...ctx.data },
        ...overrides,
    };
}
/**
 * Get value from context data store
 */
function getContextData(ctx, key) {
    return ctx.data[key];
}
/**
 * Set value in context data store
 */
function setContextData(ctx, key, value) {
    ctx.data[key] = value;
}
/**
 * Get the Sequelize model from context
 */
function getModel(ctx, entityName) {
    const name = entityName || ctx.entityName;
    return ctx.models[name];
}
/**
 * Check if user is authenticated
 */
function isAuthenticated(ctx) {
    return ctx.user !== undefined && ctx.user !== null;
}
/**
 * Get user from context
 */
function getUser(ctx) {
    return ctx.user;
}
/**
 * Dangerous prototype keys that should never be merged
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
/**
 * Add filter to query
 */
function addQueryFilter(ctx, filter) {
    if (!ctx.query.where) {
        ctx.query.where = {};
    }
    // Sanitize filter to prevent prototype pollution
    const safeFilter = Object.fromEntries(Object.entries(filter).filter(([key]) => !DANGEROUS_KEYS.includes(key)));
    Object.assign(ctx.query.where, safeFilter);
}
/**
 * Get request headers
 */
function getHeader(ctx, name) {
    return ctx.req.headers?.[name.toLowerCase()];
}
/**
 * Get query parameter
 */
function getQueryParam(ctx, name) {
    return ctx.req.query?.[name];
}
/**
 * Get request body
 */
function getRequestBody(ctx) {
    return ctx.req.body;
}
/**
 * Get the logger from context with fallback to no-op.
 *
 * Returns a safe logger that can always be called without null checks.
 * If no logger is configured, returns a no-op logger.
 *
 * @param ctx - Hook context
 * @returns Logger instance (never undefined)
 *
 * @example
 * ```typescript
 * const logger = getLogger(ctx);
 * logger.info('Processing entity', { entityName: ctx.entityName });
 * ```
 */
function getLogger(ctx) {
    if (ctx.logger) {
        return ctx.logger;
    }
    // Return a no-op logger if none configured
    return {
        debug: () => { },
        info: () => { },
        warn: () => { },
        error: () => { },
    };
}
//# sourceMappingURL=context.js.map