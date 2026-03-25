# OData V2 Sequelize - Architecture Guide

This document provides a comprehensive overview of the codebase architecture for developers who will maintain and extend this library.

## Table of Contents

1. [Overview](#overview)
2. [Request Flow](#request-flow)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [Security Features](#security-features)
6. [Testing](#testing)
7. [Extension Points](#extension-points)
8. [Key Patterns](#key-patterns)

---

## Overview

This library provides an Express middleware that translates OData V2 requests into Sequelize database operations.

### Main Flow

```
HTTP Request → URI Parser → Query Builder → Sequelize → Response Serializer → HTTP Response
```

### Key Technologies

- **Express.js** - HTTP routing and middleware
- **Sequelize** - Database ORM
- **TypeScript** - Type safety throughout

---

## Request Flow

### 1. Middleware Chain (`src/middleware.ts`)

When a request comes in, it passes through these middleware in order:

```
1. Correlation ID setup     → Assigns unique ID for request tracing
2. MERGE method detection   → OData V2 uses MERGE for partial updates
3. CSRF protection          → Validates tokens for state-changing requests
4. Body parsing             → Parses JSON/multipart bodies
5. Route handling           → Dispatches to appropriate handler
```

### 2. Request Processing

```
GET /odata/Products?$filter=Price gt 100&$expand=Category
         │
         ▼
    ┌─────────────┐
    │ URI Parser  │  → Extracts: entitySet="Products"
    └─────────────┘
         │
         ▼
    ┌─────────────┐
    │Query Options│  → Parses: $filter, $expand, $select, etc.
    └─────────────┘
         │
         ▼
    ┌─────────────┐
    │Filter Parser│  → Tokenizes and parses $filter into AST
    └─────────────┘
         │
         ▼
    ┌──────────────┐
    │Filter Transl.│  → Converts AST to Sequelize WHERE clause
    └──────────────┘
         │
         ▼
    ┌─────────────┐
    │Query Builder│  → Builds complete Sequelize query
    └─────────────┘
         │
         ▼
    ┌─────────────┐
    │  Sequelize  │  → Executes database query
    └─────────────┘
         │
         ▼
    ┌─────────────┐
    │ Serializer  │  → Formats response as OData JSON
    └─────────────┘
```

---

## Project Structure

```
src/
├── index.ts                 # Public API exports
├── middleware.ts            # Main Express middleware factory
├── ODataService.ts          # Core service class
│
├── config/
│   ├── types.ts            # TypeScript interfaces
│   ├── defaults.ts         # Default configuration values
│   └── schema-loader.ts    # Schema loading and validation
│
├── parser/
│   ├── uri-parser.ts       # Parse /Products(1)/Category → segments
│   ├── filter-parser.ts    # Parse $filter → AST (lexer/parser)
│   ├── query-options.ts    # Parse $select, $expand, $orderby, etc.
│   └── batch-parser.ts     # Parse multipart batch requests
│
├── query/
│   ├── query-builder.ts    # Build Sequelize queries
│   ├── filter-translator.ts # AST → Sequelize WHERE clause
│   ├── expand-handler.ts   # Handle $expand (joins)
│   ├── select-handler.ts   # Handle $select (projections)
│   └── orderby-handler.ts  # Handle $orderby (sorting)
│
├── handlers/
│   ├── base-handler.ts     # Base class for entity handlers
│   └── crud/               # CRUD operation handlers
│       ├── read.ts
│       ├── create.ts
│       ├── update.ts
│       └── delete.ts
│
├── serializers/
│   ├── json-serializer.ts  # Convert results to OData JSON format
│   └── content-negotiation.ts # Handle Accept headers
│
├── metadata/
│   ├── generator.ts        # Generate EDMX metadata document
│   └── type-mapping.ts     # EDM ↔ JavaScript type conversions
│
├── hooks/
│   ├── hook-registry.ts    # Hook registration and execution
│   └── context.ts          # Hook context utilities
│
└── utils/
    ├── errors.ts           # OData error formatting
    ├── etag.ts             # ETag generation/validation (SHA-256)
    ├── csrf.ts             # CSRF protection middleware
    ├── cache.ts            # TTL cache with LRU eviction
    ├── correlation.ts      # Request correlation IDs
    ├── logger.ts           # Logging utilities
    ├── validation.ts       # Input validation
    ├── health.ts           # Health check endpoints
    ├── shutdown.ts         # Graceful shutdown
    ├── timeout.ts          # Request timeout handling
    ├── metrics.ts          # Metrics collection
    ├── pool-monitor.ts     # Connection pool monitoring
    └── circuit-breaker.ts  # Circuit breaker pattern
```

---

## Core Components

### 1. Entry Point (`src/index.ts`)

Re-exports all public APIs. **When adding new utilities, always export them here.**

```typescript
// Example: Adding a new export
export { myNewUtility } from './utils/my-new-utility';
```

### 2. Configuration Types (`src/config/types.ts`)

Defines all TypeScript interfaces:

| Type | Purpose |
|------|---------|
| `ODataSchemaConfig` | Main schema configuration |
| `EntityDefinition` | Entity (table) definition |
| `PropertyDefinition` | Property (column) definition |
| `NavigationPropertyDefinition` | Relationships between entities |
| `ODataMiddlewareOptions` | Options for `odataMiddleware()` |
| `HookContext` | Context available in hooks |
| `EntityHooks` | Hook function definitions |
| `CsrfOptions` | CSRF protection configuration |

### 3. Filter Parser (`src/parser/filter-parser.ts`)

Uses a **lexer/parser** approach for security (prevents injection):

```
$filter=Price gt 100 and Name eq 'Test'
                    │
                    ▼
            FilterLexer.tokenize()
                    │
                    ▼
[IDENTIFIER:Price, GT, NUMBER:100, AND, IDENTIFIER:Name, EQ, STRING:'Test']
                    │
                    ▼
            FilterParser.parse()
                    │
                    ▼
              AST (FilterExpression tree)
```

**Security features:**
- `MAX_FILTER_LENGTH = 4096` - Prevents DoS with huge filters
- `MAX_PARSE_DEPTH = 50` - Prevents stack overflow
- Caching with TTL - Performance optimization

**To add a new filter function:**
1. Add function name to `SUPPORTED_FUNCTIONS` array
2. Handle it in `filter-translator.ts` → `translateFunction()`

### 4. Filter Translator (`src/query/filter-translator.ts`)

Converts parsed AST into Sequelize WHERE clauses.

**Key functions:**
- `translateFilter()` - Main entry point
- `translateBinaryOp()` - Handles `eq`, `gt`, `and`, arithmetic, etc.
- `translateFunction()` - Handles `substringof`, `startswith`, `year`, etc.
- `buildArithmeticExpression()` - Handles `add`, `sub`, `mul`, `div`, `mod`
- `validatePropertyPath()` - Security: validates navigation paths against schema

**Dialect awareness:**
```typescript
// Column quoting varies by database
if (dialect === 'mysql' || dialect === 'mariadb') {
  quotedCol = `\`${propPath}\``;
} else if (dialect === 'mssql') {
  quotedCol = `[${propPath}]`;
} else {
  // PostgreSQL, SQLite
  quotedCol = `"${propPath}"`;
}
```

### 5. URI Parser (`src/parser/uri-parser.ts`)

Parses OData URLs into segments:

```
/Products(1)/Category  →  [
  { type: 'entity', name: 'Products', keys: { ID: 1 } },
  { type: 'navigation', name: 'Category' }
]
```

**Security limits:**
- `MAX_KEY_STRING_LENGTH = 4096`
- `MAX_KEY_PAIRS = 20`
- `MAX_KEY_VALUE_LENGTH = 1024`

### 6. CSRF Protection (`src/utils/csrf.ts`)

Implements SAP OData CSRF pattern:

```
1. Client: GET /odata/Products
           Header: X-CSRF-Token: Fetch
                      │
                      ▼
2. Server: Returns token in X-CSRF-Token response header
           Stores token in memory (per session)
                      │
                      ▼
3. Client: POST /odata/Products
           Header: X-CSRF-Token: <token>
                      │
                      ▼
4. Server: Validates token, consumes it (single-use)
```

**Configuration:**
```typescript
odataMiddleware({
  // ...
  csrf: {
    enabled: true,              // Enable/disable (default: true)
    headerName: 'X-CSRF-Token', // Custom header name
    allowTokenReuse: false,     // Single-use tokens (more secure)
    skipPaths: ['/health']      // Paths to skip validation
  }
});
```

**Production note:** Uses in-memory store. For multi-server deployments, implement Redis-based storage.

### 7. ETag Generation (`src/utils/etag.ts`)

Uses SHA-256 for cryptographic security:

```typescript
const ETAG_HASH_ALGORITHM = 'sha256';  // NOT md5

export function generateETag(entity: Record<string, unknown>): string {
  const content = JSON.stringify(sortObject(entity));
  const hash = crypto.createHash(ETAG_HASH_ALGORITHM).update(content).digest('hex');
  return `W/"${hash.substring(0, 32)}"`;  // Truncate for reasonable length
}
```

---

## Security Features

### Input Validation

| Feature | Location | Protection |
|---------|----------|------------|
| Filter length limit | `filter-parser.ts` | DoS prevention |
| Parse depth limit | `filter-parser.ts` | Stack overflow prevention |
| URI key length limit | `uri-parser.ts` | DoS prevention |
| Key pair count limit | `uri-parser.ts` | DoS prevention |
| Property path validation | `filter-translator.ts` | Path traversal prevention |
| LIKE pattern escaping | `filter-translator.ts` | SQL injection prevention |

### Cryptographic Security

| Feature | Algorithm | Location |
|---------|-----------|----------|
| ETag generation | SHA-256 | `utils/etag.ts` |
| CSRF tokens | crypto.randomBytes(32) | `utils/csrf.ts` |
| Batch boundaries | crypto.randomBytes(16) | `parser/batch-parser.ts` |
| Correlation IDs | crypto.randomBytes(16) | `utils/correlation.ts` |

### CSRF Protection

- Enabled by default
- Single-use tokens (prevents replay attacks)
- 30-minute token expiry
- Per-session token storage with limits

---

## Testing

### Test Structure

```
tests/
├── setup.ts              # Shared test utilities
├── parser/               # Unit tests for parsers
├── query/                # Unit tests for query builders
├── integration/          # End-to-end tests
├── security/             # Security-specific tests
└── utils/                # Utility function tests
```

### Test Utilities (`tests/setup.ts`)

```typescript
import {
  createTestSequelize,  // Creates in-memory SQLite
  createTestModels,     // Creates Product, Category, Order, OrderItem
  createTestSchema,     // Returns standard OData schema
  createTestApp,        // Creates configured Express app
  seedTestData,         // Populates test data
  request,              // Makes HTTP requests to test app
} from './setup';
```

### Writing a New Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Sequelize } from 'sequelize';
import {
  createTestSequelize,
  createTestModels,
  createTestApp,
  seedTestData,
  request,
  TestModels,
} from '../setup';

describe('My Feature', () => {
  let sequelize: Sequelize;
  let models: TestModels;
  let app: Express;

  beforeAll(async () => {
    sequelize = createTestSequelize();
    models = createTestModels(sequelize);
    await sequelize.sync({ force: true });
    await seedTestData(models);
    app = createTestApp(sequelize, models);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should return products', async () => {
    const response = await request(app, 'GET', '/odata/Products');
    expect(response.status).toBe(200);
    expect(response.body.d.results).toBeDefined();
  });

  it('should filter products', async () => {
    const response = await request(app, 'GET', '/odata/Products?$filter=Price gt 100');
    expect(response.status).toBe(200);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/query/filter-translator.test.ts

# Run with verbose output
npm test -- --reporter=verbose

# Run with coverage
npm test -- --coverage
```

---

## Extension Points

### Adding a New Filter Function

1. **Add to supported functions** (`src/parser/filter-parser.ts`):
```typescript
export const SUPPORTED_FUNCTIONS = [
  // ... existing functions
  'mynewfunction',
];
```

2. **Handle in translator** (`src/query/filter-translator.ts`):
```typescript
function translateFunction(node, entityName, schema, sequelize) {
  const funcName = node.name.toLowerCase();

  switch (funcName) {
    // ... existing cases
    case 'mynewfunction':
      return fn('MY_SQL_FUNC', translatedArgs[0]);
  }
}
```

3. **Add tests** (`tests/query/filter-translator.test.ts`)

### Adding a New Query Option

1. **Parse it** (`src/parser/query-options.ts`)
2. **Create handler** (`src/query/myoption-handler.ts`)
3. **Integrate in query builder** (`src/query/query-builder.ts`)
4. **Export from index** (`src/index.ts`)

### Adding New Middleware

Add to the middleware chain in `src/middleware.ts`:

```typescript
export function odataMiddleware(options: ODataMiddlewareOptions): Router {
  const router = Router();

  // ... existing middleware

  // Add your middleware here (order matters!)
  router.use(myNewMiddleware(options));

  // ... rest of middleware
}
```

### Adding a New Utility

1. **Create file** (`src/utils/my-utility.ts`)
2. **Export from index** (`src/index.ts`):
```typescript
export { myUtility, MyUtilityOptions } from './utils/my-utility';
```
3. **Add tests** (`tests/utils/my-utility.test.ts`)

### Adding a New Hook Type

1. **Add to interface** (`src/config/types.ts`):
```typescript
export interface EntityHooks {
  // ... existing hooks
  beforeMyAction?: (ctx: HookContext) => Promise<void>;
  afterMyAction?: (ctx: HookContext, result: any) => Promise<any>;
}
```

2. **Register in hook registry** (`src/hooks/hook-registry.ts`)

3. **Call from handler** (`src/handlers/crud/my-handler.ts`)

---

## Key Patterns

### 1. Security First

- Always validate user input
- Use parameterized queries (Sequelize handles this)
- Add length limits to prevent DoS
- Use cryptographically secure random for tokens

### 2. Type Safety

```typescript
// Good: Use interfaces
function processEntity(entity: EntityDefinition): void { }

// Avoid: Using any
function processEntity(entity: any): void { }
```

### 3. Testability

- Keep functions pure when possible
- Inject dependencies (sequelize, schema)
- Use the test utilities in `tests/setup.ts`

### 4. Documentation

```typescript
/**
 * Validates a property path against the schema.
 *
 * @param propertyPath - The OData property path (e.g., "Category/Name")
 * @param entityName - The starting entity name
 * @param schema - The OData schema configuration
 * @returns true if valid
 * @throws Error if path is invalid
 *
 * @example
 * validatePropertyPath('Category/Name', 'Product', schema);
 */
function validatePropertyPath(
  propertyPath: string,
  entityName: string,
  schema: ODataSchemaConfig
): boolean { }
```

### 5. Error Handling

```typescript
import { ODataError } from './utils/errors';

// Throw OData-formatted errors
throw new ODataError(400, 'Invalid filter expression');
throw new ODataError(404, 'Product not found');
throw new ODataError(403, 'Access denied');
```

---

## Quick Reference

### Common Extension Tasks

| To add... | Modify... |
|-----------|-----------|
| New filter function | `filter-parser.ts` + `filter-translator.ts` |
| New query option | `query-options.ts` + new handler |
| New middleware | `middleware.ts` (add to chain) |
| New utility | `src/utils/` + export from `index.ts` |
| New hook type | `config/types.ts` + `hook-registry.ts` |
| New EDM type | `config/types.ts` + `type-mapping.ts` |

### Important Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Public API exports |
| `src/middleware.ts` | Middleware factory |
| `src/config/types.ts` | TypeScript interfaces |
| `src/parser/filter-parser.ts` | Filter expression parsing |
| `src/query/filter-translator.ts` | Filter to Sequelize translation |
| `tests/setup.ts` | Test utilities |

### Useful Commands

```bash
# Run tests
npm test

# Build
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## Notable Implementation Details

### Navigation Property Column Name Resolution

When filtering through navigation properties (e.g. `$filter=batch/fruitTypeId eq '...'`), the filter translator generates Sequelize's `$assoc.col$` syntax. However, Sequelize uses the literal string in the SQL WHERE clause, which fails when the model attribute name (camelCase) differs from the database column name (snake_case).

The `resolveColumnPath()` function in `src/query/filter-translator.ts` solves this by:
1. Walking the navigation path through the OData schema to find the target entity
2. Looking up the Sequelize model name from the entity definition
3. Checking `rawAttributes` on the model to find the `field` mapping
4. Replacing the attribute name with the actual DB column name

This is transparent to consumers — `$filter=batch/fruitTypeId eq '...'` just works, regardless of whether the DB column is `fruitTypeId` or `fruit_type_id`.

### Association Auto-Include

When a filter or `$orderby` references a navigation property, the query builder automatically adds a minimal `include` for that association — even without an explicit `$expand`. This prevents "missing FROM-clause entry" SQL errors. The logic is in `ensureFilterIncludes()` in `src/query/query-builder.ts`, which:
1. Scans the WHERE clause for `$assoc.col$` patterns
2. Extracts association names
3. Adds `{ model, as, attributes: [], required: false }` includes
4. Sets `subQuery: false` to ensure JOINs appear in the main query

### ETag Handling

- **Generation**: ETags are based on `updatedAt`/`createdAt` timestamps using SHA-256
- **Response header**: Single entity reads include the ETag in the response header
- **$select guard**: ETags are NOT generated for partial entities (with `$select`) because the ETag would differ from the full entity's ETag, causing spurious `412 Precondition Failed` on subsequent updates
- **Concurrency**: `If-Match` header validation in update/delete handlers enables optimistic concurrency control

---

## Questions?

If you have questions about specific components, check:

1. The JSDoc comments in the source files
2. The test files for usage examples
3. The `docs/README.md` for user-facing documentation
