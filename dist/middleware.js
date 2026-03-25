"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.odataMiddleware = odataMiddleware;
exports.createODataService = createODataService;
exports.enableMergeMethod = enableMergeMethod;
const express_1 = require("express");
const defaults_1 = require("./config/defaults");
const ODataService_1 = require("./ODataService");
const errors_1 = require("./utils/errors");
const content_negotiation_1 = require("./serializers/content-negotiation");
const correlation_1 = require("./utils/correlation");
const logger_1 = require("./utils/logger");
const csrf_1 = require("./utils/csrf");
/** Maximum body size for requests (10MB) */
const MAX_BODY_SIZE = 10 * 1024 * 1024;
/**
 * Create OData V2 middleware for Express.
 *
 * This middleware provides a complete OData V2 implementation including:
 * - Full CRUD operations (GET, POST, PUT, MERGE, DELETE)
 * - Query options ($filter, $select, $expand, $orderby, $top, $skip)
 * - Batch processing ($batch endpoint with transaction support)
 * - Metadata generation ($metadata endpoint with EDMX)
 * - Function imports
 * - Navigation properties
 *
 * @param options - Configuration options for the middleware
 * @returns Express Router configured for OData V2 requests
 *
 * @throws {SchemaValidationError} If the schema configuration is invalid
 * @throws {Error} If required models are not provided
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { Sequelize, DataTypes } from 'sequelize';
 * import { odataMiddleware } from 'odata-v2-sequelize';
 *
 * const app = express();
 * const sequelize = new Sequelize('sqlite::memory:');
 *
 * const Product = sequelize.define('Product', {
 *   ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
 *   Name: DataTypes.STRING,
 *   Price: DataTypes.DECIMAL(10, 2)
 * });
 *
 * const schema = {
 *   namespace: 'MyService',
 *   entities: {
 *     Product: {
 *       keys: ['ID'],
 *       properties: {
 *         ID: { type: 'Edm.Int32', nullable: false },
 *         Name: { type: 'Edm.String', maxLength: 100 },
 *         Price: { type: 'Edm.Decimal', precision: 10, scale: 2 }
 *       }
 *     }
 *   }
 * };
 *
 * app.use('/odata', odataMiddleware({
 *   sequelize,
 *   schema,
 *   models: { Product }
 * }));
 *
 * app.listen(3000);
 * ```
 */
