/**
 * Basic OData V2 Server Example
 *
 * This example demonstrates how to set up a basic OData V2 service
 * with Products and Categories entities.
 *
 * Run with: npx ts-node examples/basic-server.ts
 * Then access: http://localhost:3000/odata
 */

import express = require('express');
import { Sequelize, DataTypes, Model, Op } from 'sequelize';
import { odataMiddleware, ODataSchemaConfig, ODataError } from '../src/index';

// Initialize Express
const app = express.default ? express.default() : express();

// Initialize Sequelize with SQLite in-memory database
const sequelize = new Sequelize('sqlite::memory:', {
  logging: false, // Set to console.log to see SQL queries
});

// Define Models
interface ProductAttributes {
  ID: number;
  Name: string;
  Description: string | null;
  Price: number;
  CategoryID: number | null;
  CreatedAt: Date;
}

interface CategoryAttributes {
  ID: number;
  Name: string;
  Description: string | null;
}

const Product = sequelize.define<Model<ProductAttributes>>('Product', {
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
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  Price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  CategoryID: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  CreatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false, // Disable automatic timestamps to avoid conflict with CreatedAt
});

const Category = sequelize.define<Model<CategoryAttributes>>('Category', {
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
}, {
  timestamps: false,
});

// Define Associations
Category.hasMany(Product, { foreignKey: 'CategoryID', as: 'Products' });
Product.belongsTo(Category, { foreignKey: 'CategoryID', as: 'Category' });

// Define OData Schema
const schema: ODataSchemaConfig = {
  namespace: 'ExampleService',
  entities: {
    Product: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String', maxLength: 100, nullable: false },
        Description: { type: 'Edm.String', maxLength: 500 },
        Price: { type: 'Edm.Decimal', precision: 10, scale: 2, nullable: false },
        CategoryID: { type: 'Edm.Int32' },
        CreatedAt: { type: 'Edm.DateTime' },
      },
      navigationProperties: {
        Category: {
          target: 'Category',
          relationship: 'Product_Category',
          multiplicity: '0..1',
        },
      },
    },
    Category: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String', maxLength: 50, nullable: false },
        Description: { type: 'Edm.String', maxLength: 200 },
      },
      navigationProperties: {
        Products: {
          target: 'Product',
          relationship: 'Product_Category',
          multiplicity: '*',
        },
      },
    },
  },
  associations: {
    Product_Category: {
      ends: [
        { entity: 'Product', multiplicity: '*' },
        { entity: 'Category', multiplicity: '1' },
      ],
      referentialConstraint: {
        principal: { entity: 'Category', property: 'ID' },
        dependent: { entity: 'Product', property: 'CategoryID' },
      },
    },
  },
  functionImports: {
    GetProductsByPriceRange: {
      returnType: 'Collection(Product)',
      httpMethod: 'GET',
      parameters: {
        minPrice: { type: 'Edm.Decimal' },
        maxPrice: { type: 'Edm.Decimal' },
      },
      entitySet: 'Products',
    },
  },
};

// Mount OData middleware with hooks example
app.use(
  '/odata',
  odataMiddleware({
    sequelize,
    schema,
    models: { Product, Category },
    verboseErrors: true, // Enable for development

    // Example hooks
    hooks: {
      Product: {
        beforeCreate: async (ctx, data: any) => {
          // Validate price
          if (data.Price < 0) {
            throw new ODataError(400, 'Price cannot be negative');
          }
          return data;
        },
        afterRead: async (ctx, results) => {
          // Add computed property
          return results.map((p: any) => ({
            ...p,
            PriceFormatted: `$${Number(p.Price).toFixed(2)}`,
          }));
        },
      },
    },

    // Example function import implementation
    functionImports: {
      GetProductsByPriceRange: async (ctx, params) => {
        const { minPrice = 0, maxPrice = 999999 } = params as {
          minPrice?: number;
          maxPrice?: number;
        };

        return ctx.models.Product.findAll({
          where: {
            Price: {
              [Op.between]: [minPrice, maxPrice],
            },
          },
          order: [['Price', 'ASC']],
        });
      },
    },
  })
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Seed data and start server
async function startServer() {
  try {
    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synchronized');

    // Seed categories
    const electronics = await Category.create({
      Name: 'Electronics',
      Description: 'Electronic devices and gadgets',
    } as any);

    const clothing = await Category.create({
      Name: 'Clothing',
      Description: 'Apparel and accessories',
    } as any);

    // Seed products
    await Product.bulkCreate([
      {
        Name: 'Laptop',
        Description: 'High-performance laptop',
        Price: 999.99,
        CategoryID: electronics.get('ID') as number,
      },
      {
        Name: 'Smartphone',
        Description: 'Latest smartphone model',
        Price: 699.99,
        CategoryID: electronics.get('ID') as number,
      },
      {
        Name: 'Headphones',
        Description: 'Wireless noise-canceling headphones',
        Price: 299.99,
        CategoryID: electronics.get('ID') as number,
      },
      {
        Name: 'T-Shirt',
        Description: 'Cotton t-shirt',
        Price: 29.99,
        CategoryID: clothing.get('ID') as number,
      },
      {
        Name: 'Jeans',
        Description: 'Classic blue jeans',
        Price: 79.99,
        CategoryID: clothing.get('ID') as number,
      },
    ] as any);

    console.log('Seed data created');

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`\nOData V2 Server running at http://localhost:${PORT}/odata`);
      console.log('\nTry these URLs:');
      console.log(`  GET http://localhost:${PORT}/odata/$metadata`);
      console.log(`  GET http://localhost:${PORT}/odata/Products`);
      console.log(`  GET http://localhost:${PORT}/odata/Products(1)`);
      console.log(`  GET http://localhost:${PORT}/odata/Products?$filter=Price gt 100`);
      console.log(`  GET http://localhost:${PORT}/odata/Products?$expand=Category`);
      console.log(`  GET http://localhost:${PORT}/odata/Products?$orderby=Price desc`);
      console.log(`  GET http://localhost:${PORT}/odata/Categories`);
      console.log(`  GET http://localhost:${PORT}/odata/Categories(1)/Products`);
      console.log(
        `  GET http://localhost:${PORT}/odata/GetProductsByPriceRange?minPrice=50&maxPrice=500`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
