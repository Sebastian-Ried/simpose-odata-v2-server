/**
 * Heidelberg Places OData Server
 *
 * A simple example showing how to:
 * 1. Define a Sequelize model
 * 2. Create an OData schema
 * 3. Set up the OData middleware
 * 4. Add custom function imports
 *
 * Run with: npx ts-node examples/heidelberg/server.ts
 */

import express from 'express';
import { Sequelize, Op } from 'sequelize';
import { odataMiddleware, ODataSchemaConfig } from '../../src';
import { initHeidelbergPlace } from './model';
import { seedHeidelbergPlaces } from './seed';
import schema from './schema.json';

async function main() {
  // Create Express app
  const app = express();

  // Create SQLite database (in-memory for this example)
  const sequelize = new Sequelize('sqlite::memory:', {
    logging: false, // Set to console.log to see SQL queries
  });

  // Initialize model
  const HeidelbergPlaceModel = initHeidelbergPlace(sequelize);

  // Sync database (creates tables)
  await sequelize.sync({ force: true });
  console.log('✓ Database synchronized');

  // Seed data
  await seedHeidelbergPlaces(HeidelbergPlaceModel);

  // Mount OData middleware
  app.use(
    '/odata',
    odataMiddleware({
      sequelize,
      schema: schema as ODataSchemaConfig,
      models: {
        HeidelbergPlace: HeidelbergPlaceModel,
      },
      // Disable CSRF for this example (enable in production!)
      csrf: { enabled: false },
      // Enable verbose errors for development
      verboseErrors: true,
      // Custom function imports
      functionImports: {
        /**
         * Get places by category
         * Example: GET /odata/GetPlacesByCategory?category='Museum'
         */
        GetPlacesByCategory: async (ctx, params) => {
          const category = params['category'] as string;
          if (!category) {
            throw new Error('Category parameter is required');
          }
          return HeidelbergPlaceModel.findAll({
            where: { Category: category },
            order: [['Rating', 'DESC']],
          });
        },

        /**
         * Get top rated places
         * Example: GET /odata/GetTopRatedPlaces?count=5
         */
        GetTopRatedPlaces: async (ctx, params) => {
          const count = (params['count'] as number) || 5;
          return HeidelbergPlaceModel.findAll({
            where: {
              Rating: { [Op.ne]: null as any },
            },
            order: [['Rating', 'DESC']],
            limit: count,
          });
        },

        /**
         * Get places with free entry
         * Example: GET /odata/GetFreePlaces
         */
        GetFreePlaces: async () => {
          return HeidelbergPlaceModel.findAll({
            where: {
              EntryFee: { [Op.is]: null as any },
            },
            order: [['Rating', 'DESC']],
          });
        },
      },
    })
  );

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Start server
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('  Heidelberg Places OData Server');
    console.log('='.repeat(60));
    console.log('');
    console.log('  Server running at:');
    console.log(`  http://localhost:${port}/odata`);
    console.log('');
    console.log('  Try these endpoints:');
    console.log('');
    console.log('  📋 Metadata:');
    console.log(`     GET http://localhost:${port}/odata/$metadata`);
    console.log('');
    console.log('  📍 All places:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace`);
    console.log('');
    console.log('  🔍 Single place:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace(1)`);
    console.log('');
    console.log('  🎯 Filter examples:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$filter=Category eq 'Museum'`);
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$filter=Rating gt 4.5`);
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$filter=EntryFee eq null`);
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$filter=IsAccessible eq true`);
    console.log('');
    console.log('  📊 Select & Sort:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$select=Name,Category,Rating&$orderby=Rating desc`);
    console.log('');
    console.log('  📄 Pagination:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$top=5&$skip=0&$inlinecount=allpages`);
    console.log('');
    console.log('  🔧 Function Imports:');
    console.log(`     GET http://localhost:${port}/odata/GetPlacesByCategory?category='Museum'`);
    console.log(`     GET http://localhost:${port}/odata/GetTopRatedPlaces?count=5`);
    console.log(`     GET http://localhost:${port}/odata/GetFreePlaces`);
    console.log('');
    console.log('  🆕 Create (POST):');
    console.log(`     POST http://localhost:${port}/odata/HeidelbergPlace`);
    console.log('     Body: {"Name": "New Place", "Category": "Park", "IsAccessible": true}');
    console.log('');
    console.log('='.repeat(60));
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
