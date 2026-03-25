/**
 * TTL (Time-To-Live) Cache implementation for OData middleware.
 *
 * Provides a generic cache with expiration, size limits, and LRU eviction.
 * Can be used for metadata caching, filter expression caching, and more.
 */
/**
 * Configuration options for TTL cache
 */
export interface TTLCacheOptions {
    /** Maximum number of entries in the cache (default: 100) */
    maxSize?: number;
    /** Time-to-live in milliseconds (default: 0 = no expiration) */
    ttl?: number;
    /** Whether to update TTL on access (default: true) */
    updateOnAccess?: boolean;
    /** Callback when an entry is evicted */
    onEvict?: (key: string, value: unknown, reason: EvictionReason) => void;
}
/**
 * Reason for cache eviction
 */
export type EvictionReason = 'expired' | 'size' | 'manual';
/**
 * Cache statistics
 */
export interface CacheStats {
    /** Number of entries currently in cache */
    size: number;
    /** Total cache hits */
    hits: number;
    /** Total cache misses */
    misses: number;
    /** Hit rate as a percentage */
    hitRate: number;
    /** Number of entries evicted due to TTL expiration */
    evictions: {
        expired: number;
        size: number;
        manual: number;
    };
}
/**
 * A generic TTL (Time-To-Live) cache with LRU eviction.
 *
 * @example Basic usage
 * ```typescript
 * const cache = new TTLCache<string>({ maxSize: 100, ttl: 60000 });
 *
 * cache.set('key1', 'value1');
 * const value = cache.get('key1'); // 'value1'
 *
 * // After 60 seconds, the entry expires
 * const expired = cache.get('key1'); // undefined
 * ```
 *
 * @example With eviction callback
 * ```typescript
 * const cache = new TTLCache<object>({
 *   maxSize: 50,
 *   ttl: 30000,
 *   onEvict: (key, value, reason) => {
 *     console.log(`Evicted ${key}: ${reason}`);
 *   }
 * });
 * ```
 */
export declare class TTLCache<T> {
    private cache;
    private maxSize;
    private ttl;
    private updateOnAccess;
    private onEvict?;
    private _hits;
    private _misses;
    private _evictions;
    constructor(options?: TTLCacheOptions);
    /**
     * Get a value from the cache.
     *
     * @param key - Cache key
     * @returns The cached value or undefined if not found/expired
     */
    get(key: string): T | undefined;
    /**
     * Set a value in the cache.
     *
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttl - Optional TTL override for this entry (in milliseconds)
     */
    set(key: string, value: T, ttl?: number): void;
    /**
     * Check if a key exists and is not expired.
     *
     * @param key - Cache key
     * @returns True if the key exists and is not expired
     */
    has(key: string): boolean;
    /**
     * Delete an entry from the cache.
     *
     * @param key - Cache key
     * @returns True if the entry existed
     */
    delete(key: string): boolean;
    /**
     * Clear all entries from the cache.
     */
    clear(): void;
    /**
     * Get the number of entries in the cache.
     */
    get size(): number;
    /**
     * Get all keys in the cache (including potentially expired ones).
     */
    keys(): string[];
    /**
     * Get cache statistics.
     */
    getStats(): CacheStats;
    /**
     * Reset cache statistics.
     */
    resetStats(): void;
    /**
     * Remove all expired entries from the cache.
     *
     * @returns Number of entries removed
     */
    prune(): number;
    /**
     * Get time remaining until entry expires (in milliseconds).
     *
     * @param key - Cache key
     * @returns Milliseconds until expiration, or -1 if no TTL, or undefined if not found
     */
    getTTL(key: string): number | undefined;
    /**
     * Update the TTL for an existing entry.
     *
     * @param key - Cache key
     * @param ttl - New TTL in milliseconds (0 = no expiration)
     * @returns True if the entry was found and updated
     */
    setTTL(key: string, ttl: number): boolean;
    /**
     * Evict the least recently used entry.
     * Uses Map's insertion order - first entry is oldest (LRU).
     */
    private evictLRU;
    /**
     * Evict an entry from the cache.
     */
    private evict;
}
/**
 * Create a metadata cache with sensible defaults for OData metadata.
 *
 * Metadata is typically static and can be cached indefinitely,
 * but we provide manual invalidation support.
 *
 * @param options - Cache options
 * @returns Configured TTLCache instance
 */
export declare function createMetadataCache<T>(options?: Partial<TTLCacheOptions>): TTLCache<T>;
/**
 * Create a filter expression cache with LRU eviction and TTL.
 *
 * @param options - Cache options
 * @returns Configured TTLCache instance
 */
export declare function createFilterCache<T>(options?: Partial<TTLCacheOptions>): TTLCache<T>;
/**
 * Create a query result cache for caching frequently accessed data.
 *
 * @param options - Cache options
 * @returns Configured TTLCache instance
 */
export declare function createQueryCache<T>(options?: Partial<TTLCacheOptions>): TTLCache<T>;
/**
 * Decorator for caching method results.
 *
 * @param cache - TTLCache instance to use
 * @param keyFn - Function to generate cache key from arguments
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * const cache = new TTLCache<User>({ maxSize: 100, ttl: 60000 });
 *
 * class UserService {
 *   @cached(cache, (id) => `user:${id}`)
 *   async getUser(id: string): Promise<User> {
 *     return await database.findUser(id);
 *   }
 * }
 * ```
 */
export declare function cached<T>(cache: TTLCache<T>, keyFn: (...args: any[]) => string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Wrap an async function with caching.
 *
 * @param fn - Function to wrap
 * @param cache - TTLCache instance
 * @param keyFn - Function to generate cache key from arguments
 * @returns Wrapped function with caching
 *
 * @example
 * ```typescript
 * const cache = new TTLCache<string>({ maxSize: 100, ttl: 60000 });
 *
 * const cachedFetch = withCache(
 *   async (url: string) => fetch(url).then(r => r.text()),
 *   cache,
 *   (url) => url
 * );
 *
 * const html = await cachedFetch('https://example.com');
 * ```
 */
export declare function withCache<T, A extends any[]>(fn: (...args: A) => Promise<T>, cache: TTLCache<T>, keyFn: (...args: A) => string): (...args: A) => Promise<T>;
//# sourceMappingURL=cache.d.ts.map