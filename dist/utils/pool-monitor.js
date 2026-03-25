"use strict";
/**
 * Connection Pool Monitoring for Sequelize.
 *
 * Provides utilities to monitor database connection pool health,
 * expose metrics, and detect potential issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolMonitor = exports.POOL_METRICS = void 0;
exports.createPoolMonitor = createPoolMonitor;
exports.createPoolStatsMiddleware = createPoolStatsMiddleware;
const metrics_1 = require("./metrics");
/**
 * Pool metric definitions for Prometheus
 */
exports.POOL_METRICS = {
    activeConnections: {
        name: 'db_pool_active_connections',
        type: 'gauge',
        help: 'Number of active database connections',
        labelNames: [],
    },
    idleConnections: {
        name: 'db_pool_idle_connections',
        type: 'gauge',
        help: 'Number of idle database connections',
        labelNames: [],
    },
    waitingRequests: {
        name: 'db_pool_waiting_requests',
        type: 'gauge',
        help: 'Number of requests waiting for a connection',
        labelNames: [],
    },
    poolSize: {
        name: 'db_pool_size',
        type: 'gauge',
        help: 'Current total pool size',
        labelNames: [],
    },
    poolUtilization: {
        name: 'db_pool_utilization_percent',
        type: 'gauge',
        help: 'Pool utilization percentage',
        labelNames: [],
    },
    acquireTime: {
        name: 'db_pool_acquire_duration_ms',
        type: 'histogram',
        help: 'Time to acquire a connection from the pool',
        labelNames: [],
        buckets: metrics_1.DEFAULT_DURATION_BUCKETS,
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
class PoolMonitor {
    sequelize;
    options;
    pollingTimer = null;
    lastStatus = 'healthy';
    metricsRegistered = false;
    constructor(sequelize, options = {}) {
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
    getStats() {
        const pool = this.sequelize.connectionManager?.pool;
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
        const config = this.sequelize.config?.pool || {};
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
    checkHealth() {
        const stats = this.getStats();
        const issues = [];
        let status = 'healthy';
        // Check utilization
        if (stats.utilization >= this.options.criticalThreshold) {
            status = 'critical';
            issues.push(`Pool utilization critical: ${stats.utilization}%`);
        }
        else if (stats.utilization >= this.options.degradedThreshold) {
            status = 'degraded';
            issues.push(`Pool utilization high: ${stats.utilization}%`);
        }
        // Check waiting requests
        if (stats.waiting >= this.options.maxWaitingCritical) {
            status = 'critical';
            issues.push(`Too many waiting requests: ${stats.waiting}`);
        }
        else if (stats.waiting >= this.options.maxWaitingDegraded) {
            if (status !== 'critical')
                status = 'degraded';
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
    startMetricsCollection(collector) {
        // Register metrics if not already done
        if (!this.metricsRegistered) {
            for (const metric of Object.values(exports.POOL_METRICS)) {
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
    stopMetricsCollection() {
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
    async measureAcquire(collector) {
        const start = Date.now();
        try {
            // Acquire and immediately release a connection
            await this.sequelize.authenticate();
            const duration = Date.now() - start;
            if (collector) {
                collector.observeHistogram('db_pool_acquire_duration_ms', {}, duration);
            }
        }
        catch (error) {
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
    getStatus() {
        return this.lastStatus;
    }
    /**
     * Check if the pool is healthy.
     */
    isHealthy() {
        return this.checkHealth().status === 'healthy';
    }
}
exports.PoolMonitor = PoolMonitor;
/**
 * Create a pool monitor with default options.
 *
 * @param sequelize - Sequelize instance
 * @param options - Monitor options
 * @returns PoolMonitor instance
 */
function createPoolMonitor(sequelize, options) {
    return new PoolMonitor(sequelize, options);
}
/**
 * Create middleware that adds pool stats to request context.
 *
 * @param monitor - PoolMonitor instance
 * @returns Express middleware
 */
function createPoolStatsMiddleware(monitor) {
    return (req, res, next) => {
        req.poolStats = monitor.getStats();
        next();
    };
}
//# sourceMappingURL=pool-monitor.js.map