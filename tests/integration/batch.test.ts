/**
 * Integration Tests - Batch Requests
 *
 * Tests for OData $batch processing including:
 * - Single operations in batch
 * - Multiple operations in batch
 * - Changesets with transactions
 * - Content-ID references
 * - Error handling in batch
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Sequelize } from 'sequelize';
import {
  createTestSequelize,
  createTestModels,
  createTestApp,
  seedTestData,
  TestModels,
} from '../setup';
import { Express } from 'express';
import * as http from 'http';

describe('Batch Operations', () => {
  let sequelize: Sequelize;
  let models: TestModels;
  let app: Express;

  beforeAll(async () => {
    sequelize = createTestSequelize();
    models = createTestModels(sequelize);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
    await seedTestData(models);
    app = createTestApp(sequelize, models);
  });

  /**
   * Helper to make batch request
   */
  async function batchRequest(
    app: Express,
    body: string,
    boundary: string
  ): Promise<{ status: number; text: string; boundary: string }> {
    return new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const port = (server.address() as any).port;

        const options = {
          hostname: 'localhost',
          port,
          path: '/odata/$batch',
          method: 'POST',
          headers: {
            'Content-Type': `multipart/mixed; boundary=${boundary}`,
            'Accept': 'multipart/mixed',
          },
        };

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => {
            server.close();
            const responseBoundary = (res.headers['content-type'] || '').match(/boundary=([^;]+)/)?.[1] || '';
            resolve({
              status: res.statusCode || 0,
              text: data,
              boundary: responseBoundary,
            });
          });
        });

        req.on('error', (err) => {
          server.close();
          reject(err);
        });

        req.write(body);
        req.end();
      });
    });
  }

  describe('Simple Batch Requests', () => {
    it('should process single GET request in batch', async () => {
      const boundary = 'batch_simple_get';
      const body = [
        `--${boundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'GET Product(1) HTTP/1.1',
        'Accept: application/json',
        '',
        '',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await batchRequest(app, body, boundary);

      expect(res.status).toBe(200);
      expect(res.text).toContain('HTTP/1.1 200');
      expect(res.text).toContain('Laptop');
    });

    it('should process multiple GET requests in batch', async () => {
      const boundary = 'batch_multi_get';
      const body = [
        `--${boundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'GET Product(1) HTTP/1.1',
        'Accept: application/json',
        '',
        '',
        `--${boundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'GET Category(1) HTTP/1.1',
        'Accept: application/json',
        '',
        '',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await batchRequest(app, body, boundary);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Laptop');
      expect(res.text).toContain('Electronics');
    });
  });

  describe('Changesets', () => {
    it('should process changeset with single POST', async () => {
      const boundary = 'batch_changeset';
      const changesetBoundary = 'changeset_1';
      const body = [
        `--${boundary}`,
        `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
        '',
        `--${changesetBoundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        'Content-ID: 1',
        '',
        'POST Product HTTP/1.1',
        'Content-Type: application/json',
        'Accept: application/json',
        '',
        JSON.stringify({ Name: 'Batch Product', Price: 99.99 }),
        `--${changesetBoundary}--`,
        `--${boundary}--`,
      ].join('\r\n');

      const res = await batchRequest(app, body, boundary);

      expect(res.status).toBe(200);
      expect(res.text).toContain('HTTP/1.1 201');
      expect(res.text).toContain('Batch Product');
    });

    it('should process changeset with multiple operations', async () => {
      const boundary = 'batch_multi_changeset';
      const changesetBoundary = 'changeset_multi';
      const body = [
        `--${boundary}`,
        `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
        '',
        `--${changesetBoundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        'Content-ID: 1',
        '',
        'POST Product HTTP/1.1',
        'Content-Type: application/json',
        '',
        JSON.stringify({ Name: 'Product A', Price: 10.00 }),
        `--${changesetBoundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        'Content-ID: 2',
        '',
        'POST Product HTTP/1.1',
        'Content-Type: application/json',
        '',
        JSON.stringify({ Name: 'Product B', Price: 20.00 }),
        `--${changesetBoundary}--`,
        `--${boundary}--`,
      ].join('\r\n');

      const res = await batchRequest(app, body, boundary);

      expect(res.status).toBe(200);
      // Both should succeed
      const successCount = (res.text.match(/HTTP\/1\.1 201/g) || []).length;
      expect(successCount).toBe(2);
    });

    it('should rollback changeset on error', async () => {
      // First create a product, then try a changeset that will fail
      const boundary = 'batch_rollback';
      const changesetBoundary = 'changeset_rollback';
      const body = [
        `--${boundary}`,
        `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
        '',
        `--${changesetBoundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        'Content-ID: 1',
        '',
        'POST Product HTTP/1.1',
        'Content-Type: application/json',
        '',
        JSON.stringify({ Name: 'Should Rollback', Price: 50.00 }),
        `--${changesetBoundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        'Content-ID: 2',
        '',
        'POST Product HTTP/1.1',
        'Content-Type: application/json',
        '',
        // Missing required Name field - should cause error
        JSON.stringify({ Price: 25.00 }),
        `--${changesetBoundary}--`,
        `--${boundary}--`,
      ].join('\r\n');

      const res = await batchRequest(app, body, boundary);

      // The batch itself succeeds
      expect(res.status).toBe(200);
      // But should contain rollback errors
      expect(res.text).toContain('rolled back');
    });
  });

  describe('Mixed Batch Operations', () => {
    it('should handle GET followed by changeset', async () => {
      const boundary = 'batch_mixed';
      const changesetBoundary = 'changeset_mixed';
      const body = [
        `--${boundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'GET Product?$top=1 HTTP/1.1',
        'Accept: application/json',
        '',
        '',
        `--${boundary}`,
        `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
        '',
        `--${changesetBoundary}`,
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        'Content-ID: 1',
        '',
        'POST Product HTTP/1.1',
        'Content-Type: application/json',
        '',
        JSON.stringify({ Name: 'New In Mixed', Price: 15.00 }),
        `--${changesetBoundary}--`,
        `--${boundary}--`,
      ].join('\r\n');

      const res = await batchRequest(app, body, boundary);

      expect(res.status).toBe(200);
      expect(res.text).toContain('HTTP/1.1 200'); // GET response
      expect(res.text).toContain('HTTP/1.1 201'); // POST response
    });
  });

  describe('Batch Validation', () => {
    it('should reject request without boundary', async () => {
      return new Promise<void>((resolve, reject) => {
        const server = app.listen(0, () => {
          const port = (server.address() as any).port;

          const options = {
            hostname: 'localhost',
            port,
            path: '/odata/$batch',
            method: 'POST',
            headers: {
              'Content-Type': 'multipart/mixed', // Missing boundary
            },
          };

          const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk: string) => data += chunk);
            res.on('end', () => {
              server.close();
              expect(res.statusCode).toBe(400);
              resolve();
            });
          });

          req.on('error', () => {
            server.close();
            reject();
          });

          req.write('test');
          req.end();
        });
      });
    });

    it('should reject oversized batch', async () => {
      const boundary = 'batch_size';
      // Create batch with many operations to exceed limit
      const parts: string[] = [`--${boundary}`];

      for (let i = 0; i < 150; i++) {
        parts.push(
          'Content-Type: application/http',
          'Content-Transfer-Encoding: binary',
          '',
          'GET Product(1) HTTP/1.1',
          '',
          '',
          `--${boundary}`
        );
      }
      parts[parts.length - 1] = `--${boundary}--`;

      const body = parts.join('\r\n');
      const res = await batchRequest(app, body, boundary);

      expect(res.status).toBe(400);
      expect(res.text).toContain('exceeds maximum');
    });
  });
});
