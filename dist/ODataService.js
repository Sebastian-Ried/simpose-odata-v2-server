"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ODataService = void 0;
const schema_loader_1 = require("./config/schema-loader");
const defaults_1 = require("./config/defaults");
const generator_1 = require("./metadata/generator");
const query_builder_1 = require("./query/query-builder");
const base_handler_1 = require("./handlers/base-handler");
const hook_registry_1 = require("./hooks/hook-registry");
const uri_parser_1 = require("./parser/uri-parser");
const query_options_1 = require("./parser/query-options");
const read_1 = require("./handlers/crud/read");
const create_1 = require("./handlers/crud/create");
const update_1 = require("./handlers/crud/update");
const delete_1 = require("./handlers/crud/delete");
const metadata_1 = require("./handlers/metadata");
const batch_1 = require("./handlers/batch");
const function_import_1 = require("./handlers/function-import");
const errors_1 = require("./utils/errors");
/**
 * OData Service - Core orchestrator for OData operations
 */
class ODataService {
    schema;
    models;
    sequelize;
    metadataGenerator;
    queryBuilder;
    hookRegistry;
    handlers = new Map();
    functionImports;
    basePath;
    verboseErrors;
    constructor(options) {
        // Load and validate schema
        this.schema = (0, schema_loader_1.loadSchema)(options.schema);
        this.models = options.models;
        this.sequelize = options.sequelize;
        this.basePath = options.basePath || '';
        this.verboseErrors = options.verboseErrors ?? defaults_1.defaults.verboseErrors;
        this.functionImports = options.functionImports || {};
        // Initialize metadata generator
        this.metadataGenerator = new generator_1.MetadataGenerator(this.schema, this.models, this.basePath);
        // Promote the enriched schema (auto-detected Sequelize attributes included)
        // so that $metadata and all query/serialization logic share the same property set.
        // Without this, auto-detected attributes appear in $metadata but are never fetched,
        // causing UI5 OData model warnings like "No data loaded for select property: created_at".
        this.schema = this.metadataGenerator.getEnrichedSchema();
        // Initialize query builder
        this.queryBuilder = new query_builder_1.QueryBuilder(this.schema, this.models, this.sequelize);
        // Initialize hook registry
        this.hookRegistry = new hook_registry_1.HookRegistry();
        // Register hooks
        if (options.hooks) {
            for (const [entityName, hooks] of Object.entries(options.hooks)) {
                this.hookRegistry.register(entityName, hooks);
            }
        }
        // Initialize handlers
        this.initializeHandlers(options.handlers);
    }
    /**
     * Initialize entity handlers
     */
    initializeHandlers(customHandlers) {
        for (const entityName of Object.keys(this.schema.entities)) {
            const entityDef = this.schema.entities[entityName];
            const modelName = entityDef.model || entityName;
            const model = this.models[modelName];
            if (!model) {
                console.warn(`No model found for entity ${entityName}`);
                continue;
            }
            const hooks = this.hookRegistry.get(entityName);
            // Check for custom handler
            if (customHandlers?.[entityName]) {
                const CustomHandler = customHandlers[entityName];
                const handler = new CustomHandler();
                handler.initialize?.(model, entityName, this.schema);
                this.handlers.set(entityName, handler);
            }
            else {
                // Use default handler
                const handler = new base_handler_1.DefaultHandler(model, entityName, this.schema, this.queryBuilder, this.sequelize, hooks);
                this.handlers.set(entityName, handler);
            }
        }
    }
    /**
     * Get handler for entity
     */
    getHandler(entityName) {
        return this.handlers.get(entityName);
    }
    /**
     * Process an OData request
     */
    async processRequest(req, res) {
        // Set OData headers
        res.setHeader('DataServiceVersion', defaults_1.ODATA_VERSION);
        res.setHeader('OData-Version', defaults_1.ODATA_VERSION);
        // Get the path relative to the mount point
        const path = req.path;
        // Parse URI
        const segments = (0, uri_parser_1.parseUri)(path, this.schema);
        // Handle empty path (service document)
        if (segments.length === 0 || path === '/') {
            await (0, metadata_1.handleServiceDocument)(req, res, this.schema, this.basePath);
            return;
        }
        // Parse query options
        const queryOptions = (0, query_options_1.parseQueryOptions)(req.query);
        // Handle based on first segment
        const firstSegment = segments[0];
        switch (firstSegment.type) {
            case '$metadata':
                await (0, metadata_1.handleMetadata)(req, res, this.metadataGenerator);
                break;
            case '$batch':
                await this.handleBatchRequest(req, res);
                break;
            case 'entitySet':
                await this.handleEntitySetRequest(req, res, firstSegment.name, segments, queryOptions);
                break;
            case 'entity':
                await this.handleEntityRequest(req, res, firstSegment.name, firstSegment.keys, segments, queryOptions);
                break;
            case 'functionImport':
                await this.handleFunctionImportRequest(req, res, firstSegment.name, firstSegment.keys || {}, queryOptions);
                break;
            default:
                throw new errors_1.ODataError(404, `Resource not found: ${path}`);
        }
    }
    /**
     * Handle entity set request
     */
    async handleEntitySetRequest(req, res, entityName, segments, query) {
        const handler = this.getHandler(entityName);
        if (!handler) {
            throw new errors_1.ODataError(404, `Entity set ${entityName} not found`);
        }
        // Check for $count segment
        if (segments.length > 1 && segments[1]?.type === '$count') {
            await (0, read_1.handleCount)(req, res, handler, entityName, this.schema, query, this.models);
            return;
        }
        switch (req.method) {
            case 'GET':
                await (0, read_1.handleRead)(req, res, handler, entityName, undefined, this.schema, query, this.basePath, this.models);
                break;
            case 'POST':
                await (0, create_1.handleCreate)(req, res, handler, entityName, this.schema, query, this.basePath, this.models);
                break;
            default:
                throw new errors_1.ODataError(405, `Method ${req.method} not allowed on entity set`);
        }
    }
    /**
     * Handle single entity request
     */
    async handleEntityRequest(req, res, entityName, keys, segments, query) {
        const handler = this.getHandler(entityName);
        if (!handler) {
            throw new errors_1.ODataError(404, `Entity ${entityName} not found`);
        }
        // Check for navigation or property segments
        if (segments.length > 1) {
            const secondSegment = segments[1];
            if (secondSegment.type === 'navigation') {
                await this.handleNavigationRequest(req, res, handler, entityName, keys, secondSegment.name, segments.slice(2), query);
                return;
            }
            if (secondSegment.type === 'property') {
                if (segments.length > 2 && segments[2]?.type === 'value') {
                    await (0, read_1.handlePropertyValue)(req, res, handler, entityName, keys, secondSegment.name, this.schema, query, this.models);
                    return;
                }
                // Return just the property value wrapped in OData format
                throw new errors_1.ODataError(501, 'Property access not yet implemented');
            }
            if (secondSegment.type === '$count') {
                throw new errors_1.ODataError(400, '$count is not valid on single entity');
            }
            if (secondSegment.name === '$links') {
                await this.handleLinksRequest(req, res, handler, entityName, keys, segments.slice(2), query);
                return;
            }
        }
        // Standard entity operations
        switch (req.method) {
            case 'GET':
                await (0, read_1.handleRead)(req, res, handler, entityName, keys, this.schema, query, this.basePath, this.models);
                break;
            case 'PUT':
                await (0, update_1.handleUpdate)(req, res, handler, entityName, keys, this.schema, query, this.basePath, this.models);
                break;
            case 'PATCH':
            case 'MERGE':
                await (0, update_1.handleMerge)(req, res, handler, entityName, keys, this.schema, query, this.basePath, this.models);
                break;
            case 'DELETE':
                await (0, delete_1.handleDelete)(req, res, handler, entityName, keys, this.schema, query, this.models);
                break;
            default:
                throw new errors_1.ODataError(405, `Method ${req.method} not allowed`);
        }
    }
    /**
     * Handle navigation property request
     */
    async handleNavigationRequest(req, res, handler, entityName, keys, navigationProperty, remainingSegments, query) {
        switch (req.method) {
            case 'GET':
                await (0, read_1.handleNavigationRead)(req, res, handler, entityName, keys, navigationProperty, this.schema, query, this.basePath, this.models);
                break;
            case 'POST':
                await (0, create_1.handleNavigationCreate)(req, res, handler, entityName, keys, navigationProperty, this.schema, query, this.basePath, this.models, Object.fromEntries(this.handlers));
                break;
            default:
                throw new errors_1.ODataError(405, `Method ${req.method} not allowed on navigation property`);
        }
    }
    /**
     * Handle $links request
     */
    async handleLinksRequest(req, res, handler, entityName, keys, segments, query) {
        if (segments.length === 0) {
            throw new errors_1.ODataError(400, 'Navigation property required for $links');
        }
        const navigationProperty = segments[0].name;
        const targetKeys = segments[0].keys;
        switch (req.method) {
            case 'POST':
                await (0, update_1.handleCreateLink)(req, res, handler, entityName, keys, navigationProperty, this.schema, this.models, this.sequelize);
                break;
            case 'DELETE':
                await (0, update_1.handleDeleteLink)(req, res, handler, entityName, keys, navigationProperty, targetKeys, this.schema, this.models);
                break;
            default:
                throw new errors_1.ODataError(405, `Method ${req.method} not allowed on $links`);
        }
    }
    /**
     * Handle function import request
     */
    async handleFunctionImportRequest(req, res, functionName, urlParams, query) {
        const funcDef = this.schema.functionImports?.[functionName];
        if (!funcDef) {
            throw new errors_1.ODataError(404, `Function import ${functionName} not found`);
        }
        const params = (0, function_import_1.parseFunctionImportParams)(urlParams, req.query, funcDef);
        await (0, function_import_1.handleFunctionImport)(req, res, functionName, this.schema, this.basePath, this.models, this.functionImports, params);
    }
    /**
     * Handle batch request
     */
    async handleBatchRequest(req, res) {
        await (0, batch_1.handleBatch)(req, res, this.schema, this.basePath, async (method, path, headers, body, contentId) => {
            return this.processBatchPart(method, path, headers, body, contentId);
        }, this.sequelize);
    }
    /**
     * Process a single batch part
     */
    async processBatchPart(method, path, headers, body, contentId) {
        // Create mock request/response for batch processing
        const mockReq = {
            method,
            path,
            url: path,
            headers,
            body,
            query: this.parseQueryString(path),
        };
        const responseData = {
            statusCode: 200,
            headers: {},
            body: undefined,
        };
        const mockRes = {
            status: (code) => {
                responseData.statusCode = code;
                return mockRes;
            },
            header: (name, value) => {
                responseData.headers[name] = value;
                return mockRes;
            },
            setHeader: (name, value) => {
                responseData.headers[name] = value;
                return mockRes;
            },
            json: (data) => {
                responseData.body = data;
                responseData.headers['Content-Type'] = 'application/json';
                return mockRes;
            },
            send: (data) => {
                if (data !== undefined) {
                    responseData.body = data;
                }
                return mockRes;
            },
            type: (type) => {
                responseData.headers['Content-Type'] = type;
                return mockRes;
            },
        };
        try {
            await this.processRequest(mockReq, mockRes);
        }
        catch (err) {
            const error = err;
            const statusCode = error instanceof errors_1.ODataError ? error.statusCode : 500;
            const message = error instanceof errors_1.ODataError ? error.message : 'Internal server error';
            responseData.statusCode = statusCode;
            responseData.body = (0, errors_1.formatODataError)(statusCode, message);
            responseData.headers['Content-Type'] = 'application/json';
        }
        return {
            contentId,
            statusCode: responseData.statusCode,
            headers: responseData.headers,
            body: responseData.body,
        };
    }
    /**
     * Parse query string from URL
     */
    parseQueryString(url) {
        const queryIndex = url.indexOf('?');
        if (queryIndex === -1) {
            return {};
        }
        const queryString = url.slice(queryIndex + 1);
        const query = {};
        for (const pair of queryString.split('&')) {
            const [key, value] = pair.split('=');
            if (key) {
                try {
                    query[decodeURIComponent(key)] = decodeURIComponent(value || '');
                }
                catch {
                    // Invalid URI encoding - skip this parameter
                    throw new errors_1.ODataError(400, `Invalid encoding in query parameter: ${key}`);
                }
            }
        }
        return query;
    }
    /**
     * Get the schema
     */
    getSchema() {
        return this.schema;
    }
    /**
     * Invalidate metadata cache
     */
    invalidateMetadataCache() {
        this.metadataGenerator.invalidateCache();
    }
}
exports.ODataService = ODataService;
//# sourceMappingURL=ODataService.js.map