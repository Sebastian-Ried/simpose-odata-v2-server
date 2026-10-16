/**
 * Integration Tests - Function Imports
 *
 * Serialization of function import results, including $select on functions
 * that return a collection of entities.
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

describe('Function Imports', () => {
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
    app = createTestApp(sequelize, models, undefined, {
      functionImports: {
        GetProductsByPriceRange: async () => {
          const rows = await models.Product.findAll({ order: [['ID', 'ASC']] });
          return rows.map((row) => row.get({ plain: true }));
        },
        GetProductCount: async () => models.Product.count(),
      },
    });
  });

  const deferredLinks = (entity: Record<string, any>) =>
    Object.keys(entity).filter((key) => entity[key]?.__deferred);

  it('returns full entities with deferred navigation links without $select', async () => {
    const response = await request(app, 'GET', '/odata/GetProductsByPriceRange?minPrice=0M&maxPrice=5000M');

    expect(response.status).toBe(200);
    const first = response.body.d.results[0];
    expect(first.__metadata.type).toContain('Product');
    expect(first).toHaveProperty('Name');
    expect(first).toHaveProperty('Price');
    expect(deferredLinks(first).length).toBeGreaterThan(0);
  });

  it('returns only the selected properties and no unselected navigation links with $select', async () => {
    const response = await request(app, 'GET',
      '/odata/GetProductsByPriceRange?minPrice=0M&maxPrice=5000M&$select=ID,Name'
    );

    expect(response.status).toBe(200);
    const results = response.body.d.results;
    expect(results.length).toBeGreaterThan(0);
    for (const entity of results) {
      expect(Object.keys(entity).sort()).toEqual(['ID', 'Name', '__metadata']);
      expect(entity.__metadata.uri).toContain('Product(');
      expect(entity.__metadata.etag).toBeUndefined();
    }
  });

  it('always includes key properties with $select', async () => {
    const response = await request(app, 'GET', '/odata/GetProductsByPriceRange?minPrice=0M&maxPrice=5000M&$select=Name');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.d.results[0]).sort()).toEqual(['ID', 'Name', '__metadata']);
  });

  it('rejects unknown properties in $select', async () => {
    const response = await request(app, 'GET', '/odata/GetProductsByPriceRange?minPrice=0M&maxPrice=5000M&$select=Nope');

    expect(response.status).toBe(400);
  });

  it('ignores $select for primitive results', async () => {
    const response = await request(app, 'GET', '/odata/GetProductCount?$select=Name');

    expect(response.status).toBe(200);
    expect(response.body.d.GetProductCount ?? response.body.d['Edm.Int32']).toBeDefined();
  });
});
