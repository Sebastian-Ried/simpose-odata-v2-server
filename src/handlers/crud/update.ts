import { Request, Response } from 'express';
import {
  HookContext,
  ODataSchemaConfig,
  ParsedQuery,
  Logger,
} from '../../config/types';
import { BaseHandler } from '../base-handler';
import { serializeEntity } from '../../serializers/json-serializer';
import { ODataError } from '../../utils/errors';
import { validateETag, generateETag } from '../../utils/etag';

/** Request with OData extensions */
interface ODataRequest extends Request {
  correlationId?: string;
  logger?: Logger;
}

/**
 * Handle OData update operations (PUT requests - full replace)
 */
export async function handleUpdate(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown>,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  basePath: string,
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

  const body = req.body;

  if (!body || typeof body !== 'object') {
    throw new ODataError(400, 'Request body is required');
  }

  // Check if entity is read-only
  const entity = schema.entities[entityName];
  if (entity?.readOnly) {
    throw new ODataError(405, `${entityName} is read-only`);
  }

  // ETag validation for optimistic concurrency
  const ifMatch = req.headers['if-match'];
  if (ifMatch) {
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
    const updateData = transformUpdateData(body, entityName, schema);
    const result = await handler.handleUpdate(ctx, updateData);

    if (result === null) {
      throw new ODataError(404, `${entityName} not found`);
    }

    // Generate new ETag
    const newETag = generateETag(result as Record<string, unknown>);

    const serialized = serializeEntity(
      result as Record<string, unknown>,
      entityName,
      schema,
      basePath,
      query.$select
    );

    res.status(200).header('ETag', newETag).json(serialized);
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error updating ${entityName}`, error as Error);
  }
}

/**
 * Handle OData merge operations (MERGE/PATCH requests - partial update)
 */
export async function handleMerge(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown>,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  basePath: string,
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

  const body = req.body;

  if (!body || typeof body !== 'object') {
    throw new ODataError(400, 'Request body is required');
  }

  // Check if entity is read-only
  const entity = schema.entities[entityName];
  if (entity?.readOnly) {
    throw new ODataError(405, `${entityName} is read-only`);
  }

  // ETag validation for optimistic concurrency
  const ifMatch = req.headers['if-match'];
  if (ifMatch) {
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
    const updateData = transformUpdateData(body, entityName, schema);
    const result = await handler.handleMerge(ctx, updateData);

    if (result === null) {
      throw new ODataError(404, `${entityName} not found`);
    }

    // Generate new ETag
    const newETag = generateETag(result as Record<string, unknown>);

    // MERGE typically returns 204 No Content, but we can return the entity
    // Based on Prefer header
    const prefer = req.headers['prefer'];
    if (prefer === 'return=representation') {
      const serialized = serializeEntity(
        result as Record<string, unknown>,
        entityName,
        schema,
        basePath,
        query.$select
      );
      res.status(200).header('ETag', newETag).json(serialized);
    } else {
      res.status(204).header('ETag', newETag).send();
    }
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error updating ${entityName}`, error as Error);
  }
}

/**
 * Handle link creation (POST to $links)
 */
export async function handleCreateLink(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown>,
  navigationProperty: string,
  schema: ODataSchemaConfig,
  models: Record<string, any>,
  sequelize: any
): Promise<void> {
  const body = req.body;

  if (!body || !body.uri) {
    throw new ODataError(400, 'Request body must contain uri property');
  }

  const entity = schema.entities[entityName];
  const navProp = entity?.navigationProperties?.[navigationProperty];

  if (!navProp) {
    throw new ODataError(404, `Navigation property ${navigationProperty} not found`);
  }

  // Parse the URI to get target entity keys
  const targetUri = body.uri;
  const targetKeys = parseEntityUri(targetUri, navProp.target, schema);

  if (!targetKeys) {
    throw new ODataError(400, 'Invalid target entity URI');
  }

  // Find the association
  const association = findAssociationForNav(entityName, navigationProperty, schema);

  if (!association?.referentialConstraint) {
    throw new ODataError(400, 'Cannot create link for this navigation property');
  }

  const { principal, dependent } = association.referentialConstraint;

  // Determine which entity to update
  if (dependent.entity === entityName) {
    // Update this entity's foreign key
    const model = models[entity?.model || entityName];
    const where: Record<string, unknown> = {};
    for (const key of entity?.keys || []) {
      where[key] = keys[key];
    }

    await model.update(
      { [dependent.property]: targetKeys[principal.property] },
      { where }
    );
  } else {
    // Update target entity's foreign key
    const targetEntity = schema.entities[navProp.target];
    const model = models[targetEntity?.model || navProp.target];

    await model.update(
      { [dependent.property]: keys[principal.property] },
      { where: targetKeys }
    );
  }

  res.status(204).send();
}

