"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = exports.NoopLogger = void 0;
exports.createRequestLogger = createRequestLogger;
/**
 * No-operation logger that silently discards all log messages.
 *
 * Use this when logging is disabled or not needed. It has zero
 * performance impact since all methods are empty no-ops.
 *
 * @example
 * ```typescript
 * const logger = condition ? new ConsoleLogger() : new NoopLogger();
 * ```
 */
class NoopLogger {
    debug() { }
    info() { }
    warn() { }
    error() { }
}
exports.NoopLogger = NoopLogger;
/**
 * Simple console-based logger for development and debugging.
 *
 * Outputs formatted log messages to the console with timestamps,
 * log levels, and optional metadata. For production use, consider
 * using a more robust logger like pino or winston.
 *
 * @example Basic usage
 * ```typescript
 * const logger = new ConsoleLogger('odata');
 * logger.info('Request received', { path: '/Products', method: 'GET' });
 * // Output: 2024-01-15T10:30:00.000Z [odata] INFO: Request received { path: '/Products', method: 'GET' }
 * ```
 *
 * @example With custom prefix
 * ```typescript
 * const logger = new ConsoleLogger('my-service');
 * logger.error('Database connection failed', { host: 'localhost', port: 5432 });
 * ```
 */
class ConsoleLogger {
    prefix;
    /**
     * Create a new ConsoleLogger instance.
     *
     * @param prefix - Optional prefix to include in log messages (default: 'odata')
     */
    constructor(prefix = 'odata') {
        this.prefix = prefix;
    }
    /**
     * Format a log entry for console output.
     */
    format(level, message, meta) {
        const timestamp = new Date().toISOString();
        const metaStr = meta && Object.keys(meta).length > 0
            ? ' ' + JSON.stringify(meta)
            : '';
        return `${timestamp} [${this.prefix}] ${level}: ${message}${metaStr}`;
    }
    debug(message, meta) {
        console.debug(this.format('DEBUG', message, meta));
    }
    info(message, meta) {
        console.info(this.format('INFO', message, meta));
    }
    warn(message, meta) {
        console.warn(this.format('WARN', message, meta));
    }
    error(message, meta) {
        console.error(this.format('ERROR', message, meta));
    }
}
exports.ConsoleLogger = ConsoleLogger;
/**
 * Create a logger that adds a correlation ID to all log messages.
 *
 * This is useful for creating a request-scoped logger that automatically
 * includes the correlation ID in all log metadata.
 *
 * @param logger - Base logger to wrap
 * @param correlationId - Correlation ID to include in all messages
 * @returns A new logger that includes the correlation ID in metadata
 *
 * @example
 * ```typescript
 * const baseLogger = new ConsoleLogger('odata');
 * const requestLogger = createRequestLogger(baseLogger, 'abc-123-def');
 * requestLogger.info('Processing request');
 * // Output includes correlationId: 'abc-123-def' in metadata
 * ```
 */
function createRequestLogger(logger, correlationId) {
    return {
        debug(message, meta) {
            logger.debug(message, { correlationId, ...meta });
        },
        info(message, meta) {
            logger.info(message, { correlationId, ...meta });
        },
        warn(message, meta) {
            logger.warn(message, { correlationId, ...meta });
        },
        error(message, meta) {
            logger.error(message, { correlationId, ...meta });
        },
    };
}
//# sourceMappingURL=logger.js.map