/**
 * Heidelberg Places OData Server (PostGIS Edition)
 *
 * Demonstrates PostGIS spatial data handling with coordinate transformation:
 * - Stores coordinates in EPSG:25832 (UTM zone 32N) - European/German coordinate system
 * - Transforms to EPSG:4326 (WGS84/GPS) when serving via OData API
 *
 * Key features:
 * 1. afterRead hook transforms coordinates from UTM to GPS on output
 * 2. beforeCreate hook transforms GPS coordinates to UTM for storage
 * 3. GetPlacesNearby spatial function using PostGIS ST_DWithin
 *
 * Requirements:
 * - PostgreSQL with PostGIS extension
 * - Environment variables: DATABASE_URL or individual PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 *
 * Run with: npx ts-node examples/heidelberg-postgis/server.ts
 */

import express from 'express';
import { Sequelize, Op, QueryTypes } from 'sequelize';
import { odataMiddleware, ODataSchemaConfig, HookContext } from '../../src';
import { initHeidelbergPlace } from './model';
import { seedHeidelbergPlaces } from './seed';
import schema from './schema.json';

/**
 * Transform coordinates from EPSG:25832 (UTM) to EPSG:4326 (WGS84/GPS)
 * using PostGIS ST_Transform
 */
async function transformToWGS84(
  sequelize: Sequelize,
  places: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (places.length === 0) return places;

  const ids = places.map((p) => p.ID);

  // Use PostGIS to transform EPSG:25832 → EPSG:4326
  const transformed = await sequelize.query(
    `
    SELECT
      "ID",
      ST_Y(ST_Transform("Location", 4326)) as "Latitude",
      ST_X(ST_Transform("Location", 4326)) as "Longitude"
    FROM "HeidelbergPlaces"
    WHERE "ID" IN (:ids) AND "Location" IS NOT NULL
  `,
    {
      replacements: { ids },
      type: QueryTypes.SELECT,
    }
  );

  const coordMap = new Map(
    transformed.map((t: Record<string, unknown>) => [t.ID, t])
  );

  return places.map((place) => {
    const coords = coordMap.get(place.ID) as
      | { Latitude: number; Longitude: number }
      | undefined;
    return {
      ...place,
      Latitude: coords?.Latitude ?? null,
      Longitude: coords?.Longitude ?? null,
    };
  });
}

/**
 * Transform coordinates from EPSG:4326 (WGS84/GPS) to EPSG:25832 (UTM)
 * for storage using PostGIS ST_Transform
 */
async function transformToUTM(
  sequelize: Sequelize,
  lat: number,
  lon: number
): Promise<unknown> {
  const [result] = await sequelize.query(
    `SELECT ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 25832) as geom`,
    {
      replacements: { lat, lon },
      type: QueryTypes.SELECT,
    }
  );
  return (result as { geom: unknown }).geom;
}

