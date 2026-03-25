"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEntityUri = buildEntityUri;
exports.buildNavigationUri = buildNavigationUri;
exports.buildLinksUri = buildLinksUri;
exports.parseEntityUri = parseEntityUri;
/**
 * Build canonical URI for an entity
 */
function buildEntityUri(basePath, entityName, keys, schema) {
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
function buildKeyString(keys, keyNames, properties) {
    if (keyNames.length === 1) {
        // Single key - just the value
        const keyName = keyNames[0];
        const value = keys[keyName];
        const edmType = properties[keyName]?.type || 'Edm.String';
        return formatKeyValue(value, edmType);
    }
    // Multiple keys - name=value pairs
    const pairs = [];
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
function formatKeyValue(value, edmType) {
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
function buildNavigationUri(basePath, entityName, keys, navigationProperty, schema) {
    const entityUri = buildEntityUri(basePath, entityName, keys, schema);
    return `${entityUri}/${navigationProperty}`;
}
/**
 * Build URI for $links
 */
function buildLinksUri(basePath, entityName, keys, navigationProperty, schema) {
    const entityUri = buildEntityUri(basePath, entityName, keys, schema);
    return `${entityUri}/$links/${navigationProperty}`;
}
/**
 * Parse entity URI to extract entity name and keys
 */
function parseEntityUri(uri) {
    // Match patterns like /EntityName(key) or /EntityName(key1=value1,key2=value2)
    const match = uri.match(/\/([A-Za-z_][A-Za-z0-9_]*)\(([^)]+)\)(?:\/|$)/);
    if (!match) {
        return null;
    }
    const entityName = match[1];
    const keyString = match[2];
    const keys = parseKeyString(keyString);
    return { entityName, keys };
}
/**
 * Parse key string from URI
 */
function parseKeyString(keyString) {
    const keys = {};
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
function splitKeyPairs(keyString) {
    const pairs = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < keyString.length; i++) {
        const char = keyString[i];
        if (char === "'" && keyString[i + 1] === "'") {
            current += "''";
            i++;
        }
        else if (char === "'") {
            inQuote = !inQuote;
            current += char;
        }
        else if (char === ',' && !inQuote) {
            pairs.push(current.trim());
            current = '';
        }
        else {
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
function parseKeyValue(valueStr) {
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
        return new Date(dateMatch[1]);
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
    if (valueStr === 'true')
        return true;
    if (valueStr === 'false')
        return false;
    // Null
    if (valueStr === 'null')
        return null;
    return valueStr;
}
//# sourceMappingURL=uri-builder.js.map