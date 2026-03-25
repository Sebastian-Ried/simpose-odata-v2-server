"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GracefulShutdownManager = void 0;
exports.createShutdownMiddleware = createShutdownMiddleware;
exports.registerShutdownSignals = registerShutdownSignals;
/**
 * Graceful shutdown manager for tracking in-flight requests
 * and coordinating clean shutdown.
 */
class GracefulShutdownManager {
    inFlightRequests = 0;
    isShuttingDown = false;
    shutdownPromise = null;
    options;
    constructor(options = {}) {
        this.options = {
            timeout: 30000,
            onShutdownStart: () => { },
            onShutdownComplete: () => { },
            cleanupHandlers: [],
            ...options,
        };
    }
    /**
     * Check if the service is currently shutting down.
     */
    isInShutdown() {
        return this.isShuttingDown;
    }
    /**
     * Get the current number of in-flight requests.
     */
    getInFlightCount() {
        return this.inFlightRequests;
    }
    /**
     * Track the start of a request.
     * Returns false if shutdown is in progress (request should be rejected).
     */
    requestStart() {
        if (this.isShuttingDown) {
            return false;
        }
        this.inFlightRequests++;
        return true;
    }
    /**
     * Track the completion of a request.
     */
    requestEnd() {
        this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
    }
    /**
     * Wait for all in-flight requests to complete.
     */
    async waitForRequests() {
        const { logger, timeout } = this.options;
        const startTime = Date.now();
        const checkInterval = 100;
        while (this.inFlightRequests > 0) {
            if (Date.now() - startTime > timeout) {
                logger?.warn('Shutdown timeout reached, forcing shutdown', {
                    inFlightRequests: this.inFlightRequests,
                    timeout,
                });
                break;
            }
            logger?.debug('Waiting for in-flight requests', {
                count: this.inFlightRequests,
                elapsed: Date.now() - startTime,
            });
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
        }
    }
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
    async shutdown() {
        // Prevent multiple shutdowns
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }
        this.isShuttingDown = true;
        this.shutdownPromise = this.performShutdown();
        return this.shutdownPromise;
    }
    async performShutdown() {
        const { server, sequelize, logger, onShutdownStart, onShutdownComplete, cleanupHandlers } = this.options;
        logger?.info('Graceful shutdown initiated', {
            inFlightRequests: this.inFlightRequests,
        });
        try {
            // Run shutdown start callback
            await onShutdownStart();
            // Stop accepting new connections
            if (server) {
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) {
                            logger?.warn('Error closing server', { error: err.message });
                        }
                        resolve();
                    });
                });
                logger?.debug('Server stopped accepting new connections');
            }
            // Wait for in-flight requests
            await this.waitForRequests();
            logger?.debug('All in-flight requests completed');
            // Run cleanup handlers
            for (const handler of cleanupHandlers) {
                try {
                    await handler();
                }
                catch (error) {
                    logger?.warn('Cleanup handler error', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            // Close database connection
            if (sequelize) {
                try {
                    await sequelize.close();
                    logger?.debug('Database connection closed');
                }
                catch (error) {
                    logger?.warn('Error closing database connection', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            // Run shutdown complete callback
            await onShutdownComplete();
            logger?.info('Graceful shutdown completed');
        }
        catch (error) {
            logger?.error('Error during shutdown', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
}
exports.GracefulShutdownManager = GracefulShutdownManager;
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
function createShutdownMiddleware(manager) {
    return (req, res, next) => {
        if (!manager.requestStart()) {
            // Shutdown in progress, reject request
            res.status(503).json({
                error: {
                    code: '503',
                    message: { lang: 'en', value: 'Service is shutting down' },
                },
            });
            return;
        }
        // Track request completion - use flag to prevent double decrement
        let completed = false;
        const markComplete = () => {
            if (!completed) {
                completed = true;
                manager.requestEnd();
            }
        };
        res.on('finish', markComplete);
        res.on('close', markComplete);
        next();
    };
}
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
function registerShutdownSignals(manager, options = {}) {
    const { exitOnComplete = true, exitCode = 0, logger } = options;
    const handleSignal = async (signal) => {
        logger?.info(`Received ${signal} signal, initiating shutdown`);
        try {
            await manager.shutdown();
            if (exitOnComplete) {
                process.exit(exitCode);
            }
        }
        catch (error) {
            logger?.error('Shutdown failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            if (exitOnComplete) {
                process.exit(1);
            }
        }
    };
    const sigterm = () => handleSignal('SIGTERM');
    const sigint = () => handleSignal('SIGINT');
    process.on('SIGTERM', sigterm);
    process.on('SIGINT', sigint);
    // Return unregister function
    return () => {
        process.off('SIGTERM', sigterm);
        process.off('SIGINT', sigint);
    };
}
//# sourceMappingURL=shutdown.js.map