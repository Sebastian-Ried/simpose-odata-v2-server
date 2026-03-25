import { DataTypes, DataType } from 'sequelize';
import { EdmType } from '../config/types';

/**
 * Map Sequelize data types to OData EDM types
 */
export function sequelizeToEdmType(sequelizeType: DataType): EdmType {
  const typeName = (sequelizeType as any).constructor?.name || '';
  const typeKey = (sequelizeType as any).key || typeName;

  switch (typeKey) {
    case 'STRING':
    case 'TEXT':
    case 'CITEXT':
    case 'CHAR':
    case 'VARCHAR':
      return 'Edm.String';

    case 'INTEGER':
    case 'MEDIUMINT':
      return 'Edm.Int32';

    case 'BIGINT':
      return 'Edm.Int64';

    case 'SMALLINT':
      return 'Edm.Int16';

    case 'TINYINT':
      return 'Edm.Byte';

    case 'FLOAT':
    case 'REAL':
      return 'Edm.Single';

    case 'DOUBLE':
    case 'DOUBLE PRECISION':
      return 'Edm.Double';

    case 'DECIMAL':
    case 'NUMERIC':
      return 'Edm.Decimal';

    case 'BOOLEAN':
      return 'Edm.Boolean';

    case 'DATE':
    case 'DATEONLY':
    case 'DATETIME':
      return 'Edm.DateTime';

    case 'TIME':
      return 'Edm.Time';

    case 'UUID':
    case 'UUIDV1':
    case 'UUIDV4':
      return 'Edm.Guid';

    case 'BLOB':
    case 'BINARY':
    case 'VARBINARY':
      return 'Edm.Binary';

    case 'JSON':
    case 'JSONB':
    case 'ARRAY':
    case 'GEOMETRY':
    case 'GEOGRAPHY':
    case 'HSTORE':
    case 'RANGE':
    case 'ENUM':
    case 'VIRTUAL':
    default:
      // Default to string for complex/unknown types
      return 'Edm.String';
  }
}

/**
 * Map OData EDM types to Sequelize data types
 */
export function edmToSequelizeType(edmType: EdmType): DataType {
  switch (edmType) {
    case 'Edm.String':
      return DataTypes.STRING as unknown as DataType;

    case 'Edm.Int16':
      return DataTypes.SMALLINT as unknown as DataType;

    case 'Edm.Int32':
      return DataTypes.INTEGER as unknown as DataType;

    case 'Edm.Int64':
      return DataTypes.BIGINT as unknown as DataType;

    case 'Edm.Byte':
      return DataTypes.TINYINT as unknown as DataType;

    case 'Edm.SByte':
      return DataTypes.TINYINT as unknown as DataType;

    case 'Edm.Single':
      return DataTypes.FLOAT as unknown as DataType;

    case 'Edm.Double':
      return DataTypes.DOUBLE as unknown as DataType;

    case 'Edm.Decimal':
      return DataTypes.DECIMAL as unknown as DataType;

    case 'Edm.Boolean':
      return DataTypes.BOOLEAN as unknown as DataType;

    case 'Edm.DateTime':
    case 'Edm.DateTimeOffset':
      return DataTypes.DATE as unknown as DataType;

    case 'Edm.Time':
      return DataTypes.TIME as unknown as DataType;

    case 'Edm.Guid':
      return DataTypes.UUID as unknown as DataType;

    case 'Edm.Binary':
      return DataTypes.BLOB as unknown as DataType;

    default:
      return DataTypes.STRING as unknown as DataType;
  }
}

/**
 * Convert a JavaScript value to OData literal format
 */
