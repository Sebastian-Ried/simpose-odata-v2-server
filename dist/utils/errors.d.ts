import { ODataErrorDetails, Logger } from '../config/types';
/**
 * OData-specific error class for generating compliant error responses.
 *
 * Use this class to throw errors that will be automatically formatted
 * as OData-compliant error responses by the middleware.
 *
 * @example
 * ```typescript
 * // In a hook or handler
 * if (!user.canEdit) {
 *   throw new ODataError(403, 'You do not have permission to edit this resource');
 * }
 *
 * // With inner error for debugging
 * try {
 *   await someOperation();
 * } catch (e) {
 *   throw new ODataError(500, 'Operation failed', e);
 * }
 * ```
 */
export declare class ODataError extends Error {
    /** HTTP status code for the error response */
    statusCode: number;
    /** OData error code (typically matches status code) */
    code: string;
    /** Original error that caused this error (for debugging) */
    innerError?: Error;
    /**
     * Create a new OData error.
     *
     * @param statusCode - HTTP status code (e.g., 400, 404, 500)
     * @param message - Human-readable error message
     * @param innerError - Optional original error for debugging
     */
    constructor(statusCode: number, message: string, innerError?: Error);
}
/**
 * Format an error as an OData-compliant error response.
 *
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param innerError - Optional original error
 * @param verbose - Whether to include stack trace (for development)
 * @param correlationId - Optional correlation ID to include
 * @returns OData error response object
 *
 * @example
 * ```typescript
 * const errorResponse = formatODataError(404, 'Product not found');
 * // Returns:
 * // {
 * //   error: {
 * //     code: "404",
 * //     message: { lang: "en", value: "Product not found" }
 * //   }
 * // }
 * ```
 */
export declare function formatODataError(statusCode: number, message: string, innerError?: Error, verbose?: boolean, correlationId?: string): {
    error: ODataErrorDetails;
};
/**
 * Error codes for common OData errors
 */
export declare const ERROR_CODES: {
    BAD_REQUEST: string;
    UNAUTHORIZED: string;
    FORBIDDEN: string;
    NOT_FOUND: string;
    METHOD_NOT_ALLOWED: string;
    CONFLICT: string;
    PRECONDITION_FAILED: string;
    UNSUPPORTED_MEDIA_TYPE: string;
    INTERNAL_SERVER_ERROR: string;
    NOT_IMPLEMENTED: string;
};
/**
 * Create a 400 Bad Request error
 */
export declare function badRequest(message: string): ODataError;
/**
 * Create a 401 Unauthorized error
 */
export declare function unauthorized(message?: string): ODataError;
/**
 * Create a 403 Forbidden error
 */
export declare function forbidden(message?: string): ODataError;
/**
 * Create a 404 Not Found error
 */
export declare function notFound(resource: string): ODataError;
/**
 * Create a 405 Method Not Allowed error
 */
export declare function methodNotAllowed(method: string): ODataError;
/**
 * Create a 409 Conflict error
 */
export declare function conflict(message: string): ODataError;
/**
 * Create a 412 Precondition Failed error
 */
export declare function preconditionFailed(message?: string): ODataError;
/**
 * Create a 500 Internal Server Error
 */
export declare function internalError(message: string, innerError?: Error): ODataError;
/**
 * Create a 501 Not Implemented error
 */
export declare function notImplemented(feature: string): ODataError;
/**
 * Express error handler middleware factory.
 *
 * Creates an Express error handling middleware that formats all errors
 * as OData-compliant error responses.
 *
 * @param verbose - If true, includes stack traces in error responses (for development)
 * @param logger - Optional logger for logging errors
 * @returns Express error handling middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createErrorHandler } from 'odata-v2-sequelize';
 *
 * const app = express();
 *
 * // ... routes ...
 *
 * // Add error handler (must be last)
 * app.use(createErrorHandler(process.env.NODE_ENV === 'development'));
 * ```
 */
export declare function createErrorHandler(verbose?: boolean, logger?: Logger): (error: Error, req: any, res: any, next: any) => void;
//# sourceMappingURL=errors.d.ts.map