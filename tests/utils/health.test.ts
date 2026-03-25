/**
 * Health Check Tests
 *
 * Tests for health, readiness, and liveness endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import { Sequelize } from 'sequelize';
import {
  createHealthHandler,
  createReadinessHandler,
  createLivenessHandler,
  createHealthRouter,
} from '../../src/utils/health';

// Helper to make requests
function makeRequest(
  app: Express,
  path: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;

      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path,
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode, body: data });
            }
          });
        }
      );

      req.on('error', (err: Error) => {
        server.close();
        reject(err);
      });

      req.end();
    });
  });
}

describe('Health Check Utilities', () => {
  describe('createLivenessHandler', () => {
    it('should return alive status', async () => {
      const app = express();
      app.get('/live', createLivenessHandler());

      const { status, body } = await makeRequest(app, '/live');

      expect(status).toBe(200);
      expect(body.alive).toBe(true);
      expect(body.timestamp).toBeDefined();
    });

    it('should always return 200', async () => {
      const app = express();
      app.get('/live', createLivenessHandler());

      // Multiple requests should all succeed
      for (let i = 0; i < 3; i++) {
        const { status } = await makeRequest(app, '/live');
        expect(status).toBe(200);
      }
    });
  });

  describe('createHealthHandler', () => {
    it('should return healthy status without database', async () => {
      const app = express();
      app.get('/health', createHealthHandler());

      const { status, body } = await makeRequest(app, '/health');

      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(body.checks).toEqual({});
    });

    it('should return healthy status with working database', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });

      const app = express();
      app.get('/health', createHealthHandler({ sequelize }));

      const { status, body } = await makeRequest(app, '/health');

      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.checks.database.status).toBe('up');
      expect(body.checks.database.latency).toBeGreaterThanOrEqual(0);

      await sequelize.close();
    });

    it('should return unhealthy status when database is down', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });
      // Mock authenticate to simulate failure
      vi.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('Connection refused'));

      const app = express();
      app.get('/health', createHealthHandler({ sequelize, dbCheckTimeout: 500 }));

      const { status, body } = await makeRequest(app, '/health');

      expect(status).toBe(503);
      expect(body.status).toBe('unhealthy');
      expect(body.checks.database.status).toBe('down');
      expect(body.checks.database.error).toBe('Connection refused');

      await sequelize.close().catch(() => {});
    });

    it('should run custom health checks', async () => {
      const customChecks = {
        externalApi: async () => ({ status: 'up' as const, latency: 50 }),
        cache: async () => ({ status: 'down' as const, error: 'Connection refused' }),
      };

      const app = express();
      app.get('/health', createHealthHandler({ customChecks }));

      const { status, body } = await makeRequest(app, '/health');

      expect(status).toBe(200); // degraded still returns 200
      expect(body.status).toBe('degraded');
      expect(body.checks.externalApi.status).toBe('up');
      expect(body.checks.cache.status).toBe('down');
    });

    it('should handle custom check errors', async () => {
      const customChecks = {
        failing: async () => {
          throw new Error('Check exploded');
        },
      };

      const app = express();
      app.get('/health', createHealthHandler({ customChecks }));

      const { status, body } = await makeRequest(app, '/health');

      expect(body.status).toBe('degraded');
      expect(body.checks.failing.status).toBe('down');
      expect(body.checks.failing.error).toBe('Check exploded');
    });
  });

  describe('createReadinessHandler', () => {
    it('should return ready without database', async () => {
      const app = express();
      app.get('/ready', createReadinessHandler());

      const { status, body } = await makeRequest(app, '/ready');

      expect(status).toBe(200);
      expect(body.ready).toBe(true);
      expect(body.timestamp).toBeDefined();
    });

    it('should return ready with working database', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });

      const app = express();
      app.get('/ready', createReadinessHandler({ sequelize }));

      const { status, body } = await makeRequest(app, '/ready');

      expect(status).toBe(200);
      expect(body.ready).toBe(true);
      expect(body.checks.database.ready).toBe(true);

      await sequelize.close();
    });

    it('should return not ready when database is down', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });
      // Mock authenticate to simulate failure
      vi.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('Connection refused'));

      const app = express();
      app.get('/ready', createReadinessHandler({ sequelize, dbCheckTimeout: 500 }));

      const { status, body } = await makeRequest(app, '/ready');

      expect(status).toBe(503);
      expect(body.ready).toBe(false);
      expect(body.checks.database.ready).toBe(false);

      await sequelize.close().catch(() => {});
    });

    it('should respect external isReady flag', async () => {
      let ready = false;

      const app = express();
      app.get('/ready', createReadinessHandler({ isReady: () => ready }));

      // Initially not ready
      let response = await makeRequest(app, '/ready');
      expect(response.status).toBe(503);
      expect(response.body.ready).toBe(false);

      // Now ready
      ready = true;
      response = await makeRequest(app, '/ready');
      expect(response.status).toBe(200);
      expect(response.body.ready).toBe(true);
    });
  });

  describe('createHealthRouter', () => {
    it('should create router with all endpoints', async () => {
      const app = express();
      app.use(createHealthRouter());

      // Test all three endpoints
      const liveResponse = await makeRequest(app, '/live');
      expect(liveResponse.status).toBe(200);
      expect(liveResponse.body.alive).toBe(true);

      const readyResponse = await makeRequest(app, '/ready');
      expect(readyResponse.status).toBe(200);
      expect(readyResponse.body.ready).toBe(true);

      const healthResponse = await makeRequest(app, '/health');
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe('healthy');
    });

    it('should pass options to all handlers', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });

      const app = express();
      app.use(createHealthRouter({ sequelize }));

      const healthResponse = await makeRequest(app, '/health');
      expect(healthResponse.body.checks.database).toBeDefined();

      const readyResponse = await makeRequest(app, '/ready');
      expect(readyResponse.body.checks.database).toBeDefined();

      await sequelize.close();
    });

    it('should work when mounted at a path', async () => {
      const app = express();
      app.use('/api', createHealthRouter());

      const response = await makeRequest(app, '/api/health');
      expect(response.status).toBe(200);
    });
  });
});
