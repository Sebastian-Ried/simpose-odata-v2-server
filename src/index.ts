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

// Main exports
export { odataMiddleware, createODataService, enableMergeMethod } from './middleware';
export { ODataService } from './ODataService';

// Types
export {
  ODataSchemaConfig,
  EntityDefinition,
  PropertyDefinition,
  NavigationPropertyDefinition,
  AssociationDefinition,
  FunctionImportDefinition,
  ODataMiddlewareOptions,
  HookContext,
  ParsedQuery,
  EntityHooks,
  FunctionImportHandler,
  EdmType,
  Multiplicity,
  EntityHandler,
  Logger,
  CsrfOptions,
} from './config/types';

// Configuration
export { loadSchema, inferSchemaFromModels, SchemaValidationError } from './config/schema-loader';
export { defaults, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ODATA_VERSION } from './config/defaults';

// Metadata
export { MetadataGenerator } from './metadata/generator';
export { sequelizeToEdmType, edmToSequelizeType, valueToODataLiteral, odataLiteralToValue } from './metadata/type-mapping';

// Parsers
export { parseUri, buildEntityUri } from './parser/uri-parser';
export { parseFilter, SUPPORTED_FUNCTIONS, configureFilterCache, getFilterCacheStats, clearFilterCache } from './parser/filter-parser';
export { parseQueryOptions, QueryOptionError, validateQueryOptions } from './parser/query-options';
export { parseBatchRequest, buildBatchResponse, generateBoundaryId } from './parser/batch-parser';

// Query building
export { QueryBuilder, createQueryBuilder } from './query/query-builder';
export { translateFilter } from './query/filter-translator';
export { buildExpands, getNavigationTarget, isNavigationCollection } from './query/expand-handler';
export { buildSelect, isPropertySelected, filterSelectedProperties } from './query/select-handler';
export { buildOrderBy, buildOrderByWithAssociations } from './query/orderby-handler';

// Handlers
export { BaseHandler, DefaultHandler } from './handlers/base-handler';

// Serializers
export { serializeEntitySet, serializeEntity, serializeValue, serializeError } from './serializers/json-serializer';
export { getResponseFormat, contentNegotiation, CONTENT_TYPES } from './serializers/content-negotiation';

// Hooks
export { HookRegistry, createHookRegistry, HookType } from './hooks/hook-registry';
export {
  createHookContext,
  cloneContext,
  getContextData,
  setContextData,
  getModel,
  isAuthenticated,
  getUser,
  addQueryFilter,
  getLogger,
} from './hooks/context';

// Utilities
export {
  ODataError,
  formatODataError,
  createErrorHandler,
  badRequest,
  notFound,
  methodNotAllowed,
  conflict,
  preconditionFailed,
  internalError,
  notImplemented,
} from './utils/errors';
export { generateETag, validateETag, checkIfNoneMatch } from './utils/etag';
export { buildEntityUri as buildUri, buildNavigationUri, buildLinksUri, parseEntityUri } from './utils/uri-builder';

// Logger utilities
export { NoopLogger, ConsoleLogger, createRequestLogger } from './utils/logger';

// Correlation ID utilities
export {
  generateCorrelationId,
  extractCorrelationId,
  getOrCreateCorrelationId,
  isValidUUID,
} from './utils/correlation';

// CSRF protection utilities
export {
  createCsrfProtection,
  generateCsrfToken,
  clearSessionTokens,
  getCsrfStats,
  DEFAULT_CSRF_HEADER,
  CsrfProtectionOptions,
} from './utils/csrf';

// Health check utilities
export {
  createHealthHandler,
  createReadinessHandler,
  createLivenessHandler,
  createHealthRouter,
  HealthStatus,
  ReadinessStatus,
  LivenessStatus,
  HealthCheckOptions,
} from './utils/health';

// Graceful shutdown utilities
export {
  GracefulShutdownManager,
  GracefulShutdownOptions,
  createShutdownMiddleware,
  registerShutdownSignals,
} from './utils/shutdown';

// Request timeout utilities
export {
  createRequestTimeoutMiddleware,
  createDynamicTimeoutMiddleware,
  RequestTimeoutOptions,
  TimeoutControlledRequest,
} from './utils/timeout';

// Metrics utilities
export {
  MetricsCollector,
  MetricType,
  MetricLabels,
  MetricDefinition,
  HistogramBuckets,
  ODATA_METRICS,
  DEFAULT_DURATION_BUCKETS,
  createMetricsMiddleware,
  createMetricsHandler,
} from './utils/metrics';

// Validation utilities
export {
  validateEntityData,
  createValidationMiddleware,
  formatValidationErrors,
  ValidationPatterns,
  ValidationError,
  ValidationResult,
  ValidationOptions,
  ValidatedPropertyDefinition,
  CustomValidator,
} from './utils/validation';

// Cache utilities
export {
  TTLCache,
  TTLCacheOptions,
  CacheStats,
  EvictionReason,
  createMetadataCache,
  createFilterCache,
  createQueryCache,
  withCache,
} from './utils/cache';

// Connection pool monitoring
export {
  PoolMonitor,
  PoolStats,
  PoolHealthStatus,
  PoolHealthResult,
  PoolMonitorOptions,
  POOL_METRICS,
  createPoolMonitor,
  createPoolStatsMiddleware,
} from './utils/pool-monitor';

// Circuit breaker
export {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOptions,
  CircuitBreakerStats,
  CircuitOpenError,
  createCircuitBreaker,
  createDatabaseCircuitBreaker,
  withCircuitBreaker,
} from './utils/circuit-breaker';
