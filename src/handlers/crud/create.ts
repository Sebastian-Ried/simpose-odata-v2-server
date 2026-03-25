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
import { buildEntityUri } from '../../parser/uri-parser';

/** Request with OData extensions */
interface ODataRequest extends Request {
  correlationId?: string;
  logger?: Logger;
}

/**
 * Handle OData create operations (POST requests)
 */
export async function handleCreate(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
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

  try {
    // Validate and transform input data
    const createData = transformInputData(body, entityName, schema);

    const result = await handler.handleCreate(ctx, createData);

    // Build Location header
    const keys = extractKeys(result as Record<string, unknown>, entityName, schema);
    const location = buildEntityUri(basePath, entityName, keys, schema);

    const serialized = serializeEntity(
      result as Record<string, unknown>,
      entityName,
      schema,
      basePath,
      query.$select
    );

    res.status(201).header('Location', location).json(serialized);
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }

    // Check for unique constraint violations
    const errorMessage = (error as Error).message || '';
    if (
      errorMessage.includes('UNIQUE') ||
      errorMessage.includes('duplicate') ||
      errorMessage.includes('already exists')
    ) {
      throw new ODataError(409, `Entity already exists`, error as Error);
    }

    throw new ODataError(500, `Error creating ${entityName}`, error as Error);
  }
}

/**
 * Handle deep create (POST with nested entities)
 */
export async function handleDeepCreate(
  req: Request,
  res: Response,
  handler: BaseHandler,
  entityName: string,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  basePath: string,
  models: Record<string, any>,
  sequelize: any
): Promise<void> {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    throw new ODataError(400, 'Request body is required');
  }

  // Use transaction for deep create
  const transaction = await sequelize.transaction();

  try {
    const odataReq = req as ODataRequest;
    // Create context with transaction
    const ctx: HookContext = {
      req: req as any,
      res: res as any,
      query,
      entityName,
      models,
      user: (req as any).user,
      data: {},
      transaction, // Pass transaction to handler
      correlationId: odataReq.correlationId,
      logger: odataReq.logger,
    };

    const createData = transformInputData(body, entityName, schema);
    const result = await handler.handleCreate(ctx, createData);

    await transaction.commit();

    const keys = extractKeys(result as Record<string, unknown>, entityName, schema);
    const location = buildEntityUri(basePath, entityName, keys, schema);

    const serialized = serializeEntity(
      result as Record<string, unknown>,
      entityName,
      schema,
      basePath,
      query.$select
    );

    res.status(201).header('Location', location).json(serialized);
  } catch (error) {
    await transaction.rollback();

    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error creating ${entityName}`, error as Error);
  }
}

/**
 * Handle POST to navigation property (create related entity)
 */
export async function handleNavigationCreate(
  req: Request,
  res: Response,
  parentHandler: BaseHandler,
  parentEntityName: string,
  parentKeys: Record<string, unknown>,
  navigationProperty: string,
  schema: ODataSchemaConfig,
  query: ParsedQuery,
  basePath: string,
  models: Record<string, any>,
  handlers: Record<string, BaseHandler>
): Promise<void> {
  const parentEntity = schema.entities[parentEntityName];
  const navProp = parentEntity?.navigationProperties?.[navigationProperty];

  if (!navProp) {
    throw new ODataError(404, `Navigation property ${navigationProperty} not found`);
  }

  const targetEntityName = navProp.target;
  const targetHandler = handlers[targetEntityName];

  if (!targetHandler) {
    throw new ODataError(500, `Handler not found for ${targetEntityName}`);
  }

  // Get the association to determine the foreign key
  const association = findAssociation(parentEntityName, targetEntityName, schema);

  if (!association) {
    throw new ODataError(400, `Cannot create ${targetEntityName} via ${navigationProperty}`);
  }

  const body = req.body;

  if (!body || typeof body !== 'object') {
    throw new ODataError(400, 'Request body is required');
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

  const odataReq = req as ODataRequest;
  const ctx: HookContext = {
    req: req as any,
    res: res as any,
    query,
    entityName: targetEntityName,
    models,
    user: (req as any).user,
    data: {},
    correlationId: odataReq.correlationId,
    logger: odataReq.logger,
  };

  try {
    const result = await targetHandler.handleCreate(ctx, createData);

    const keys = extractKeys(result as Record<string, unknown>, targetEntityName, schema);
    const location = buildEntityUri(basePath, targetEntityName, keys, schema);

    const serialized = serializeEntity(
      result as Record<string, unknown>,
      targetEntityName,
      schema,
      basePath,
      query.$select
    );

    res.status(201).header('Location', location).json(serialized);
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(500, `Error creating ${targetEntityName}`, error as Error);
  }
}

/**
 * Transform input data according to schema
 */
function transformInputData(
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

    // Check if property exists in schema
    const propDef = entity.properties[key];
    const navProp = entity.navigationProperties?.[key];

    if (propDef) {
      // Transform value based on type
      transformed[propDef.column || key] = transformValue(value, propDef.type);
    } else if (navProp) {
      // Navigation property - include for deep create
      if (Array.isArray(value)) {
        transformed[key] = value.map((item) =>
          transformInputData(item as Record<string, unknown>, navProp.target, schema)
        );
      } else if (value && typeof value === 'object') {
        transformed[key] = transformInputData(
          value as Record<string, unknown>,
          navProp.target,
          schema
        );
      }
    } else {
      // Unknown property - pass through
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
      // Parse OData date format: /Date(timestamp)/ or ISO string
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
function extractKeys(
  data: Record<string, unknown>,
  entityName: string,
  schema: ODataSchemaConfig
): Record<string, unknown> {
  const entity = schema.entities[entityName];
  if (!entity) {
    return {};
  }

  const keys: Record<string, unknown> = {};
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
function findAssociation(
  entity1: string,
  entity2: string,
  schema: ODataSchemaConfig
) {
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
