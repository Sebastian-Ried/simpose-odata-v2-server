/**
 * Connection Pool Monitoring for Sequelize.
 *
 * Provides utilities to monitor database connection pool health,
 * expose metrics, and detect potential issues.
 */
import { Sequelize } from 'sequelize';
import { MetricsCollector } from './metrics';
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
export declare const POOL_METRICS: {
    activeConnections: {
        name: string;
        type: "gauge";
        help: string;
        labelNames: string[];
    };
    idleConnections: {
        name: string;
        type: "gauge";
        help: string;
        labelNames: string[];
    };
    waitingRequests: {
        name: string;
        type: "gauge";
        help: string;
        labelNames: string[];
    };
    poolSize: {
        name: string;
        type: "gauge";
        help: string;
        labelNames: string[];
    };
    poolUtilization: {
        name: string;
        type: "gauge";
        help: string;
        labelNames: string[];
    };
    acquireTime: {
        name: string;
        type: "histogram";
        help: string;
        labelNames: string[];
        buckets: import("./metrics").HistogramBuckets;
    };
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
export declare class PoolMonitor {
    private sequelize;
    private options;
    private pollingTimer;
    private lastStatus;
    private metricsRegistered;
    constructor(sequelize: Sequelize, options?: PoolMonitorOptions);
    /**
     * Get current pool statistics.
     */
    getStats(): PoolStats;
    /**
     * Check pool health status.
     */
    checkHealth(): PoolHealthResult;
    /**
     * Start periodic metrics collection.
     *
     * @param collector - MetricsCollector instance to record metrics
     */
    startMetricsCollection(collector: MetricsCollector): void;
    /**
     * Stop periodic metrics collection.
     */
    stopMetricsCollection(): void;
    /**
     * Measure time to acquire a connection.
     *
     * @param collector - MetricsCollector to record the duration
     * @returns Connection from the pool (must be released by caller)
     */
    measureAcquire(collector?: MetricsCollector): Promise<void>;
    /**
     * Get the current health status.
     */
    getStatus(): PoolHealthStatus;
    /**
     * Check if the pool is healthy.
     */
    isHealthy(): boolean;
}
/**
 * Create a pool monitor with default options.
 *
 * @param sequelize - Sequelize instance
 * @param options - Monitor options
 * @returns PoolMonitor instance
 */
export declare function createPoolMonitor(sequelize: Sequelize, options?: PoolMonitorOptions): PoolMonitor;
/**
 * Create middleware that adds pool stats to request context.
 *
 * @param monitor - PoolMonitor instance
 * @returns Express middleware
 */
export declare function createPoolStatsMiddleware(monitor: PoolMonitor): (req: {
    poolStats?: PoolStats;
}, res: unknown, next: () => void) => void;
//# sourceMappingURL=pool-monitor.d.ts.map