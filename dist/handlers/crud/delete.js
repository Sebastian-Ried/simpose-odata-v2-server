"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDelete = handleDelete;
const errors_1 = require("../../utils/errors");
const etag_1 = require("../../utils/etag");
/**
 * Handle OData DELETE operation for a single entity.
 *
 * This function processes DELETE requests to remove an entity by its key(s).
 * It supports:
 * - ETag validation for optimistic concurrency control
 * - Read-only entity checking
 * - Foreign key constraint error handling
 * - Lifecycle hooks (beforeDelete, afterDelete)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param handler - Entity handler for database operations
 * @param entityName - Name of the entity being deleted
 * @param keys - Primary key values identifying the entity
 * @param schema - OData schema configuration
 * @param query - Parsed query options (unused for delete but included for consistency)
 * @param models - Map of Sequelize models
 *
 * @throws {ODataError} 404 if entity not found
 * @throws {ODataError} 405 if entity is read-only
 * @throws {ODataError} 409 if foreign key constraint violation
 * @throws {ODataError} 412 if ETag mismatch (precondition failed)
 *
 * @example
 * ```
 * DELETE /Products(1) HTTP/1.1
 * If-Match: "abc123"
 *
 * Response: 204 No Content
 * ```
 */
async function handleDelete(req, res, handler, entityName, keys, schema, query, models) {
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
    // Check if entity is read-only
    const entity = schema.entities[entityName];
    if (entity?.readOnly) {
        throw new errors_1.ODataError(405, `${entityName} is read-only`);
    }
    // Check if entity exists
    const exists = await handler.exists(keys);
    if (!exists) {
        throw new errors_1.ODataError(404, `${entityName} not found`);
    }
    // ETag validation for optimistic concurrency
    const ifMatch = req.headers['if-match'];
    if (ifMatch && ifMatch !== '*') {
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
        await handler.handleDelete(ctx);
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        // Check for foreign key constraint violations
        const errorMessage = error.message || '';
        if (errorMessage.includes('FOREIGN KEY') ||
            errorMessage.includes('constraint') ||
            errorMessage.includes('referenced')) {
            throw new errors_1.ODataError(409, `Cannot delete ${entityName} - it is referenced by other entities`, error);
        }
        throw new errors_1.ODataError(500, `Error deleting ${entityName}`, error);
    }
}
//# sourceMappingURL=delete.js.map