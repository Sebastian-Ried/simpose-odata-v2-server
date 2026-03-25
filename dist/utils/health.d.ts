import { Request, Response, Router } from 'express';
import { Sequelize } from 'sequelize';
/**
 * Health check status
 */
export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    checks: {
        database?: {
            status: 'up' | 'down';
            latency?: number;
            error?: string;
        };
        [key: string]: {
            status: 'up' | 'down';
            latency?: number;
            error?: string;
        } | undefined;
    };
}
/**
 * Readiness check status
 */
export interface ReadinessStatus {
    ready: boolean;
    timestamp: string;
    checks: {
        database?: {
            ready: boolean;
            error?: string;
        };
        [key: string]: {
            ready: boolean;
            error?: string;
        } | undefined;
    };
}
/**
 * Liveness check status (simple alive check)
 */
export interface LivenessStatus {
    alive: boolean;
    timestamp: string;
}
/**
 * Options for health check configuration
 */
export interface HealthCheckOptions {
    /** Sequelize instance for database health checks */
    sequelize?: Sequelize;
    /** Custom health check functions */
    customChecks?: Record<string, () => Promise<{
        status: 'up' | 'down';
        latency?: number;
        error?: string;
    }>>;
    /** Timeout for database health check in ms (default: 5000) */
    dbCheckTimeout?: number;
    /** Whether the service is ready to accept traffic (can be set externally) */
    isReady?: () => boolean;
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
export declare function createHealthHandler(options?: HealthCheckOptions): (req: Request, res: Response) => Promise<void>;
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
export declare function createReadinessHandler(options?: HealthCheckOptions): (req: Request, res: Response) => Promise<void>;
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
export declare function createLivenessHandler(): (req: Request, res: Response) => void;
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
export declare function createHealthRouter(options?: HealthCheckOptions): Router;
//# sourceMappingURL=health.d.ts.map