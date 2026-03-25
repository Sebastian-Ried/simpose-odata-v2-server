/**
 * Logging Integration Tests
 *
 * Tests for request logging and correlation ID handling in the middleware
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import { Sequelize } from 'sequelize';
import {
  createTestSequelize,
  createTestModels,
  seedTestData,
  request,
  TestModels,
  createTestSchema,
} from '../setup';
import { odataMiddleware, ConsoleLogger, Logger } from '../../src';

describe('Logging Integration', () => {
  let sequelize: Sequelize;
  let models: TestModels;

  beforeAll(async () => {
    sequelize = createTestSequelize();
    models = createTestModels(sequelize);
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
    await seedTestData(models);
  });

  const createLoggingApp = (options: {
    logger?: Logger;
    logRequests?: boolean;
    correlationIdHeader?: string;
    hooks?: any;
  }) => {
    const app = express();
    app.use(
      '/odata',
      odataMiddleware({
        sequelize,
        schema: createTestSchema(),
        models: {
          Product: models.Product,
          Category: models.Category,
          Order: models.Order,
          OrderItem: models.OrderItem,
        },
        ...options,
      })
    );
    return app;
  };

  describe('Correlation ID Handling', () => {
    it('should use provided correlation ID from header', async () => {
      const app = createLoggingApp({});

      const response = await request(app, 'GET', '/odata/Product', {
        headers: { 'x-correlation-id': 'my-custom-correlation-id' },
      });

      expect(response.headers['x-correlation-id']).toBe('my-custom-correlation-id');
    });

    it('should generate correlation ID when not provided', async () => {
      const app = createLoggingApp({});

      const response = await request(app, 'GET', '/odata/Product');

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should support custom correlation ID header name', async () => {
      const app = createLoggingApp({
        correlationIdHeader: 'x-request-id',
      });

      const response = await request(app, 'GET', '/odata/Product', {
        headers: { 'x-request-id': 'custom-header-id' },
      });

      expect(response.headers['x-request-id']).toBe('custom-header-id');
    });
  });

  describe('Request Logging', () => {
    it('should log request start and completion', async () => {
      const logs: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];

      const testLogger: Logger = {
        debug: (msg, meta) => logs.push({ level: 'debug', message: msg, meta }),
        info: (msg, meta) => logs.push({ level: 'info', message: msg, meta }),
        warn: (msg, meta) => logs.push({ level: 'warn', message: msg, meta }),
        error: (msg, meta) => logs.push({ level: 'error', message: msg, meta }),
      };

      const app = createLoggingApp({ logger: testLogger });

      await request(app, 'GET', '/odata/Product');

      // Should have request start and completion logs
      const infoLogs = logs.filter((l) => l.level === 'info');
      expect(infoLogs.length).toBeGreaterThanOrEqual(2);

      // Check request start log
      const startLog = infoLogs.find((l) => l.message === 'OData request started');
      expect(startLog).toBeDefined();
      expect(startLog?.meta?.method).toBe('GET');
      expect(startLog?.meta?.path).toBe('/Product');
      expect(startLog?.meta?.correlationId).toBeDefined();

      // Check request completed log
      const completedLog = infoLogs.find((l) => l.message === 'OData request completed');
      expect(completedLog).toBeDefined();
      expect(completedLog?.meta?.status).toBe(200);
      expect(completedLog?.meta?.duration).toBeDefined();
      expect(typeof completedLog?.meta?.duration).toBe('number');
    });

    it('should log errors with correlation ID', async () => {
      const logs: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];

      const testLogger: Logger = {
        debug: (msg, meta) => logs.push({ level: 'debug', message: msg, meta }),
        info: (msg, meta) => logs.push({ level: 'info', message: msg, meta }),
        warn: (msg, meta) => logs.push({ level: 'warn', message: msg, meta }),
        error: (msg, meta) => logs.push({ level: 'error', message: msg, meta }),
      };

      const app = createLoggingApp({ logger: testLogger });

      // Request non-existent entity
      await request(app, 'GET', '/odata/Product(999)', {
        headers: { 'x-correlation-id': 'error-test-id' },
      });

      // Should have error log
      const errorLogs = logs.filter((l) => l.level === 'error');
      expect(errorLogs.length).toBeGreaterThanOrEqual(1);

      const errorLog = errorLogs.find((l) => l.message === 'OData request failed');
      expect(errorLog).toBeDefined();
      expect(errorLog?.meta?.correlationId).toBe('error-test-id');
      expect(errorLog?.meta?.status).toBe(404);
    });

    it('should not log when logRequests is false', async () => {
      const logs: string[] = [];

      const testLogger: Logger = {
        debug: (msg) => logs.push(msg),
        info: (msg) => logs.push(msg),
        warn: (msg) => logs.push(msg),
        error: (msg) => logs.push(msg),
      };

      const app = createLoggingApp({
        logger: testLogger,
        logRequests: false,
      });

      await request(app, 'GET', '/odata/Product');

      // Should not have request logs
      expect(logs.filter((l) => l.includes('request'))).toHaveLength(0);
    });

    it('should work without logger configured', async () => {
      const app = createLoggingApp({});

      const response = await request(app, 'GET', '/odata/Product');

      expect(response.status).toBe(200);
    });

    it('should include correlation ID in all logs for a request', async () => {
      const logs: Array<{ meta?: Record<string, unknown> }> = [];

      const testLogger: Logger = {
        debug: (_, meta) => logs.push({ meta }),
        info: (_, meta) => logs.push({ meta }),
        warn: (_, meta) => logs.push({ meta }),
        error: (_, meta) => logs.push({ meta }),
      };

      const app = createLoggingApp({ logger: testLogger });

      const correlationId = 'consistent-id-123';
      await request(app, 'GET', '/odata/Product', {
        headers: { 'x-correlation-id': correlationId },
      });

      // All logs should have the same correlation ID
      for (const log of logs) {
        expect(log.meta?.correlationId).toBe(correlationId);
      }
    });
  });

  describe('Logger in Hooks', () => {
    it('should provide logger in hook context', async () => {
      let hookLogger: Logger | undefined;
      let hookCorrelationId: string | undefined;

      const app = createLoggingApp({
        logger: new ConsoleLogger('test'),
        hooks: {
          Product: {
            beforeRead: async (ctx: any) => {
              hookLogger = ctx.logger;
              hookCorrelationId = ctx.correlationId;
            },
          },
        },
      });

      await request(app, 'GET', '/odata/Product', {
        headers: { 'x-correlation-id': 'hook-test-id' },
      });

      expect(hookLogger).toBeDefined();
      expect(hookCorrelationId).toBe('hook-test-id');
    });

    it('should allow hooks to log with correlation ID', async () => {
      const logs: Array<{ message: string; meta?: Record<string, unknown> }> = [];

      const testLogger: Logger = {
        debug: () => {},
        info: (msg, meta) => logs.push({ message: msg, meta }),
        warn: () => {},
        error: () => {},
      };

      const app = createLoggingApp({
        logger: testLogger,
        hooks: {
          Product: {
            beforeRead: async (ctx: any) => {
              ctx.logger?.info('Custom hook log', { entityName: ctx.entityName });
            },
          },
        },
      });

      await request(app, 'GET', '/odata/Product', {
        headers: { 'x-correlation-id': 'hook-log-test' },
      });

      // Find the custom hook log
      const hookLog = logs.find((l) => l.message === 'Custom hook log');
      expect(hookLog).toBeDefined();
      expect(hookLog?.meta?.correlationId).toBe('hook-log-test');
      expect(hookLog?.meta?.entityName).toBe('Product');
    });
  });

  describe('ConsoleLogger Integration', () => {
    it('should work with ConsoleLogger', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const app = createLoggingApp({
        logger: new ConsoleLogger('odata-test'),
      });

      await request(app, 'GET', '/odata/Product');

      expect(consoleSpy).toHaveBeenCalled();

      const calls = consoleSpy.mock.calls;
      const hasOdataLog = calls.some((call) =>
        String(call[0]).includes('[odata-test]')
      );
      expect(hasOdataLog).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
