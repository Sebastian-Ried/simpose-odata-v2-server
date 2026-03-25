"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestTimeoutMiddleware = createRequestTimeoutMiddleware;
exports.createDynamicTimeoutMiddleware = createDynamicTimeoutMiddleware;
/**
 * Create middleware that enforces a global request timeout.
 *
 * This middleware sets a timeout for the entire request lifecycle.
 * If the response is not sent within the timeout, it returns a
 * 408 Request Timeout error.
 *
 * Note: This middleware should be added early in the middleware chain,
 * before route handlers.
 *
 * @param options - Timeout configuration options
 * @returns Express middleware function
 *
 * @example Basic usage
 * ```typescript
 * import { createRequestTimeoutMiddleware } from 'odata-v2-sequelize';
 *
 * // 30 second timeout
 * app.use(createRequestTimeoutMiddleware({ timeout: 30000 }));
 *
 * // Then add your routes
 * app.use('/odata', odataMiddleware({ ... }));
 * ```
 *
 * @example With custom handler
 * ```typescript
 * app.use(createRequestTimeoutMiddleware({
 *   timeout: 60000,
 *   onTimeout: (req, res) => {
 *     logger.warn('Request timed out', { path: req.path });
 *   }
 * }));
 * ```
 */
function createRequestTimeoutMiddleware(options = {}) {
    const { timeout = 30000, message = 'Request timeout', statusCode = 408, onTimeout, } = options;
    return (req, res, next) => {
        // Track if the response has been sent
        let responded = false;
        let timeoutId = null;
        // Clear timeout when response is sent
        const clearRequestTimeout = () => {
            responded = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };
        // Listen for response completion
        res.on('finish', clearRequestTimeout);
        res.on('close', clearRequestTimeout);
        // Set timeout
        timeoutId = setTimeout(() => {
            if (responded) {
                return;
            }
            // Call timeout callback if provided
            if (onTimeout) {
                try {
                    onTimeout(req, res);
                }
                catch {
                    // Ignore errors in callback
                }
            }
            // Only send error if headers haven't been sent
            if (!res.headersSent) {
                res.status(statusCode).json({
                    error: {
                        code: String(statusCode),
                        message: {
                            lang: 'en',
                            value: message,
                        },
                    },
                });
            }
            // Destroy the socket to ensure cleanup
            if (req.socket && !req.socket.destroyed) {
                req.socket.destroy();
            }
        }, timeout);
        next();
    };
}
/**
 * Create middleware with dynamic timeout control.
 *
 * This middleware allows handlers to extend or reset the timeout
 * for long-running operations like file uploads or batch processing.
 *
 * @param options - Timeout configuration options
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * app.use(createDynamicTimeoutMiddleware({ timeout: 30000 }));
 *
 * app.post('/upload', (req, res) => {
 *   // Extend timeout for large file uploads
 *   req.extendTimeout?.(60000);
 *
 *   // ... handle upload
 * });
 * ```
 */
function createDynamicTimeoutMiddleware(options = {}) {
    const { timeout: defaultTimeout = 30000, message = 'Request timeout', statusCode = 408, onTimeout, } = options;
    return (req, res, next) => {
        let responded = false;
        let timeoutId = null;
        let currentTimeout = defaultTimeout;
        let startTime = Date.now();
        const clearRequestTimeout = () => {
            responded = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };
        const handleTimeout = () => {
            if (responded) {
                return;
            }
            if (onTimeout) {
                try {
                    onTimeout(req, res);
                }
                catch {
                    // Ignore errors in callback
                }
            }
            if (!res.headersSent) {
                res.status(statusCode).json({
                    error: {
                        code: String(statusCode),
                        message: {
                            lang: 'en',
                            value: message,
                        },
                    },
                });
            }
            if (req.socket && !req.socket.destroyed) {
                req.socket.destroy();
            }
        };
        const setNewTimeout = (ms) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            currentTimeout = ms;
            startTime = Date.now();
            timeoutId = setTimeout(handleTimeout, ms);
        };
        // Listen for response completion
        res.on('finish', clearRequestTimeout);
        res.on('close', clearRequestTimeout);
        // Attach control methods to request
        req.extendTimeout = (ms) => {
            if (!responded) {
                const elapsed = Date.now() - startTime;
                const remaining = currentTimeout - elapsed;
                setNewTimeout(remaining + ms);
            }
        };
        req.resetTimeout = () => {
            if (!responded) {
                setNewTimeout(defaultTimeout);
            }
        };
        req.getRemainingTimeout = () => {
            const elapsed = Date.now() - startTime;
            return Math.max(0, currentTimeout - elapsed);
        };
        // Set initial timeout
        setNewTimeout(defaultTimeout);
        next();
    };
}
//# sourceMappingURL=timeout.js.map