export function valueToODataLiteral(value: unknown, edmType: EdmType): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  switch (edmType) {
    case 'Edm.String':
      return `'${String(value).replace(/'/g, "''")}'`;

    case 'Edm.Int16':
    case 'Edm.Int32':
    case 'Edm.Byte':
    case 'Edm.SByte':
      return String(Math.floor(Number(value)));

    case 'Edm.Int64':
      return `${String(value)}L`;

    case 'Edm.Single':
      return `${String(value)}f`;

    case 'Edm.Double':
      return `${String(value)}d`;

    case 'Edm.Decimal':
      return `${String(value)}M`;

    case 'Edm.Boolean':
      return value ? 'true' : 'false';

    case 'Edm.DateTime':
      if (value instanceof Date) {
        return `datetime'${value.toISOString().replace('Z', '')}'`;
      }
      return `datetime'${String(value)}'`;

    case 'Edm.DateTimeOffset':
      if (value instanceof Date) {
        return `datetimeoffset'${value.toISOString()}'`;
      }
      return `datetimeoffset'${String(value)}'`;

    case 'Edm.Time':
      return `time'${String(value)}'`;

    case 'Edm.Guid':
      return `guid'${String(value)}'`;

    case 'Edm.Binary':
      if (Buffer.isBuffer(value)) {
        return `binary'${value.toString('hex')}'`;
      }
      return `binary'${String(value)}'`;

    default:
      return `'${String(value)}'`;
  }
}

/**
 * Parse an OData literal value to JavaScript
 */
export function odataLiteralToValue(literal: string | unknown, edmType?: EdmType): unknown {
  // Handle non-string literals (already parsed values)
  if (typeof literal !== 'string') {
    if (edmType === 'Edm.String') return String(literal);
    return literal;
  }

  if (literal === 'null') {
    return null;
  }

  // String literal
  if (literal.startsWith("'") && literal.endsWith("'")) {
    const raw = literal.slice(1, -1).replace(/''/g, "'");
    try { return decodeURIComponent(raw); } catch { return raw; }
  }

  // If edmType explicitly says Edm.String, don't infer numeric types from unquoted values.
  // parseKeyString strips OData quotes before parseEntityKeys re-calls with edmType,
  // so a value like '09764' arrives here as plain 09764 and must not be parsed as integer.
  if (edmType === 'Edm.String') {
    try { return decodeURIComponent(literal); } catch { return literal; }
  }

  // DateTime literal
  const dateTimeMatch = literal.match(/^datetime'(.+)'$/i);
  if (dateTimeMatch) {
    return new Date(dateTimeMatch[1]!);
  }

  // DateTimeOffset literal
  const dateTimeOffsetMatch = literal.match(/^datetimeoffset'(.+)'$/i);
  if (dateTimeOffsetMatch) {
    return new Date(dateTimeOffsetMatch[1]!);
  }

  // Time literal
  const timeMatch = literal.match(/^time'(.+)'$/i);
  if (timeMatch) {
    return timeMatch[1];
  }

  // Guid literal
  const guidMatch = literal.match(/^guid'(.+)'$/i);
  if (guidMatch) {
    return guidMatch[1];
  }

  // Binary literal
  const binaryMatch = literal.match(/^binary'(.+)'$/i);
  if (binaryMatch) {
    return Buffer.from(binaryMatch[1]!, 'hex');
  }

  // Boolean
  if (literal === 'true') return true;
  if (literal === 'false') return false;

  // Int64 (with L suffix)
  if (literal.endsWith('L') || literal.endsWith('l')) {
    return BigInt(literal.slice(0, -1));
  }

  // Single (with f suffix)
  if (literal.endsWith('f') || literal.endsWith('F')) {
    return parseFloat(literal.slice(0, -1));
  }

  // Double (with d suffix)
  if (literal.endsWith('d') || literal.endsWith('D')) {
    return parseFloat(literal.slice(0, -1));
  }

  // Decimal (with M suffix)
  if (literal.endsWith('M') || literal.endsWith('m')) {
    return parseFloat(literal.slice(0, -1));
  }

  // Plain number
  if (/^-?\d+$/.test(literal)) {
    return parseInt(literal, 10);
  }

  if (/^-?\d+\.\d+$/.test(literal)) {
    return parseFloat(literal);
  }

  return literal;
}

/**
 * Get the default SRID for EDM Geometry types
 */
export function getDefaultSrid(edmType: EdmType): number | undefined {
  // OData V2 doesn't have native geometry support
  return undefined;
}
