"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUri = parseUri;
exports.buildEntityUri = buildEntityUri;
const type_mapping_1 = require("../metadata/type-mapping");
/** Maximum length for URI key strings to prevent DoS */
const MAX_KEY_STRING_LENGTH = 4096;
/** Maximum number of key-value pairs in a composite key */
const MAX_KEY_PAIRS = 20;
/** Maximum length for a single key value */
const MAX_KEY_VALUE_LENGTH = 1024;
/**
 * Parse OData URI path into segments
 */
function parseUri(path, schema) {
    const segments = [];
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    if (!normalizedPath) {
        return segments;
    }
    // Security: Limit total path length to prevent DoS
    if (normalizedPath.length > MAX_KEY_STRING_LENGTH * 2) {
        throw new Error(`URI path exceeds maximum length`);
    }
    const parts = normalizedPath.split('/');
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // System resources
        if (part === '$metadata') {
            segments.push({ type: '$metadata', name: '$metadata' });
            continue;
        }
        if (part === '$batch') {
            segments.push({ type: '$batch', name: '$batch' });
            continue;
        }
        if (part === '$count') {
            segments.push({ type: '$count', name: '$count' });
            continue;
        }
        if (part === '$value') {
            segments.push({ type: 'value', name: '$value' });
            continue;
        }
        // Entity set or entity with keys
        // Security: Use bounded match with length limit to prevent ReDoS
        // Match: Name(keys) where keys is limited in length
        const keyMatch = part.match(/^([A-Za-z_][A-Za-z0-9_]{0,127})\((.{1,4096})\)$/);
        if (keyMatch) {
            const name = keyMatch[1];
            const keyString = keyMatch[2];
            // Security: Validate key string length
            if (keyString.length > MAX_KEY_STRING_LENGTH) {
                throw new Error(`Key string exceeds maximum length of ${MAX_KEY_STRING_LENGTH}`);
            }
            // Check if this is a function import
            if (schema.functionImports?.[name]) {
                segments.push({
                    type: 'functionImport',
                    name,
                    keys: parseKeyString(keyString),
                });
                continue;
            }
            // It's an entity reference
            if (schema.entities[name]) {
                const keys = parseEntityKeys(keyString, name, schema);
                segments.push({ type: 'entity', name, keys });
            }
            else if (segments.length > 0) {
                // Navigation property with keys
                const keys = parseKeyString(keyString);
                segments.push({ type: 'navigation', name, keys });
            }
            continue;
        }
        // Simple name (entity set, navigation property, or property)
        if (schema.entities[part]) {
            segments.push({ type: 'entitySet', name: part });
        }
        else if (schema.functionImports?.[part]) {
            segments.push({ type: 'functionImport', name: part });
        }
        else if (segments.length > 0) {
            // Could be navigation property or property
            const lastSegment = segments[segments.length - 1];
            const entityName = getEntityNameFromSegment(lastSegment, schema);
            if (entityName) {
                const entity = schema.entities[entityName];
                if (entity?.navigationProperties?.[part]) {
                    segments.push({ type: 'navigation', name: part });
                }
                else if (entity?.properties[part]) {
                    segments.push({ type: 'property', name: part });
                }
                else {
                    // Unknown segment - treat as navigation
                    segments.push({ type: 'navigation', name: part });
                }
            }
            else {
                segments.push({ type: 'navigation', name: part });
            }
        }
    }
    return segments;
}
/**
 * Parse entity keys from URI segment
 */
function parseEntityKeys(keyString, entityName, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return parseKeyString(keyString);
    }
    const keys = parseKeyString(keyString);
    // If single key without name, use entity's primary key
    if (Object.keys(keys).length === 1 && keys['']) {
        const primaryKey = entity.keys[0];
        const edmType = entity.properties[primaryKey]?.type;
        const value = (0, type_mapping_1.odataLiteralToValue)(keys[''], edmType);
        return { [primaryKey]: value };
    }
    // Parse typed values
    const typedKeys = {};
    for (const [keyName, keyValue] of Object.entries(keys)) {
        const edmType = entity.properties[keyName]?.type;
        typedKeys[keyName] = (0, type_mapping_1.odataLiteralToValue)(keyValue, edmType);
    }
    return typedKeys;
}
/**
 * Parse key string into key-value pairs
 */
