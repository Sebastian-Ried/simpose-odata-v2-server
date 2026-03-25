# CLAUDE.md — odata-v2-sequelize

## What This Is

Production-ready OData V2 middleware for Express.js + Sequelize. Translates OData HTTP requests into Sequelize database queries automatically.

Repository: `simpose-odata-v2-server` (public)
Package name: `odata-v2-sequelize`
Consumed by: `simpose-liquid-warehouse`, `simpose-orchard-ledger`

## How Consumers Use It

```javascript
// ESM projects use createRequire since this is a CJS package
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { odataMiddleware } = require('odata-v2-sequelize');

// Mount on Express
app.use("/service/api", odataMiddleware({ schema, sequelize, hooks, customHandlers }));
```

Installed via git URL: `"odata-v2-sequelize": "github:Sebastian-Ried/simpose-odata-v2-server#v1.0.0"`

## Key Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Express middleware factory — entry point |
| `src/ODataService.ts` | Core orchestrator — routes requests to handlers |
| `src/query/filter-translator.ts` | `$filter` → Sequelize WHERE clause (with `resolveColumnPath` for nav property column name resolution) |
| `src/query/query-builder.ts` | Builds complete Sequelize `FindOptions` from parsed OData query (auto-includes associations) |
| `src/query/expand-handler.ts` | `$expand` → Sequelize `include` |
| `src/query/select-handler.ts` | `$select` → Sequelize `attributes` (auto-includes timestamp fields for ETag) |
| `src/handlers/crud/read.ts` | GET handler — sets ETag response header |
| `src/handlers/crud/update.ts` | PUT/MERGE handler — validates `If-Match` ETag |
| `src/handlers/crud/delete.ts` | DELETE handler — validates `If-Match` ETag |
| `src/handlers/function-import.ts` | Custom server-side operations |
| `src/serializers/json-serializer.ts` | OData JSON response formatting (ETag only for complete entities, not `$select`) |
| `src/hooks/context.ts` | `addQueryFilter()`, `getModel()`, `getUser()` — hook context utilities |

## OData Schema Structure

Consumer projects define their OData schema as a JS object:

```javascript
const schema = {
  namespace: 'ServiceName',
  entities: {
    EntitySetName: {
      model: 'SequelizeModelName',    // maps to sequelize.models[model]
      keys: ['id'],                    // OData entity key(s)
      properties: { ... },             // Edm types
      navigationProperties: { ... }    // relationships
    }
  },
  associations: {
    RelationshipName: {
      ends: [{ entity: '...', multiplicity: '...' }, ...],
      referentialConstraint: { principal: {...}, dependent: {...} }
    }
  },
  functionImports: { ... }
};
```

**Important**: `associations` with `referentialConstraint` are required for navigation property filters (e.g. `$filter=batch/year eq 2022`) to work correctly.

## Hooks Pattern

Consumer projects define hooks per entity set:

```javascript
const hooks = {
  EntitySetName: {
    beforeRead: async (ctx) => { addQueryFilter(ctx, { clientId: '...' }); },
    beforeCreate: async (ctx, data) => { /* validate/modify */ return data; },
    beforeUpdate: async (ctx, data) => { /* validate/modify */ return data; },
    beforeDelete: async (ctx) => { /* authorize */ },
  }
};
```

The `addQueryFilter(ctx, where)` function from the library adds Sequelize WHERE conditions.

## Navigation Property Filtering

The middleware supports `$filter=navProp/field eq value` syntax. Internally:

1. Filter parser recognizes `/` in property paths
2. `getPropertyPath()` converts `batch/fruitTypeId` → `batch.fruitTypeId`
3. `resolveColumnPath()` looks up Sequelize `rawAttributes` to map `fruitTypeId` → `fruit_type_id` (actual DB column)
4. Generates `{ '$batch.fruit_type_id$': { [Op.eq]: value } }` for Sequelize
5. `ensureFilterIncludes()` auto-adds the association JOIN if not already in `$expand`

## Development

```bash
npm install           # install deps
npm run build         # TypeScript → dist/
npm test              # 549 tests
npm run dev           # watch mode
```

After changes: rebuild (`npm run build`), commit dist/, tag, push. Consumers update by changing the git tag in their `package.json`.

## Testing

- Tests use SQLite in-memory (no external DB needed)
- `vitest` framework, 23 test files, 549 tests
- Note: `iLike` (case-insensitive LIKE) is not supported by SQLite — string function tests accept both 200 and 500
