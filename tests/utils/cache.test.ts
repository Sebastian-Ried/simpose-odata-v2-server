/**
 * TTL Cache Tests
 *
 * Tests for the TTL cache implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TTLCache,
  createMetadataCache,
  createFilterCache,
  createQueryCache,
  withCache,
} from '../../src/utils/cache';

describe('TTLCache', () => {
  describe('Basic operations', () => {
    it('should set and get values', () => {
      const cache = new TTLCache<string>();

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      const cache = new TTLCache<string>();

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      const cache = new TTLCache<string>();

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      const cache = new TTLCache<string>();

      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new TTLCache<string>();

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return size', () => {
      const cache = new TTLCache<string>();

      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });

    it('should return keys', () => {
      const cache = new TTLCache<string>();

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      const cache = new TTLCache<string>({ ttl: 1000 });

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(1100);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire when TTL is 0', () => {
      const cache = new TTLCache<string>({ ttl: 0 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(100000);

      expect(cache.get('key1')).toBe('value1');
    });

    it('should extend TTL on access when updateOnAccess is true', () => {
      const cache = new TTLCache<string>({ ttl: 1000, updateOnAccess: true });

      cache.set('key1', 'value1');

      // Access at 500ms
      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('value1'); // This extends TTL

      // At 1000ms from start (500ms from last access)
      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('value1'); // Still valid

      // At 1500ms from last access
      vi.advanceTimersByTime(1100);
      expect(cache.get('key1')).toBeUndefined(); // Now expired
    });

    it('should not extend TTL on access when updateOnAccess is false', () => {
      const cache = new TTLCache<string>({ ttl: 1000, updateOnAccess: false });

      cache.set('key1', 'value1');

      vi.advanceTimersByTime(500);
      cache.get('key1'); // Access doesn't extend

      vi.advanceTimersByTime(600); // 1100ms from start
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should allow per-entry TTL override', () => {
      const cache = new TTLCache<string>({ ttl: 1000 });

      cache.set('short', 'value1', 500);
      cache.set('long', 'value2', 2000);

      vi.advanceTimersByTime(600);
      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe('value2');

      vi.advanceTimersByTime(1500);
      expect(cache.get('long')).toBeUndefined();
    });

    it('should report remaining TTL', () => {
      const cache = new TTLCache<string>({ ttl: 1000 });

      cache.set('key1', 'value1');

      const remaining = cache.getTTL('key1');
      expect(remaining).toBe(1000);

      vi.advanceTimersByTime(300);
      expect(cache.getTTL('key1')).toBe(700);

      vi.advanceTimersByTime(800);
      expect(cache.getTTL('key1')).toBe(0);
    });

    it('should allow updating TTL', () => {
      const cache = new TTLCache<string>({ ttl: 1000 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(500);

      cache.setTTL('key1', 2000);
      vi.advanceTimersByTime(1500);

      expect(cache.get('key1')).toBe('value1'); // Still valid
    });
  });

  describe('LRU eviction', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should evict least recently used when at capacity', () => {
      const cache = new TTLCache<string>({ maxSize: 3 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);

      // Access key1 to make it recent
      cache.get('key1');
      vi.advanceTimersByTime(10);

      // Add key4, should evict key2 (oldest accessed)
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false); // Evicted
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should update position when setting existing key', () => {
      const cache = new TTLCache<string>({ maxSize: 3 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);

      // Update key1 (makes it most recent)
      cache.set('key1', 'updated');
      vi.advanceTimersByTime(10);

      // Add key4, should evict key2
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('updated');
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('Eviction callbacks', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call onEvict callback when entry expires', () => {
      const onEvict = vi.fn();
      const cache = new TTLCache<string>({ ttl: 1000, onEvict });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(1100);

      cache.get('key1'); // Trigger expiration check

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1', 'expired');
    });

    it('should call onEvict callback when entry is manually deleted', () => {
      const onEvict = vi.fn();
      const cache = new TTLCache<string>({ onEvict });

      cache.set('key1', 'value1');
      cache.delete('key1');

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1', 'manual');
    });

    it('should call onEvict callback when entry is evicted for size', () => {
      const onEvict = vi.fn();
      const cache = new TTLCache<string>({ maxSize: 2, onEvict });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3'); // Evicts key1

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1', 'size');
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      const cache = new TTLCache<string>();

      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss
      cache.get('nonexistent'); // Miss
      cache.get('nonexistent'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBe(40);
    });

    it('should track evictions by reason', () => {
      const cache = new TTLCache<string>({ maxSize: 2, ttl: 100 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.delete('key1'); // Manual eviction
      cache.set('key3', 'value3'); // Size eviction of key2
      cache.set('key4', 'value4', 1); // Short TTL

      // Wait for expiration (using real timers for this)
      vi.useRealTimers();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cache.get('key4'); // Trigger expiration
          const stats = cache.getStats();
          expect(stats.evictions.manual).toBe(1);
          expect(stats.evictions.size).toBe(1);
          expect(stats.evictions.expired).toBe(1);
          resolve();
        }, 10);
      });
    });

    it('should reset statistics', () => {
      const cache = new TTLCache<string>();

      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('prune', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should remove all expired entries', () => {
      const cache = new TTLCache<string>({ ttl: 1000, updateOnAccess: false });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2', 500);
      cache.set('key3', 'value3', 2000);

      vi.advanceTimersByTime(600);

      const pruned = cache.prune();

      expect(pruned).toBe(1); // key2 expired
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
    });
  });
});

describe('Cache factory functions', () => {
  it('should create metadata cache with appropriate defaults', () => {
    const cache = createMetadataCache<string>();

    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');

    // Metadata cache should not expire by default
    expect(cache.getTTL('key')).toBe(-1);
  });

  it('should create filter cache with TTL', () => {
    const cache = createFilterCache<string>();

    cache.set('key', 'value');
    expect(cache.getTTL('key')).toBeGreaterThan(0);
  });

  it('should create query cache with TTL', () => {
    const cache = createQueryCache<string>();

    cache.set('key', 'value');
    expect(cache.getTTL('key')).toBeGreaterThan(0);
  });
});

describe('withCache helper', () => {
  it('should cache async function results', async () => {
    const cache = new TTLCache<number>();
    let callCount = 0;

    const expensiveOperation = async (n: number): Promise<number> => {
      callCount++;
      return n * 2;
    };

    const cachedOp = withCache(expensiveOperation, cache, (n) => `key:${n}`);

    expect(await cachedOp(5)).toBe(10);
    expect(await cachedOp(5)).toBe(10); // Should be cached
    expect(await cachedOp(5)).toBe(10);

    expect(callCount).toBe(1); // Only called once
  });

  it('should use different cache entries for different arguments', async () => {
    const cache = new TTLCache<number>();
    let callCount = 0;

    const fn = async (n: number): Promise<number> => {
      callCount++;
      return n * 2;
    };

    const cachedFn = withCache(fn, cache, (n) => `key:${n}`);

    await cachedFn(5);
    await cachedFn(10);
    await cachedFn(5); // Cached

    expect(callCount).toBe(2);
  });
});
