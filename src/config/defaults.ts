import { ODataMiddlewareOptions } from './types';

/**
 * Default configuration values for the OData middleware
 */
export const defaults: Required<
  Pick<
    ODataMiddlewareOptions,
    'exposeMetadata' | 'enableBatch' | 'verboseErrors' | 'correlationIdHeader' | 'logRequests'
  >
> = {
  exposeMetadata: true,
  enableBatch: true,
  verboseErrors: false,
  correlationIdHeader: 'x-correlation-id',
  logRequests: true,
};

/**
 * Default page size for entity sets
 */
export const DEFAULT_PAGE_SIZE = 1000;

/**
 * Maximum page size allowed
 */
export const MAX_PAGE_SIZE = 10000;

/**
 * Default OData service version
 */
export const ODATA_VERSION = '2.0';

/**
 * Default max batch size
 */
export const MAX_BATCH_SIZE = 100;
