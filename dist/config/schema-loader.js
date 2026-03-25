"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaValidationError = void 0;
exports.loadSchema = loadSchema;
exports.inferSchemaFromModels = inferSchemaFromModels;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Dangerous path patterns to block */
const DANGEROUS_PATH_PATTERNS = [
    /\.\.\//, // Parent directory traversal
    /\.\.\\/, // Windows parent directory traversal
];
/**
 * Validation error for schema configuration
 */
class SchemaValidationError extends Error {
    path;
    constructor(message, path) {
        super(path ? `${path}: ${message}` : message);
        this.path = path;
        this.name = 'SchemaValidationError';
    }
}
exports.SchemaValidationError = SchemaValidationError;
/**
 * Load and validate OData schema configuration
 */
function loadSchema(schemaOrPath) {
    let schema;
    if (typeof schemaOrPath === 'string') {
        // Security: Check for path traversal attempts
        for (const pattern of DANGEROUS_PATH_PATTERNS) {
            if (pattern.test(schemaOrPath)) {
                throw new SchemaValidationError('Path traversal detected in schema path');
            }
        }
        const resolvedPath = path.resolve(schemaOrPath);
        // Security: Ensure the resolved path doesn't escape to unexpected directories
        const cwd = process.cwd();
        if (!resolvedPath.startsWith(cwd) && !path.isAbsolute(schemaOrPath)) {
            throw new SchemaValidationError('Schema path must be within the application directory');
        }
        if (!fs.existsSync(resolvedPath)) {
            throw new SchemaValidationError(`Schema file not found: ${resolvedPath}`);
        }
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        try {
            schema = JSON.parse(content);
        }
        catch (e) {
            throw new SchemaValidationError(`Invalid JSON in schema file: ${e.message}`, resolvedPath);
        }
    }
    else {
        // Deep clone to prevent mutation of the original schema object
        schema = JSON.parse(JSON.stringify(schemaOrPath));
    }
    validateSchema(schema);
    return normalizeSchema(schema);
}
/**
 * Validate the schema configuration
 */
function validateSchema(schema) {
    if (!schema.namespace || typeof schema.namespace !== 'string') {
        throw new SchemaValidationError('namespace is required and must be a string');
    }
    if (!schema.entities || typeof schema.entities !== 'object') {
        throw new SchemaValidationError('entities is required and must be an object');
    }
    for (const [entityName, entity] of Object.entries(schema.entities)) {
        validateEntity(entityName, entity, schema);
    }
    if (schema.associations) {
        for (const [assocName, assoc] of Object.entries(schema.associations)) {
            validateAssociation(assocName, assoc, schema);
        }
    }
    if (schema.functionImports) {
        for (const [funcName, func] of Object.entries(schema.functionImports)) {
            validateFunctionImport(funcName, func);
        }
    }
}
/**
 * Validate entity definition
 */
function validateEntity(name, entity, schema) {
    const path = `entities.${name}`;
    if (!entity.keys || !Array.isArray(entity.keys) || entity.keys.length === 0) {
        throw new SchemaValidationError('keys is required and must be a non-empty array', path);
    }
    if (!entity.properties || typeof entity.properties !== 'object') {
        throw new SchemaValidationError('properties is required and must be an object', path);
    }
    // Validate that all keys exist in properties
    for (const key of entity.keys) {
        if (!entity.properties[key]) {
            throw new SchemaValidationError(`Key property "${key}" not found in properties`, path);
        }
    }
    // Validate each property
    for (const [propName, prop] of Object.entries(entity.properties)) {
        if (!prop.type || typeof prop.type !== 'string') {
            throw new SchemaValidationError(`Property "${propName}" must have a type`, path);
        }
        if (!isValidEdmType(prop.type)) {
            throw new SchemaValidationError(`Property "${propName}" has invalid type: ${prop.type}`, path);
        }
    }
    // Validate navigation properties
    if (entity.navigationProperties) {
        for (const [navName, nav] of Object.entries(entity.navigationProperties)) {
            if (!nav.target || !schema.entities[nav.target]) {
                throw new SchemaValidationError(`Navigation property "${navName}" references unknown entity: ${nav.target}`, path);
            }
            if (!nav.relationship) {
                throw new SchemaValidationError(`Navigation property "${navName}" must specify a relationship`, path);
            }
            if (!['0..1', '1', '*'].includes(nav.multiplicity)) {
                throw new SchemaValidationError(`Navigation property "${navName}" has invalid multiplicity: ${nav.multiplicity}`, path);
            }
        }
    }
}
/**
 * Validate association definition
 */