function parseKeyString(keyString) {
    // Security: Validate key string length
    if (keyString.length > MAX_KEY_STRING_LENGTH) {
        throw new Error(`Key string exceeds maximum length of ${MAX_KEY_STRING_LENGTH}`);
    }
    const keys = {};
    // Single value (no key name)
    if (!keyString.includes('=')) {
        // Security: Validate single value length
        if (keyString.length > MAX_KEY_VALUE_LENGTH) {
            throw new Error(`Key value exceeds maximum length of ${MAX_KEY_VALUE_LENGTH}`);
        }
        // Remove surrounding quotes for string values
        let value = keyString;
        if (keyString.startsWith("'") && keyString.endsWith("'")) {
            value = decodeURIComponent(keyString.slice(1, -1).replace(/''/g, "'"));
        }
        else if (/^-?\d+$/.test(keyString)) {
            value = parseInt(keyString, 10);
        }
        else if (/^-?\d+\.\d+$/.test(keyString)) {
            value = parseFloat(keyString);
        }
        keys[''] = value;
        return keys;
    }
    // Multiple key-value pairs
    const pairs = splitKeyPairs(keyString);
    // Security: Limit number of key pairs
    if (pairs.length > MAX_KEY_PAIRS) {
        throw new Error(`Number of key pairs exceeds maximum of ${MAX_KEY_PAIRS}`);
    }
    for (const pair of pairs) {
        // Security: Validate individual pair length
        if (pair.length > MAX_KEY_VALUE_LENGTH) {
            throw new Error(`Key pair exceeds maximum length of ${MAX_KEY_VALUE_LENGTH}`);
        }
        const eqIndex = pair.indexOf('=');
        if (eqIndex > 0) {
            const name = pair.slice(0, eqIndex).trim();
            let value = pair.slice(eqIndex + 1).trim();
            // Parse value
            if (typeof value === 'string') {
                value = (0, type_mapping_1.odataLiteralToValue)(value);
            }
            keys[name] = value;
        }
    }
    return keys;
}
/**
 * Split key string by commas, respecting quotes
 */
function splitKeyPairs(keyString) {
    // Security: Validate input length
    if (keyString.length > MAX_KEY_STRING_LENGTH) {
        throw new Error(`Key string exceeds maximum length`);
    }
    const pairs = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < keyString.length; i++) {
        const char = keyString[i];
        if (char === "'" && keyString[i + 1] === "'") {
            // Escaped quote
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
            // Security: Limit number of pairs during parsing
            if (pairs.length > MAX_KEY_PAIRS) {
                throw new Error(`Number of key pairs exceeds maximum of ${MAX_KEY_PAIRS}`);
            }
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
 * Get entity name from a segment
 */
function getEntityNameFromSegment(segment, schema) {
    if (segment.type === 'entitySet' || segment.type === 'entity') {
        return segment.name;
    }
    if (segment.type === 'navigation') {
        // Find the navigation property definition
        for (const entity of Object.values(schema.entities)) {
            const nav = entity.navigationProperties?.[segment.name];
            if (nav) {
                return nav.target;
            }
        }
    }
    return null;
}
/**
 * Build canonical URI for an entity
 */
function buildEntityUri(basePath, entityName, keys, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return `${basePath}/${entityName}`;
    }
    let keyString;
    if (entity.keys.length === 1) {
        // Single key - just value
        const keyName = entity.keys[0];
        const keyValue = keys[keyName];
        const edmType = entity.properties[keyName]?.type || 'Edm.String';
        keyString = formatKeyValue(keyValue, edmType);
    }
    else {
        // Composite key - name=value pairs
        const pairs = [];
        for (const keyName of entity.keys) {
            const keyValue = keys[keyName];
            const edmType = entity.properties[keyName]?.type || 'Edm.String';
            pairs.push(`${keyName}=${formatKeyValue(keyValue, edmType)}`);
        }
        keyString = pairs.join(',');
    }
    return `${basePath}/${entityName}(${keyString})`;
}
/**
 * Format key value for URI
 */
function formatKeyValue(value, edmType) {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (edmType === 'Edm.String' || edmType === 'Edm.Guid') {
        return `'${String(value).replace(/'/g, "''")}'`;
    }
    return String(value);
}
//# sourceMappingURL=uri-parser.js.map