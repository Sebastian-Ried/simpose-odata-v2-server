"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthHandler = createHealthHandler;
exports.createReadinessHandler = createReadinessHandler;
exports.createLivenessHandler = createLivenessHandler;
exports.createHealthRouter = createHealthRouter;
const express_1 = require("express");
/** Start time for uptime calculation */
const startTime = Date.now();
/**
 * Check database connectivity with timeout.
 */
async function checkDatabase(sequelize, timeout) {
    const start = Date.now();
    try {
        // Race between the query and a timeout, ensuring timer cleanup
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Database check timeout')), timeout);
        });
        await Promise.race([
            sequelize.authenticate().finally(() => clearTimeout(timeoutId)),
            timeoutPromise,
        ]);
        return {
            status: 'up',
            latency: Date.now() - start,
        };
    }
    catch (error) {
        return {
            status: 'down',
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * Create a health check handler.
 *
 * Returns detailed health information including database connectivity
 * and custom health checks. Suitable for monitoring systems.
 *
 * @param options - Health check configuration
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * app.get('/health', createHealthHandler({ sequelize }));
 * ```
 */
function createHealthHandler(options = {}) {
    const { sequelize, customChecks = {}, dbCheckTimeout = 5000 } = options;
    return async (req, res) => {
        const checks = {};
        let overallStatus = 'healthy';
        // Database check
        if (sequelize) {
            const dbResult = await checkDatabase(sequelize, dbCheckTimeout);
            checks.database = dbResult;
            if (dbResult.status === 'down') {
                overallStatus = 'unhealthy';
            }
        }
        // Custom checks
        for (const [name, checkFn] of Object.entries(customChecks)) {
            try {
                const result = await checkFn();
                checks[name] = result;
                if (result.status === 'down') {
                    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
                }
            }
            catch (error) {
                checks[name] = {
                    status: 'down',
                    error: error instanceof Error ? error.message : 'Check failed',
                };
                overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
            }
        }
        const response = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - startTime) / 1000),
            checks,
        };
        const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
        res.status(statusCode).json(response);
    };
}
/**
 * Create a readiness check handler.
 *
 * Indicates whether the service is ready to accept traffic.
 * Used by Kubernetes readiness probes to determine if traffic
 * should be routed to this instance.
 *
 * @param options - Health check configuration
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * app.get('/ready', createReadinessHandler({ sequelize }));
 * ```
 */
function createReadinessHandler(options = {}) {
    const { sequelize, isReady, dbCheckTimeout = 5000 } = options;
    return async (req, res) => {
        const checks = {};
        let ready = true;
        // External readiness flag
        if (isReady && !isReady()) {
            ready = false;
        }
        // Database check
        if (sequelize) {
            const dbResult = await checkDatabase(sequelize, dbCheckTimeout);
            checks.database = {
                ready: dbResult.status === 'up',
                error: dbResult.error,
            };
            if (dbResult.status === 'down') {
                ready = false;
            }
        }
        const response = {
            ready,
            timestamp: new Date().toISOString(),
            checks,
        };
        res.status(ready ? 200 : 503).json(response);
    };
}
/**
 * Create a liveness check handler.
 *
 * Simple check that the process is alive and responding.
 * Used by Kubernetes liveness probes to determine if the
 * container should be restarted.
 *
 * This is intentionally simple - it should always return 200
 * unless the process is completely unresponsive.
 *
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * app.get('/live', createLivenessHandler());
 * ```
 */
function createLivenessHandler() {
    return (req, res) => {
        const response = {
            alive: true,
            timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
    };
}
/**
 * Create a router with all health check endpoints.
 *
 * Provides three endpoints:
 * - GET /health - Detailed health status with all checks
 * - GET /ready - Readiness probe for traffic routing
 * - GET /live - Liveness probe for container health
 *
 * @param options - Health check configuration
 * @returns Express Router with health endpoints
 *
 * @example
 * ```typescript
 * import { createHealthRouter } from 'odata-v2-sequelize';
 *
 * // Mount at root level (outside OData middleware)
 * app.use(createHealthRouter({ sequelize }));
 *
 * // Or mount at specific path
 * app.use('/api', createHealthRouter({ sequelize }));
 * ```
 */
function createHealthRouter(options = {}) {
    const router = (0, express_1.Router)();
    router.get('/health', createHealthHandler(options));
    router.get('/ready', createReadinessHandler(options));
    router.get('/live', createLivenessHandler());
    return router;
}
//# sourceMappingURL=health.js.map