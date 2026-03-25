import { Request, Response } from 'express';
import {
  HookContext,
  ODataSchemaConfig,
  ParsedQuery,
  Logger,
} from '../../config/types';
import { BaseHandler } from '../base-handler';
import { serializeEntitySet, serializeEntity } from '../../serializers/json-serializer';
import { ODataError } from '../../utils/errors';
import { generateETag } from '../../utils/etag';

/** Request with OData extensions */
interface ODataRequest extends Request {
  correlationId?: string;
  logger?: Logger;
}

/**
 * Handle OData read operations (GET requests)
 */
export async function handleRead(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown> | undefined,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  basePath: string,
  models: Record<string, any>
): Promise<void> {
  const odataReq = req as ODataRequest;
  // Create hook context
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

  try {
    if (keys) {
      // Single entity read
      const result = await handler.handleReadSingle(ctx);

      if (result === null) {
        throw new ODataError(404, `${entityName} not found`);
      }

      const entityData = result as Record<string, unknown>;
      const serialized = serializeEntity(
        entityData,
        entityName,
        schema,
        basePath,
        query.$select
      );

      // Set ETag response header so UI5 uses our timestamp-based ETag
      // (prevents Express from auto-generating one from the response body)
      const etag = generateETag(entityData);
      res.status(200).header('ETag', etag).json(serialized);
    } else {
      // Entity set read
      const { results, count } = await handler.handleRead(ctx);

      const serialized = serializeEntitySet(
        results as Record<string, unknown>[],
        entityName,
        schema,
        basePath,
        query.$select,
        count,
        query.$inlinecount === 'allpages'
      );

      res.status(200).json(serialized);
    }
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error reading ${entityName}`, error as Error);
  }
}

/**
 * Handle $count requests
 */
export async function handleCount(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  models: Record<string, any>
): Promise<void> {
  const odataReq = req as ODataRequest;
  const ctx: HookContext = {
    req: req as any,
    res: res as any,
    query: {
      ...query,
      // Remove pagination for count - we want total count
      $top: undefined,
      $skip: undefined,
    },
    entityName,
    models,
    user: (req as any).user,
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
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error counting ${entityName}`, error as Error);
  }
}

/**
 * Handle navigation property read
 */
export async function handleNavigationRead(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown>,
  navigationProperty: string,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  basePath: string,
  models: Record<string, any>
): Promise<void> {
  const odataReq = req as ODataRequest;
  // Forward any $expand from the request as nested expand on the navigation property
  // so that e.g. GET /Properties('X')/trees?$expand=treeType,treeVariety works correctly.
  // The remaining query options ($filter, $orderby, etc.) come from the request and apply
  // to the parent entity fetch — for single-key navigation reads this has no practical effect.
  const navExpand = query.$expand && query.$expand.length > 0
    ? [{ property: navigationProperty, nested: query.$expand }]
    : [{ property: navigationProperty }];

  const ctx: HookContext = {
    req: req as any,
    res: res as any,
    query: {
      $expand: navExpand,
    },
    entityName,
    models,
    user: (req as any).user,
    keys,
    data: {},
    correlationId: odataReq.correlationId,
    logger: odataReq.logger,
  };

  try {
    const result = await handler.handleReadSingle(ctx);

    if (result === null) {
      throw new ODataError(404, `${entityName} not found`);
    }

    const entity = schema.entities[entityName];
    const navProp = entity?.navigationProperties?.[navigationProperty];

    if (!navProp) {
      throw new ODataError(404, `Navigation property ${navigationProperty} not found`);
    }

    const navData = (result as any)[navigationProperty];

    if (navData === undefined || navData === null) {
      if (navProp.multiplicity === '*') {
        // Empty collection
        const serialized = serializeEntitySet(
          [],
          navProp.target,
          schema,
          basePath
        );
        res.status(200).json(serialized);
      } else {
        throw new ODataError(404, `Related ${navProp.target} not found`);
      }
      return;
    }

    if (Array.isArray(navData)) {
      const serialized = serializeEntitySet(
        navData,
        navProp.target,
        schema,
        basePath,
        query.$select
      );
      res.status(200).json(serialized);
    } else {
      const serialized = serializeEntity(
        navData,
        navProp.target,
        schema,
        basePath,
        query.$select
      );
      res.status(200).json(serialized);
    }
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error reading ${navigationProperty}`, error as Error);
  }
}

/**
 * Handle property value read ($value)
 */
export async function handlePropertyValue(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown>,
  propertyName: string,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  models: Record<string, any>
): Promise<void> {
  const odataReq = req as ODataRequest;
  const ctx: HookContext = {
    req: req as any,
    res: res as any,
    query: {
      ...query,
      $select: [propertyName],
    },
    entityName,
    models,
    user: (req as any).user,
    keys,
    data: {},
    correlationId: odataReq.correlationId,
    logger: odataReq.logger,
  };

  try {
    const result = await handler.handleReadSingle(ctx);

    if (result === null) {
      throw new ODataError(404, `${entityName} not found`);
    }

    const value = (result as any)[propertyName];

    if (value === undefined) {
      throw new ODataError(404, `Property ${propertyName} not found`);
    }

    // Return raw value
    if (value === null) {
      res.status(204).send();
    } else if (typeof value === 'string') {
      res.status(200).type('text/plain').send(value);
    } else if (Buffer.isBuffer(value)) {
      res.status(200).type('application/octet-stream').send(value);
    } else {
      res.status(200).type('text/plain').send(String(value));
    }
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error reading property ${propertyName}`, error as Error);
  }
}