function odataMiddleware(options) {
    const router = (0, express_1.Router)();
    // Resolve logging configuration
    const baseLogger = options.logger;
    const correlationIdHeader = options.correlationIdHeader ?? defaults_1.defaults.correlationIdHeader;
    const logRequests = options.logRequests ?? (baseLogger ? defaults_1.defaults.logRequests : false);
    // Initialize OData service
    const service = new ODataService_1.ODataService(options);
    // Correlation ID and logging setup middleware
    router.use((req, res, next) => {
        // Extract or generate correlation ID
        const correlationId = (0, correlation_1.getOrCreateCorrelationId)(req, correlationIdHeader);
        req.correlationId = correlationId;
        // Set correlation ID response header
        res.setHeader(correlationIdHeader, correlationId);
        // Create request-scoped logger
        if (baseLogger) {
            req.logger = (0, logger_1.createRequestLogger)(baseLogger, correlationId);
        }
        // Record request start time for duration logging
        if (logRequests && baseLogger) {
            req._requestStartTime = Date.now();
            // Log only OData system query options, not custom parameters that may contain sensitive data
            const safeQueryKeys = ['$filter', '$select', '$expand', '$orderby', '$top', '$skip', '$count', '$inlinecount', '$format'];
            const safeQuery = {};
            for (const key of safeQueryKeys) {
                if (req.query[key] !== undefined) {
                    safeQuery[key] = req.query[key];
                }
            }
            req.logger.info('OData request started', {
                method: req.method,
                path: req.path,
                query: Object.keys(safeQuery).length > 0 ? safeQuery : undefined,
            });
        }
        next();
    });
    // OData method tunneling: POST with X-HTTP-Method header overrides req.method
    // (standard OData V2 pattern used by SAP UI5 when useBatch is false)
    router.use((req, res, next) => {
        if (req.method === 'POST') {
            const methodOverride = req.headers['x-http-method'] ||
                req.headers['x-http-method-override'];
            if (methodOverride) {
                req.method = methodOverride.toUpperCase();
            }
        }
        next();
    });
    // MERGE method support (OData V2 specific)
    router.use((req, res, next) => {
        if (req.method === 'MERGE') {
            req._odataMerge = true;
        }
        next();
    });
    // CSRF protection middleware (enabled by default)
    const csrfConfig = options.csrf;
    if (csrfConfig?.enabled !== false) {
        const csrfMiddleware = (0, csrf_1.createCsrfProtection)({
            headerName: csrfConfig?.headerName ?? csrf_1.DEFAULT_CSRF_HEADER,
            allowTokenReuse: csrfConfig?.allowTokenReuse ?? false,
            skipPaths: [
                '/$metadata',
                '/$batch', // Batch has its own CSRF handling per part
                ...(csrfConfig?.skipPaths ?? []),
            ],
        });
        router.use((req, res, next) => {
            csrfMiddleware({
                method: req.method,
                path: req.path,
                headers: req.headers,
                cookies: req.cookies,
                sessionID: req.sessionID,
                ip: req.ip,
            }, {
                setHeader: (name, value) => res.setHeader(name, value),
                status: (code) => ({
                    json: (body) => res.status(code).json(body),
                }),
            }, next);
        });
    }
    // Parse JSON and text bodies with size limits and error handling
    router.use((req, res, next) => {
        const contentType = req.headers['content-type'] || '';
        // Skip if body already parsed by another middleware
        if (req.body !== undefined && req.body !== null && Object.keys(req.body).length > 0) {
            next();
            return;
        }
        const needsBodyParsing = contentType.includes('multipart/mixed') ||
            (!req.body && ['POST', 'PUT', 'PATCH', 'MERGE'].includes(req.method));
        if (!needsBodyParsing) {
            next();
            return;
        }
        // Performance: Use Buffer array instead of string concatenation
        const chunks = [];
        let bodySize = 0;
        let errorOccurred = false;
        req.on('data', (chunk) => {
            if (errorOccurred)
                return;
            bodySize += chunk.length;
            if (bodySize > MAX_BODY_SIZE) {
                errorOccurred = true;
                next(new errors_1.ODataError(413, `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes`));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (errorOccurred)
                return;
            // Performance: Single Buffer.concat and toString at the end
            const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : '';
            if (contentType.includes('multipart/mixed')) {
                // Batch request - keep as raw string
                req.body = body;
            }
            else if (body) {
                // Validate content-type for JSON parsing
                const isJsonContent = contentType.includes('application/json') ||
                    contentType.includes('application/atom+xml') ||
                    contentType === '';
                if (isJsonContent) {
                    try {
                        const parsed = JSON.parse(body);
                        // Security: Validate parsed result is an object (not array at root for OData)
                        if (parsed !== null && typeof parsed === 'object') {
                            req.body = parsed;
                        }
                        else {
                            next(new errors_1.ODataError(400, 'Request body must be a JSON object'));
                            return;
                        }
                    }
                    catch {
                        next(new errors_1.ODataError(400, 'Invalid JSON in request body'));
                        return;
                    }
                }
                else {
                    // Non-JSON content type - reject for data modification operations
                    next(new errors_1.ODataError(415, 'Unsupported content type. Expected application/json'));
                    return;
                }
            }
            next();
        });
        req.on('error', (err) => {
            if (errorOccurred)
                return;
            errorOccurred = true;
            next(new errors_1.ODataError(400, `Error reading request body: ${err.message}`));
        });
        // Timeout for body reading
        const timeout = setTimeout(() => {
            if (errorOccurred)
                return;
            errorOccurred = true;
            next(new errors_1.ODataError(408, 'Request timeout while reading body'));
        }, 30000); // 30 second timeout
        req.on('end', () => clearTimeout(timeout));
        req.on('error', () => clearTimeout(timeout));
    });
    // Content negotiation
    router.use(content_negotiation_1.contentNegotiation);
    // Main request handler
    router.all('*', async (req, res, next) => {
        try {
            await service.processRequest(req, res);
            // Log successful request completion
            if (logRequests && req.logger && req._requestStartTime) {
                const duration = Date.now() - req._requestStartTime;
                req.logger.info('OData request completed', {
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    duration,
                });
            }
        }
        catch (error) {
            // Log request failure
            if (logRequests && req.logger && req._requestStartTime) {
                const duration = Date.now() - req._requestStartTime;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const statusCode = error instanceof errors_1.ODataError ? error.statusCode : 500;
                req.logger.error('OData request failed', {
                    method: req.method,
                    path: req.path,
                    status: statusCode,
                    duration,
                    error: errorMessage,
                });
            }
            next(error);
        }
    });
    // Error handler
    router.use((0, errors_1.createErrorHandler)(options.verboseErrors ?? false, baseLogger));
    return router;
}
/**
 * Create a standalone OData service instance for custom routing scenarios.
 *
 * Use this when you need more control over how the OData service is integrated
 * into your Express application, or when you want to call it programmatically.
 *
 * @param options - Configuration options for the OData service
 * @returns Configured ODataService instance
 *
 * @example
 * ```typescript
 * const service = createODataService({
 *   sequelize,
 *   schema,
 *   models: { Product }
 * });
 *
 * // Use with custom routing
 * app.all('/api/v1/*', async (req, res, next) => {
 *   try {
 *     await service.processRequest(req, res);
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 * ```
 */
function createODataService(options) {
    return new ODataService_1.ODataService(options);
}
/**
 * Enable MERGE HTTP method support at the Express application level.
 *
 * OData V2 uses the MERGE method for partial updates, but Express doesn't
 * recognize it by default. This helper patches the app's handle method
 * to properly recognize MERGE requests.
 *
 * Note: The middleware already handles MERGE internally, so this is only
 * needed if you want to handle MERGE requests outside the OData middleware.
 *
 * @param app - Express application or router with a handle method
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { enableMergeMethod } from 'odata-v2-sequelize';
 *
 * const app = express();
 * enableMergeMethod(app);
 *
 * // Now MERGE requests will be recognized
 * app.merge('/resource/:id', (req, res) => {
 *   // Handle partial update
 * });
 * ```
 */
function enableMergeMethod(app) {
    const originalHandle = app.handle.bind(app);
    app.handle = function (req, res, next) {
        if (req.method === 'MERGE') {
            req._odataMerge = true;
        }
        return originalHandle(req, res, next);
    };
}
//# sourceMappingURL=middleware.js.map