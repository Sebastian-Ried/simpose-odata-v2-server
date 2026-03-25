/**
 * Basic OData V2 Server Example
 *
 * This example demonstrates a complete OData server with:
 * - Products and Categories entities
 * - Relationships between entities
 * - Basic hooks for business logic
 * - Function imports
 *
 * Run with: npx ts-node examples/basic/server.ts
 * Then open: http://localhost:3000/odata/$metadata
 */

import express from 'express';
import { Sequelize, DataTypes, Model, Op } from 'sequelize';
import { odataMiddleware, ODataError, ODataSchemaConfig } from '../../src';

// =============================================================================
// Database Setup
// =============================================================================

// Using SQLite in-memory database for simplicity
const sequelize = new Sequelize('sqlite::memory:', {
  logging: false, // Set to console.log to see SQL queries
});

// =============================================================================
// Model Definitions
// =============================================================================

// Category Model
class Category extends Model {
  declare ID: number;
  declare Name: string;
  declare Description: string | null;
}

Category.init(
  {
    ID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    Name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    Description: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'categories',
    timestamps: false,
  }
);

// Product Model
class Product extends Model {
  declare ID: number;
  declare Name: string;
  declare Description: string | null;
  declare Price: number;
  declare Stock: number;
  declare CategoryID: number | null;
  declare CreatedAt: Date;
}

Product.init(
  {
    ID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    Name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    Description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    Stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    CategoryID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'ID',
      },
    },
    CreatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'products',
    timestamps: false,
  }
);

// Define relationships
Product.belongsTo(Category, { foreignKey: 'CategoryID', as: 'Category' });
Category.hasMany(Product, { foreignKey: 'CategoryID', as: 'Products' });

// =============================================================================
// OData Schema Configuration
// =============================================================================

const odataSchema: ODataSchemaConfig = {
  namespace: 'ShopService',
  containerName: 'ShopContainer',

  entities: {
    // Products entity set
    Products: {
      model: 'Product',
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String', maxLength: 100, nullable: false },
        Description: { type: 'Edm.String' },
        Price: { type: 'Edm.Decimal', precision: 10, scale: 2, nullable: false },
        Stock: { type: 'Edm.Int32', nullable: false },
        CategoryID: { type: 'Edm.Int32' },
        CreatedAt: { type: 'Edm.DateTime' },
      },
      navigationProperties: {
        Category: {
          target: 'Categories',
          relationship: 'Product_Category',
          multiplicity: '0..1',
        },
      },
    },

    // Categories entity set
    Categories: {
      model: 'Category',
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String', maxLength: 50, nullable: false },
        Description: { type: 'Edm.String', maxLength: 200 },
      },
      navigationProperties: {
        Products: {
          target: 'Products',
          relationship: 'Product_Category',
          multiplicity: '*',
        },
      },
    },
  },

  // Association definitions
  associations: {
    Product_Category: {
      ends: [
        { entity: 'Products', multiplicity: '*' },
        { entity: 'Categories', multiplicity: '0..1' },
      ],
      referentialConstraint: {
        principal: { entity: 'Categories', property: 'ID' },
        dependent: { entity: 'Products', property: 'CategoryID' },
      },
    },
  },

  // Function imports
  functionImports: {
    GetProductsByPriceRange: {
      returnType: 'Collection(Products)',
      httpMethod: 'GET',
      parameters: {
        minPrice: { type: 'Edm.Decimal' },
        maxPrice: { type: 'Edm.Decimal' },
      },
    },
    GetCategoryStats: {
      returnType: 'Edm.String',
      httpMethod: 'GET',
      parameters: {
        categoryId: { type: 'Edm.Int32' },
      },
    },
  },
};

// =============================================================================
// Seed Data
// =============================================================================

async function seedDatabase() {
  // Create categories
  const electronics = await Category.create({
    Name: 'Electronics',
    Description: 'Electronic devices and accessories',
  });

  const clothing = await Category.create({
    Name: 'Clothing',
    Description: 'Apparel and fashion items',
  });

  const books = await Category.create({
    Name: 'Books',
    Description: 'Physical and digital books',
  });

  // Create products
  await Product.bulkCreate([
    {
      Name: 'iPhone 15 Pro',
      Description: 'Latest Apple smartphone',
      Price: 999.99,
      Stock: 50,
      CategoryID: electronics.ID,
    },
    {
      Name: 'Samsung Galaxy S24',
      Description: 'Premium Android smartphone',
      Price: 899.99,
      Stock: 45,
      CategoryID: electronics.ID,
    },
    {
      Name: 'MacBook Pro 14"',
      Description: 'Professional laptop for developers',
      Price: 1999.99,
      Stock: 20,
      CategoryID: electronics.ID,
    },
    {
      Name: 'Sony WH-1000XM5',
      Description: 'Noise-canceling headphones',
      Price: 349.99,
      Stock: 100,
      CategoryID: electronics.ID,
    },
    {
      Name: 'Classic T-Shirt',
      Description: '100% cotton comfortable t-shirt',
      Price: 29.99,
      Stock: 200,
      CategoryID: clothing.ID,
    },
    {
      Name: 'Slim Fit Jeans',
      Description: 'Modern slim fit denim jeans',
      Price: 79.99,
      Stock: 150,
      CategoryID: clothing.ID,
    },
    {
      Name: 'Winter Jacket',
      Description: 'Warm and stylish winter jacket',
      Price: 149.99,
      Stock: 75,
      CategoryID: clothing.ID,
    },
    {
      Name: 'Clean Code',
      Description: 'A handbook of agile software craftsmanship',
      Price: 44.99,
      Stock: 30,
      CategoryID: books.ID,
    },
    {
      Name: 'Design Patterns',
      Description: 'Elements of reusable object-oriented software',
      Price: 54.99,
      Stock: 25,
      CategoryID: books.ID,
    },
    {
      Name: 'The Pragmatic Programmer',
      Description: 'Your journey to mastery',
      Price: 49.99,
      Stock: 40,
      CategoryID: books.ID,
    },
  ]);

  console.log('✓ Seed data created');
}

