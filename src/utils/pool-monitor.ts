/**
 * Connection Pool Monitoring for Sequelize.
 *
 * Provides utilities to monitor database connection pool health,
 * expose metrics, and detect potential issues.
 */

import { Sequelize } from 'sequelize';
import { MetricsCollector, DEFAULT_DURATION_BUCKETS } from './metrics';

/**
 * Connection pool statistics
 */
export interface PoolStats {
  /** Number of connections currently in use */
  active: number;
  /** Number of idle connections in the pool */
  idle: number;
  /** Number of requests waiting for a connection */
  waiting: number;
  /** Total pool size (active + idle) */
  size: number;
  /** Maximum pool size configured */
  maxSize: number;
  /** Minimum pool size configured */
  minSize: number;
  /** Pool utilization percentage (active / maxSize * 100) */
  utilization: number;
}

/**
 * Pool health status
 */
export type PoolHealthStatus = 'healthy' | 'degraded' | 'critical';

/**
 * Pool health check result
 */
export interface PoolHealthResult {
  status: PoolHealthStatus;
  stats: PoolStats;
  issues: string[];
}

/**
 * Options for pool monitoring
 */
export interface PoolMonitorOptions {
  /** Utilization threshold for degraded status (default: 80) */
  degradedThreshold?: number;
  /** Utilization threshold for critical status (default: 95) */
  criticalThreshold?: number;
  /** Maximum waiting requests before degraded (default: 5) */
  maxWaitingDegraded?: number;
  /** Maximum waiting requests before critical (default: 20) */
  maxWaitingCritical?: number;
  /** Polling interval for metrics collection in ms (default: 10000) */
  pollingInterval?: number;
  /** Callback when pool status changes */
  onStatusChange?: (status: PoolHealthStatus, stats: PoolStats) => void;
}

/**
 * Pool metric definitions for Prometheus
 */
export const POOL_METRICS = {
  activeConnections: {
    name: 'db_pool_active_connections',
    type: 'gauge' as const,
    help: 'Number of active database connections',
    labelNames: [] as string[],
  },
  idleConnections: {
    name: 'db_pool_idle_connections',
    type: 'gauge' as const,
    help: 'Number of idle database connections',
    labelNames: [] as string[],
  },
  waitingRequests: {
    name: 'db_pool_waiting_requests',
    type: 'gauge' as const,
    help: 'Number of requests waiting for a connection',
    labelNames: [] as string[],
  },
  poolSize: {
    name: 'db_pool_size',
    type: 'gauge' as const,
    help: 'Current total pool size',
    labelNames: [] as string[],
  },
  poolUtilization: {
    name: 'db_pool_utilization_percent',
    type: 'gauge' as const,
    help: 'Pool utilization percentage',
    labelNames: [] as string[],
  },
  acquireTime: {
    name: 'db_pool_acquire_duration_ms',
    type: 'histogram' as const,
    help: 'Time to acquire a connection from the pool',
    labelNames: [] as string[],
    buckets: DEFAULT_DURATION_BUCKETS,
  },
};

/**
 * Connection Pool Monitor.
 *
 * Monitors Sequelize connection pool health and exposes metrics.
 *
 * @example Basic usage
 * ```typescript
 * const monitor = new PoolMonitor(sequelize);
 *
 * // Get current stats
 * const stats = monitor.getStats();
 * console.log(`Active: ${stats.active}, Idle: ${stats.idle}`);
 *
 * // Check health
 * const health = monitor.checkHealth();
 * if (health.status !== 'healthy') {
 *   console.warn('Pool issues:', health.issues);
 * }
 * ```
 *
 * @example With metrics integration
 * ```typescript
 * const metrics = new MetricsCollector();
 * const monitor = new PoolMonitor(sequelize, { pollingInterval: 5000 });
 *
 * // Start collecting metrics
 * monitor.startMetricsCollection(metrics);
 *
 * // Later, stop collection
 * monitor.stopMetricsCollection();
 * ```
 *
 * @example With status change callback
 * ```typescript
 * const monitor = new PoolMonitor(sequelize, {
 *   onStatusChange: (status, stats) => {
 *     if (status === 'critical') {
 *       alerting.send('Database pool critical!', stats);
 *     }
 *   }
 * });
 * ```
 */
export class PoolMonitor {
  private sequelize: Sequelize;
  private options: Required<Omit<PoolMonitorOptions, 'onStatusChange'>> & Pick<PoolMonitorOptions, 'onStatusChange'>;
  private pollingTimer: NodeJS.Timeout | null = null;
  private lastStatus: PoolHealthStatus = 'healthy';
  private metricsRegistered = false;

  constructor(sequelize: Sequelize, options: PoolMonitorOptions = {}) {
    this.sequelize = sequelize;
    this.options = {
      degradedThreshold: options.degradedThreshold ?? 80,
      criticalThreshold: options.criticalThreshold ?? 95,
      maxWaitingDegraded: options.maxWaitingDegraded ?? 5,
      maxWaitingCritical: options.maxWaitingCritical ?? 20,
      pollingInterval: options.pollingInterval ?? 10000,
      onStatusChange: options.onStatusChange,
    };
  }

