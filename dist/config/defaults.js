"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BATCH_SIZE = exports.ODATA_VERSION = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = exports.defaults = void 0;
/**
 * Default configuration values for the OData middleware
 */
exports.defaults = {
    exposeMetadata: true,
    enableBatch: true,
    verboseErrors: false,
    correlationIdHeader: 'x-correlation-id',
    logRequests: true,
};
/**
 * Default page size for entity sets
 */
exports.DEFAULT_PAGE_SIZE = 1000;
/**
 * Maximum page size allowed
 */
exports.MAX_PAGE_SIZE = 10000;
/**
 * Default OData service version
 */
exports.ODATA_VERSION = '2.0';
/**
 * Default max batch size
 */
exports.MAX_BATCH_SIZE = 100;
//# sourceMappingURL=defaults.js.map