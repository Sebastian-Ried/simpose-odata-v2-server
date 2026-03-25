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
export class ODataError extends Error {
  /** HTTP status code for the error response */
  public statusCode: number;
  /** OData error code (typically matches status code) */
  public code: string;
  /** Original error that caused this error (for debugging) */
  public innerError?: Error;

  /**
   * Create a new OData error.
   *
   * @param statusCode - HTTP status code (e.g., 400, 404, 500)
   * @param message - Human-readable error message
   * @param innerError - Optional original error for debugging
   */
  constructor(statusCode: number, message: string, innerError?: Error) {
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
export function formatODataError(
  statusCode: number,
  message: string,
  innerError?: Error,
  verbose: boolean = false,
  correlationId?: string
): { error: ODataErrorDetails } {
  const error: ODataErrorDetails = {
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
export const ERROR_CODES = {
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
export function badRequest(message: string): ODataError {
  return new ODataError(400, message);
}

/**
 * Create a 401 Unauthorized error
 */
export function unauthorized(message: string = 'Unauthorized'): ODataError {
  return new ODataError(401, message);
}

/**
 * Create a 403 Forbidden error
 */
export function forbidden(message: string = 'Forbidden'): ODataError {
  return new ODataError(403, message);
}

/**
 * Create a 404 Not Found error
 */
export function notFound(resource: string): ODataError {
  return new ODataError(404, `${resource} not found`);
}

/**
 * Create a 405 Method Not Allowed error
 */
export function methodNotAllowed(method: string): ODataError {
  return new ODataError(405, `Method ${method} not allowed`);
}

/**
 * Create a 409 Conflict error
 */
export function conflict(message: string): ODataError {
  return new ODataError(409, message);
}

/**
 * Create a 412 Precondition Failed error
 */
export function preconditionFailed(message: string = 'Precondition failed'): ODataError {
  return new ODataError(412, message);
}

/**
 * Create a 500 Internal Server Error
 */
export function internalError(message: string, innerError?: Error): ODataError {
  return new ODataError(500, message, innerError);
}

/**
 * Create a 501 Not Implemented error
 */
export function notImplemented(feature: string): ODataError {
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
export function createErrorHandler(verbose: boolean = false, logger?: Logger) {
  return (
    error: Error,
    req: any,
    res: any,
    next: any
  ): void => {
    if (res.headersSent) {
      return next(error);
    }

    let statusCode = 500;
    let message = 'Internal server error';
    let innerError: Error | undefined;

    if (error instanceof ODataError) {
      statusCode = error.statusCode;
      message = error.message;
      innerError = error.innerError;
    } else {
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
