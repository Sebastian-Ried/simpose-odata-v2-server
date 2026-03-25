import { ODataMiddlewareOptions } from './types';
/**
 * Default configuration values for the OData middleware
 */
export declare const defaults: Required<Pick<ODataMiddlewareOptions, 'exposeMetadata' | 'enableBatch' | 'verboseErrors' | 'correlationIdHeader' | 'logRequests'>>;
/**
 * Default page size for entity sets
 */
export declare const DEFAULT_PAGE_SIZE = 1000;
/**
 * Maximum page size allowed
 */
export declare const MAX_PAGE_SIZE = 10000;
/**
 * Default OData service version
 */
export declare const ODATA_VERSION = "2.0";
/**
 * Default max batch size
 */
export declare const MAX_BATCH_SIZE = 100;
//# sourceMappingURL=defaults.d.ts.map