async function main() {
  // Create Express app
  const app = express();

  // Create PostgreSQL connection (requires PostGIS)
  const databaseUrl = process.env['DATABASE_URL'];
  const sequelize = databaseUrl
    ? new Sequelize(databaseUrl, {
        logging: false, // Set to console.log to see SQL queries
        dialect: 'postgres',
      })
    : new Sequelize({
        dialect: 'postgres',
        host: process.env['PGHOST'] || 'localhost',
        port: parseInt(process.env['PGPORT'] || '5432', 10),
        username: process.env['PGUSER'] || 'postgres',
        password: process.env['PGPASSWORD'] || 'postgres',
        database: process.env['PGDATABASE'] || 'heidelberg_postgis',
        logging: false,
      });

  // Test database connection
  try {
    await sequelize.authenticate();
    console.log('✓ PostgreSQL connection established');
  } catch (error) {
    console.error('✗ Unable to connect to PostgreSQL:', error);
    console.error('');
    console.error('Make sure PostgreSQL with PostGIS is running.');
    console.error('You can start one with Docker:');
    console.error('');
    console.error(
      '  docker run --name heidelberg-postgis -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=heidelberg_postgis -p 5432:5432 -d postgis/postgis:15-3.3'
    );
    console.error('');
    process.exit(1);
  }

  // Check PostGIS extension
  try {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✓ PostGIS extension enabled');
  } catch (error) {
    console.error('✗ Failed to enable PostGIS extension:', error);
    process.exit(1);
  }

  // Initialize model
  const HeidelbergPlaceModel = initHeidelbergPlace(sequelize);

  // Sync database (creates tables)
  await sequelize.sync({ force: true });
  console.log('✓ Database synchronized');

  // Seed data
  await seedHeidelbergPlaces(HeidelbergPlaceModel, sequelize);

  // Create spatial index (improves query performance)
  try {
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_heidelberg_places_location
      ON "HeidelbergPlaces" USING GIST ("Location");
    `);
    console.log('✓ Spatial index created');
  } catch (error) {
    console.warn('⚠ Could not create spatial index:', error);
  }

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

      // Entity hooks for coordinate transformation
      hooks: {
        HeidelbergPlace: {
          /**
           * afterRead: Transform coordinates from EPSG:25832 to EPSG:4326
           * This ensures OData clients receive GPS coordinates (WGS84)
           */
          afterRead: async (
            ctx: HookContext,
            results: unknown[]
          ): Promise<unknown[]> => {
            return transformToWGS84(
              sequelize,
              results as Record<string, unknown>[]
            );
          },

          /**
           * beforeCreate: Transform GPS coordinates to EPSG:25832 for storage
           * This allows clients to POST with Latitude/Longitude and have them
           * stored in the native UTM coordinate system
           */
          beforeCreate: async (
            ctx: HookContext,
            data: unknown
          ): Promise<unknown> => {
            const inputData = data as Record<string, unknown>;
            if (inputData.Latitude != null && inputData.Longitude != null) {
              inputData.Location = await transformToUTM(
                sequelize,
                inputData.Latitude as number,
                inputData.Longitude as number
              );
              // Remove virtual fields - they're computed, not stored
              delete inputData.Latitude;
              delete inputData.Longitude;
            }
            return inputData;
          },

          /**
           * beforeUpdate: Transform GPS coordinates to EPSG:25832 on update
           */
          beforeUpdate: async (
            ctx: HookContext,
            data: unknown
          ): Promise<unknown> => {
            const inputData = data as Record<string, unknown>;
            if (inputData.Latitude != null && inputData.Longitude != null) {
              inputData.Location = await transformToUTM(
                sequelize,
                inputData.Latitude as number,
                inputData.Longitude as number
              );
              delete inputData.Latitude;
              delete inputData.Longitude;
            }
            return inputData;
          },
        },
      },

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
          const places = await HeidelbergPlaceModel.findAll({
            where: { Category: category },
            order: [['Rating', 'DESC']],
          });
          // Transform coordinates for output
          return transformToWGS84(
            sequelize,
            places.map((p) => p.get({ plain: true }) as Record<string, unknown>)
          );
        },

        /**
         * Get top rated places
         * Example: GET /odata/GetTopRatedPlaces?count=5
         */
        GetTopRatedPlaces: async (ctx, params) => {
          const count = (params['count'] as number) || 5;
          const places = await HeidelbergPlaceModel.findAll({
            where: {
              Rating: { [Op.ne]: null as any },
            },
            order: [['Rating', 'DESC']],
            limit: count,
          });
          return transformToWGS84(
            sequelize,
            places.map((p) => p.get({ plain: true }) as Record<string, unknown>)
          );
        },

        /**
         * Get places with free entry
         * Example: GET /odata/GetFreePlaces
         */
        GetFreePlaces: async () => {
          const places = await HeidelbergPlaceModel.findAll({
            where: {
              EntryFee: { [Op.is]: null as any },
            },
            order: [['Rating', 'DESC']],
          });
          return transformToWGS84(
            sequelize,
            places.map((p) => p.get({ plain: true }) as Record<string, unknown>)
          );
        },

        /**
         * Spatial query: Find places within a radius (meters)
         * Uses PostGIS ST_DWithin for efficient spatial queries
         *
         * Example: GET /odata/GetPlacesNearby?lat=49.41&lon=8.71&radiusMeters=500
         *
         * @param lat - Latitude in WGS84 (EPSG:4326)
         * @param lon - Longitude in WGS84 (EPSG:4326)
         * @param radiusMeters - Search radius in meters (default: 1000)
         */
        GetPlacesNearby: async (ctx, params) => {
          const lat = params['lat'] as number;
          const lon = params['lon'] as number;
          const radius = (params['radiusMeters'] as number) || 1000;

          if (lat == null || lon == null) {
            throw new Error('lat and lon parameters are required');
          }

          // Use PostGIS for efficient spatial query
          // ST_DWithin checks if geometries are within a distance (in meters for projected CRS)
          // ST_Distance calculates actual distance for ordering
          const results = await sequelize.query(
            `
            SELECT
              hp."ID",
              hp."Name",
              hp."Description",
              hp."Category",
              hp."Address",
              hp."OpeningHours",
              hp."EntryFee",
              hp."Website",
              hp."Rating",
              hp."IsAccessible",
              hp."CreatedAt",
              hp."UpdatedAt",
              ST_Y(ST_Transform(hp."Location", 4326)) as "Latitude",
              ST_X(ST_Transform(hp."Location", 4326)) as "Longitude",
              ST_Distance(
                hp."Location",
                ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 25832)
              ) as "DistanceMeters"
            FROM "HeidelbergPlaces" hp
            WHERE hp."Location" IS NOT NULL
              AND ST_DWithin(
                hp."Location",
                ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 25832),
                :radius
              )
            ORDER BY ST_Distance(
              hp."Location",
              ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 25832)
            )
          `,
            {
              replacements: { lat, lon, radius },
              type: QueryTypes.SELECT,
            }
          );

          return results;
        },
      },
    })
  );

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', database: 'postgis' });
  });

  // Start server
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log('');
    console.log('='.repeat(70));
    console.log('  Heidelberg Places OData Server (PostGIS Edition)');
    console.log('='.repeat(70));
    console.log('');
    console.log('  Coordinate System:');
    console.log('  - Storage: EPSG:25832 (UTM zone 32N) - European/German system');
    console.log('  - API Output: EPSG:4326 (WGS84/GPS) - Standard GPS coordinates');
    console.log('');
    console.log('  Server running at:');
    console.log(`  http://localhost:${port}/odata`);
    console.log('');
    console.log('  Try these endpoints:');
    console.log('');
    console.log('  📋 Metadata:');
    console.log(`     GET http://localhost:${port}/odata/$metadata`);
    console.log('');
    console.log('  📍 All places (with GPS coordinates):');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace`);
    console.log('');
    console.log('  🔍 Single place:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace(1)`);
    console.log('');
    console.log('  🎯 Filter examples:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$filter=Category eq 'Museum'`);
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$filter=Rating gt 4.5`);
    console.log('');
    console.log('  📊 Select & Sort:');
    console.log(`     GET http://localhost:${port}/odata/HeidelbergPlace?$select=Name,Category,Latitude,Longitude&$orderby=Rating desc`);
    console.log('');
    console.log('  🌍 Spatial Query (PostGIS):');
    console.log(`     GET http://localhost:${port}/odata/GetPlacesNearby?lat=49.41&lon=8.71&radiusMeters=500`);
    console.log('');
    console.log('  🔧 Function Imports:');
    console.log(`     GET http://localhost:${port}/odata/GetPlacesByCategory?category='Museum'`);
    console.log(`     GET http://localhost:${port}/odata/GetTopRatedPlaces?count=5`);
    console.log(`     GET http://localhost:${port}/odata/GetFreePlaces`);
    console.log('');
    console.log('  🆕 Create (POST with GPS coordinates):');
    console.log(`     POST http://localhost:${port}/odata/HeidelbergPlace`);
    console.log('     Body: {"Name": "New Place", "Category": "Park", "Latitude": 49.41, "Longitude": 8.71, "IsAccessible": true}');
    console.log('');
    console.log('='.repeat(70));
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