// =============================================================================
// Express Application
// =============================================================================

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Initialize database
  await sequelize.sync({ force: true });
  console.log('✓ Database synchronized');

  // Seed data
  await seedDatabase();

  // Mount OData middleware
  app.use(
    '/odata',
    odataMiddleware({
      sequelize,
      schema: odataSchema,
      models: {
        Product: Product,
        Category: Category,
      },

      // Hooks for business logic
      hooks: {
        Products: {
          // Add computed fields to responses
          afterRead: async (ctx, results) => {
            return results.map((product: any) => ({
              ...product,
              // Add availability status
              Availability:
                product.Stock > 20
                  ? 'In Stock'
                  : product.Stock > 0
                  ? 'Low Stock'
                  : 'Out of Stock',
            }));
          },

          // Validate before creating
          beforeCreate: async (ctx, data: any) => {
            if (!data.Name || data.Name.trim().length < 2) {
              throw new ODataError(400, 'Product name must be at least 2 characters');
            }
            if (data.Price < 0) {
              throw new ODataError(400, 'Price cannot be negative');
            }
            if (data.Stock < 0) {
              throw new ODataError(400, 'Stock cannot be negative');
            }
            return data;
          },

          // Validate before updating
          beforeUpdate: async (ctx, data: any) => {
            if (data.Price !== undefined && data.Price < 0) {
              throw new ODataError(400, 'Price cannot be negative');
            }
            if (data.Stock !== undefined && data.Stock < 0) {
              throw new ODataError(400, 'Stock cannot be negative');
            }
            return data;
          },
        },

        Categories: {
          // Prevent deletion of categories with products
          beforeDelete: async (ctx) => {
            const productCount = await Product.count({
              where: { CategoryID: ctx.keys?.['ID'] },
            });
            if (productCount > 0) {
              throw new ODataError(
                409,
                `Cannot delete category: ${productCount} products are assigned to it`
              );
            }
          },
        },
      },

      // Function import implementations
      functionImports: {
        // Get products within a price range
        GetProductsByPriceRange: async (ctx, params) => {
          const minPrice = params['minPrice'] as number || 0;
          const maxPrice = params['maxPrice'] as number || Number.MAX_VALUE;

          return await Product.findAll({
            where: {
              Price: {
                [Op.between]: [minPrice, maxPrice],
              },
            },
            order: [['Price', 'ASC']],
          });
        },

        // Get statistics for a category
        GetCategoryStats: async (ctx, params) => {
          const categoryId = params['categoryId'] as number;

          const products = await Product.findAll({
            where: { CategoryID: categoryId },
          });

          if (products.length === 0) {
            return JSON.stringify({ error: 'No products in category' });
          }

          const totalValue = products.reduce(
            (sum, p) => sum + Number(p.Price) * p.Stock,
            0
          );
          const avgPrice =
            products.reduce((sum, p) => sum + Number(p.Price), 0) / products.length;

          return JSON.stringify({
            productCount: products.length,
            totalStock: products.reduce((sum, p) => sum + p.Stock, 0),
            averagePrice: avgPrice.toFixed(2),
            totalInventoryValue: totalValue.toFixed(2),
          });
        },
      },

      // Enable verbose errors for development
      verboseErrors: true,
    })
  );

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start server
  const PORT = process.env['PORT'] || 3000;
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           OData V2 Server Example - Running!                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Server URL: http://localhost:${PORT}`);
    console.log('');
    console.log('Try these endpoints:');
    console.log('');
    console.log('  Service Document:');
    console.log(`    GET http://localhost:${PORT}/odata/`);
    console.log('');
    console.log('  Metadata:');
    console.log(`    GET http://localhost:${PORT}/odata/$metadata`);
    console.log('');
    console.log('  All Products:');
    console.log(`    GET http://localhost:${PORT}/odata/Products`);
    console.log('');
    console.log('  Single Product:');
    console.log(`    GET http://localhost:${PORT}/odata/Products(1)`);
    console.log('');
    console.log('  Products with Category:');
    console.log(`    GET http://localhost:${PORT}/odata/Products?$expand=Category`);
    console.log('');
    console.log('  Filtered Products:');
    console.log(`    GET http://localhost:${PORT}/odata/Products?$filter=Price gt 100`);
    console.log('');
    console.log('  Selected Fields:');
    console.log(`    GET http://localhost:${PORT}/odata/Products?$select=ID,Name,Price`);
    console.log('');
    console.log('  Sorted Products:');
    console.log(`    GET http://localhost:${PORT}/odata/Products?$orderby=Price desc`);
    console.log('');
    console.log('  Paginated Products:');
    console.log(`    GET http://localhost:${PORT}/odata/Products?$top=5&$skip=0`);
    console.log('');
    console.log('  Combined Query:');
    console.log(`    GET http://localhost:${PORT}/odata/Products?$filter=Price gt 50&$expand=Category&$orderby=Name&$top=10`);
    console.log('');
    console.log('  Function Import:');
    console.log(`    GET http://localhost:${PORT}/odata/GetProductsByPriceRange?minPrice=50&maxPrice=500`);
    console.log('');
    console.log('  Categories:');
    console.log(`    GET http://localhost:${PORT}/odata/Categories`);
    console.log('');
    console.log('  Category with Products:');
    console.log(`    GET http://localhost:${PORT}/odata/Categories(1)?$expand=Products`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
  });
}

// Run the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
