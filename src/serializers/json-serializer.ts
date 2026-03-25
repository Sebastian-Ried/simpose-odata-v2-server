import {
  ODataSchemaConfig,
  EntityMetadata,
  PropertyDefinition,
} from '../config/types';
import { buildEntityUri } from '../parser/uri-parser';
import { valueToODataLiteral } from '../metadata/type-mapping';
import { generateETag } from '../utils/etag';

/**
 * Serialize an entity set to OData V2 JSON format
 */
export function serializeEntitySet(
  results: Record<string, unknown>[],
  entityName: string,
  schema: ODataSchemaConfig,
  basePath: string,
  select?: string[],
  count?: number,
  includeCount: boolean = false
): object {
  const serializedResults = results.map((entity) =>
    serializeEntityData(entity, entityName, schema, basePath, select)
  );

  const response: any = {
    d: {
      results: serializedResults,
    },
  };

  // Add inline count if requested
  if (includeCount && count !== undefined) {
    response.d.__count = String(count);
  }

  return response;
}

/**
 * Serialize a single entity to OData V2 JSON format
 */
export function serializeEntity(
  entity: Record<string, unknown>,
  entityName: string,
  schema: ODataSchemaConfig,
  basePath: string,
  select?: string[]
): object {
  return {
    d: serializeEntityData(entity, entityName, schema, basePath, select),
  };
}

/**
 * Serialize entity data with metadata
 */
function serializeEntityData(
  entity: Record<string, unknown>,
  entityName: string,
  schema: ODataSchemaConfig,
  basePath: string,
  select?: string[]
): Record<string, unknown> {
  const entityDef = schema.entities[entityName];
  if (!entityDef) {
    return entity;
  }

  // Build entity keys
  const keys: Record<string, unknown> = {};
  for (const keyName of entityDef.keys) {
    keys[keyName] = entity[keyName];
  }

  // Build metadata
  const metadata: EntityMetadata = {
    uri: buildEntityUri(basePath, entityName, keys, schema),
    type: `${schema.namespace}.${entityName}`,
  };

  // Add ETag based on entity timestamp (updatedAt / createdAt).
  // Only generate ETags for complete entities — a partial entity (with $select)
  // would produce an ETag that cannot be validated on update.
  if (!select || select.length === 0) {
    const etag = generateETag(entity);
    if (etag) {
      metadata.etag = etag;
    }
  }

  const result: Record<string, unknown> = {
    __metadata: metadata,
  };

  // Serialize properties
  for (const [propName, propDef] of Object.entries(entityDef.properties)) {
    // Skip if not selected
    if (select && select.length > 0 && !select.includes(propName) && !entityDef.keys.includes(propName)) {
      continue;
    }

    const columnName = propDef.column || propName;
    const hasValue = (columnName in entity) || (propName in entity);

    // Skip virtual properties not present in the entity object (not injected by afterRead hook).
    // This prevents expansion serialization from writing null over hook-injected values in the
    // UI5 OData model cache when the top-level afterRead hook did not run for the nested entity.
    if (propDef.virtual && !hasValue) {
      continue;
    }

    const value = entity[columnName] ?? entity[propName];
    result[propName] = serializePropertyValue(value, propDef);
  }

  // Serialize navigation properties if expanded
  if (entityDef.navigationProperties) {
    for (const [navName, navProp] of Object.entries(entityDef.navigationProperties)) {
      const navValue = entity[navName];

      if (navValue !== undefined) {
        if (Array.isArray(navValue)) {
          // Collection navigation property
          result[navName] = {
            results: navValue.map((item) =>
              serializeEntityData(
                item as Record<string, unknown>,
                navProp.target,
                schema,
                basePath
              )
            ),
          };
        } else if (navValue !== null) {
          // Single navigation property
          result[navName] = serializeEntityData(
            navValue as Record<string, unknown>,
            navProp.target,
            schema,
            basePath
          );
        }
      } else {
        // Deferred link
        result[navName] = {
          __deferred: {
            uri: `${buildEntityUri(basePath, entityName, keys, schema)}/${navName}`,
          },
        };
      }
    }
  }

  return result;
}

/**
 * Serialize a property value based on its type
 */
function serializePropertyValue(
  value: unknown,
  propDef: PropertyDefinition
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (propDef.type) {
    case 'Edm.DateTime':
    case 'Edm.DateTimeOffset':
      return serializeDateTime(value);

    case 'Edm.Time':
      return serializeTime(value);

    case 'Edm.Binary':
      return serializeBinary(value);

    case 'Edm.Int64':
      // Return as string to preserve precision
      return String(value);

    case 'Edm.Decimal':
      // Return as string to preserve precision
      return String(value);

    case 'Edm.Guid':
      return String(value);

    default:
      return value;
  }
}

/**
 * Serialize DateTime to OData format
 */
function serializeDateTime(value: unknown): string {
  if (value instanceof Date) {
    return `/Date(${value.getTime()})/`;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return `/Date(${date.getTime()})/`;
    }
  }

  if (typeof value === 'number') {
    return `/Date(${value})/`;
  }

  return String(value);
}

/**
 * Serialize Time to OData format
 */
function serializeTime(value: unknown): string {
  if (typeof value === 'string') {
    // Format: PT{hours}H{minutes}M{seconds}S
    const parts = value.split(':');
    if (parts.length >= 2) {
      const hours = parts[0];
      const minutes = parts[1];
      const seconds = parts[2] || '0';
      return `PT${hours}H${minutes}M${seconds}S`;
    }
  }

  return String(value);
}

/**
 * Serialize Binary to Base64
 */
function serializeBinary(value: unknown): string {
  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value);
}

/**
 * Serialize a primitive value for function import results
 */
export function serializeValue(value: unknown, edmType: string): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (edmType) {
    case 'Edm.DateTime':
    case 'Edm.DateTimeOffset':
      return serializeDateTime(value);

    case 'Edm.Time':
      return serializeTime(value);

    case 'Edm.Binary':
      return serializeBinary(value);

    case 'Edm.Int64':
    case 'Edm.Decimal':
      return String(value);

    default:
      return value;
  }
}

/**
 * Serialize error response
 */
export function serializeError(
  code: string,
  message: string,
  innerError?: { message: string; type: string; stacktrace?: string }
): object {
  const error: any = {
    code,
    message: {
      lang: 'en',
      value: message,
    },
  };

  if (innerError) {
    error.innererror = innerError;
  }

  return { error };
}
