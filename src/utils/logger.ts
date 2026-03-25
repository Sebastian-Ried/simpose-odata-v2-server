/**
 * Logger interface for pluggable logging support.
 *
 * This interface is designed to be compatible with common logging libraries
 * like winston, pino, bunyan, etc. Users can provide their own logger
 * implementation or use the built-in ConsoleLogger.
 *
 * @example Using with pino
 * ```typescript
 * import pino from 'pino';
 *
 * const pinoLogger = pino();
 * const logger: Logger = {
 *   debug: (msg, meta) => pinoLogger.debug(meta, msg),
 *   info: (msg, meta) => pinoLogger.info(meta, msg),
 *   warn: (msg, meta) => pinoLogger.warn(meta, msg),
 *   error: (msg, meta) => pinoLogger.error(meta, msg),
 * };
 * ```
 */
export interface Logger {
  /**
   * Log a debug message (verbose development information)
   */
  debug(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log an info message (general operational information)
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log a warning message (potential issues)
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log an error message (errors and failures)
   */
  error(message: string, meta?: Record<string, unknown>): void;
}

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
export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

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
export class ConsoleLogger implements Logger {
  private prefix: string;

  /**
   * Create a new ConsoleLogger instance.
   *
   * @param prefix - Optional prefix to include in log messages (default: 'odata')
   */
  constructor(prefix: string = 'odata') {
    this.prefix = prefix;
  }

  /**
   * Format a log entry for console output.
   */
  private format(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length > 0
      ? ' ' + JSON.stringify(meta)
      : '';
    return `${timestamp} [${this.prefix}] ${level}: ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(this.format('DEBUG', message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(this.format('INFO', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.format('WARN', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.format('ERROR', message, meta));
  }
}

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
export function createRequestLogger(logger: Logger, correlationId: string): Logger {
  return {
    debug(message: string, meta?: Record<string, unknown>): void {
      logger.debug(message, { correlationId, ...meta });
    },
    info(message: string, meta?: Record<string, unknown>): void {
      logger.info(message, { correlationId, ...meta });
    },
    warn(message: string, meta?: Record<string, unknown>): void {
      logger.warn(message, { correlationId, ...meta });
    },
    error(message: string, meta?: Record<string, unknown>): void {
      logger.error(message, { correlationId, ...meta });
    },
  };
}
