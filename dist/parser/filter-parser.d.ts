import { FilterExpression } from '../config/types';
/**
 * Configure the filter cache.
 *
 * @param options - Cache configuration options
 *
 * @example
 * ```typescript
 * // Increase cache size and TTL
 * configureFilterCache({ maxSize: 500, ttl: 600000 });
 *
 * // Disable caching
 * configureFilterCache({ maxSize: 0 });
 * ```
 */
export declare function configureFilterCache(options: {
    maxSize?: number;
    ttl?: number;
}): void;
/**
 * Get filter cache statistics.
 */
export declare function getFilterCacheStats(): import("../utils/cache").CacheStats;
/**
 * Clear the filter cache.
 */
export declare function clearFilterCache(): void;
/**
 * Parse an OData $filter expression into an AST
 */
export declare function parseFilter(filter: string): FilterExpression;
/**
 * List of supported OData V2 filter functions
 */
export declare const SUPPORTED_FUNCTIONS: string[];
//# sourceMappingURL=filter-parser.d.ts.map