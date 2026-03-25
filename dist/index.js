"use strict";
/**
 * odata-v2-sequelize
 *
 * A production-ready OData V2 middleware for Express.js with Sequelize ORM integration.
 *
 * @packageDocumentation
 *
 * @example Basic Usage
 * ```typescript
 * import express from 'express';
 * import { Sequelize, DataTypes } from 'sequelize';
 * import { odataMiddleware } from 'odata-v2-sequelize';
 *
 * const app = express();
 * const sequelize = new Sequelize('sqlite::memory:');
 *
 * const Product = sequelize.define('Product', {
 *   ID: { type: DataTypes.INTEGER, primaryKey: true },
 *   Name: DataTypes.STRING,
 *   Price: DataTypes.DECIMAL
 * });
 *
 * const schema = {
 *   namespace: 'MyService',
 *   entities: {
 *     Product: {
 *       keys: ['ID'],
 *       properties: {
 *         ID: { type: 'Edm.Int32', nullable: false },
 *         Name: { type: 'Edm.String' },
 *         Price: { type: 'Edm.Decimal' }
 *       }
 *     }
 *   }
 * };
 *
 * app.use('/odata', odataMiddleware({ sequelize, schema, models: { Product } }));
 * app.listen(3000);
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_TYPES = exports.contentNegotiation = exports.getResponseFormat = exports.serializeError = exports.serializeValue = exports.serializeEntity = exports.serializeEntitySet = exports.DefaultHandler = exports.BaseHandler = exports.buildOrderByWithAssociations = exports.buildOrderBy = exports.filterSelectedProperties = exports.isPropertySelected = exports.buildSelect = exports.isNavigationCollection = exports.getNavigationTarget = exports.buildExpands = exports.translateFilter = exports.createQueryBuilder = exports.QueryBuilder = exports.generateBoundaryId = exports.buildBatchResponse = exports.parseBatchRequest = exports.validateQueryOptions = exports.QueryOptionError = exports.parseQueryOptions = exports.clearFilterCache = exports.getFilterCacheStats = exports.configureFilterCache = exports.SUPPORTED_FUNCTIONS = exports.parseFilter = exports.buildEntityUri = exports.parseUri = exports.odataLiteralToValue = exports.valueToODataLiteral = exports.edmToSequelizeType = exports.sequelizeToEdmType = exports.MetadataGenerator = exports.ODATA_VERSION = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = exports.defaults = exports.SchemaValidationError = exports.inferSchemaFromModels = exports.loadSchema = exports.EntityHandler = exports.ODataService = exports.enableMergeMethod = exports.createODataService = exports.odataMiddleware = void 0;
exports.MetricsCollector = exports.createDynamicTimeoutMiddleware = exports.createRequestTimeoutMiddleware = exports.registerShutdownSignals = exports.createShutdownMiddleware = exports.GracefulShutdownManager = exports.createHealthRouter = exports.createLivenessHandler = exports.createReadinessHandler = exports.createHealthHandler = exports.DEFAULT_CSRF_HEADER = exports.getCsrfStats = exports.clearSessionTokens = exports.generateCsrfToken = exports.createCsrfProtection = exports.isValidUUID = exports.getOrCreateCorrelationId = exports.extractCorrelationId = exports.generateCorrelationId = exports.createRequestLogger = exports.ConsoleLogger = exports.NoopLogger = exports.parseEntityUri = exports.buildLinksUri = exports.buildNavigationUri = exports.buildUri = exports.checkIfNoneMatch = exports.validateETag = exports.generateETag = exports.notImplemented = exports.internalError = exports.preconditionFailed = exports.conflict = exports.methodNotAllowed = exports.notFound = exports.badRequest = exports.createErrorHandler = exports.formatODataError = exports.ODataError = exports.getLogger = exports.addQueryFilter = exports.getUser = exports.isAuthenticated = exports.getModel = exports.setContextData = exports.getContextData = exports.cloneContext = exports.createHookContext = exports.createHookRegistry = exports.HookRegistry = void 0;
exports.withCircuitBreaker = exports.createDatabaseCircuitBreaker = exports.createCircuitBreaker = exports.CircuitOpenError = exports.CircuitBreaker = exports.createPoolStatsMiddleware = exports.createPoolMonitor = exports.POOL_METRICS = exports.PoolMonitor = exports.withCache = exports.createQueryCache = exports.createFilterCache = exports.createMetadataCache = exports.TTLCache = exports.ValidationPatterns = exports.formatValidationErrors = exports.createValidationMiddleware = exports.validateEntityData = exports.createMetricsHandler = exports.createMetricsMiddleware = exports.DEFAULT_DURATION_BUCKETS = exports.ODATA_METRICS = void 0;
// Main exports
var middleware_1 = require("./middleware");
Object.defineProperty(exports, "odataMiddleware", { enumerable: true, get: function () { return middleware_1.odataMiddleware; } });
Object.defineProperty(exports, "createODataService", { enumerable: true, get: function () { return middleware_1.createODataService; } });
Object.defineProperty(exports, "enableMergeMethod", { enumerable: true, get: function () { return middleware_1.enableMergeMethod; } });
var ODataService_1 = require("./ODataService");
Object.defineProperty(exports, "ODataService", { enumerable: true, get: function () { return ODataService_1.ODataService; } });
// Types
var types_1 = require("./config/types");
Object.defineProperty(exports, "EntityHandler", { enumerable: true, get: function () { return types_1.EntityHandler; } });
// Configuration
var schema_loader_1 = require("./config/schema-loader");
Object.defineProperty(exports, "loadSchema", { enumerable: true, get: function () { return schema_loader_1.loadSchema; } });
Object.defineProperty(exports, "inferSchemaFromModels", { enumerable: true, get: function () { return schema_loader_1.inferSchemaFromModels; } });
Object.defineProperty(exports, "SchemaValidationError", { enumerable: true, get: function () { return schema_loader_1.SchemaValidationError; } });
var defaults_1 = require("./config/defaults");
Object.defineProperty(exports, "defaults", { enumerable: true, get: function () { return defaults_1.defaults; } });
Object.defineProperty(exports, "DEFAULT_PAGE_SIZE", { enumerable: true, get: function () { return defaults_1.DEFAULT_PAGE_SIZE; } });
Object.defineProperty(exports, "MAX_PAGE_SIZE", { enumerable: true, get: function () { return defaults_1.MAX_PAGE_SIZE; } });
Object.defineProperty(exports, "ODATA_VERSION", { enumerable: true, get: function () { return defaults_1.ODATA_VERSION; } });
// Metadata
var generator_1 = require("./metadata/generator");
Object.defineProperty(exports, "MetadataGenerator", { enumerable: true, get: function () { return generator_1.MetadataGenerator; } });
var type_mapping_1 = require("./metadata/type-mapping");
Object.defineProperty(exports, "sequelizeToEdmType", { enumerable: true, get: function () { return type_mapping_1.sequelizeToEdmType; } });
Object.defineProperty(exports, "edmToSequelizeType", { enumerable: true, get: function () { return type_mapping_1.edmToSequelizeType; } });
Object.defineProperty(exports, "valueToODataLiteral", { enumerable: true, get: function () { return type_mapping_1.valueToODataLiteral; } });
Object.defineProperty(exports, "odataLiteralToValue", { enumerable: true, get: function () { return type_mapping_1.odataLiteralToValue; } });
// Parsers
var uri_parser_1 = require("./parser/uri-parser");
Object.defineProperty(exports, "parseUri", { enumerable: true, get: function () { return uri_parser_1.parseUri; } });
Object.defineProperty(exports, "buildEntityUri", { enumerable: true, get: function () { return uri_parser_1.buildEntityUri; } });
var filter_parser_1 = require("./parser/filter-parser");
Object.defineProperty(exports, "parseFilter", { enumerable: true, get: function () { return filter_parser_1.parseFilter; } });
Object.defineProperty(exports, "SUPPORTED_FUNCTIONS", { enumerable: true, get: function () { return filter_parser_1.SUPPORTED_FUNCTIONS; } });
Object.defineProperty(exports, "configureFilterCache", { enumerable: true, get: function () { return filter_parser_1.configureFilterCache; } });
Object.defineProperty(exports, "getFilterCacheStats", { enumerable: true, get: function () { return filter_parser_1.getFilterCacheStats; } });
Object.defineProperty(exports, "clearFilterCache", { enumerable: true, get: function () { return filter_parser_1.clearFilterCache; } });
var query_options_1 = require("./parser/query-options");
Object.defineProperty(exports, "parseQueryOptions", { enumerable: true, get: function () { return query_options_1.parseQueryOptions; } });
Object.defineProperty(exports, "QueryOptionError", { enumerable: true, get: function () { return query_options_1.QueryOptionError; } });
Object.defineProperty(exports, "validateQueryOptions", { enumerable: true, get: function () { return query_options_1.validateQueryOptions; } });
var batch_parser_1 = require("./parser/batch-parser");
Object.defineProperty(exports, "parseBatchRequest", { enumerable: true, get: function () { return batch_parser_1.parseBatchRequest; } });
Object.defineProperty(exports, "buildBatchResponse", { enumerable: true, get: function () { return batch_parser_1.buildBatchResponse; } });
Object.defineProperty(exports, "generateBoundaryId", { enumerable: true, get: function () { return batch_parser_1.generateBoundaryId; } });
// Query building
var query_builder_1 = require("./query/query-builder");
Object.defineProperty(exports, "QueryBuilder", { enumerable: true, get: function () { return query_builder_1.QueryBuilder; } });
Object.defineProperty(exports, "createQueryBuilder", { enumerable: true, get: function () { return query_builder_1.createQueryBuilder; } });
var filter_translator_1 = require("./query/filter-translator");
Object.defineProperty(exports, "translateFilter", { enumerable: true, get: function () { return filter_translator_1.translateFilter; } });
var expand_handler_1 = require("./query/expand-handler");
Object.defineProperty(exports, "buildExpands", { enumerable: true, get: function () { return expand_handler_1.buildExpands; } });
Object.defineProperty(exports, "getNavigationTarget", { enumerable: true, get: function () { return expand_handler_1.getNavigationTarget; } });
Object.defineProperty(exports, "isNavigationCollection", { enumerable: true, get: function () { return expand_handler_1.isNavigationCollection; } });
var select_handler_1 = require("./query/select-handler");
Object.defineProperty(exports, "buildSelect", { enumerable: true, get: function () { return select_handler_1.buildSelect; } });
Object.defineProperty(exports, "isPropertySelected", { enumerable: true, get: function () { return select_handler_1.isPropertySelected; } });
Object.defineProperty(exports, "filterSelectedProperties", { enumerable: true, get: function () { return select_handler_1.filterSelectedProperties; } });
var orderby_handler_1 = require("./query/orderby-handler");
Object.defineProperty(exports, "buildOrderBy", { enumerable: true, get: function () { return orderby_handler_1.buildOrderBy; } });
Object.defineProperty(exports, "buildOrderByWithAssociations", { enumerable: true, get: function () { return orderby_handler_1.buildOrderByWithAssociations; } });
// Handlers
var base_handler_1 = require("./handlers/base-handler");
Object.defineProperty(exports, "BaseHandler", { enumerable: true, get: function () { return base_handler_1.BaseHandler; } });
Object.defineProperty(exports, "DefaultHandler", { enumerable: true, get: function () { return base_handler_1.DefaultHandler; } });
// Serializers
var json_serializer_1 = require("./serializers/json-serializer");
Object.defineProperty(exports, "serializeEntitySet", { enumerable: true, get: function () { return json_serializer_1.serializeEntitySet; } });
Object.defineProperty(exports, "serializeEntity", { enumerable: true, get: function () { return json_serializer_1.serializeEntity; } });
Object.defineProperty(exports, "serializeValue", { enumerable: true, get: function () { return json_serializer_1.serializeValue; } });
Object.defineProperty(exports, "serializeError", { enumerable: true, get: function () { return json_serializer_1.serializeError; } });
var content_negotiation_1 = require("./serializers/content-negotiation");
Object.defineProperty(exports, "getResponseFormat", { enumerable: true, get: function () { return content_negotiation_1.getResponseFormat; } });
Object.defineProperty(exports, "contentNegotiation", { enumerable: true, get: function () { return content_negotiation_1.contentNegotiation; } });
Object.defineProperty(exports, "CONTENT_TYPES", { enumerable: true, get: function () { return content_negotiation_1.CONTENT_TYPES; } });
// Hooks
var hook_registry_1 = require("./hooks/hook-registry");
Object.defineProperty(exports, "HookRegistry", { enumerable: true, get: function () { return hook_registry_1.HookRegistry; } });
Object.defineProperty(exports, "createHookRegistry", { enumerable: true, get: function () { return hook_registry_1.createHookRegistry; } });
var context_1 = require("./hooks/context");
Object.defineProperty(exports, "createHookContext", { enumerable: true, get: function () { return context_1.createHookContext; } });
Object.defineProperty(exports, "cloneContext", { enumerable: true, get: function () { return context_1.cloneContext; } });
Object.defineProperty(exports, "getContextData", { enumerable: true, get: function () { return context_1.getContextData; } });
Object.defineProperty(exports, "setContextData", { enumerable: true, get: function () { return context_1.setContextData; } });
Object.defineProperty(exports, "getModel", { enumerable: true, get: function () { return context_1.getModel; } });
Object.defineProperty(exports, "isAuthenticated", { enumerable: true, get: function () { return context_1.isAuthenticated; } });
Object.defineProperty(exports, "getUser", { enumerable: true, get: function () { return context_1.getUser; } });
Object.defineProperty(exports, "addQueryFilter", { enumerable: true, get: function () { return context_1.addQueryFilter; } });
Object.defineProperty(exports, "getLogger", { enumerable: true, get: function () { return context_1.getLogger; } });
// Utilities
var errors_1 = require("./utils/errors");
Object.defineProperty(exports, "ODataError", { enumerable: true, get: function () { return errors_1.ODataError; } });
Object.defineProperty(exports, "formatODataError", { enumerable: true, get: function () { return errors_1.formatODataError; } });
Object.defineProperty(exports, "createErrorHandler", { enumerable: true, get: function () { return errors_1.createErrorHandler; } });
Object.defineProperty(exports, "badRequest", { enumerable: true, get: function () { return errors_1.badRequest; } });
Object.defineProperty(exports, "notFound", { enumerable: true, get: function () { return errors_1.notFound; } });
Object.defineProperty(exports, "methodNotAllowed", { enumerable: true, get: function () { return errors_1.methodNotAllowed; } });
Object.defineProperty(exports, "conflict", { enumerable: true, get: function () { return errors_1.conflict; } });
Object.defineProperty(exports, "preconditionFailed", { enumerable: true, get: function () { return errors_1.preconditionFailed; } });
Object.defineProperty(exports, "internalError", { enumerable: true, get: function () { return errors_1.internalError; } });
Object.defineProperty(exports, "notImplemented", { enumerable: true, get: function () { return errors_1.notImplemented; } });
var etag_1 = require("./utils/etag");
Object.defineProperty(exports, "generateETag", { enumerable: true, get: function () { return etag_1.generateETag; } });
Object.defineProperty(exports, "validateETag", { enumerable: true, get: function () { return etag_1.validateETag; } });
Object.defineProperty(exports, "checkIfNoneMatch", { enumerable: true, get: function () { return etag_1.checkIfNoneMatch; } });
var uri_builder_1 = require("./utils/uri-builder");
Object.defineProperty(exports, "buildUri", { enumerable: true, get: function () { return uri_builder_1.buildEntityUri; } });
Object.defineProperty(exports, "buildNavigationUri", { enumerable: true, get: function () { return uri_builder_1.buildNavigationUri; } });
Object.defineProperty(exports, "buildLinksUri", { enumerable: true, get: function () { return uri_builder_1.buildLinksUri; } });
Object.defineProperty(exports, "parseEntityUri", { enumerable: true, get: function () { return uri_builder_1.parseEntityUri; } });
// Logger utilities
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "NoopLogger", { enumerable: true, get: function () { return logger_1.NoopLogger; } });
Object.defineProperty(exports, "ConsoleLogger", { enumerable: true, get: function () { return logger_1.ConsoleLogger; } });
Object.defineProperty(exports, "createRequestLogger", { enumerable: true, get: function () { return logger_1.createRequestLogger; } });
// Correlation ID utilities
var correlation_1 = require("./utils/correlation");
Object.defineProperty(exports, "generateCorrelationId", { enumerable: true, get: function () { return correlation_1.generateCorrelationId; } });
Object.defineProperty(exports, "extractCorrelationId", { enumerable: true, get: function () { return correlation_1.extractCorrelationId; } });
Object.defineProperty(exports, "getOrCreateCorrelationId", { enumerable: true, get: function () { return correlation_1.getOrCreateCorrelationId; } });
Object.defineProperty(exports, "isValidUUID", { enumerable: true, get: function () { return correlation_1.isValidUUID; } });
// CSRF protection utilities
var csrf_1 = require("./utils/csrf");
Object.defineProperty(exports, "createCsrfProtection", { enumerable: true, get: function () { return csrf_1.createCsrfProtection; } });
Object.defineProperty(exports, "generateCsrfToken", { enumerable: true, get: function () { return csrf_1.generateCsrfToken; } });
Object.defineProperty(exports, "clearSessionTokens", { enumerable: true, get: function () { return csrf_1.clearSessionTokens; } });
Object.defineProperty(exports, "getCsrfStats", { enumerable: true, get: function () { return csrf_1.getCsrfStats; } });
Object.defineProperty(exports, "DEFAULT_CSRF_HEADER", { enumerable: true, get: function () { return csrf_1.DEFAULT_CSRF_HEADER; } });
// Health check utilities
var health_1 = require("./utils/health");
Object.defineProperty(exports, "createHealthHandler", { enumerable: true, get: function () { return health_1.createHealthHandler; } });
Object.defineProperty(exports, "createReadinessHandler", { enumerable: true, get: function () { return health_1.createReadinessHandler; } });
Object.defineProperty(exports, "createLivenessHandler", { enumerable: true, get: function () { return health_1.createLivenessHandler; } });
Object.defineProperty(exports, "createHealthRouter", { enumerable: true, get: function () { return health_1.createHealthRouter; } });
// Graceful shutdown utilities
var shutdown_1 = require("./utils/shutdown");
Object.defineProperty(exports, "GracefulShutdownManager", { enumerable: true, get: function () { return shutdown_1.GracefulShutdownManager; } });
Object.defineProperty(exports, "createShutdownMiddleware", { enumerable: true, get: function () { return shutdown_1.createShutdownMiddleware; } });
Object.defineProperty(exports, "registerShutdownSignals", { enumerable: true, get: function () { return shutdown_1.registerShutdownSignals; } });
// Request timeout utilities
var timeout_1 = require("./utils/timeout");
Object.defineProperty(exports, "createRequestTimeoutMiddleware", { enumerable: true, get: function () { return timeout_1.createRequestTimeoutMiddleware; } });
Object.defineProperty(exports, "createDynamicTimeoutMiddleware", { enumerable: true, get: function () { return timeout_1.createDynamicTimeoutMiddleware; } });
// Metrics utilities
var metrics_1 = require("./utils/metrics");
Object.defineProperty(exports, "MetricsCollector", { enumerable: true, get: function () { return metrics_1.MetricsCollector; } });
Object.defineProperty(exports, "ODATA_METRICS", { enumerable: true, get: function () { return metrics_1.ODATA_METRICS; } });
Object.defineProperty(exports, "DEFAULT_DURATION_BUCKETS", { enumerable: true, get: function () { return metrics_1.DEFAULT_DURATION_BUCKETS; } });
Object.defineProperty(exports, "createMetricsMiddleware", { enumerable: true, get: function () { return metrics_1.createMetricsMiddleware; } });
Object.defineProperty(exports, "createMetricsHandler", { enumerable: true, get: function () { return metrics_1.createMetricsHandler; } });
// Validation utilities
var validation_1 = require("./utils/validation");
Object.defineProperty(exports, "validateEntityData", { enumerable: true, get: function () { return validation_1.validateEntityData; } });
Object.defineProperty(exports, "createValidationMiddleware", { enumerable: true, get: function () { return validation_1.createValidationMiddleware; } });
Object.defineProperty(exports, "formatValidationErrors", { enumerable: true, get: function () { return validation_1.formatValidationErrors; } });
Object.defineProperty(exports, "ValidationPatterns", { enumerable: true, get: function () { return validation_1.ValidationPatterns; } });
// Cache utilities
var cache_1 = require("./utils/cache");
Object.defineProperty(exports, "TTLCache", { enumerable: true, get: function () { return cache_1.TTLCache; } });
Object.defineProperty(exports, "createMetadataCache", { enumerable: true, get: function () { return cache_1.createMetadataCache; } });
Object.defineProperty(exports, "createFilterCache", { enumerable: true, get: function () { return cache_1.createFilterCache; } });
Object.defineProperty(exports, "createQueryCache", { enumerable: true, get: function () { return cache_1.createQueryCache; } });
Object.defineProperty(exports, "withCache", { enumerable: true, get: function () { return cache_1.withCache; } });
// Connection pool monitoring
var pool_monitor_1 = require("./utils/pool-monitor");
Object.defineProperty(exports, "PoolMonitor", { enumerable: true, get: function () { return pool_monitor_1.PoolMonitor; } });
Object.defineProperty(exports, "POOL_METRICS", { enumerable: true, get: function () { return pool_monitor_1.POOL_METRICS; } });
Object.defineProperty(exports, "createPoolMonitor", { enumerable: true, get: function () { return pool_monitor_1.createPoolMonitor; } });
Object.defineProperty(exports, "createPoolStatsMiddleware", { enumerable: true, get: function () { return pool_monitor_1.createPoolStatsMiddleware; } });
// Circuit breaker
var circuit_breaker_1 = require("./utils/circuit-breaker");
Object.defineProperty(exports, "CircuitBreaker", { enumerable: true, get: function () { return circuit_breaker_1.CircuitBreaker; } });
Object.defineProperty(exports, "CircuitOpenError", { enumerable: true, get: function () { return circuit_breaker_1.CircuitOpenError; } });
Object.defineProperty(exports, "createCircuitBreaker", { enumerable: true, get: function () { return circuit_breaker_1.createCircuitBreaker; } });
Object.defineProperty(exports, "createDatabaseCircuitBreaker", { enumerable: true, get: function () { return circuit_breaker_1.createDatabaseCircuitBreaker; } });
Object.defineProperty(exports, "withCircuitBreaker", { enumerable: true, get: function () { return circuit_breaker_1.withCircuitBreaker; } });
//# sourceMappingURL=index.js.map