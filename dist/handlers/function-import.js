"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFunctionImport = handleFunctionImport;
exports.parseFunctionImportParams = parseFunctionImportParams;
const json_serializer_1 = require("../serializers/json-serializer");
const errors_1 = require("../utils/errors");
/**
 * Handle function import execution
 */
async function handleFunctionImport(req, res, functionName, schema, basePath, models, functionImports, params) {
    const funcDef = schema.functionImports?.[functionName];
    if (!funcDef) {
        throw new errors_1.ODataError(404, `Function import ${functionName} not found`);
    }
    // Validate HTTP method
    if (req.method !== funcDef.httpMethod) {
        throw new errors_1.ODataError(405, `Function import ${functionName} requires ${funcDef.httpMethod} method`);
    }
    // Get handler
    const handler = functionImports[functionName];
    if (!handler) {
        throw new errors_1.ODataError(501, `Function import ${functionName} not implemented`);
    }
    // Validate and transform parameters
    const transformedParams = transformParameters(params, funcDef);
    // Create context
    const odataReq = req;
    const ctx = {
        req: req,
        res: res,
        query: {},
        entityName: '',
        models,
        user: req.user,
        data: {},
        correlationId: odataReq.correlationId,
        logger: odataReq.logger,
    };
    try {
        const result = await handler(ctx, transformedParams);
        // Serialize result based on return type
        serializeFunctionResult(res, result, funcDef, schema, basePath);
    }
    catch (error) {
        if (error instanceof errors_1.ODataError) {
            throw error;
        }
        throw new errors_1.ODataError(500, `Error executing function ${functionName}`, error);
    }
}
/**
 * Transform and validate function parameters
 */
function transformParameters(params, funcDef) {
    if (!funcDef.parameters) {
        return {};
    }
    const transformed = {};
    for (const [paramName, paramDef] of Object.entries(funcDef.parameters)) {
        let value = params[paramName];
        // Check for required parameters
        if (value === undefined && paramDef.nullable === false) {
            throw new errors_1.ODataError(400, `Required parameter ${paramName} is missing`);
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
function transformParameterValue(value, edmType) {
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
                return new Date(dateMatch[1]);
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
function serializeFunctionResult(res, result, funcDef, schema, basePath) {
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
        const innerType = collectionMatch[1];
        if (innerType.startsWith('Edm.')) {
            // Collection of primitive types
            res.status(200).json({
                d: {
                    results: Array.isArray(result) ? result : [result],
                },
            });
        }
        else {
            // Collection of entities
            const entityName = innerType.includes('.')
                ? innerType.split('.').pop()
                : innerType;
            const serialized = (0, json_serializer_1.serializeEntitySet)(Array.isArray(result) ? result : [result], entityName, schema, basePath);
            res.status(200).json(serialized);
        }
        return;
    }
    // Single value return
    if (returnType.startsWith('Edm.')) {
        // Primitive type
        const serialized = (0, json_serializer_1.serializeValue)(result, returnType);
        res.status(200).json({ d: { [returnType]: serialized } });
    }
    else {
        // Entity type
        const entityName = returnType.includes('.')
            ? returnType.split('.').pop()
            : returnType;
        const serialized = (0, json_serializer_1.serializeEntity)(result, entityName, schema, basePath);
        res.status(200).json(serialized);
    }
}
/**
 * Parse function import parameters from URL
 */
function parseFunctionImportParams(urlParams, queryParams, funcDef) {
    const params = {};
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
//# sourceMappingURL=function-import.js.map