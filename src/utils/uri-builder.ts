import { ODataSchemaConfig } from '../config/types';
import { valueToODataLiteral } from '../metadata/type-mapping';

/**
 * Build canonical URI for an entity
 */
export function buildEntityUri(
  basePath: string,
  entityName: string,
  keys: Record<string, unknown>,
  schema: ODataSchemaConfig
): string {
  const entity = schema.entities[entityName];
  if (!entity) {
    return `${basePath}/${entityName}`;
  }

  const keyString = buildKeyString(keys, entity.keys, entity.properties);
  return `${basePath}/${entityName}(${keyString})`;
}

/**
 * Build key string for entity URI
 */
function buildKeyString(
  keys: Record<string, unknown>,
  keyNames: string[],
  properties: Record<string, { type: string }>
): string {
  if (keyNames.length === 1) {
    // Single key - just the value
    const keyName = keyNames[0]!;
    const value = keys[keyName];
    const edmType = properties[keyName]?.type || 'Edm.String';
    return formatKeyValue(value, edmType);
  }

  // Multiple keys - name=value pairs
  const pairs: string[] = [];
  for (const keyName of keyNames) {
    const value = keys[keyName];
    const edmType = properties[keyName]?.type || 'Edm.String';
    pairs.push(`${keyName}=${formatKeyValue(value, edmType)}`);
  }
  return pairs.join(',');
}

/**
 * Format a key value for URI
 */
function formatKeyValue(value: unknown, edmType: string): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  switch (edmType) {
    case 'Edm.String':
      return `'${String(value).replace(/'/g, "''")}'`;

    case 'Edm.Guid':
      return `guid'${String(value)}'`;

    case 'Edm.DateTime':
      if (value instanceof Date) {
        return `datetime'${value.toISOString().replace('Z', '')}'`;
      }
      return `datetime'${String(value)}'`;

    case 'Edm.Int64':
      return `${String(value)}L`;

    case 'Edm.Decimal':
      return `${String(value)}M`;

    case 'Edm.Double':
      return `${String(value)}D`;

    case 'Edm.Single':
      return `${String(value)}F`;

    case 'Edm.Binary':
      if (Buffer.isBuffer(value)) {
        return `binary'${value.toString('hex')}'`;
      }
      return `binary'${String(value)}'`;

    default:
      return String(value);
  }
}

/**
 * Build URI for navigation property
 */
export function buildNavigationUri(
  basePath: string,
  entityName: string,
  keys: Record<string, unknown>,
  navigationProperty: string,
  schema: ODataSchemaConfig
): string {
  const entityUri = buildEntityUri(basePath, entityName, keys, schema);
  return `${entityUri}/${navigationProperty}`;
}

/**
 * Build URI for $links
 */
export function buildLinksUri(
  basePath: string,
  entityName: string,
  keys: Record<string, unknown>,
  navigationProperty: string,
  schema: ODataSchemaConfig
): string {
  const entityUri = buildEntityUri(basePath, entityName, keys, schema);
  return `${entityUri}/$links/${navigationProperty}`;
}

/**
 * Parse entity URI to extract entity name and keys
 */
export function parseEntityUri(uri: string): {
  entityName: string;
  keys: Record<string, unknown>;
} | null {
  // Match patterns like /EntityName(key) or /EntityName(key1=value1,key2=value2)
  const match = uri.match(/\/([A-Za-z_][A-Za-z0-9_]*)\(([^)]+)\)(?:\/|$)/);

  if (!match) {
    return null;
  }

  const entityName = match[1]!;
  const keyString = match[2]!;
  const keys = parseKeyString(keyString);

  return { entityName, keys };
}

/**
 * Parse key string from URI
 */
function parseKeyString(keyString: string): Record<string, unknown> {
  const keys: Record<string, unknown> = {};

  // Check for single value vs. key=value pairs
  if (!keyString.includes('=')) {
    // Single value - parse the value
    keys[''] = parseKeyValue(keyString);
    return keys;
  }

  // Multiple key=value pairs
  const pairs = splitKeyPairs(keyString);

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      const name = pair.slice(0, eqIndex).trim();
      const valueStr = pair.slice(eqIndex + 1).trim();
      keys[name] = parseKeyValue(valueStr);
    }
  }

  return keys;
}

/**
 * Split key pairs respecting quotes
 */
function splitKeyPairs(keyString: string): string[] {
  const pairs: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < keyString.length; i++) {
    const char = keyString[i]!;

    if (char === "'" && keyString[i + 1] === "'") {
      current += "''";
      i++;
    } else if (char === "'") {
      inQuote = !inQuote;
      current += char;
    } else if (char === ',' && !inQuote) {
      pairs.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    pairs.push(current.trim());
  }

  return pairs;
}

/**
 * Parse a key value from string
 */
function parseKeyValue(valueStr: string): unknown {
  // String literal
  if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
    return valueStr.slice(1, -1).replace(/''/g, "'");
  }

  // Guid
  const guidMatch = valueStr.match(/^guid'([^']+)'$/i);
  if (guidMatch) {
    return guidMatch[1];
  }

  // DateTime
  const dateMatch = valueStr.match(/^datetime'([^']+)'$/i);
  if (dateMatch) {
    return new Date(dateMatch[1]!);
  }

  // Numbers with suffixes
  if (valueStr.endsWith('L') || valueStr.endsWith('l')) {
    return BigInt(valueStr.slice(0, -1));
  }
  if (valueStr.endsWith('M') || valueStr.endsWith('m')) {
    return parseFloat(valueStr.slice(0, -1));
  }
  if (valueStr.endsWith('D') || valueStr.endsWith('d')) {
    return parseFloat(valueStr.slice(0, -1));
  }
  if (valueStr.endsWith('F') || valueStr.endsWith('f')) {
    return parseFloat(valueStr.slice(0, -1));
  }

  // Integer
  if (/^-?\d+$/.test(valueStr)) {
    return parseInt(valueStr, 10);
  }

  // Float
  if (/^-?\d+\.\d+$/.test(valueStr)) {
    return parseFloat(valueStr);
  }

  // Boolean
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;

  // Null
  if (valueStr === 'null') return null;

  return valueStr;
}
