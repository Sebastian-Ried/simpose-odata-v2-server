"use strict";
/**
 * TTL (Time-To-Live) Cache implementation for OData middleware.
 *
 * Provides a generic cache with expiration, size limits, and LRU eviction.
 * Can be used for metadata caching, filter expression caching, and more.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTLCache = void 0;
exports.createMetadataCache = createMetadataCache;
exports.createFilterCache = createFilterCache;
exports.createQueryCache = createQueryCache;
exports.cached = cached;
exports.withCache = withCache;
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
class TTLCache {
    cache = new Map();
    maxSize;
    ttl;
    updateOnAccess;
    onEvict;
    // Statistics
    _hits = 0;
    _misses = 0;
    _evictions = { expired: 0, size: 0, manual: 0 };
    constructor(options = {}) {
        this.maxSize = options.maxSize ?? 100;
        this.ttl = options.ttl ?? 0;
        this.updateOnAccess = options.updateOnAccess ?? true;
        this.onEvict = options.onEvict;
    }
    /**
     * Get a value from the cache.
     *
     * @param key - Cache key
     * @returns The cached value or undefined if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this._misses++;
            return undefined;
        }
        // Check if expired
        const now = Date.now();
        if (entry.expiresAt !== null && now > entry.expiresAt) {
            this.evict(key, 'expired');
            this._misses++;
            return undefined;
        }
        // Move to end of Map for LRU (delete and re-insert)
        this.cache.delete(key);
        entry.lastAccessedAt = now;
        if (this.updateOnAccess && this.ttl > 0) {
            entry.expiresAt = now + this.ttl;
        }
        this.cache.set(key, entry);
        this._hits++;
        return entry.value;
    }
    /**
     * Set a value in the cache.
     *
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttl - Optional TTL override for this entry (in milliseconds)
     */
    set(key, value, ttl) {
        // If key exists, remove it first (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Evict if at capacity
        while (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        const now = Date.now();
        const entryTTL = ttl ?? this.ttl;
        this.cache.set(key, {
            value,
            createdAt: now,
            lastAccessedAt: now,
            expiresAt: entryTTL > 0 ? now + entryTTL : null,
        });
    }
    /**
     * Check if a key exists and is not expired.
     *
     * @param key - Cache key
     * @returns True if the key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        // Check if expired
        if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
            this.evict(key, 'expired');
            return false;
        }
        return true;
    }
    /**
     * Delete an entry from the cache.
     *
     * @param key - Cache key
     * @returns True if the entry existed
     */
    delete(key) {
        const entry = this.cache.get(key);
        if (entry) {
            this.evict(key, 'manual');
            return true;
        }
        return false;
    }
    /**
     * Clear all entries from the cache.
     */
    clear() {
        if (this.onEvict) {
            for (const [key, entry] of this.cache) {
                this.onEvict(key, entry.value, 'manual');
                this._evictions.manual++;
            }
        }
        this.cache.clear();
    }
    /**
     * Get the number of entries in the cache.
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Get all keys in the cache (including potentially expired ones).
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get cache statistics.
     */
    getStats() {
        const total = this._hits + this._misses;
        return {
            size: this.cache.size,
            hits: this._hits,
            misses: this._misses,
            hitRate: total > 0 ? (this._hits / total) * 100 : 0,
            evictions: { ...this._evictions },
        };
    }
    /**
     * Reset cache statistics.
     */
    resetStats() {
        this._hits = 0;
        this._misses = 0;
        this._evictions = { expired: 0, size: 0, manual: 0 };
    }
    /**
     * Remove all expired entries from the cache.
     *
     * @returns Number of entries removed
     */
    prune() {
        const now = Date.now();
        const expiredKeys = [];
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt !== null && now > entry.expiresAt) {
                expiredKeys.push(key);
            }
        }
        for (const key of expiredKeys) {
            this.evict(key, 'expired');
        }
        return expiredKeys.length;
    }
    /**
     * Get time remaining until entry expires (in milliseconds).
     *
     * @param key - Cache key
     * @returns Milliseconds until expiration, or -1 if no TTL, or undefined if not found
     */
    getTTL(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }
        if (entry.expiresAt === null) {
            return -1; // No expiration
        }
        const remaining = entry.expiresAt - Date.now();
        return remaining > 0 ? remaining : 0;
    }
    /**
     * Update the TTL for an existing entry.
     *
     * @param key - Cache key
     * @param ttl - New TTL in milliseconds (0 = no expiration)
     * @returns True if the entry was found and updated
     */
    setTTL(key, ttl) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        // Check if expired
        if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
            this.evict(key, 'expired');
            return false;
        }
        entry.expiresAt = ttl > 0 ? Date.now() + ttl : null;
        return true;
    }
    /**
     * Evict the least recently used entry.
     * Uses Map's insertion order - first entry is oldest (LRU).
     */
    evictLRU() {
        // Map.keys().next() gives the first (oldest) key in O(1)
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
            this.evict(firstKey, 'size');
        }
    }
    /**
     * Evict an entry from the cache.
     */
    evict(key, reason) {
        const entry = this.cache.get(key);
        if (entry) {
            this.cache.delete(key);
            this._evictions[reason]++;
            if (this.onEvict) {
                this.onEvict(key, entry.value, reason);
            }
        }
    }
}
exports.TTLCache = TTLCache;
/**
 * Create a metadata cache with sensible defaults for OData metadata.
 *
 * Metadata is typically static and can be cached indefinitely,
 * but we provide manual invalidation support.
 *
 * @param options - Cache options
 * @returns Configured TTLCache instance
 */
function createMetadataCache(options = {}) {
    return new TTLCache({
        maxSize: options.maxSize ?? 10,
        ttl: options.ttl ?? 0, // No expiration by default
        updateOnAccess: false,
        ...options,
    });
}
/**
 * Create a filter expression cache with LRU eviction and TTL.
 *
 * @param options - Cache options
 * @returns Configured TTLCache instance
 */
function createFilterCache(options = {}) {
    return new TTLCache({
        maxSize: options.maxSize ?? 100,
        ttl: options.ttl ?? 300000, // 5 minutes default
        updateOnAccess: true,
        ...options,
    });
}
/**
 * Create a query result cache for caching frequently accessed data.
 *
 * @param options - Cache options
 * @returns Configured TTLCache instance
 */
function createQueryCache(options = {}) {
    return new TTLCache({
        maxSize: options.maxSize ?? 50,
        ttl: options.ttl ?? 60000, // 1 minute default
        updateOnAccess: true,
        ...options,
    });
}
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
function cached(cache, keyFn) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const key = keyFn(...args);
            const cachedValue = cache.get(key);
            if (cachedValue !== undefined) {
                return cachedValue;
            }
            const result = await originalMethod.apply(this, args);
            cache.set(key, result);
            return result;
        };
        return descriptor;
    };
}
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
function withCache(fn, cache, keyFn) {
    return async (...args) => {
        const key = keyFn(...args);
        const cachedValue = cache.get(key);
        if (cachedValue !== undefined) {
            return cachedValue;
        }
        const result = await fn(...args);
        cache.set(key, result);
        return result;
    };
}
//# sourceMappingURL=cache.js.map