# Basic OData Server Example

This example shows a complete OData V2 server with Products and Categories.

## Quick Start

1. **Install dependencies** (from the root directory):
   ```bash
   npm install
   npm run build
   ```

2. **Run the example**:
   ```bash
   npx ts-node examples/basic/server.ts
   ```

3. **Test the server**:
   Open your browser to: http://localhost:3000/odata/$metadata

## What's Included

- **Two entities**: Products and Categories
- **Relationship**: Products belong to Categories
- **Hooks**: Validation and computed fields
- **Function imports**: Custom queries

## Sample Requests

### Get All Products
```
GET http://localhost:3000/odata/Products
```

### Get Product with Category
```
GET http://localhost:3000/odata/Products(1)?$expand=Category
```

### Filter Products by Price
```
GET http://localhost:3000/odata/Products?$filter=Price gt 100
```

### Get Products in Price Range (Function Import)
```
GET http://localhost:3000/odata/GetProductsByPriceRange?minPrice=50&maxPrice=500
```

### Create a Product
```bash
curl -X POST http://localhost:3000/odata/Products \
  -H "Content-Type: application/json" \
  -d '{"Name":"New Product","Price":99.99,"Stock":10,"CategoryID":1}'
```

### Update a Product
```bash
curl -X PATCH http://localhost:3000/odata/Products\(1\) \
  -H "Content-Type: application/json" \
  -d '{"Price":899.99}'
```

### Delete a Product
```bash
curl -X DELETE http://localhost:3000/odata/Products\(1\)
```

## Features Demonstrated

1. **Entity Sets** - Products and Categories with CRUD operations
2. **Navigation Properties** - Product.Category and Category.Products
3. **Query Options** - $filter, $select, $expand, $orderby, $top, $skip
4. **Hooks** - Validation in beforeCreate, computed fields in afterRead
5. **Function Imports** - GetProductsByPriceRange, GetCategoryStats
6. **Error Handling** - Custom validation errors