function validateAssociation(name, assoc, schema) {
    const path = `associations.${name}`;
    if (!assoc.ends || !Array.isArray(assoc.ends) || assoc.ends.length !== 2) {
        throw new SchemaValidationError('Association must have exactly 2 ends', path);
    }
    for (const end of assoc.ends) {
        if (!end.entity || !schema.entities[end.entity]) {
            throw new SchemaValidationError(`Association end references unknown entity: ${end.entity}`, path);
        }
        if (!['0..1', '1', '*'].includes(end.multiplicity)) {
            throw new SchemaValidationError(`Association end has invalid multiplicity: ${end.multiplicity}`, path);
        }
    }
    if (assoc.referentialConstraint) {
        const { principal, dependent } = assoc.referentialConstraint;
        if (!principal?.entity || !schema.entities[principal.entity]) {
            throw new SchemaValidationError(`Referential constraint principal references unknown entity: ${principal?.entity}`, path);
        }
        if (!dependent?.entity || !schema.entities[dependent.entity]) {
            throw new SchemaValidationError(`Referential constraint dependent references unknown entity: ${dependent?.entity}`, path);
        }
    }
}
/**
 * Validate function import definition
 */
function validateFunctionImport(name, func) {
    const path = `functionImports.${name}`;
    if (!func.httpMethod || !['GET', 'POST'].includes(func.httpMethod)) {
        throw new SchemaValidationError('Function import must have httpMethod of GET or POST', path);
    }
    if (func.parameters) {
        for (const [paramName, param] of Object.entries(func.parameters)) {
            if (!param.type || !isValidEdmType(param.type)) {
                throw new SchemaValidationError(`Parameter "${paramName}" has invalid type: ${param.type}`, path);
            }
        }
    }
}
/**
 * Check if a type string is a valid EDM type
 */
function isValidEdmType(type) {
    const validTypes = [
        'Edm.Binary',
        'Edm.Boolean',
        'Edm.Byte',
        'Edm.DateTime',
        'Edm.DateTimeOffset',
        'Edm.Decimal',
        'Edm.Double',
        'Edm.Guid',
        'Edm.Int16',
        'Edm.Int32',
        'Edm.Int64',
        'Edm.SByte',
        'Edm.Single',
        'Edm.String',
        'Edm.Time',
    ];
    return validTypes.includes(type);
}
/**
 * Normalize schema with default values
 */
function normalizeSchema(schema) {
    const normalized = {
        ...schema,
        containerName: schema.containerName || `${schema.namespace}Container`,
        associations: schema.associations || {},
        functionImports: schema.functionImports || {},
    };
    // Normalize entity definitions
    for (const [entityName, entity] of Object.entries(normalized.entities)) {
        normalized.entities[entityName] = {
            ...entity,
            model: entity.model || entityName,
            navigationProperties: entity.navigationProperties || {},
        };
        // Normalize property definitions
        for (const [propName, prop] of Object.entries(entity.properties)) {
            normalized.entities[entityName].properties[propName] = {
                ...prop,
                nullable: prop.nullable ?? true,
            };
        }
    }
    return normalized;
}
/**
 * Auto-infer schema from Sequelize models
 */
function inferSchemaFromModels(models, existingSchema) {
    const { sequelizeToEdmType } = require('../metadata/type-mapping');
    const entities = {};
    const associations = {};
    for (const [modelName, model] of Object.entries(models)) {
        const attributes = model.getAttributes();
        const primaryKeys = Object.entries(attributes)
            .filter(([, attr]) => attr.primaryKey)
            .map(([name]) => name);
        const properties = {};
        for (const [attrName, attr] of Object.entries(attributes)) {
            const edmType = sequelizeToEdmType(attr.type);
            properties[attrName] = {
                type: edmType,
                nullable: attr.allowNull ?? true,
            };
            // Add maxLength for string types
            if (attr.type.constructor.name === 'STRING' && attr.type._length) {
                properties[attrName].maxLength = attr.type._length;
            }
        }
        entities[modelName] = {
            model: modelName,
            keys: primaryKeys.length > 0 ? primaryKeys : ['id'],
            properties: properties,
            navigationProperties: {},
        };
    }
    // Merge with existing schema if provided
    const schema = {
        namespace: existingSchema?.namespace || 'ODataService',
        containerName: existingSchema?.containerName,
        entities: { ...entities, ...existingSchema?.entities },
        associations: { ...associations, ...existingSchema?.associations },
        functionImports: existingSchema?.functionImports,
    };
    return schema;
}
//# sourceMappingURL=schema-loader.js.map