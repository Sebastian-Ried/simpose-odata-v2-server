# OData V2 Quick Reference

## Query Options

| Option | Description | Example |
|--------|-------------|---------|
| `$filter` | Filter results | `$filter=Price gt 100` |
| `$select` | Choose fields | `$select=ID,Name,Price` |
| `$expand` | Include related | `$expand=Category` |
| `$orderby` | Sort results | `$orderby=Price desc` |
| `$top` | Limit results | `$top=10` |
| `$skip` | Skip results | `$skip=20` |
| `$inlinecount` | Include count | `$inlinecount=allpages` |

## Filter Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `eq` | Equals | `Name eq 'iPhone'` |
| `ne` | Not equals | `Status ne 'Deleted'` |
| `gt` | Greater than | `Price gt 100` |
| `ge` | Greater or equal | `Stock ge 10` |
| `lt` | Less than | `Price lt 1000` |
| `le` | Less or equal | `Stock le 50` |
| `and` | Logical AND | `Price gt 10 and Price lt 100` |
| `or` | Logical OR | `Status eq 'A' or Status eq 'B'` |
| `not` | Logical NOT | `not endswith(Name,'test')` |

## Filter Functions

### String Functions
```
startswith(Name, 'iPhone')
endswith(Name, 'Pro')
substringof('Phone', Name)
tolower(Name) eq 'iphone'
toupper(Name) eq 'IPHONE'
length(Name) gt 10
concat(FirstName, LastName)
trim(Name)
```

### Date Functions
```
year(CreatedAt) eq 2024
month(CreatedAt) eq 6
day(CreatedAt) eq 15
hour(CreatedAt) eq 14
```

### Math Functions
```
round(Price) eq 100
floor(Price) eq 99
ceiling(Price) eq 100
```

## HTTP Methods

| Method | Operation | URL Pattern |
|--------|-----------|-------------|
| GET | Read | `/Products` or `/Products(1)` |
| POST | Create | `/Products` |
| PUT | Replace | `/Products(1)` |
| PATCH/MERGE | Update | `/Products(1)` |
| DELETE | Delete | `/Products(1)` |

## Response Format

### Collection
```json
{
  "d": {
    "results": [
      { "__metadata": {...}, "ID": 1, "Name": "..." },
      { "__metadata": {...}, "ID": 2, "Name": "..." }
    ],
    "__count": "42"
  }
}
```

### Single Entity
```json
{
  "d": {
    "__metadata": {
      "uri": "/odata/Products(1)",
      "type": "MyService.Products",
      "etag": "W/\"abc123\""
    },
    "ID": 1,
    "Name": "iPhone",
    "Price": "999.99"
  }
}
```

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Bad Request |
| 404 | Not Found |
| 409 | Conflict |
| 412 | Precondition Failed |
| 500 | Server Error |

## Schema Types (EDM)

| EDM Type | JavaScript |
|----------|------------|
| `Edm.String` | string |
| `Edm.Int32` | number |
| `Edm.Int64` | string |
| `Edm.Decimal` | number |
| `Edm.Double` | number |
| `Edm.Boolean` | boolean |
| `Edm.DateTime` | Date |
| `Edm.Guid` | string |
| `Edm.Binary` | Buffer |

## Multiplicity

| Value | Meaning |
|-------|---------|
| `1` | Required (exactly one) |
| `0..1` | Optional (zero or one) |
| `*` | Collection (zero or more) |

## Combined Query Example

```
GET /odata/Products
  ?$filter=Price gt 50 and Stock gt 0
  &$select=ID,Name,Price,Category
  &$expand=Category
  &$orderby=Price desc
  &$top=10
  &$skip=0
  &$inlinecount=allpages
```
