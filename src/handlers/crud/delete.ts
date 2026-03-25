import { Request, Response } from 'express';
import {
  HookContext,
  ODataSchemaConfig,
  ParsedQuery,
  Logger,
} from '../../config/types';
import { BaseHandler } from '../base-handler';
import { ODataError } from '../../utils/errors';
import { validateETag, generateETag } from '../../utils/etag';

/** Request with OData extensions */
interface ODataRequest extends Request {
  correlationId?: string;
  logger?: Logger;
}

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
export async function handleDelete(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown>,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  models: Record<string, any>
): Promise<void> {
  const odataReq = req as ODataRequest;
  const ctx: HookContext = {
    req: req as any,
    res: res as any,
    query,
    entityName,
    models,
    user: (req as any).user,
    keys,
    data: {},
    correlationId: odataReq.correlationId,
    logger: odataReq.logger,
  };

  // Check if entity is read-only
  const entity = schema.entities[entityName];
  if (entity?.readOnly) {
    throw new ODataError(405, `${entityName} is read-only`);
  }

  // Check if entity exists
  const exists = await handler.exists(keys);
  if (!exists) {
    throw new ODataError(404, `${entityName} not found`);
  }

  // ETag validation for optimistic concurrency
  const ifMatch = req.headers['if-match'];
  if (ifMatch && ifMatch !== '*') {
    // Use a clean query without $select so timestamp fields are always included
    const etagCtx = { ...ctx, query: { ...ctx.query, $select: undefined } };
    const existingEntity = await handler.handleReadSingle(etagCtx);
    if (existingEntity) {
      const currentETag = generateETag(existingEntity as Record<string, unknown>);
      if (!validateETag(ifMatch as string, currentETag)) {
        throw new ODataError(412, 'Precondition failed - ETag mismatch');
      }
    }
  }

  try {
    await handler.handleDelete(ctx);
    res.status(204).send();
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }

    // Check for foreign key constraint violations
    const errorMessage = (error as Error).message || '';
    if (
      errorMessage.includes('FOREIGN KEY') ||
      errorMessage.includes('constraint') ||
      errorMessage.includes('referenced')
    ) {
      throw new ODataError(
        409,
        `Cannot delete ${entityName} - it is referenced by other entities`,
        error as Error
      );
    }

    throw new ODataError(500, `Error deleting ${entityName}`, error as Error);
  }
}