  /**
   * Get current pool statistics.
   */
  getStats(): PoolStats {
    const pool = (this.sequelize as any).connectionManager?.pool;

    if (!pool) {
      // Return empty stats if pool not available
      return {
        active: 0,
        idle: 0,
        waiting: 0,
        size: 0,
        maxSize: 0,
        minSize: 0,
        utilization: 0,
      };
    }

    // Access pool internals (works with sequelize-pool / generic-pool)
    const active = pool.using || pool._inUseObjects?.size || 0;
    const idle = pool.available || pool._availableObjects?.length || 0;
    const waiting = pool.waiting || pool._waitingClientsQueue?.size || 0;
    const size = active + idle;

    // Get pool config
    const config = (this.sequelize as any).config?.pool || {};
    const maxSize = config.max || pool.max || 5;
    const minSize = config.min || pool.min || 0;

    const utilization = maxSize > 0 ? (active / maxSize) * 100 : 0;

    return {
      active,
      idle,
      waiting,
      size,
      maxSize,
      minSize,
      utilization: Math.round(utilization * 100) / 100,
    };
  }

  /**
   * Check pool health status.
   */
  checkHealth(): PoolHealthResult {
    const stats = this.getStats();
    const issues: string[] = [];
    let status: PoolHealthStatus = 'healthy';

    // Check utilization
    if (stats.utilization >= this.options.criticalThreshold) {
      status = 'critical';
      issues.push(`Pool utilization critical: ${stats.utilization}%`);
    } else if (stats.utilization >= this.options.degradedThreshold) {
      status = 'degraded';
      issues.push(`Pool utilization high: ${stats.utilization}%`);
    }

    // Check waiting requests
    if (stats.waiting >= this.options.maxWaitingCritical) {
      status = 'critical';
      issues.push(`Too many waiting requests: ${stats.waiting}`);
    } else if (stats.waiting >= this.options.maxWaitingDegraded) {
      if (status !== 'critical') status = 'degraded';
      issues.push(`Elevated waiting requests: ${stats.waiting}`);
    }

    // Check if pool is exhausted
    if (stats.active >= stats.maxSize && stats.waiting > 0) {
      status = 'critical';
      issues.push('Pool exhausted with pending requests');
    }

    // Notify on status change
    if (status !== this.lastStatus && this.options.onStatusChange) {
      this.options.onStatusChange(status, stats);
    }
    this.lastStatus = status;

    return { status, stats, issues };
  }

  /**
   * Start periodic metrics collection.
   *
   * @param collector - MetricsCollector instance to record metrics
   */
  startMetricsCollection(collector: MetricsCollector): void {
    // Register metrics if not already done
    if (!this.metricsRegistered) {
      for (const metric of Object.values(POOL_METRICS)) {
        collector.registerMetric(metric);
      }
      this.metricsRegistered = true;
    }

    // Stop existing polling if any
    this.stopMetricsCollection();

    // Start polling
    const collectMetrics = () => {
      const stats = this.getStats();

      collector.setGauge('db_pool_active_connections', {}, stats.active);
      collector.setGauge('db_pool_idle_connections', {}, stats.idle);
      collector.setGauge('db_pool_waiting_requests', {}, stats.waiting);
      collector.setGauge('db_pool_size', {}, stats.size);
      collector.setGauge('db_pool_utilization_percent', {}, stats.utilization);

      // Also check health for status change callbacks
      this.checkHealth();
    };

    // Collect immediately and then on interval
    collectMetrics();
    this.pollingTimer = setInterval(collectMetrics, this.options.pollingInterval);
  }

  /**
   * Stop periodic metrics collection.
   */
  stopMetricsCollection(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Measure time to acquire a connection.
   *
   * @param collector - MetricsCollector to record the duration
   * @returns Connection from the pool (must be released by caller)
   */
  async measureAcquire(collector?: MetricsCollector): Promise<void> {
    const start = Date.now();

    try {
      // Acquire and immediately release a connection
      await this.sequelize.authenticate();

      const duration = Date.now() - start;
      if (collector) {
        collector.observeHistogram('db_pool_acquire_duration_ms', {}, duration);
      }
    } catch (error) {
      const duration = Date.now() - start;
      if (collector) {
        collector.observeHistogram('db_pool_acquire_duration_ms', {}, duration);
      }
      throw error;
    }
  }

  /**
   * Get the current health status.
   */
  getStatus(): PoolHealthStatus {
    return this.lastStatus;
  }

  /**
   * Check if the pool is healthy.
   */
  isHealthy(): boolean {
    return this.checkHealth().status === 'healthy';
  }
}

/**
 * Create a pool monitor with default options.
 *
 * @param sequelize - Sequelize instance
 * @param options - Monitor options
 * @returns PoolMonitor instance
 */
export function createPoolMonitor(
  sequelize: Sequelize,
  options?: PoolMonitorOptions
): PoolMonitor {
  return new PoolMonitor(sequelize, options);
}

/**
 * Create middleware that adds pool stats to request context.
 *
 * @param monitor - PoolMonitor instance
 * @returns Express middleware
 */
export function createPoolStatsMiddleware(monitor: PoolMonitor) {
  return (
    req: { poolStats?: PoolStats },
    res: unknown,
    next: () => void
  ): void => {
    req.poolStats = monitor.getStats();
    next();
  };
}
