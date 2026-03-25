import { Server } from 'http';
import { Sequelize } from 'sequelize';
import { Logger } from '../config/types';
/**
 * Options for graceful shutdown configuration
 */
export interface GracefulShutdownOptions {
    /** HTTP server to shutdown */
    server?: Server;
    /** Sequelize instance to close */
    sequelize?: Sequelize;
    /** Logger for shutdown messages */
    logger?: Logger;
    /** Timeout in ms before forcing shutdown (default: 30000) */
    timeout?: number;
    /** Callback before shutdown starts */
    onShutdownStart?: () => void | Promise<void>;
    /** Callback after shutdown completes */
    onShutdownComplete?: () => void | Promise<void>;
    /** Additional cleanup functions to run during shutdown */
    cleanupHandlers?: Array<() => void | Promise<void>>;
}
/**
 * Graceful shutdown manager for tracking in-flight requests
 * and coordinating clean shutdown.
 */
export declare class GracefulShutdownManager {
    private inFlightRequests;
    private isShuttingDown;
    private shutdownPromise;
    private options;
    constructor(options?: GracefulShutdownOptions);
    /**
     * Check if the service is currently shutting down.
     */
    isInShutdown(): boolean;
    /**
     * Get the current number of in-flight requests.
     */
    getInFlightCount(): number;
    /**
     * Track the start of a request.
     * Returns false if shutdown is in progress (request should be rejected).
     */
    requestStart(): boolean;
    /**
     * Track the completion of a request.
     */
    requestEnd(): void;
    /**
     * Wait for all in-flight requests to complete.
     */
    private waitForRequests;
    /**
     * Initiate graceful shutdown.
     *
     * This will:
     * 1. Stop accepting new requests
     * 2. Wait for in-flight requests to complete (with timeout)
     * 3. Close database connections
     * 4. Run cleanup handlers
     * 5. Close the HTTP server
     */
    shutdown(): Promise<void>;
    private performShutdown;
}
/**
 * Create Express middleware for tracking in-flight requests.
 *
 * This middleware tracks request start/end for graceful shutdown
 * and rejects new requests when shutdown is in progress.
 *
 * @param manager - GracefulShutdownManager instance
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { GracefulShutdownManager, createShutdownMiddleware } from 'odata-v2-sequelize';
 *
 * const shutdownManager = new GracefulShutdownManager({ sequelize, logger });
 * app.use(createShutdownMiddleware(shutdownManager));
 * ```
 */
export declare function createShutdownMiddleware(manager: GracefulShutdownManager): (req: any, res: any, next: any) => void;
/**
 * Register signal handlers for graceful shutdown.
 *
 * Listens for SIGTERM and SIGINT signals and initiates graceful shutdown.
 *
 * @param manager - GracefulShutdownManager instance
 * @param options - Additional options
 * @returns Function to unregister the handlers
 *
 * @example
 * ```typescript
 * const shutdownManager = new GracefulShutdownManager({
 *   server,
 *   sequelize,
 *   logger,
 * });
 *
 * // Register signal handlers
 * const unregister = registerShutdownSignals(shutdownManager);
 *
 * // Later, if needed
 * unregister();
 * ```
 */
export declare function registerShutdownSignals(manager: GracefulShutdownManager, options?: {
    exitOnComplete?: boolean;
    exitCode?: number;
    logger?: Logger;
}): () => void;
//# sourceMappingURL=shutdown.d.ts.map