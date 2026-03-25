/**
 * CSRF Protection Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { Sequelize } from 'sequelize';
import {
  createTestSequelize,
  createTestModels,
  createTestSchema,
  TestModels,
  seedTestData,
  request,
} from '../setup';
import { odataMiddleware } from '../../src/index';

describe('CSRF Protection', () => {
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
    // Clear and reseed data
    await sequelize.sync({ force: true });
    await seedTestData(models);
  });

  describe('CSRF Enabled', () => {
    function createAppWithCsrf() {
      const app = express();
      app.use('/odata', odataMiddleware({
        sequelize,
        schema: createTestSchema(),
        models: {
          Product: models.Product,
          Category: models.Category,
          Order: models.Order,
          OrderItem: models.OrderItem,
        },
        csrf: { enabled: true },
      }));
      return app;
    }

    it('should allow GET requests without CSRF token', async () => {
      const app = createAppWithCsrf();
      const response = await request(app, 'GET', '/odata/Product');

      expect(response.status).toBe(200);
    });

    it('should return CSRF token when requested with Fetch header', async () => {
      const app = createAppWithCsrf();
      const response = await request(app, 'GET', '/odata/Product', {
        headers: { 'X-CSRF-Token': 'Fetch' },
      });

      expect(response.status).toBe(200);
      expect(response.headers['x-csrf-token']).toBeDefined();
      expect(response.headers['x-csrf-token']).not.toBe('Fetch');
      expect(response.headers['x-csrf-token'].length).toBeGreaterThan(20);
    });

    it('should block POST without CSRF token', async () => {
      const app = createAppWithCsrf();
      const response = await request(app, 'POST', '/odata/Product', {
        body: { Name: 'Test', Price: 10.00 },
      });

      expect(response.status).toBe(403);
      expect(response.body?.error?.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should block DELETE without CSRF token', async () => {
      const app = createAppWithCsrf();
      const response = await request(app, 'DELETE', '/odata/Product(1)');

      expect(response.status).toBe(403);
      expect(response.body?.error?.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should block PUT without CSRF token', async () => {
      const app = createAppWithCsrf();
      const response = await request(app, 'PUT', '/odata/Product(1)', {
        body: { Name: 'Updated', Price: 20.00 },
      });

      expect(response.status).toBe(403);
      expect(response.body?.error?.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should allow $metadata without CSRF token', async () => {
      const app = createAppWithCsrf();
      const response = await request(app, 'GET', '/odata/$metadata', {
        headers: { 'Accept': 'application/xml' },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('CSRF Disabled', () => {
    function createAppWithoutCsrf() {
      const app = express();
      app.use('/odata', odataMiddleware({
        sequelize,
        schema: createTestSchema(),
        models: {
          Product: models.Product,
          Category: models.Category,
          Order: models.Order,
          OrderItem: models.OrderItem,
        },
        csrf: { enabled: false },
      }));
      return app;
    }

    it('should allow POST without CSRF token when disabled', async () => {
      const app = createAppWithoutCsrf();
      const response = await request(app, 'POST', '/odata/Product', {
        body: { Name: 'Test Product', Price: 99.99 },
      });

      expect(response.status).toBe(201);
    });

    it('should allow DELETE without CSRF token when disabled', async () => {
      const app = createAppWithoutCsrf();
      const response = await request(app, 'DELETE', '/odata/Product(1)');

      expect(response.status).toBe(204);
    });
  });
});
