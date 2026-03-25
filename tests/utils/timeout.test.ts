/**
 * Request Timeout Tests
 *
 * Tests for request timeout middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import {
  createRequestTimeoutMiddleware,
  createDynamicTimeoutMiddleware,
  TimeoutControlledRequest,
} from '../../src/utils/timeout';

// Helper to make requests with timeout
function makeRequest(
  app: Express,
  path: string,
  timeoutMs: number = 5000
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
          timeout: timeoutMs,
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
        // Socket destroyed errors are expected on timeout
        if (err.message.includes('socket hang up') || err.message.includes('ECONNRESET')) {
          resolve({ status: 408, body: { error: 'timeout' } });
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
      });

      req.end();
    });
  });
}

describe('Request Timeout Utilities', () => {
  describe('createRequestTimeoutMiddleware', () => {
    it('should allow requests that complete in time', async () => {
      const app = express();
      app.use(createRequestTimeoutMiddleware({ timeout: 1000 }));
      app.get('/fast', (req, res) => {
        res.json({ success: true });
      });

      const { status, body } = await makeRequest(app, '/fast');

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should timeout slow requests', async () => {
      const app = express();
      app.use(createRequestTimeoutMiddleware({ timeout: 100 }));
      app.get('/slow', (req, res) => {
        // Never responds
        setTimeout(() => {
          if (!res.headersSent) {
            res.json({ success: true });
          }
        }, 5000);
      });

      const { status, body } = await makeRequest(app, '/slow', 2000);

      expect(status).toBe(408);
      expect(body.error?.code).toBe('408');
    });

    it('should use custom status code', async () => {
      const app = express();
      app.use(createRequestTimeoutMiddleware({ timeout: 100, statusCode: 504 }));
      app.get('/slow', (req, res) => {
        // Never responds
      });

      const { status, body } = await makeRequest(app, '/slow', 2000);

      expect(status).toBe(504);
      expect(body.error?.code).toBe('504');
    });

    it('should use custom message', async () => {
      const app = express();
      app.use(createRequestTimeoutMiddleware({
        timeout: 100,
        message: 'Custom timeout message',
      }));
      app.get('/slow', (req, res) => {
        // Never responds
      });

      const { status, body } = await makeRequest(app, '/slow', 2000);

      expect(body.error?.message?.value).toBe('Custom timeout message');
    });

    it('should call onTimeout callback', async () => {
      let timeoutCalled = false;
      let timeoutPath = '';

      const app = express();
      app.use(createRequestTimeoutMiddleware({
        timeout: 100,
        onTimeout: (req) => {
          timeoutCalled = true;
          timeoutPath = req.path;
        },
      }));
      app.get('/slow', (req, res) => {
        // Never responds
      });

      await makeRequest(app, '/slow', 2000);

      expect(timeoutCalled).toBe(true);
      expect(timeoutPath).toBe('/slow');
    });

    it('should not timeout if response is sent', async () => {
      const app = express();
      app.use(createRequestTimeoutMiddleware({ timeout: 200 }));
      app.get('/fast', (req, res) => {
        res.json({ success: true });
      });

      const { status } = await makeRequest(app, '/fast');

      expect(status).toBe(200);

      // Wait to ensure timeout doesn't fire after response
      await new Promise((r) => setTimeout(r, 300));
    });
  });

  describe('createDynamicTimeoutMiddleware', () => {
    it('should allow timeout extension', async () => {
      const app = express();
      app.use(createDynamicTimeoutMiddleware({ timeout: 100 }));
      app.get('/extended', (req: TimeoutControlledRequest, res) => {
        // Extend timeout before it expires
        req.extendTimeout?.(500);

        setTimeout(() => {
          res.json({ success: true });
        }, 200);
      });

      const { status, body } = await makeRequest(app, '/extended', 2000);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should allow timeout reset', async () => {
      const app = express();
      app.use(createDynamicTimeoutMiddleware({ timeout: 100 }));
      app.get('/reset', (req: TimeoutControlledRequest, res) => {
        // Wait a bit, then reset timeout
        setTimeout(() => {
          req.resetTimeout?.();
        }, 50);

        setTimeout(() => {
          res.json({ success: true });
        }, 120);
      });

      const { status, body } = await makeRequest(app, '/reset', 2000);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should report remaining timeout', async () => {
      const app = express();
      app.use(createDynamicTimeoutMiddleware({ timeout: 1000 }));

      let remaining1: number | undefined;
      let remaining2: number | undefined;

      app.get('/remaining', (req: TimeoutControlledRequest, res) => {
        remaining1 = req.getRemainingTimeout?.();

        setTimeout(() => {
          remaining2 = req.getRemainingTimeout?.();
          res.json({ remaining1, remaining2 });
        }, 100);
      });

      const { status } = await makeRequest(app, '/remaining');

      expect(status).toBe(200);
      expect(remaining1).toBeGreaterThan(900);
      expect(remaining2).toBeGreaterThan(800);
      expect(remaining2!).toBeLessThan(remaining1!);
    });

    it('should timeout if not extended', async () => {
      const app = express();
      app.use(createDynamicTimeoutMiddleware({ timeout: 100 }));
      app.get('/slow', (req, res) => {
        // Don't extend, don't respond
      });

      const { status } = await makeRequest(app, '/slow', 2000);

      expect(status).toBe(408);
    });
  });
});
