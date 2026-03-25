import { Request, Response } from 'express';
import {
  ODataSchemaConfig,
  HookContext,
  FunctionImportHandler,
  FunctionImportDefinition,
  Logger,
} from '../config/types';
import { serializeEntitySet, serializeEntity, serializeValue } from '../serializers/json-serializer';
import { ODataError } from '../utils/errors';

/** Request with OData extensions */
interface ODataRequest extends Request {
  correlationId?: string;
  logger?: Logger;
}

/**
 * Handle function import execution
 */
export async function handleFunctionImport(
  req: Request,
  res: Response,
  functionName: string,
  schema: ODataSchemaConfig,
  basePath: string,
  models: Record<string, any>,
  functionImports: Record<string, FunctionImportHandler>,
  params: Record<string, unknown>
): Promise<void> {
  const funcDef = schema.functionImports?.[functionName];

  if (!funcDef) {
    throw new ODataError(404, `Function import ${functionName} not found`);
  }

  // Validate HTTP method
  if (req.method !== funcDef.httpMethod) {
    throw new ODataError(
      405,
      `Function import ${functionName} requires ${funcDef.httpMethod} method`
    );
  }

  // Get handler
  const handler = functionImports[functionName];

  if (!handler) {
    throw new ODataError(501, `Function import ${functionName} not implemented`);
  }

  // Validate and transform parameters
  const transformedParams = transformParameters(params, funcDef);

  // Create context
  const odataReq = req as ODataRequest;
  const ctx: HookContext = {
    req: req as any,
    res: res as any,
    query: {},
    entityName: '',
    models,
    user: (req as any).user,
    data: {},
    correlationId: odataReq.correlationId,
    logger: odataReq.logger,
  };

  try {
    const result = await handler(ctx, transformedParams);

    // Serialize result based on return type
    serializeFunctionResult(res, result, funcDef, schema, basePath);
  } catch (error) {
    if (error instanceof ODataError) {
      throw error;
    }
    throw new ODataError(
      500,
      `Error executing function ${functionName}`,
      error as Error
    );
  }
}

/**
 * Transform and validate function parameters
 */
function transformParameters(
  params: Record<string, unknown>,
  funcDef: FunctionImportDefinition
): Record<string, unknown> {
  if (!funcDef.parameters) {
    return {};
  }

  const transformed: Record<string, unknown> = {};

  for (const [paramName, paramDef] of Object.entries(funcDef.parameters)) {
    let value = params[paramName];

    // Check for required parameters
    if (value === undefined && paramDef.nullable === false) {
      throw new ODataError(400, `Required parameter ${paramName} is missing`);
    }

    // Transform value based on type
    if (value !== undefined && value !== null) {
      value = transformParameterValue(value, paramDef.type);
    }

    transformed[paramName] = value;
  }

  return transformed;
}

/**
 * Transform parameter value based on EDM type
 */
function transformParameterValue(value: unknown, edmType: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const strValue = String(value);

  switch (edmType) {
    case 'Edm.Int16':
    case 'Edm.Int32':
    case 'Edm.Int64':
    case 'Edm.Byte':
    case 'Edm.SByte':
      return parseInt(strValue, 10);

    case 'Edm.Single':
    case 'Edm.Double':
    case 'Edm.Decimal':
      return parseFloat(strValue);

    case 'Edm.Boolean':
      return strValue.toLowerCase() === 'true';

    case 'Edm.DateTime':
    case 'Edm.DateTimeOffset':
      // Handle OData date format
      const dateMatch = strValue.match(/datetime'([^']+)'/i);
      if (dateMatch) {
        return new Date(dateMatch[1]!);
      }
      return new Date(strValue);

    case 'Edm.Guid':
      // Remove quotes if present
      return strValue.replace(/^guid'|'$/gi, '');

    case 'Edm.String':
      // Remove surrounding quotes if present
      if (strValue.startsWith("'") && strValue.endsWith("'")) {
        return strValue.slice(1, -1).replace(/''/g, "'");
      }
      return strValue;

    default:
      return value;
  }
}

/**
 * Serialize function import result
 */
function serializeFunctionResult(
  res: Response,
  result: unknown,
  funcDef: FunctionImportDefinition,
  schema: ODataSchemaConfig,
  basePath: string
): void {
  if (result === undefined || result === null) {
    res.status(204).send();
    return;
  }

  const returnType = funcDef.returnType;

  if (!returnType) {
    // No return type defined - return as-is
    res.status(200).json({ d: result });
    return;
  }

  // Check for collection return type
  const collectionMatch = returnType.match(/^Collection\((.+)\)$/);

  if (collectionMatch) {
    const innerType = collectionMatch[1]!;

    if (innerType.startsWith('Edm.')) {
      // Collection of primitive types
      res.status(200).json({
        d: {
          results: Array.isArray(result) ? result : [result],
        },
      });
    } else {
      // Collection of entities
      const entityName = innerType.includes('.')
        ? innerType.split('.').pop()!
        : innerType;

      const serialized = serializeEntitySet(
        Array.isArray(result) ? result as Record<string, unknown>[] : [result as Record<string, unknown>],
        entityName,
        schema,
        basePath
      );
      res.status(200).json(serialized);
    }
    return;
  }

  // Single value return
  if (returnType.startsWith('Edm.')) {
    // Primitive type
    const serialized = serializeValue(result, returnType);
    res.status(200).json({ d: { [returnType]: serialized } });
  } else {
    // Entity type
    const entityName = returnType.includes('.')
      ? returnType.split('.').pop()!
      : returnType;

    const serialized = serializeEntity(
      result as Record<string, unknown>,
      entityName,
      schema,
      basePath
    );
    res.status(200).json(serialized);
  }
}

/**
 * Parse function import parameters from URL
 */
export function parseFunctionImportParams(
  urlParams: Record<string, unknown>,
  queryParams: Record<string, string | undefined>,
  funcDef: FunctionImportDefinition
): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // URL params (from path like /Func(param=value))
  for (const [key, value] of Object.entries(urlParams)) {
    if (key && value !== undefined) {
      params[key] = value;
    }
  }

  // Query params (from ?param=value)
  if (funcDef.parameters) {
    for (const paramName of Object.keys(funcDef.parameters)) {
      const queryValue = queryParams[paramName];
      if (queryValue !== undefined && params[paramName] === undefined) {
        params[paramName] = queryValue;
      }
    }
  }

  return params;
}