/**
 * Handle link deletion (DELETE to $links)
 */
export async function handleDeleteLink(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  keys: Record<string, unknown>,
  navigationProperty: string,
  targetKeys: Record<string, unknown> | undefined,
  schema: ODataSchemaConfig,
  models: Record<string, any>
): Promise<void> {
  const entity = schema.entities[entityName];
  const navProp = entity?.navigationProperties?.[navigationProperty];

  if (!navProp) {
    throw new ODataError(404, `Navigation property ${navigationProperty} not found`);
  }

  const association = findAssociationForNav(entityName, navigationProperty, schema);

  if (!association?.referentialConstraint) {
    throw new ODataError(400, 'Cannot delete link for this navigation property');
  }

  const { principal, dependent } = association.referentialConstraint;

  // Set foreign key to null
  if (dependent.entity === entityName) {
    const model = models[entity?.model || entityName];
    const where: Record<string, unknown> = {};
    for (const key of entity?.keys || []) {
      where[key] = keys[key];
    }

    await model.update({ [dependent.property]: null }, { where });
  } else if (targetKeys) {
    const targetEntity = schema.entities[navProp.target];
    const model = models[targetEntity?.model || navProp.target];

    await model.update({ [dependent.property]: null }, { where: targetKeys });
  }

  res.status(204).send();
}

/**
 * Transform update data according to schema
 */
function transformUpdateData(
  data: Record<string, unknown>,
  entityName: string,
  schema: ODataSchemaConfig
): Record<string, unknown> {
  const entity = schema.entities[entityName];
  if (!entity) {
    return data;
  }

  const transformed: Record<string, unknown> = {};

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
    } else if (!entity.navigationProperties?.[key]) {
      // Unknown property that's not a navigation - pass through
      transformed[key] = value;
    }
  }

  return transformed;
}

/**
 * Transform a single value based on EDM type
 */
function transformValue(value: unknown, edmType: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  switch (edmType) {
    case 'Edm.DateTime':
    case 'Edm.DateTimeOffset':
      if (typeof value === 'string') {
        const match = value.match(/\/Date\((-?\d+)\)\//);
        if (match) {
          return new Date(parseInt(match[1]!, 10));
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
function parseEntityUri(
  uri: string,
  entityName: string,
  schema: ODataSchemaConfig
): Record<string, unknown> | null {
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

  const keys: Record<string, unknown> = {};

  if (keyString && !keyString.includes('=')) {
    // Single key value
    if (entity.keys.length === 1) {
      let value: unknown = keyString;
      if (keyString.startsWith("'") && keyString.endsWith("'")) {
        value = keyString.slice(1, -1);
      } else if (/^\d+$/.test(keyString)) {
        value = parseInt(keyString, 10);
      }
      keys[entity.keys[0]!] = value;
    }
  } else if (keyString) {
    // Multiple keys
    const pairs = keyString.split(',');
    for (const pair of pairs) {
      const [name, rawValue] = pair.split('=');
      if (name && rawValue) {
        let value: unknown = rawValue;
        if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
          value = rawValue.slice(1, -1);
        } else if (/^\d+$/.test(rawValue)) {
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
function findAssociationForNav(
  entityName: string,
  navigationProperty: string,
  schema: ODataSchemaConfig
) {
  const entity = schema.entities[entityName];
  const navProp = entity?.navigationProperties?.[navigationProperty];

  if (!navProp || !schema.associations) {
    return null;
  }

  return schema.associations[navProp.relationship] || null;
}
