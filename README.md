# odata-v2-sequelize

A production-ready OData V2 middleware for Express.js with Sequelize ORM integration.

## Features

- **Full OData V2 compliance**: `$filter`, `$select`, `$expand`, `$orderby`, `$top`, `$skip`, `$count`, `$batch`
- **Sequelize integration**: Automatic query translation — filters become WHERE clauses, expands become JOINs
- **Navigation property filters**: Filter through associations (e.g. `$filter=batch/year eq 2022`) with automatic column name resolution
- **Association auto-include**: Referenced associations are automatically JOINed even without explicit `$expand`
- **JSON schema configuration**: Simple JSON-based entity/association definitions — no EDMX files needed
- **Function imports**: Custom server-side operations with typed parameters
- **Hooks system**: Intercept and modify operations at any stage (beforeRead, beforeCreate, etc.)
- **ETag support**: Automatic ETag generation, `If-Match` validation for optimistic concurrency
- **Security**: CSRF protection, SQL injection prevention, property path validation
- **Production utilities**: Health checks, graceful shutdown, request timeouts, circuit breaker, metrics, connection pool monitoring

## Installation

```bash
# From GitHub (recommended for simpose projects)
npm install github:Sebastian-Ried/simpose-odata-v2-server#v1.0.0
```

Requires `express` and `sequelize` as peer dependencies in your project.

## Quick Start

```typescript
import express from 'express';
import { Sequelize, DataTypes } from 'sequelize';
import { odataMiddleware } from 'odata-v2-sequelize';

const app = express();
const sequelize = new Sequelize('sqlite::memory:');

// Define models
const Product = sequelize.define('Product', {
  ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Name: { type: DataTypes.STRING(100), allowNull: false },
  Price: { type: DataTypes.DECIMAL(10, 2) },
  CategoryID: DataTypes.INTEGER
});

const Category = sequelize.define('Category', {
  ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Name: { type: DataTypes.STRING(50), allowNull: false }
});

Category.hasMany(Product, { foreignKey: 'CategoryID' });
Product.belongsTo(Category, { foreignKey: 'CategoryID' });

// Define OData schema
const schema = {
  namespace: 'MyService',
  entities: {
    Products: {
      model: 'Product',
      keys: ['ID'],
      properties: {
        ID:         { type: 'Edm.Int32', nullable: false },
        Name:       { type: 'Edm.String', maxLength: 100 },
        Price:      { type: 'Edm.Decimal', precision: 10, scale: 2 },
        CategoryID: { type: 'Edm.Int32' }
      },
      navigationProperties: {
        Category: { target: 'Categories', relationship: 'Product_Category', multiplicity: '0..1' }
      }
    },
    Categories: {
      model: 'Category',
      keys: ['ID'],
      properties: {
        ID:   { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String', maxLength: 50 }
      },
      navigationProperties: {
        Products: { target: 'Products', relationship: 'Product_Category', multiplicity: '*' }
      }
    }
  },
  associations: {
    Product_Category: {
      ends: [
        { entity: 'Products', multiplicity: '*' },
        { entity: 'Categories', multiplicity: '1' }
      ],
      referentialConstraint: {
        principal: { entity: 'Categories', property: 'ID' },
        dependent: { entity: 'Products', property: 'CategoryID' }
      }
    }
  }
};

// Mount middleware
app.use('/odata', odataMiddleware({ schema, sequelize }));

sequelize.sync().then(() => {
  app.listen(3000, () => console.log('OData service at http://localhost:3000/odata'));
});
```

## Usage

### Query Examples

```
GET /odata/Products                                    # All products
GET /odata/Products?$top=10&$skip=20                   # Pagination
GET /odata/Products?$filter=Price gt 100               # Filter
GET /odata/Products?$filter=Category/Name eq 'Electronics'  # Navigation filter
GET /odata/Products?$select=ID,Name                    # Select fields
GET /odata/Products?$expand=Category                   # Include related
GET /odata/Products?$orderby=Price desc                # Sort
GET /odata/Products?$inlinecount=allpages              # Include total count
GET /odata/Products('123')                             # Single entity by key
GET /odata/$metadata                                   # EDMX metadata document
```

### Hooks

```javascript
const hooks = {
  Products: {
    beforeRead: async (ctx) => {
      // Add tenant filtering
      addQueryFilter(ctx, { tenantId: ctx.req.user.tenantId });
    },
    beforeCreate: async (ctx, data) => {
      data.createdBy = ctx.req.user.id;
      return data;
    },
    afterRead: async (ctx, result) => {
      // Transform results
      return result;
    }
  }
};

app.use('/odata', odataMiddleware({ schema, sequelize, hooks }));
```

### Function Imports

```javascript
const schema = {
  // ... entities ...
  functionImports: {
    CalculateTotal: {
      httpMethod: 'POST',
      parameters: {
        orderId: { type: 'Edm.String', nullable: false }
      }
    }
  }
};

const customHandlers = {
  async CalculateTotal(ctx, params) {
    const order = await db.Order.findByPk(params.orderId);
    return { total: order.calculateTotal() };
  }
};

app.use('/odata', odataMiddleware({ schema, sequelize, customHandlers }));
```

### Associations

Define associations in the schema so the middleware can handle navigation property filters and `$expand`:

```javascript
associations: {
  Order_Customer: {
    ends: [
      { entity: 'Orders', multiplicity: '*' },
      { entity: 'Customers', multiplicity: '1' }
    ],
    referentialConstraint: {
      principal: { entity: 'Customers', property: 'id' },
      dependent: { entity: 'Orders', property: 'customerId' }
    }
  }
}
```

This enables filtering like `$filter=customer/name eq 'Acme'` — the middleware automatically resolves the association JOIN and maps camelCase property names to the actual database column names.

## Column Name Resolution

When Sequelize models use camelCase attributes with explicit `field` mappings (e.g. `fruitTypeId` → `fruit_type_id`), the middleware automatically resolves the correct database column name for navigation property filters. This is handled by `resolveColumnPath()` in the filter translator, which looks up `rawAttributes` on the target Sequelize model.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed guide to the codebase structure.

## API Documentation

See [docs/README.md](docs/README.md) for complete API documentation including all query operations, CRUD operations, batch requests, and hooks.

See [docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) for a cheat sheet of OData query options and filter syntax.

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → dist/
npm test             # Run all tests (549 tests)
npm run test:watch   # Interactive test runner
npm run test:coverage # Coverage report
npm run dev          # Watch mode compilation
```

## Project Structure

```
src/
├── index.ts              # Public API exports
├── middleware.ts          # Express middleware factory
├── ODataService.ts        # Core service orchestrator
├── config/               # Schema types, defaults, validation
├── parser/               # URI, filter, query option, batch parsers
├── query/                # Sequelize query building
│   ├── query-builder.ts  # Main query builder
│   ├── filter-translator.ts # OData filter → Sequelize WHERE
│   ├── expand-handler.ts # $expand → Sequelize includes
│   ├── select-handler.ts # $select → attributes
│   └── orderby-handler.ts # $orderby → order clause
├── handlers/             # CRUD + batch + function import handlers
├── metadata/             # EDMX metadata generation
├── serializers/          # OData JSON response formatting
├── hooks/                # Lifecycle hook system
└── utils/                # Security, caching, health, metrics, etc.
```

## Used By

- [simpose-liquid-warehouse](https://github.com/Sebastian-Ried/simpose-liquid-warehouse) — Warehouse management for distilled spirits
- [simpose-orchard-ledger](https://github.com/Sebastian-Ried/simpose-orchard-ledger) — Orchard management for scattered fruit trees

## License

MIT
