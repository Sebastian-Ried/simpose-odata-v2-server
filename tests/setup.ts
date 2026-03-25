/**
 * Test utilities and fixtures for OData V2 middleware tests
 */

import express, { Express } from 'express';
import { Sequelize, DataTypes, Model, ModelStatic } from 'sequelize';
import { odataMiddleware, ODataSchemaConfig } from '../src/index';

/**
 * Test database setup with common models
 */
export interface TestModels {
  Product: ModelStatic<Model>;
  Category: ModelStatic<Model>;
  Order: ModelStatic<Model>;
  OrderItem: ModelStatic<Model>;
}

/**
 * Create a test Sequelize instance with in-memory SQLite
 */
export function createTestSequelize(): Sequelize {
  return new Sequelize('sqlite::memory:', {
    logging: false,
  });
}

/**
 * Create test models for a typical e-commerce scenario
 */
export function createTestModels(sequelize: Sequelize): TestModels {
  const Category = sequelize.define('Category', {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Name: { type: DataTypes.STRING(50), allowNull: false },
    Description: { type: DataTypes.STRING(200) },
  }, { timestamps: false });

  const Product = sequelize.define('Product', {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Name: { type: DataTypes.STRING(100), allowNull: false },
    Description: { type: DataTypes.STRING(500) },
    Price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    Stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    CategoryID: { type: DataTypes.INTEGER },
    IsActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { timestamps: false });

  const Order = sequelize.define('Order', {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    CustomerName: { type: DataTypes.STRING(100), allowNull: false },
    OrderDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    TotalAmount: { type: DataTypes.DECIMAL(10, 2) },
    Status: { type: DataTypes.STRING(20), defaultValue: 'Pending' },
  }, { timestamps: false });

  const OrderItem = sequelize.define('OrderItem', {
    ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    OrderID: { type: DataTypes.INTEGER, allowNull: false },
    ProductID: { type: DataTypes.INTEGER, allowNull: false },
    Quantity: { type: DataTypes.INTEGER, allowNull: false },
    UnitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  }, { timestamps: false });

  // Associations
  Category.hasMany(Product, { foreignKey: 'CategoryID', as: 'Products' });
  Product.belongsTo(Category, { foreignKey: 'CategoryID', as: 'Category' });

  Order.hasMany(OrderItem, { foreignKey: 'OrderID', as: 'Items' });
  OrderItem.belongsTo(Order, { foreignKey: 'OrderID', as: 'Order' });

  Product.hasMany(OrderItem, { foreignKey: 'ProductID', as: 'OrderItems' });
  OrderItem.belongsTo(Product, { foreignKey: 'ProductID', as: 'Product' });

  return { Product, Category, Order, OrderItem };
}

/**
 * Create standard test schema
 */
export function createTestSchema(): ODataSchemaConfig {
  return {
    namespace: 'TestService',
    entities: {
      Product: {
        keys: ['ID'],
        properties: {
          ID: { type: 'Edm.Int32', nullable: false },
          Name: { type: 'Edm.String', maxLength: 100, nullable: false },
          Description: { type: 'Edm.String', maxLength: 500 },
          Price: { type: 'Edm.Decimal', precision: 10, scale: 2, nullable: false },
          Stock: { type: 'Edm.Int32' },
          CategoryID: { type: 'Edm.Int32' },
          IsActive: { type: 'Edm.Boolean' },
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
      Order: {
        keys: ['ID'],
        properties: {
          ID: { type: 'Edm.Int32', nullable: false },
          CustomerName: { type: 'Edm.String', maxLength: 100, nullable: false },
          OrderDate: { type: 'Edm.DateTime' },
          TotalAmount: { type: 'Edm.Decimal', precision: 10, scale: 2 },
          Status: { type: 'Edm.String', maxLength: 20 },
        },
        navigationProperties: {
          Items: {
            target: 'OrderItem',
            relationship: 'Order_Items',
            multiplicity: '*',
          },
        },
      },
      OrderItem: {
        keys: ['ID'],
        properties: {
          ID: { type: 'Edm.Int32', nullable: false },
          OrderID: { type: 'Edm.Int32', nullable: false },
          ProductID: { type: 'Edm.Int32', nullable: false },
          Quantity: { type: 'Edm.Int32', nullable: false },
          UnitPrice: { type: 'Edm.Decimal', precision: 10, scale: 2, nullable: false },
        },
        navigationProperties: {
          Order: {
            target: 'Order',
            relationship: 'Order_Items',
            multiplicity: '1',
          },
          Product: {
            target: 'Product',
            relationship: 'OrderItem_Product',
            multiplicity: '1',
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
      Order_Items: {
        ends: [
          { entity: 'Order', multiplicity: '1' },
          { entity: 'OrderItem', multiplicity: '*' },
        ],
        referentialConstraint: {
          principal: { entity: 'Order', property: 'ID' },
          dependent: { entity: 'OrderItem', property: 'OrderID' },
        },
      },
      OrderItem_Product: {
        ends: [
          { entity: 'OrderItem', multiplicity: '*' },
          { entity: 'Product', multiplicity: '1' },
        ],
        referentialConstraint: {
          principal: { entity: 'Product', property: 'ID' },
          dependent: { entity: 'OrderItem', property: 'ProductID' },
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
      },
      GetProductCount: {
        returnType: 'Edm.Int32',
        httpMethod: 'GET',
        parameters: {},
      },
    },
  };
}

/**
 * Create a configured Express app with OData middleware
 */
export function createTestApp(
  sequelize: Sequelize,
  models: TestModels,
  schema?: ODataSchemaConfig,
  options?: {
    hooks?: any;
    functionImports?: any;
    verboseErrors?: boolean;
    csrf?: { enabled?: boolean };
  }
): Express {
  const app = express();

  app.use('/odata', odataMiddleware({
    sequelize,
    schema: schema || createTestSchema(),
    models: {
      Product: models.Product,
      Category: models.Category,
      Order: models.Order,
      OrderItem: models.OrderItem,
    },
    verboseErrors: options?.verboseErrors ?? true,
    hooks: options?.hooks,
    functionImports: options?.functionImports,
    // Disable CSRF in tests by default for simplicity
    csrf: options?.csrf ?? { enabled: false },
  }));

  return app;
}

/**
 * Seed test data
 */
export async function seedTestData(models: TestModels): Promise<void> {
  const { Category, Product, Order, OrderItem } = models;

  // Create categories
  const electronics = await Category.create({ Name: 'Electronics', Description: 'Electronic devices' });
  const clothing = await Category.create({ Name: 'Clothing', Description: 'Apparel and accessories' });
  const books = await Category.create({ Name: 'Books', Description: 'Books and publications' });

  // Create products
  const laptop = await Product.create({
    Name: 'Laptop',
    Description: 'High-performance laptop',
    Price: 999.99,
    Stock: 50,
    CategoryID: (electronics as any).ID,
    IsActive: true,
  });

  const phone = await Product.create({
    Name: 'Smartphone',
    Description: 'Latest smartphone',
    Price: 699.99,
    Stock: 100,
    CategoryID: (electronics as any).ID,
    IsActive: true,
  });

  const headphones = await Product.create({
    Name: 'Headphones',
    Description: 'Wireless headphones',
    Price: 199.99,
    Stock: 75,
    CategoryID: (electronics as any).ID,
    IsActive: true,
  });

  const tshirt = await Product.create({
    Name: 'T-Shirt',
    Description: 'Cotton t-shirt',
    Price: 29.99,
    Stock: 200,
    CategoryID: (clothing as any).ID,
    IsActive: true,
  });

  const novel = await Product.create({
    Name: 'Novel',
    Description: 'Bestselling novel',
    Price: 14.99,
    Stock: 150,
    CategoryID: (books as any).ID,
    IsActive: false, // Discontinued
  });

  // Create orders
  const order1 = await Order.create({
    CustomerName: 'John Doe',
    TotalAmount: 1199.98,
    Status: 'Completed',
  });

  const order2 = await Order.create({
    CustomerName: 'Jane Smith',
    TotalAmount: 229.98,
    Status: 'Pending',
  });

  // Create order items
  await OrderItem.create({
    OrderID: (order1 as any).ID,
    ProductID: (laptop as any).ID,
    Quantity: 1,
    UnitPrice: 999.99,
  });

  await OrderItem.create({
    OrderID: (order1 as any).ID,
    ProductID: (headphones as any).ID,
    Quantity: 1,
    UnitPrice: 199.99,
  });

  await OrderItem.create({
    OrderID: (order2 as any).ID,
    ProductID: (tshirt as any).ID,
    Quantity: 2,
    UnitPrice: 29.99,
  });

  await OrderItem.create({
    OrderID: (order2 as any).ID,
    ProductID: (novel as any).ID,
    Quantity: 1,
    UnitPrice: 14.99,
  });
}

/**
 * Make HTTP request to test app
 */
export async function request(
  app: Express,
  method: string,
  path: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; headers: Record<string, string>; body: any; text: string }> {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;

      // Parse path and query string, encode query string properly
      const [pathPart, queryPart] = path.split('?');
      let encodedPath = pathPart || '';
      if (queryPart) {
        // Encode spaces and special characters in query string
        encodedPath += '?' + queryPart.replace(/ /g, '%20').replace(/'/g, '%27');
      }

      const reqOptions: any = {
        hostname: 'localhost',
        port,
        path: encodedPath,
        method: method.toUpperCase(),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      };

      const req = http.request(reqOptions, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          server.close();
          let body: any;
          try {
            body = JSON.parse(data);
          } catch {
            body = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            text: data,
          });
        });
      });

      req.on('error', (err: Error) => {
        server.close();
        reject(err);
      });

      if (options?.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  });
}
