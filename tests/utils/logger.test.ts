/**
 * Logger Tests
 *
 * Tests for the logging utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NoopLogger,
  ConsoleLogger,
  createRequestLogger,
  Logger,
} from '../../src/utils/logger';

describe('Logger Utilities', () => {
  describe('NoopLogger', () => {
    it('should create a logger instance', () => {
      const logger = new NoopLogger();

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should not throw when calling methods', () => {
      const logger = new NoopLogger();

      expect(() => logger.debug('test')).not.toThrow();
      expect(() => logger.info('test', { key: 'value' })).not.toThrow();
      expect(() => logger.warn('test')).not.toThrow();
      expect(() => logger.error('test')).not.toThrow();
    });

    it('should implement Logger interface', () => {
      const logger: Logger = new NoopLogger();

      expect(logger).toBeDefined();
    });
  });

  describe('ConsoleLogger', () => {
    let consoleSpy: {
      debug: ReturnType<typeof vi.spyOn>;
      info: ReturnType<typeof vi.spyOn>;
      warn: ReturnType<typeof vi.spyOn>;
      error: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
      consoleSpy = {
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create logger with default prefix', () => {
      const logger = new ConsoleLogger();

      logger.info('test message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const output = consoleSpy.info.mock.calls[0]?.[0] as string;
      expect(output).toContain('[odata]');
      expect(output).toContain('INFO');
      expect(output).toContain('test message');
    });

    it('should create logger with custom prefix', () => {
      const logger = new ConsoleLogger('my-service');

      logger.info('test message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const output = consoleSpy.info.mock.calls[0]?.[0] as string;
      expect(output).toContain('[my-service]');
    });

    it('should log debug messages', () => {
      const logger = new ConsoleLogger();

      logger.debug('debug message', { key: 'value' });

      expect(consoleSpy.debug).toHaveBeenCalled();
      const output = consoleSpy.debug.mock.calls[0]?.[0] as string;
      expect(output).toContain('DEBUG');
      expect(output).toContain('debug message');
      expect(output).toContain('"key":"value"');
    });

    it('should log info messages', () => {
      const logger = new ConsoleLogger();

      logger.info('info message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const output = consoleSpy.info.mock.calls[0]?.[0] as string;
      expect(output).toContain('INFO');
      expect(output).toContain('info message');
    });

    it('should log warn messages', () => {
      const logger = new ConsoleLogger();

      logger.warn('warn message');

      expect(consoleSpy.warn).toHaveBeenCalled();
      const output = consoleSpy.warn.mock.calls[0]?.[0] as string;
      expect(output).toContain('WARN');
      expect(output).toContain('warn message');
    });

    it('should log error messages', () => {
      const logger = new ConsoleLogger();

      logger.error('error message', { error: 'details' });

      expect(consoleSpy.error).toHaveBeenCalled();
      const output = consoleSpy.error.mock.calls[0]?.[0] as string;
      expect(output).toContain('ERROR');
      expect(output).toContain('error message');
      expect(output).toContain('"error":"details"');
    });

    it('should include timestamp in output', () => {
      const logger = new ConsoleLogger();

      logger.info('test');

      const output = consoleSpy.info.mock.calls[0]?.[0] as string;
      // ISO timestamp format check
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle empty metadata', () => {
      const logger = new ConsoleLogger();

      logger.info('test', {});

      const output = consoleSpy.info.mock.calls[0]?.[0] as string;
      expect(output).not.toContain('{}');
    });

    it('should handle undefined metadata', () => {
      const logger = new ConsoleLogger();

      logger.info('test');

      expect(consoleSpy.info).toHaveBeenCalled();
      const output = consoleSpy.info.mock.calls[0]?.[0] as string;
      expect(output).toContain('test');
    });
  });

  describe('createRequestLogger', () => {
    it('should create a logger with correlation ID', () => {
      const logs: Array<{ method: string; message: string; meta?: Record<string, unknown> }> = [];

      const baseLogger: Logger = {
        debug: (msg, meta) => logs.push({ method: 'debug', message: msg, meta }),
        info: (msg, meta) => logs.push({ method: 'info', message: msg, meta }),
        warn: (msg, meta) => logs.push({ method: 'warn', message: msg, meta }),
        error: (msg, meta) => logs.push({ method: 'error', message: msg, meta }),
      };

      const correlationId = 'test-correlation-id-123';
      const requestLogger = createRequestLogger(baseLogger, correlationId);

      requestLogger.info('test message');

      expect(logs).toHaveLength(1);
      expect(logs[0]?.meta?.correlationId).toBe(correlationId);
    });

    it('should preserve additional metadata', () => {
      const logs: Array<{ message: string; meta?: Record<string, unknown> }> = [];

      const baseLogger: Logger = {
        debug: () => {},
        info: (msg, meta) => logs.push({ message: msg, meta }),
        warn: () => {},
        error: () => {},
      };

      const requestLogger = createRequestLogger(baseLogger, 'abc-123');

      requestLogger.info('test', { path: '/Products', method: 'GET' });

      expect(logs[0]?.meta?.correlationId).toBe('abc-123');
      expect(logs[0]?.meta?.path).toBe('/Products');
      expect(logs[0]?.meta?.method).toBe('GET');
    });

    it('should work with all log levels', () => {
      const calls: string[] = [];

      const baseLogger: Logger = {
        debug: () => calls.push('debug'),
        info: () => calls.push('info'),
        warn: () => calls.push('warn'),
        error: () => calls.push('error'),
      };

      const requestLogger = createRequestLogger(baseLogger, 'id');

      requestLogger.debug('test');
      requestLogger.info('test');
      requestLogger.warn('test');
      requestLogger.error('test');

      expect(calls).toEqual(['debug', 'info', 'warn', 'error']);
    });

    it('should implement Logger interface', () => {
      const baseLogger: Logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };

      const requestLogger: Logger = createRequestLogger(baseLogger, 'id');

      expect(requestLogger).toBeDefined();
      expect(typeof requestLogger.debug).toBe('function');
      expect(typeof requestLogger.info).toBe('function');
      expect(typeof requestLogger.warn).toBe('function');
      expect(typeof requestLogger.error).toBe('function');
    });

    it('should not mutate base logger metadata', () => {
      const receivedMeta: Record<string, unknown>[] = [];

      const baseLogger: Logger = {
        debug: () => {},
        info: (_, meta) => { if (meta) receivedMeta.push({ ...meta }); },
        warn: () => {},
        error: () => {},
      };

      const requestLogger1 = createRequestLogger(baseLogger, 'id-1');
      const requestLogger2 = createRequestLogger(baseLogger, 'id-2');

      requestLogger1.info('test1', { extra: 'data1' });
      requestLogger2.info('test2', { extra: 'data2' });

      expect(receivedMeta[0]?.correlationId).toBe('id-1');
      expect(receivedMeta[1]?.correlationId).toBe('id-2');
    });
  });
});
