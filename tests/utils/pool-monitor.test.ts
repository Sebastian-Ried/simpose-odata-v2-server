/**
 * Connection Pool Monitor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PoolMonitor,
  createPoolMonitor,
  PoolStats,
  PoolHealthStatus,
} from '../../src/utils/pool-monitor';
import { MetricsCollector } from '../../src/utils/metrics';

// Mock Sequelize instance
function createMockSequelize(poolStats: Partial<PoolStats> = {}) {
  return {
    connectionManager: {
      pool: {
        using: poolStats.active ?? 2,
        available: poolStats.idle ?? 3,
        waiting: poolStats.waiting ?? 0,
        max: poolStats.maxSize ?? 10,
        min: poolStats.minSize ?? 1,
      },
    },
    config: {
      pool: {
        max: poolStats.maxSize ?? 10,
        min: poolStats.minSize ?? 1,
      },
    },
    authenticate: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('PoolMonitor', () => {
  describe('getStats', () => {
    it('should return pool statistics', () => {
      const sequelize = createMockSequelize({
        active: 3,
        idle: 5,
        waiting: 0,
        maxSize: 10,
        minSize: 2,
      });

      const monitor = new PoolMonitor(sequelize);
      const stats = monitor.getStats();

      expect(stats.active).toBe(3);
      expect(stats.idle).toBe(5);
      expect(stats.waiting).toBe(0);
      expect(stats.size).toBe(8);
      expect(stats.maxSize).toBe(10);
      expect(stats.minSize).toBe(2);
      expect(stats.utilization).toBe(30); // 3/10 * 100
    });

    it('should handle missing pool gracefully', () => {
      const sequelize = { connectionManager: {} } as any;
      const monitor = new PoolMonitor(sequelize);
      const stats = monitor.getStats();

      expect(stats.active).toBe(0);
      expect(stats.idle).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy for normal utilization', () => {
      const sequelize = createMockSequelize({
        active: 2,
        idle: 8,
        waiting: 0,
        maxSize: 10,
      });

      const monitor = new PoolMonitor(sequelize);
      const health = monitor.checkHealth();

      expect(health.status).toBe('healthy');
      expect(health.issues).toHaveLength(0);
    });

    it('should return degraded for high utilization', () => {
      const sequelize = createMockSequelize({
        active: 8,
        idle: 2,
        waiting: 0,
        maxSize: 10,
      });

      const monitor = new PoolMonitor(sequelize, { degradedThreshold: 75 });
      const health = monitor.checkHealth();

      expect(health.status).toBe('degraded');
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues[0]).toContain('utilization');
    });

    it('should return critical for very high utilization', () => {
      const sequelize = createMockSequelize({
        active: 10,
        idle: 0,
        waiting: 0,
        maxSize: 10,
      });

      const monitor = new PoolMonitor(sequelize, { criticalThreshold: 95 });
      const health = monitor.checkHealth();

      expect(health.status).toBe('critical');
    });

    it('should return degraded for elevated waiting requests', () => {
      const sequelize = createMockSequelize({
        active: 5,
        idle: 5,
        waiting: 6,
        maxSize: 10,
      });

      const monitor = new PoolMonitor(sequelize, { maxWaitingDegraded: 5 });
      const health = monitor.checkHealth();

      expect(health.status).toBe('degraded');
      expect(health.issues.some((i) => i.includes('waiting'))).toBe(true);
    });

    it('should return critical for exhausted pool with waiting requests', () => {
      const sequelize = createMockSequelize({
        active: 10,
        idle: 0,
        waiting: 5,
        maxSize: 10,
      });

      const monitor = new PoolMonitor(sequelize);
      const health = monitor.checkHealth();

      expect(health.status).toBe('critical');
      expect(health.issues.some((i) => i.includes('exhausted'))).toBe(true);
    });

    it('should call onStatusChange when status changes', () => {
      const onStatusChange = vi.fn();
      const sequelize = createMockSequelize({
        active: 10,
        idle: 0,
        waiting: 5,
        maxSize: 10,
      });

      const monitor = new PoolMonitor(sequelize, { onStatusChange });
      monitor.checkHealth(); // Initial: healthy -> critical

      expect(onStatusChange).toHaveBeenCalledWith('critical', expect.any(Object));
    });
  });

  describe('metrics collection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should collect metrics on interval', () => {
      const sequelize = createMockSequelize({
        active: 3,
        idle: 5,
        maxSize: 10,
      });

      const monitor = new PoolMonitor(sequelize, { pollingInterval: 1000 });
      const collector = new MetricsCollector();

      monitor.startMetricsCollection(collector);

      // Initial collection
      expect(collector.getMetricValue('db_pool_active_connections', {})).toBe(3);

      // Update mock values
      sequelize.connectionManager.pool.using = 5;

      // Advance timer
      vi.advanceTimersByTime(1000);

      expect(collector.getMetricValue('db_pool_active_connections', {})).toBe(5);

      monitor.stopMetricsCollection();
    });

    it('should stop collecting when stopped', () => {
      const sequelize = createMockSequelize({ active: 3 });
      const monitor = new PoolMonitor(sequelize, { pollingInterval: 1000 });
      const collector = new MetricsCollector();

      monitor.startMetricsCollection(collector);
      monitor.stopMetricsCollection();

      sequelize.connectionManager.pool.using = 10;
      vi.advanceTimersByTime(2000);

      // Should still be 3, not 10
      expect(collector.getMetricValue('db_pool_active_connections', {})).toBe(3);
    });
  });

  describe('isHealthy', () => {
    it('should return true for healthy pool', () => {
      const sequelize = createMockSequelize({ active: 2, maxSize: 10 });
      const monitor = new PoolMonitor(sequelize);

      expect(monitor.isHealthy()).toBe(true);
    });

    it('should return false for unhealthy pool', () => {
      const sequelize = createMockSequelize({
        active: 10,
        idle: 0,
        waiting: 10,
        maxSize: 10,
      });
      const monitor = new PoolMonitor(sequelize);

      expect(monitor.isHealthy()).toBe(false);
    });
  });
});

describe('createPoolMonitor', () => {
  it('should create a pool monitor with default options', () => {
    const sequelize = createMockSequelize();
    const monitor = createPoolMonitor(sequelize);

    expect(monitor).toBeInstanceOf(PoolMonitor);
    expect(monitor.getStats()).toBeDefined();
  });

  it('should accept custom options', () => {
    const sequelize = createMockSequelize({ active: 8, maxSize: 10 });
    const monitor = createPoolMonitor(sequelize, { degradedThreshold: 90 });

    // 80% utilization should be healthy with 90% threshold
    expect(monitor.checkHealth().status).toBe('healthy');
  });
});
