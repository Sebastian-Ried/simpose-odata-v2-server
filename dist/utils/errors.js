"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = exports.ODataError = void 0;
exports.formatODataError = formatODataError;
exports.badRequest = badRequest;
exports.unauthorized = unauthorized;
exports.forbidden = forbidden;
exports.notFound = notFound;
exports.methodNotAllowed = methodNotAllowed;
exports.conflict = conflict;
exports.preconditionFailed = preconditionFailed;
exports.internalError = internalError;
exports.notImplemented = notImplemented;
exports.createErrorHandler = createErrorHandler;
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
class ODataError extends Error {
    /** HTTP status code for the error response */
    statusCode;
    /** OData error code (typically matches status code) */
    code;
    /** Original error that caused this error (for debugging) */
    innerError;
    /**
     * Create a new OData error.
     *
     * @param statusCode - HTTP status code (e.g., 400, 404, 500)
     * @param message - Human-readable error message
     * @param innerError - Optional original error for debugging
     */
    constructor(statusCode, message, innerError) {
        super(message);
        this.name = 'ODataError';
        this.statusCode = statusCode;
        this.code = String(statusCode);
        this.innerError = innerError;
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ODataError);
        }
    }
}
exports.ODataError = ODataError;
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
function formatODataError(statusCode, message, innerError, verbose = false, correlationId) {
    const error = {
        code: String(statusCode),
        message: {
            lang: 'en',
            value: message,
        },
    };
    if (verbose && innerError) {
        error.innererror = {
            message: innerError.message,
            type: innerError.name,
            stacktrace: innerError.stack,
        };
    }
    return { error };
}
/**
 * Error codes for common OData errors
 */
exports.ERROR_CODES = {
    BAD_REQUEST: '400',
    UNAUTHORIZED: '401',
    FORBIDDEN: '403',
    NOT_FOUND: '404',
    METHOD_NOT_ALLOWED: '405',
    CONFLICT: '409',
    PRECONDITION_FAILED: '412',
    UNSUPPORTED_MEDIA_TYPE: '415',
    INTERNAL_SERVER_ERROR: '500',
    NOT_IMPLEMENTED: '501',
};
/**
 * Create a 400 Bad Request error
 */
function badRequest(message) {
    return new ODataError(400, message);
}
/**
 * Create a 401 Unauthorized error
 */
function unauthorized(message = 'Unauthorized') {
    return new ODataError(401, message);
}
/**
 * Create a 403 Forbidden error
 */
function forbidden(message = 'Forbidden') {
    return new ODataError(403, message);
}
/**
 * Create a 404 Not Found error
 */
function notFound(resource) {
    return new ODataError(404, `${resource} not found`);
}
/**
 * Create a 405 Method Not Allowed error
 */
function methodNotAllowed(method) {
    return new ODataError(405, `Method ${method} not allowed`);
}
/**
 * Create a 409 Conflict error
 */
function conflict(message) {
    return new ODataError(409, message);
}
/**
 * Create a 412 Precondition Failed error
 */
function preconditionFailed(message = 'Precondition failed') {
    return new ODataError(412, message);
}
/**
 * Create a 500 Internal Server Error
 */
function internalError(message, innerError) {
    return new ODataError(500, message, innerError);
}
/**
 * Create a 501 Not Implemented error
 */
function notImplemented(feature) {
    return new ODataError(501, `${feature} is not implemented`);
}
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
function createErrorHandler(verbose = false, logger) {
    return (error, req, res, next) => {
        if (res.headersSent) {
            return next(error);
        }
        let statusCode = 500;
        let message = 'Internal server error';
        let innerError;
        if (error instanceof ODataError) {
            statusCode = error.statusCode;
            message = error.message;
            innerError = error.innerError;
        }
        else {
            innerError = error;
            message = error.message || message;
        }
        // Log the error if logger is provided
        if (logger) {
            const correlationId = req.correlationId;
            logger.error('OData error response', {
                correlationId,
                statusCode,
                message,
                error: innerError?.message,
                stack: verbose ? innerError?.stack : undefined,
            });
        }
        const errorResponse = formatODataError(statusCode, message, innerError, verbose, req.correlationId);
        res.status(statusCode).json(errorResponse);
    };
}
//# sourceMappingURL=errors.js.map