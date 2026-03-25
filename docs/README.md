# OData V2 Server for Node.js

A complete OData V2 implementation for Express.js with Sequelize ORM.

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Project Setup](#project-setup)
5. [Defining Your Data Model](#defining-your-data-model)
6. [OData Schema Configuration](#odata-schema-configuration)
7. [Setting Up the Server](#setting-up-the-server)
8. [Query Operations](#query-operations)
9. [CRUD Operations](#crud-operations)
10. [Navigation Properties](#navigation-properties)
11. [Function Imports](#function-imports)
12. [Hooks and Custom Logic](#hooks-and-custom-logic)
13. [Batch Requests](#batch-requests)
14. [Error Handling](#error-handling)
15. [Best Practices](#best-practices)
16. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is OData?

OData (Open Data Protocol) is a standardized protocol for building and consuming RESTful APIs. Think of it as a universal language that allows different applications to communicate and share data.

**Why OData V2?**
- Required for SAP ecosystem integration
- Many enterprise systems still use V2
- Stable and well-documented specification
- Excellent tooling support

### What This Library Does

This library provides:
- A ready-to-use Express.js middleware
- Automatic CRUD operations for your database
- Query capabilities ($filter, $select, $expand, etc.)
- Metadata generation for client discovery
- Hooks for custom business logic

---

## Quick Start

Here's the simplest possible OData server:

```typescript
import express from 'express';
import { Sequelize, DataTypes } from 'sequelize';
import { odataMiddleware } from 'odata-v2-sequelize';

// 1. Create Express app
const app = express();

// 2. Setup database
const sequelize = new Sequelize('sqlite::memory:');

// 3. Define a model
const Product = sequelize.define('Product', {
  ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Name: { type: DataTypes.STRING },
  Price: { type: DataTypes.DECIMAL(10, 2) }
});

// 4. Define OData schema
const schema = {
  namespace: 'MyShop',
  entities: {
    Products: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String', maxLength: 100 },
        Price: { type: 'Edm.Decimal', precision: 10, scale: 2 }
      }
    }
  }
};

// 5. Mount OData middleware
app.use('/odata', odataMiddleware({
  sequelize,
  schema,
  models: { Products: Product }
}));

// 6. Start server
async function start() {
  await sequelize.sync();
  app.listen(3000, () => console.log('OData server running on http://localhost:3000/odata'));
}

start();
```

Now you can:
- View metadata: `GET http://localhost:3000/odata/$metadata`
- Get all products: `GET http://localhost:3000/odata/Products`
- Get one product: `GET http://localhost:3000/odata/Products(1)`
- Create product: `POST http://localhost:3000/odata/Products`
- Update product: `PUT http://localhost:3000/odata/Products(1)`
- Delete product: `DELETE http://localhost:3000/odata/Products(1)`

---

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Install the Package

```bash
npm install odata-v2-sequelize express sequelize
```

### Install a Database Driver

Choose one based on your database:

```bash
# SQLite (great for development)
npm install sqlite3

# PostgreSQL
npm install pg pg-hstore

# MySQL
npm install mysql2

# Microsoft SQL Server
npm install tedious
```

---

## Project Setup

### Recommended Project Structure

```
my-odata-server/
├── src/
│   ├── index.ts              # Application entry point
│   ├── database.ts           # Database configuration
│   ├── models/               # Sequelize models
│   │   ├── index.ts
│   │   ├── Product.ts
│   │   ├── Category.ts
│   │   └── Order.ts
│   ├── odata/
│   │   ├── schema.json       # OData schema configuration
│   │   └── handlers/         # Custom handlers (optional)
│   └── hooks/                # Business logic hooks (optional)
├── package.json
├── tsconfig.json
└── .env                      # Environment variables
```

### Setting Up TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### Environment Configuration

Create `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=secret

# Server
PORT=3000
NODE_ENV=development
```

---

## Defining Your Data Model

### Creating Sequelize Models

Models define your database tables. Here's how to create them:

#### Simple Model (`src/models/Product.ts`)

```typescript
import { DataTypes, Model, Sequelize } from 'sequelize';

export interface ProductAttributes {
  ID: number;
  Name: string;
  Description?: string;
  Price: number;
  Stock: number;
  CreatedAt?: Date;
  UpdatedAt?: Date;
}

export class Product extends Model<ProductAttributes> implements ProductAttributes {
  public ID!: number;
  public Name!: string;
  public Description?: string;
  public Price!: number;
  public Stock!: number;
  public CreatedAt?: Date;
  public UpdatedAt?: Date;
}

export function initProduct(sequelize: Sequelize): typeof Product {
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
      CreatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      UpdatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'products',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return Product;
}
```

#### Model with Relationships (`src/models/Category.ts`)

```typescript
import { DataTypes, Model, Sequelize } from 'sequelize';

export interface CategoryAttributes {
  ID: number;
  Name: string;
  ParentID?: number;
}

export class Category extends Model<CategoryAttributes> implements CategoryAttributes {
  public ID!: number;
  public Name!: string;
  public ParentID?: number;
}

export function initCategory(sequelize: Sequelize): typeof Category {
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
      ParentID: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'categories',
          key: 'ID',
        },
      },
    },
    {
      sequelize,
      tableName: 'categories',
      timestamps: false,
    }
  );

  return Category;
}
```

#### Model Index File (`src/models/index.ts`)

```typescript
import { Sequelize } from 'sequelize';
import { initProduct, Product } from './Product';
import { initCategory, Category } from './Category';

export interface Models {
  Product: typeof Product;
  Category: typeof Category;
}

export function initModels(sequelize: Sequelize): Models {
  // Initialize all models
  initProduct(sequelize);
  initCategory(sequelize);

  // Define relationships
  Product.belongsTo(Category, { foreignKey: 'CategoryID', as: 'Category' });
  Category.hasMany(Product, { foreignKey: 'CategoryID', as: 'Products' });

  // Self-referencing relationship for categories
  Category.belongsTo(Category, { foreignKey: 'ParentID', as: 'Parent' });
  Category.hasMany(Category, { foreignKey: 'ParentID', as: 'Children' });

  return { Product, Category };
}

export { Product, Category };
```

### Database Configuration (`src/database.ts`)

```typescript
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Create Sequelize instance based on environment
export function createDatabase(): Sequelize {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'development') {
    // SQLite for development (no setup required)
    return new Sequelize({
      dialect: 'sqlite',
      storage: './database.sqlite',
      logging: console.log, // See SQL queries
    });
  }

  // Production database
  return new Sequelize({
    dialect: 'postgres', // or 'mysql', 'mssql'
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}
```

---

## OData Schema Configuration

The OData schema defines how your data appears to OData clients.

### Schema Structure

Create `src/odata/schema.json`:

```json
{
  "namespace": "MyService",
  "containerName": "MyServiceContainer",

  "entities": {
    "Products": {
      "model": "Product",
      "keys": ["ID"],
      "properties": {
        "ID": { "type": "Edm.Int32", "nullable": false },
        "Name": { "type": "Edm.String", "maxLength": 100, "nullable": false },
        "Description": { "type": "Edm.String" },
        "Price": { "type": "Edm.Decimal", "precision": 10, "scale": 2, "nullable": false },
        "Stock": { "type": "Edm.Int32", "nullable": false },
        "CategoryID": { "type": "Edm.Int32" },
        "CreatedAt": { "type": "Edm.DateTime" },
        "UpdatedAt": { "type": "Edm.DateTime" }
      },
      "navigationProperties": {
        "Category": {
          "target": "Categories",
          "relationship": "Product_Category",
          "multiplicity": "0..1"
        }
      }
    },

    "Categories": {
      "model": "Category",
      "keys": ["ID"],
      "properties": {
        "ID": { "type": "Edm.Int32", "nullable": false },
        "Name": { "type": "Edm.String", "maxLength": 50, "nullable": false },
        "ParentID": { "type": "Edm.Int32" }
      },
      "navigationProperties": {
        "Products": {
          "target": "Products",
          "relationship": "Product_Category",
          "multiplicity": "*"
        },
        "Parent": {
          "target": "Categories",
          "relationship": "Category_Parent",
          "multiplicity": "0..1"
        },
        "Children": {
          "target": "Categories",
          "relationship": "Category_Parent",
          "multiplicity": "*"
        }
      }
    }
  },

  "associations": {
    "Product_Category": {
      "ends": [
        { "entity": "Products", "multiplicity": "*" },
        { "entity": "Categories", "multiplicity": "0..1" }
      ],
      "referentialConstraint": {
        "principal": { "entity": "Categories", "property": "ID" },
        "dependent": { "entity": "Products", "property": "CategoryID" }
      }
    },
    "Category_Parent": {
      "ends": [
        { "entity": "Categories", "multiplicity": "*" },
        { "entity": "Categories", "multiplicity": "0..1" }
      ],
      "referentialConstraint": {
        "principal": { "entity": "Categories", "property": "ID" },
        "dependent": { "entity": "Categories", "property": "ParentID" }
      }
    }
  },

  "functionImports": {
    "GetTopSellingProducts": {
      "returnType": "Collection(Products)",
      "httpMethod": "GET",
      "parameters": {
        "count": { "type": "Edm.Int32" }
      }
    }
  }
}
```

### EDM Types Reference

| EDM Type | JavaScript Type | Description |
|----------|-----------------|-------------|
| `Edm.String` | string | Text data |
| `Edm.Int16` | number | Small integer (-32,768 to 32,767) |
| `Edm.Int32` | number | Integer (-2.1B to 2.1B) |
| `Edm.Int64` | string | Large integer (as string for precision) |
| `Edm.Decimal` | number | Decimal number |
| `Edm.Double` | number | Double-precision float |
| `Edm.Single` | number | Single-precision float |
| `Edm.Boolean` | boolean | True/false |
| `Edm.DateTime` | Date | Date and time |
| `Edm.DateTimeOffset` | Date | Date/time with timezone |
| `Edm.Time` | string | Time of day |
| `Edm.Guid` | string | UUID |
| `Edm.Binary` | Buffer | Binary data |

### Multiplicity Values

| Value | Meaning |
|-------|---------|
| `1` | Exactly one (required) |
| `0..1` | Zero or one (optional) |
| `*` | Zero or more (collection) |

---

## Setting Up the Server

### Complete Server Setup (`src/index.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import { odataMiddleware } from 'odata-v2-sequelize';
import { createDatabase } from './database';
import { initModels } from './models';
import schema from './odata/schema.json';

async function main() {
  // Create Express application
  const app = express();

  // Enable CORS for browser access
  app.use(cors());

  // Parse JSON bodies (for non-OData endpoints)
  app.use(express.json());

  // Initialize database
  const sequelize = createDatabase();

  // Test database connection
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  }

  // Initialize models
  const models = initModels(sequelize);
  console.log('✓ Models initialized');

  // Sync database (creates tables if they don't exist)
  await sequelize.sync({ alter: true }); // Use { force: true } to drop and recreate
  console.log('✓ Database synchronized');

  // Mount OData middleware
  app.use('/odata', odataMiddleware({
    sequelize,
    schema,
    models: {
      Products: models.Product,
      Categories: models.Category,
    },
  }));
  console.log('✓ OData middleware mounted at /odata');

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log('');
    console.log('=================================');
    console.log(`OData Server running on port ${port}`);
    console.log('=================================');
    console.log('');
    console.log('Available endpoints:');
    console.log(`  Service Document: http://localhost:${port}/odata/`);
    console.log(`  Metadata:         http://localhost:${port}/odata/$metadata`);
    console.log(`  Products:         http://localhost:${port}/odata/Products`);
    console.log(`  Categories:       http://localhost:${port}/odata/Categories`);
    console.log('');
  });
}

// Handle errors
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

### Adding Seed Data

Create `src/seed.ts`:

```typescript
import { createDatabase } from './database';
import { initModels } from './models';

async function seed() {
  const sequelize = createDatabase();
  const models = initModels(sequelize);

  await sequelize.sync({ force: true }); // WARNING: Drops all data!

  // Create categories
  const electronics = await models.Category.create({ Name: 'Electronics' });
  const clothing = await models.Category.create({ Name: 'Clothing' });
  const phones = await models.Category.create({
    Name: 'Phones',
    ParentID: electronics.ID
  });

  // Create products
  await models.Product.bulkCreate([
    { Name: 'iPhone 15', Price: 999.99, Stock: 50, CategoryID: phones.ID },
    { Name: 'Samsung Galaxy', Price: 899.99, Stock: 30, CategoryID: phones.ID },
    { Name: 'MacBook Pro', Price: 1999.99, Stock: 20, CategoryID: electronics.ID },
    { Name: 'T-Shirt', Price: 29.99, Stock: 100, CategoryID: clothing.ID },
    { Name: 'Jeans', Price: 79.99, Stock: 75, CategoryID: clothing.ID },
  ]);

  console.log('✓ Seed data created');
  await sequelize.close();
}

seed().catch(console.error);
```

Run with: `npx ts-node src/seed.ts`

---

## Query Operations

OData provides powerful query capabilities through URL parameters.

### Getting All Entities

```
GET /odata/Products
```

Response:
```json
{
  "d": {
    "results": [
      {
        "__metadata": {
          "uri": "/odata/Products(1)",
          "type": "MyService.Products"
        },
        "ID": 1,
        "Name": "iPhone 15",
        "Price": "999.99",
        "Stock": 50
      },
      ...
    ]
  }
}
```

### Getting a Single Entity

```
GET /odata/Products(1)
```

Response:
```json
{
  "d": {
    "__metadata": {
      "uri": "/odata/Products(1)",
      "type": "MyService.Products"
    },
    "ID": 1,
    "Name": "iPhone 15",
    "Price": "999.99",
    "Stock": 50
  }
}
```

### Filtering ($filter)

Filter results using expressions:

```
# Equal
GET /odata/Products?$filter=Name eq 'iPhone 15'

# Not equal
GET /odata/Products?$filter=Price ne 0

# Greater than
GET /odata/Products?$filter=Price gt 100

# Less than or equal
GET /odata/Products?$filter=Stock le 50

# Combining with AND
GET /odata/Products?$filter=Price gt 100 and Stock gt 0

# Combining with OR
GET /odata/Products?$filter=CategoryID eq 1 or CategoryID eq 2

# Using NOT
GET /odata/Products?$filter=not (Price gt 1000)

# String functions
GET /odata/Products?$filter=startswith(Name, 'iPhone')
GET /odata/Products?$filter=endswith(Name, 'Pro')
GET /odata/Products?$filter=substringof('Phone', Name)
GET /odata/Products?$filter=tolower(Name) eq 'iphone 15'

# Date functions
GET /odata/Products?$filter=year(CreatedAt) eq 2024
GET /odata/Products?$filter=month(CreatedAt) eq 6

# Math functions
GET /odata/Products?$filter=round(Price) eq 1000
```

**Filter Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `Price eq 100` |
| `ne` | Not equal | `Status ne 'Deleted'` |
| `gt` | Greater than | `Price gt 50` |
| `ge` | Greater or equal | `Stock ge 10` |
| `lt` | Less than | `Price lt 1000` |
| `le` | Less or equal | `Stock le 100` |
| `and` | Logical and | `Price gt 10 and Price lt 100` |
| `or` | Logical or | `Status eq 'A' or Status eq 'B'` |
| `not` | Logical not | `not endswith(Name, 'test')` |

**Arithmetic Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `add` | Addition | `Price add 10 gt 100` |
| `sub` | Subtraction | `Price sub Tax gt 50` |
| `mul` | Multiplication | `Quantity mul UnitPrice gt 1000` |
| `div` | Division | `Total div Count eq 10` |
| `mod` | Modulo (remainder) | `ID mod 2 eq 0` |

Complex arithmetic expressions:
```
# Combined arithmetic
GET /odata/Products?$filter=Price mul 2 add 10 gt 100

# Arithmetic on both sides
GET /odata/Products?$filter=Price add Tax gt Cost mul 1.2

# With parentheses
GET /odata/Products?$filter=(Price add 10) mul Quantity gt 500
```

### Selecting Properties ($select)

Return only specific properties:

```
GET /odata/Products?$select=ID,Name,Price
```

Response:
```json
{
  "d": {
    "results": [
      {
        "__metadata": { "uri": "/odata/Products(1)", "type": "MyService.Products" },
        "ID": 1,
        "Name": "iPhone 15",
        "Price": "999.99"
      }
    ]
  }
}
```

### Sorting ($orderby)

```
# Ascending (default)
GET /odata/Products?$orderby=Name

# Descending
GET /odata/Products?$orderby=Price desc

# Multiple columns
GET /odata/Products?$orderby=CategoryID asc,Price desc
```

### Pagination ($top, $skip)

```
# First 10 products
GET /odata/Products?$top=10

# Skip first 20, get next 10 (page 3)
GET /odata/Products?$skip=20&$top=10

# With count of total records
GET /odata/Products?$top=10&$inlinecount=allpages
```

Response with count:
```json
{
  "d": {
    "__count": "47",
    "results": [...]
  }
}
```

### Expanding Related Entities ($expand)

```
# Get products with their category
GET /odata/Products?$expand=Category

# Multiple expansions
GET /odata/Products?$expand=Category,Supplier

# Nested expansion
GET /odata/Categories?$expand=Products,Parent
```

Response:
```json
{
  "d": {
    "results": [
      {
        "__metadata": { "uri": "/odata/Products(1)", "type": "MyService.Products" },
        "ID": 1,
        "Name": "iPhone 15",
        "Price": "999.99",
        "Category": {
          "__metadata": { "uri": "/odata/Categories(3)", "type": "MyService.Categories" },
          "ID": 3,
          "Name": "Phones"
        }
      }
    ]
  }
}
```

### Combined Query Example

```
GET /odata/Products?$filter=Price gt 100 and Stock gt 0&$select=ID,Name,Price,Category&$expand=Category&$orderby=Price desc&$top=10&$skip=0&$inlinecount=allpages
```

This query:
1. Filters products with Price > 100 AND Stock > 0
2. Returns only ID, Name, Price, and Category
3. Includes the Category details
4. Sorts by Price descending
5. Returns first 10 results
6. Includes total count

---

## CRUD Operations

### Create (POST)

```http
POST /odata/Products
Content-Type: application/json

{
  "Name": "New Product",
  "Price": 49.99,
  "Stock": 100,
  "CategoryID": 1
}
```

Response (201 Created):
```json
{
  "d": {
    "__metadata": {
      "uri": "/odata/Products(6)",
      "type": "MyService.Products"
    },
    "ID": 6,
    "Name": "New Product",
    "Price": "49.99",
    "Stock": 100,
    "CategoryID": 1
  }
}
```

### Deep Create (Create with Related Entities)

```http
POST /odata/Categories
Content-Type: application/json

{
  "Name": "New Category",
  "Products": [
    { "Name": "Product A", "Price": 10.00, "Stock": 50 },
    { "Name": "Product B", "Price": 20.00, "Stock": 30 }
  ]
}
```

### Read (GET)

```http
GET /odata/Products(1)
```

### Update (PUT) - Full Replace

Replaces the entire entity:

```http
PUT /odata/Products(1)
Content-Type: application/json

{
  "Name": "Updated iPhone",
  "Price": 1099.99,
  "Stock": 45,
  "CategoryID": 3
}
```

### Partial Update (MERGE/PATCH)

Updates only specified fields:

```http
MERGE /odata/Products(1)
Content-Type: application/json

{
  "Price": 899.99
}
```

Or using PATCH:

```http
PATCH /odata/Products(1)
Content-Type: application/json

{
  "Price": 899.99,
  "Stock": 60
}
```

### Delete (DELETE)

```http
DELETE /odata/Products(1)
```

Response: 204 No Content

### Optimistic Concurrency (ETags)

The server returns ETags for concurrency control:

```http
GET /odata/Products(1)
```

Response headers include:
```
ETag: W/"abc123"
```

To update with concurrency check:

```http
PUT /odata/Products(1)
If-Match: W/"abc123"
Content-Type: application/json

{
  "Name": "Updated Product",
  ...
}
```

If the entity was modified by someone else, you'll get 412 Precondition Failed.

---

## Navigation Properties

### Accessing Related Entities

```
# Get a product's category
GET /odata/Products(1)/Category

# Get a category's products
GET /odata/Categories(1)/Products

# Get category's parent category
GET /odata/Categories(3)/Parent
```

### Creating Related Entities

```http
POST /odata/Categories(1)/Products
Content-Type: application/json

{
  "Name": "New Product in Category",
  "Price": 29.99,
  "Stock": 50
}
```

### Managing Links

Create a link between existing entities:

```http
POST /odata/Products(1)/$links/Category
Content-Type: application/json

{
  "uri": "/odata/Categories(2)"
}
```

Remove a link:

```http
DELETE /odata/Products(1)/$links/Category
```

---

## Function Imports

Function imports allow custom operations beyond CRUD.

### Defining Function Imports

In your schema:

```json
{
  "functionImports": {
    "GetTopSellingProducts": {
      "returnType": "Collection(Products)",
      "httpMethod": "GET",
      "parameters": {
        "count": { "type": "Edm.Int32" },
        "categoryId": { "type": "Edm.Int32", "nullable": true }
      }
    },
    "ApplyDiscount": {
      "returnType": "Products",
      "httpMethod": "POST",
      "parameters": {
        "productId": { "type": "Edm.Int32" },
        "percentage": { "type": "Edm.Decimal" }
      }
    }
  }
}
```

### Implementing Function Imports

```typescript
app.use('/odata', odataMiddleware({
  sequelize,
  schema,
  models,
  functionImports: {
    // GET function
    GetTopSellingProducts: async (ctx, params) => {
      const count = params.count as number || 10;
      const categoryId = params.categoryId as number | undefined;

      const where: any = {};
      if (categoryId) {
        where.CategoryID = categoryId;
      }

      return await ctx.models.Products.findAll({
        where,
        order: [['SalesCount', 'DESC']],
        limit: count,
      });
    },

    // POST function (action)
    ApplyDiscount: async (ctx, params) => {
      const productId = params.productId as number;
      const percentage = params.percentage as number;

      const product = await ctx.models.Products.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const newPrice = product.Price * (1 - percentage / 100);
      await product.update({ Price: newPrice });

      return product;
    },
  },
}));
```

### Calling Function Imports

```
# GET function with parameters in URL
GET /odata/GetTopSellingProducts?count=5&categoryId=1

# Or with parameters in path
GET /odata/GetTopSellingProducts(count=5,categoryId=1)

# POST function
POST /odata/ApplyDiscount?productId=1&percentage=10
```

---

## Hooks and Custom Logic

Hooks let you add business logic before or after operations.

### Available Hooks

| Hook | When Called | Use Case |
|------|-------------|----------|
| `beforeRead` | Before query execution | Add filters, check permissions |
| `afterRead` | After query, before response | Transform data, add computed fields |
| `beforeCreate` | Before insert | Validate, set defaults, audit |
| `afterCreate` | After insert | Send notifications, logging |
| `beforeUpdate` | Before update | Validate changes, audit |
| `afterUpdate` | After update | Sync external systems |
| `beforeDelete` | Before delete | Check dependencies, soft delete |
| `afterDelete` | After delete | Cleanup, notifications |

### Using Hooks

```typescript
app.use('/odata', odataMiddleware({
  sequelize,
  schema,
  models,
  hooks: {
    Products: {
      // Add tenant filtering to all reads
      beforeRead: async (ctx) => {
        const tenantId = ctx.user?.tenantId;
        if (tenantId) {
          ctx.query.where = ctx.query.where || {};
          ctx.query.where.TenantID = tenantId;
        }
      },

      // Add computed fields to results
      afterRead: async (ctx, results) => {
        return results.map((product: any) => ({
          ...product,
          PriceFormatted: `$${product.Price.toFixed(2)}`,
          InStock: product.Stock > 0,
        }));
      },

      // Set audit fields on create
      beforeCreate: async (ctx, data: any) => {
        return {
          ...data,
          CreatedBy: ctx.user?.id,
          CreatedAt: new Date(),
        };
      },

      // Log creation
      afterCreate: async (ctx, result: any) => {
        console.log(`Product created: ${result.ID} by user ${ctx.user?.id}`);
        return result;
      },

      // Validate before update
      beforeUpdate: async (ctx, data: any) => {
        if (data.Price < 0) {
          throw new Error('Price cannot be negative');
        }
        return {
          ...data,
          UpdatedBy: ctx.user?.id,
          UpdatedAt: new Date(),
        };
      },

      // Prevent deletion of products with orders
      beforeDelete: async (ctx) => {
        const orders = await ctx.models.OrderItems.count({
          where: { ProductID: ctx.keys?.ID },
        });
        if (orders > 0) {
          throw new Error('Cannot delete product with existing orders');
        }
      },
    },

    Categories: {
      // Prevent deletion of categories with products
      beforeDelete: async (ctx) => {
        const products = await ctx.models.Products.count({
          where: { CategoryID: ctx.keys?.ID },
        });
        if (products > 0) {
          throw new Error('Cannot delete category with products');
        }
      },
    },
  },
}));
```

### Hook Context

The `ctx` object contains:

```typescript
interface HookContext {
  req: Express.Request;       // Original request
  res: Express.Response;      // Response object
  query: ParsedQuery;         // Parsed OData query options
  entityName: string;         // Entity being accessed
  models: Record<string, Model>; // All Sequelize models
  user?: any;                 // User from auth middleware
  keys?: Record<string, any>; // Entity keys (for single-entity ops)
  data: Record<string, any>;  // Custom data store between hooks
}
```

### Custom Handler Classes

For complex logic, use handler classes:

```typescript
import { BaseHandler, HookContext, ODataError } from 'odata-v2-sequelize';

class ProductHandler extends BaseHandler {
  async handleRead(ctx: HookContext) {
    // Completely custom read logic
    const products = await this.model.findAll({
      where: {
        ...ctx.query.where,
        Status: 'Active', // Always filter active only
      },
      include: this.getIncludes(ctx),
    });

    // Apply business rules
    return {
      results: products.map(p => this.applyBusinessRules(p)),
      count: products.length,
    };
  }

  async handleCreate(ctx: HookContext, data: any) {
    // Custom validation
    await this.validateProduct(data);

    // Custom creation logic
    const product = await this.model.create({
      ...data,
      Status: 'Active',
      SKU: await this.generateSKU(),
    });

    // Trigger external processes
    await this.notifyInventorySystem(product);

    return product;
  }

  private async validateProduct(data: any) {
    if (!data.Name || data.Name.length < 3) {
      throw new ODataError(400, 'Product name must be at least 3 characters');
    }
    if (data.Price <= 0) {
      throw new ODataError(400, 'Price must be positive');
    }
  }

  private async generateSKU(): Promise<string> {
    const count = await this.model.count();
    return `PRD-${String(count + 1).padStart(6, '0')}`;
  }

  private applyBusinessRules(product: any) {
    return {
      ...product.get({ plain: true }),
      DisplayPrice: `$${product.Price.toFixed(2)}`,
      Availability: product.Stock > 10 ? 'In Stock' :
                    product.Stock > 0 ? 'Low Stock' : 'Out of Stock',
    };
  }

  private async notifyInventorySystem(product: any) {
    // Integration with external system
    console.log('Notifying inventory system about new product:', product.ID);
  }
}

// Use the custom handler
app.use('/odata', odataMiddleware({
  sequelize,
  schema,
  models,
  handlers: {
    Products: ProductHandler,
  },
}));
```

---

## Batch Requests

Batch requests allow multiple operations in a single HTTP request.

### Batch Request Format

```http
POST /odata/$batch
Content-Type: multipart/mixed; boundary=batch_1234

--batch_1234
Content-Type: application/http
Content-Transfer-Encoding: binary

GET /odata/Products(1) HTTP/1.1
Accept: application/json

--batch_1234
Content-Type: multipart/mixed; boundary=changeset_5678

--changeset_5678
Content-Type: application/http
Content-Transfer-Encoding: binary
Content-ID: 1

POST /odata/Products HTTP/1.1
Content-Type: application/json

{"Name":"Product A","Price":10.00,"Stock":50}

--changeset_5678
Content-Type: application/http
Content-Transfer-Encoding: binary
Content-ID: 2

POST /odata/Products HTTP/1.1
Content-Type: application/json

{"Name":"Product B","Price":20.00,"Stock":30}

--changeset_5678--
--batch_1234--
```

### Understanding Batch Structure

1. **Batch** - Container for multiple requests
2. **Changeset** - Group of write operations executed as a transaction
3. **Individual requests** - GET operations outside changesets

### Changeset Transactions

All operations in a changeset succeed or fail together:

```
If any operation in a changeset fails:
  → All operations in that changeset are rolled back
  → Other changesets and GETs still execute
```

### Referencing Created Entities

Use Content-ID to reference entities created earlier in the batch:

```http
--changeset_5678
Content-ID: 1

POST /odata/Categories HTTP/1.1
Content-Type: application/json

{"Name":"New Category"}

--changeset_5678
Content-ID: 2

POST /odata/Products HTTP/1.1
Content-Type: application/json

{"Name":"Product in New Category","Price":50.00,"CategoryID":"$1"}
```

---

## Error Handling

### OData Error Format

Errors are returned in OData format:

```json
{
  "error": {
    "code": "404",
    "message": {
      "lang": "en",
      "value": "Product not found"
    }
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid query, malformed request |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Entity doesn't exist |
| 405 | Method Not Allowed | Wrong HTTP method |
| 409 | Conflict | Duplicate key, constraint violation |
| 412 | Precondition Failed | ETag mismatch |
| 500 | Internal Error | Server error |

### Throwing Errors in Hooks

```typescript
import { ODataError } from 'odata-v2-sequelize';

hooks: {
  Products: {
    beforeCreate: async (ctx, data) => {
      if (data.Price < 0) {
        throw new ODataError(400, 'Price cannot be negative');
      }

      const exists = await ctx.models.Products.findOne({
        where: { Name: data.Name }
      });
      if (exists) {
        throw new ODataError(409, 'Product with this name already exists');
      }

      return data;
    }
  }
}
```

### Verbose Errors (Development)

Enable detailed errors in development:

```typescript
app.use('/odata', odataMiddleware({
  ...options,
  verboseErrors: process.env.NODE_ENV === 'development',
}));
```

Verbose error response:

```json
{
  "error": {
    "code": "500",
    "message": {
      "lang": "en",
      "value": "Database connection failed"
    },
    "innererror": {
      "message": "ECONNREFUSED 127.0.0.1:5432",
      "type": "SequelizeConnectionError",
      "stacktrace": "Error: ...\n    at ..."
    }
  }
}
```

---

## Best Practices

### 1. Database Design

```typescript
// Always use explicit primary keys
ID: {
  type: DataTypes.INTEGER,
  primaryKey: true,
  autoIncrement: true,
}

// Add timestamps for auditing
CreatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
UpdatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

// Use appropriate indexes
{
  indexes: [
    { fields: ['Name'] },
    { fields: ['CategoryID'] },
    { fields: ['CreatedAt'] },
  ]
}
```

### 2. Security

```typescript
// Add authentication middleware
import passport from 'passport';

app.use('/odata',
  passport.authenticate('jwt', { session: false }),
  odataMiddleware({...})
);

// Filter by tenant in hooks
hooks: {
  Products: {
    beforeRead: async (ctx) => {
      ctx.query.where = ctx.query.where || {};
      ctx.query.where.TenantID = ctx.user.tenantId;
    }
  }
}
```

#### CSRF Protection

CSRF protection is enabled by default. Clients must:

1. Fetch token: `GET /odata/Products` with header `X-CSRF-Token: Fetch`
2. Use token: Include returned token in `X-CSRF-Token` header for POST/PUT/MERGE/DELETE

```typescript
// Disable for development
app.use('/odata', odataMiddleware({
  ...options,
  csrf: { enabled: false }
}));

// Configure CSRF
app.use('/odata', odataMiddleware({
  ...options,
  csrf: {
    enabled: true,
    headerName: 'X-CSRF-Token',
    allowTokenReuse: false,  // Single-use tokens (more secure)
    skipPaths: ['/health']
  }
}));
```

### 3. Performance

```typescript
// Limit page size
const schema = {
  // ... schema config
};

// Use indexes for filtered columns
// Add appropriate $select to limit data transfer
// Use $expand judiciously - avoid deep nesting

// Example: Limit expand depth in hooks
beforeRead: async (ctx) => {
  if (ctx.query.$expand && ctx.query.$expand.length > 3) {
    throw new ODataError(400, 'Maximum 3 expand levels allowed');
  }
}
```

### 4. Validation

```typescript
// Validate in beforeCreate/beforeUpdate hooks
beforeCreate: async (ctx, data) => {
  // Required fields
  if (!data.Name?.trim()) {
    throw new ODataError(400, 'Name is required');
  }

  // Field length
  if (data.Name.length > 100) {
    throw new ODataError(400, 'Name must be 100 characters or less');
  }

  // Business rules
  if (data.Price < data.Cost) {
    throw new ODataError(400, 'Price cannot be less than cost');
  }

  return data;
}
```

### 5. Logging

```typescript
// Log all operations
hooks: {
  Products: {
    afterCreate: async (ctx, result) => {
      console.log(`[CREATE] Products(${result.ID}) by ${ctx.user?.id}`);
      return result;
    },
    afterUpdate: async (ctx, result) => {
      console.log(`[UPDATE] Products(${ctx.keys?.ID}) by ${ctx.user?.id}`);
      return result;
    },
    afterDelete: async (ctx) => {
      console.log(`[DELETE] Products(${ctx.keys?.ID}) by ${ctx.user?.id}`);
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot find module" Error

```
Error: Cannot find module 'odata-v2-sequelize'
```

**Solution:** Make sure you installed the package:
```bash
npm install odata-v2-sequelize
```

#### 2. "Model not found" Error

```
Error: No model found for entity Products
```

**Solution:** Ensure model names in schema match the models object:
```typescript
// Schema
entities: {
  Products: {  // Entity name
    model: 'Product',  // Must match key in models object
    ...
  }
}

// Models object
models: {
  Product: ProductModel,  // Key must match schema's "model" value
}
```

#### 3. "Invalid $filter" Error

```
Error: Invalid $filter: Unexpected token at position 15
```

**Solution:** Check filter syntax:
```
# Wrong
?$filter=Name = 'Test'  (spaces around =)
?$filter=Name=='Test'   (double equals)

# Correct
?$filter=Name eq 'Test'
```

#### 4. Foreign Key Constraint Error

```
Error: FOREIGN KEY constraint failed
```

**Solution:** Ensure related entities exist before creating:
```typescript
// First create category
const category = await Category.create({ Name: 'Electronics' });

// Then create product with valid CategoryID
const product = await Product.create({
  Name: 'Phone',
  CategoryID: category.ID  // Must exist
});
```

#### 5. "Entity is read-only" Error

```
Error: Products is read-only
```

**Solution:** Remove `readOnly: true` from schema or use a different entity.

### Debugging Tips

#### Enable SQL Logging

```typescript
const sequelize = new Sequelize({
  ...config,
  logging: console.log,  // See all SQL queries
});
```

#### Log OData Requests

```typescript
app.use('/odata', (req, res, next) => {
  console.log(`[OData] ${req.method} ${req.url}`);
  next();
}, odataMiddleware({...}));
```

#### Test with curl

```bash
# Get metadata
curl http://localhost:3000/odata/\$metadata

# Get products
curl http://localhost:3000/odata/Products

# Create product
curl -X POST http://localhost:3000/odata/Products \
  -H "Content-Type: application/json" \
  -d '{"Name":"Test","Price":10,"Stock":5}'

# Filter products
curl "http://localhost:3000/odata/Products?\$filter=Price%20gt%2050"
```

---

## Next Steps

1. **Explore the API** - Use tools like Postman or SAP Gateway Client
2. **Add Authentication** - Integrate with your auth system
3. **Customize Behavior** - Add hooks for your business logic
4. **Monitor Performance** - Add logging and metrics
5. **Deploy** - Set up production database and hosting

## Resources

- [OData V2 Specification](https://www.odata.org/documentation/odata-version-2-0/)
- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)

---

*Happy coding! If you have questions, check the issues on GitHub or consult the OData specification.*
