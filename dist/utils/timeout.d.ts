import { Request, Response, NextFunction } from 'express';
/**
 * Options for request timeout middleware
 */
export interface RequestTimeoutOptions {
    /** Timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Custom error message (default: 'Request timeout') */
    message?: string;
    /** Status code for timeout response (default: 408) */
    statusCode?: number;
    /** Callback when timeout occurs */
    onTimeout?: (req: Request, res: Response) => void;
}
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
export declare function createRequestTimeoutMiddleware(options?: RequestTimeoutOptions): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Extended request interface with timeout control
 */
export interface TimeoutControlledRequest extends Request {
    /** Extend the request timeout by the specified milliseconds */
    extendTimeout?: (ms: number) => void;
    /** Reset the request timeout to the original value */
    resetTimeout?: () => void;
    /** Get remaining timeout in milliseconds */
    getRemainingTimeout?: () => number;
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
export declare function createDynamicTimeoutMiddleware(options?: RequestTimeoutOptions): (req: TimeoutControlledRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=timeout.d.ts.map