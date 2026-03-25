import { Request, Response } from 'express';
import { ODataSchemaConfig, ParsedQuery } from '../../config/types';
import { BaseHandler } from '../base-handler';
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
export declare function handleDelete(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown>, schema: ODataSchemaConfig, query: ParsedQuery, models: Record<string, any>): Promise<void>;
//# sourceMappingURL=delete.d.ts.map