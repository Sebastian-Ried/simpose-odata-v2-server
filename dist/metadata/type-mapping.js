"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelizeToEdmType = sequelizeToEdmType;
exports.edmToSequelizeType = edmToSequelizeType;
exports.valueToODataLiteral = valueToODataLiteral;
exports.odataLiteralToValue = odataLiteralToValue;
exports.getDefaultSrid = getDefaultSrid;
const sequelize_1 = require("sequelize");
/**
 * Map Sequelize data types to OData EDM types
 */
function sequelizeToEdmType(sequelizeType) {
    const typeName = sequelizeType.constructor?.name || '';
    const typeKey = sequelizeType.key || typeName;
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
function edmToSequelizeType(edmType) {
    switch (edmType) {
        case 'Edm.String':
            return sequelize_1.DataTypes.STRING;
        case 'Edm.Int16':
            return sequelize_1.DataTypes.SMALLINT;
        case 'Edm.Int32':
            return sequelize_1.DataTypes.INTEGER;
        case 'Edm.Int64':
            return sequelize_1.DataTypes.BIGINT;
        case 'Edm.Byte':
            return sequelize_1.DataTypes.TINYINT;
        case 'Edm.SByte':
            return sequelize_1.DataTypes.TINYINT;
        case 'Edm.Single':
            return sequelize_1.DataTypes.FLOAT;
        case 'Edm.Double':
            return sequelize_1.DataTypes.DOUBLE;
        case 'Edm.Decimal':
            return sequelize_1.DataTypes.DECIMAL;
        case 'Edm.Boolean':
            return sequelize_1.DataTypes.BOOLEAN;
        case 'Edm.DateTime':
        case 'Edm.DateTimeOffset':
            return sequelize_1.DataTypes.DATE;
        case 'Edm.Time':
            return sequelize_1.DataTypes.TIME;
        case 'Edm.Guid':
            return sequelize_1.DataTypes.UUID;
        case 'Edm.Binary':
            return sequelize_1.DataTypes.BLOB;
        default:
            return sequelize_1.DataTypes.STRING;
    }
}
/**
 * Convert a JavaScript value to OData literal format
 */
function valueToODataLiteral(value, edmType) {
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
function odataLiteralToValue(literal, edmType) {
    // Handle non-string literals (already parsed values)
    if (typeof literal !== 'string') {
        if (edmType === 'Edm.String')
            return String(literal);
        return literal;
    }
    if (literal === 'null') {
        return null;
    }
    // String literal
    if (literal.startsWith("'") && literal.endsWith("'")) {
        const raw = literal.slice(1, -1).replace(/''/g, "'");
        try {
            return decodeURIComponent(raw);
        }
        catch {
            return raw;
        }
    }
    // If edmType explicitly says Edm.String, don't infer numeric types from unquoted values.
    // parseKeyString strips OData quotes before parseEntityKeys re-calls with edmType,
    // so a value like '09764' arrives here as plain 09764 and must not be parsed as integer.
    if (edmType === 'Edm.String') {
        try {
            return decodeURIComponent(literal);
        }
        catch {
            return literal;
        }
    }
    // DateTime literal
    const dateTimeMatch = literal.match(/^datetime'(.+)'$/i);
    if (dateTimeMatch) {
        return new Date(dateTimeMatch[1]);
    }
    // DateTimeOffset literal
    const dateTimeOffsetMatch = literal.match(/^datetimeoffset'(.+)'$/i);
    if (dateTimeOffsetMatch) {
        return new Date(dateTimeOffsetMatch[1]);
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
        return Buffer.from(binaryMatch[1], 'hex');
    }
    // Boolean
    if (literal === 'true')
        return true;
    if (literal === 'false')
        return false;
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
function getDefaultSrid(edmType) {
    // OData V2 doesn't have native geometry support
    return undefined;
}
//# sourceMappingURL=type-mapping.js.map