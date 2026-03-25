import { Router } from 'express';
import { ODataMiddlewareOptions } from './config/types';
import { ODataService } from './ODataService';
/**
 * Create OData V2 middleware for Express.
 *
 * This middleware provides a complete OData V2 implementation including:
 * - Full CRUD operations (GET, POST, PUT, MERGE, DELETE)
 * - Query options ($filter, $select, $expand, $orderby, $top, $skip)
 * - Batch processing ($batch endpoint with transaction support)
 * - Metadata generation ($metadata endpoint with EDMX)
 * - Function imports
 * - Navigation properties
 *
 * @param options - Configuration options for the middleware
 * @returns Express Router configured for OData V2 requests
 *
 * @throws {SchemaValidationError} If the schema configuration is invalid
 * @throws {Error} If required models are not provided
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { Sequelize, DataTypes } from 'sequelize';
 * import { odataMiddleware } from 'odata-v2-sequelize';
 *
 * const app = express();
 * const sequelize = new Sequelize('sqlite::memory:');
 *
 * const Product = sequelize.define('Product', {
 *   ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
 *   Name: DataTypes.STRING,
 *   Price: DataTypes.DECIMAL(10, 2)
 * });
 *
 * const schema = {
 *   namespace: 'MyService',
 *   entities: {
 *     Product: {
 *       keys: ['ID'],
 *       properties: {
 *         ID: { type: 'Edm.Int32', nullable: false },
 *         Name: { type: 'Edm.String', maxLength: 100 },
 *         Price: { type: 'Edm.Decimal', precision: 10, scale: 2 }
 *       }
 *     }
 *   }
 * };
 *
 * app.use('/odata', odataMiddleware({
 *   sequelize,
 *   schema,
 *   models: { Product }
 * }));
 *
 * app.listen(3000);
 * ```
 */
export declare function odataMiddleware(options: ODataMiddlewareOptions): Router;
/**
 * Create a standalone OData service instance for custom routing scenarios.
 *
 * Use this when you need more control over how the OData service is integrated
 * into your Express application, or when you want to call it programmatically.
 *
 * @param options - Configuration options for the OData service
 * @returns Configured ODataService instance
 *
 * @example
 * ```typescript
 * const service = createODataService({
 *   sequelize,
 *   schema,
 *   models: { Product }
 * });
 *
 * // Use with custom routing
 * app.all('/api/v1/*', async (req, res, next) => {
 *   try {
 *     await service.processRequest(req, res);
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 * ```
 */
export declare function createODataService(options: ODataMiddlewareOptions): ODataService;
/**
 * Enable MERGE HTTP method support at the Express application level.
 *
 * OData V2 uses the MERGE method for partial updates, but Express doesn't
 * recognize it by default. This helper patches the app's handle method
 * to properly recognize MERGE requests.
 *
 * Note: The middleware already handles MERGE internally, so this is only
 * needed if you want to handle MERGE requests outside the OData middleware.
 *
 * @param app - Express application or router with a handle method
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { enableMergeMethod } from 'odata-v2-sequelize';
 *
 * const app = express();
 * enableMergeMethod(app);
 *
 * // Now MERGE requests will be recognized
 * app.merge('/resource/:id', (req, res) => {
 *   // Handle partial update
 * });
 * ```
 */
export declare function enableMergeMethod(app: {
    handle: Function;
}): void;
//# sourceMappingURL=middleware.d.ts.map