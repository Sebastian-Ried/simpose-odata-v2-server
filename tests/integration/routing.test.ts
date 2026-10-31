/**
 * Integration Tests - Routing
 *
 * - Method tunneling (POST + X-HTTP-Method / X-HTTP-Method-Override) switches
 *   only to the OData methods; anything else leaves the request a POST.
 * - An unknown first segment is 404, not the service document.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Sequelize } from 'sequelize';
import {
  createTestSequelize,
  createTestModels,
  createTestApp,
  seedTestData,
  request,
  TestModels,
} from '../setup';
import { Express } from 'express';

describe('Routing', () => {
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
    app = createTestApp(sequelize, models, undefined, { csrf: { enabled: false } });
  });

  describe('method tunneling', () => {
    it('POST with X-HTTP-Method-Override: MERGE updates the entity', async () => {
      const res = await request(app, 'POST', '/odata/Product(1)', {
        headers: { 'X-HTTP-Method-Override': 'MERGE' },
        body: { Price: 1.5 },
      });
      expect([200, 204]).toContain(res.status);

      const after = await request(app, 'GET', '/odata/Product(1)');
      expect(Number(after.body.d.Price)).toBe(1.5);
    });

    it('an unknown override method is ignored and the request stays a POST', async () => {
      const res = await request(app, 'POST', '/odata/Product', {
        headers: { 'X-HTTP-Method-Override': 'TRACE' },
        body: { Name: 'Tunnelled', Price: 1, Stock: 1, IsActive: true },
      });
      expect(res.status).toBe(201);
      expect(res.body.d.Name).toBe('Tunnelled');
    });
  });

  describe('unknown resources', () => {
    it('answers 404 for an unknown first segment, on GET and POST', async () => {
      const get = await request(app, 'GET', '/odata/NoSuchThing');
      expect(get.status).toBe(404);

      const post = await request(app, 'POST', '/odata/NoSuchThing', { body: { x: 1 } });
      expect(post.status).toBe(404);
    });

    it('still serves the service document at the root', async () => {
      const res = await request(app, 'GET', '/odata/');
      expect(res.status).toBe(200);
      expect(res.body.d.EntitySets).toBeDefined();
    });
  });
});
