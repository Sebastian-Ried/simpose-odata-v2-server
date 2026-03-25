import { ODataSchemaConfig } from '../config/types';

/**
 * Build Sequelize attributes from $select options
 */
export function buildSelect(
  select: string[],
  entityName: string,
  schema: ODataSchemaConfig
): string[] {
  const entity = schema.entities[entityName];
  if (!entity) {
    return select;
  }

  // Separate properties from navigation properties
  const properties: string[] = [];

  for (const item of select) {
    // Handle nested selection (Property/SubProperty)
    const baseProp = item.split('/')[0]!;

    // Check if it's a regular non-virtual property
    if (entity.properties[baseProp] && !entity.properties[baseProp].virtual) {
      // Add the base property (Sequelize doesn't support nested property selection)
      if (!properties.includes(baseProp)) {
        properties.push(baseProp);
      }
    }
    // Navigation properties are handled by $expand
  }

  // Always include primary keys
  for (const key of entity.keys) {
    if (!properties.includes(key)) {
      properties.push(key);
    }
  }

  // Always include timestamp fields for consistent ETag generation
  const timestampFields = ['updatedAt', 'updated_at', 'createdAt', 'created_at'];
  for (const ts of timestampFields) {
    if (entity.properties[ts] && !properties.includes(ts)) {
      properties.push(ts);
    }
  }

  return properties;
}

/**
 * Build attribute exclusion list
 */
export function buildExclude(
  exclude: string[],
  entityName: string,
  schema: ODataSchemaConfig
): string[] {
  const entity = schema.entities[entityName];
  if (!entity) {
    return exclude;
  }

  // Filter to only include valid properties
  return exclude.filter((prop) => entity.properties[prop]);
}

/**
 * Check if $select includes specific property
 */
export function isPropertySelected(
  property: string,
  select: string[] | undefined,
  entityName: string,
  schema: ODataSchemaConfig
): boolean {
  // If no $select, all properties are selected
  if (!select || select.length === 0) {
    return true;
  }

  const entity = schema.entities[entityName];
  if (!entity) {
    return select.includes(property);
  }

  // Keys are always selected
  if (entity.keys.includes(property)) {
    return true;
  }

  // Check direct property selection
  if (select.includes(property)) {
    return true;
  }

  // Check if property is part of a path (Property/SubProperty)
  for (const item of select) {
    if (item.startsWith(`${property}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter result object to only include selected properties
 */
export function filterSelectedProperties(
  data: Record<string, unknown>,
  select: string[] | undefined,
  entityName: string,
  schema: ODataSchemaConfig
): Record<string, unknown> {
  // If no $select, return all properties
  if (!select || select.length === 0) {
    return data;
  }

  const entity = schema.entities[entityName];
  if (!entity) {
    return data;
  }

  const result: Record<string, unknown> = {};

  // Always include keys
  for (const key of entity.keys) {
    if (data[key] !== undefined) {
      result[key] = data[key];
    }
  }

  // Include selected properties
  for (const prop of select) {
    const baseProp = prop.split('/')[0]!;
    if (data[baseProp] !== undefined) {
      result[baseProp] = data[baseProp];
    }
  }

  return result;
}

/**
 * Get all property names for an entity (excluding navigation properties)
 */
export function getAllPropertyNames(
  entityName: string,
  schema: ODataSchemaConfig
): string[] {
  const entity = schema.entities[entityName];
  if (!entity) {
    return [];
  }

  return Object.keys(entity.properties);
}

/**
 * Get all navigation property names for an entity
 */
export function getAllNavigationPropertyNames(
  entityName: string,
  schema: ODataSchemaConfig
): string[] {
  const entity = schema.entities[entityName];
  if (!entity || !entity.navigationProperties) {
    return [];
  }

  return Object.keys(entity.navigationProperties);
}
