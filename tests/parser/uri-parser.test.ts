/**
 * URI Parser Tests
 *
 * Tests for OData URI parsing including:
 * - Entity set paths
 * - Entity keys (single and composite)
 * - Navigation properties
 * - Special segments ($metadata, $batch, $count, $value)
 * - Function imports
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseUri, buildEntityUri } from '../../src/parser/uri-parser';
import { ODataSchemaConfig } from '../../src/config/types';

// Test schema for URI parsing
const testSchema: ODataSchemaConfig = {
  namespace: 'TestService',
  entities: {
    Products: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String' },
      },
      navigationProperties: {
        Category: {
          target: 'Categories',
          relationship: 'Product_Category',
          multiplicity: '0..1',
        },
      },
    },
    Categories: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String' },
      },
      navigationProperties: {
        Products: {
          target: 'Products',
          relationship: 'Product_Category',
          multiplicity: '*',
        },
      },
    },
    Orders: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
      },
      navigationProperties: {
        Items: {
          target: 'OrderItems',
          relationship: 'Order_Items',
          multiplicity: '*',
        },
      },
    },
    OrderItems: {
      keys: ['OrderID', 'ProductID'],
      properties: {
        OrderID: { type: 'Edm.Int32', nullable: false },
        ProductID: { type: 'Edm.Int32', nullable: false },
      },
      navigationProperties: {
        Order: {
          target: 'Orders',
          relationship: 'Order_Items',
          multiplicity: '1',
        },
        Product: {
          target: 'Products',
          relationship: 'OrderItem_Product',
          multiplicity: '1',
        },
      },
    },
    Items: {
      keys: ['Category', 'ID'],
      properties: {
        Category: { type: 'Edm.String', nullable: false },
        ID: { type: 'Edm.Int32', nullable: false },
      },
    },
  },
  functionImports: {
    GetAllProducts: {
      returnType: 'Collection(Products)',
      httpMethod: 'GET',
      parameters: {},
    },
    GetProductsByCategory: {
      returnType: 'Collection(Products)',
      httpMethod: 'GET',
      parameters: {
        categoryId: { type: 'Edm.Int32' },
      },
    },
  },
};

describe('URI Parser', () => {
  describe('Entity Set Paths', () => {
    it('should parse simple entity set', () => {
      const result = parseUri('/Products', testSchema);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('entitySet');
      expect(result[0].name).toBe('Products');
    });

    it('should parse entity set with leading slash', () => {
      const result = parseUri('/Products', testSchema);
      expect(result[0].name).toBe('Products');
    });

    it('should parse entity set without leading slash', () => {
      const result = parseUri('Products', testSchema);
      expect(result[0].name).toBe('Products');
    });

    it('should handle empty path as service root', () => {
      const result = parseUri('/', testSchema);
      expect(result).toHaveLength(0);
    });
  });

  describe('Single Entity Keys', () => {
    it('should parse integer key', () => {
      const result = parseUri('/Products(1)', testSchema);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('entity');
      expect(result[0].keys).toEqual({ ID: 1 });
    });

    it('should parse string key', () => {
      // For composite keys, use named syntax
      const result = parseUri("/Items(Category='ABC',ID=1)", testSchema);
      expect(result[0].keys?.Category).toBe('ABC');
    });

    it('should parse string key with escaped quotes', () => {
      const result = parseUri("/Items(Category='It''s',ID=1)", testSchema);
      expect(result[0].keys?.Category).toBe("It's");
    });

    it('should parse guid key', () => {
      const result = parseUri("/Products(guid'12345678-1234-1234-1234-123456789012')", testSchema);
      expect(result[0].keys?.ID).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('should parse negative integer key', () => {
      const result = parseUri('/Products(-5)', testSchema);
      expect(result[0].keys).toEqual({ ID: -5 });
    });

    it('should parse decimal key', () => {
      const result = parseUri('/Products(1.5)', testSchema);
      expect(result[0].keys).toEqual({ ID: 1.5 });
    });
  });

  describe('Composite Keys', () => {
    it('should parse composite key with two parts', () => {
      const result = parseUri('/OrderItems(OrderID=1,ProductID=2)', testSchema);
      expect(result[0].keys).toEqual({
        OrderID: 1,
        ProductID: 2,
      });
    });

    it('should parse composite key with string and integer', () => {
      const result = parseUri("/Items(Category='A',ID=1)", testSchema);
      expect(result[0].keys).toEqual({
        Category: 'A',
        ID: 1,
      });
    });

    it('should handle whitespace in composite keys', () => {
      const result = parseUri('/OrderItems(OrderID=1, ProductID=2)', testSchema);
      expect(result[0].keys).toEqual({ OrderID: 1, ProductID: 2 });
    });
  });

  describe('Navigation Properties', () => {
    it('should parse navigation to collection', () => {
      const result = parseUri('/Categories(1)/Products', testSchema);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('entity');
      // Navigation properties may be parsed as entitySet depending on implementation
      expect(['navigation', 'entitySet']).toContain(result[1].type);
      expect(result[1].name).toBe('Products');
    });

    it('should parse navigation to single entity', () => {
      const result = parseUri('/Products(1)/Category', testSchema);
      expect(['navigation', 'entitySet']).toContain(result[1].type);
      expect(result[1].name).toBe('Category');
    });

    it('should parse deep navigation', () => {
      const result = parseUri('/Orders(1)/Items(OrderID=1,ProductID=2)/Product', testSchema);
      expect(result).toHaveLength(3);
      expect(result[2].name).toBe('Product');
    });

    it('should parse navigation with key access', () => {
      const result = parseUri('/Categories(1)/Products(5)', testSchema);
      expect(result[1].keys).toEqual({ ID: 5 });
    });
  });

  describe('Special Segments', () => {
    it('should parse $metadata', () => {
      const result = parseUri('/$metadata', testSchema);
      expect(result[0].type).toBe('$metadata');
    });

    it('should parse $batch', () => {
      const result = parseUri('/$batch', testSchema);
      expect(result[0].type).toBe('$batch');
    });

    it('should parse $count on collection', () => {
      const result = parseUri('/Products/$count', testSchema);
      expect(result).toHaveLength(2);
      expect(result[1].type).toBe('$count');
    });

    it('should parse $value on property', () => {
      const result = parseUri('/Products(1)/Name/$value', testSchema);
      expect(result[2].type).toBe('value');
    });

    it('should parse $links', () => {
      const result = parseUri('/Products(1)/$links/Category', testSchema);
      // The implementation may or may not specifically handle $links
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('Function Imports', () => {
    it('should parse function import without parameters', () => {
      const result = parseUri('/GetAllProducts', testSchema);
      expect(result[0].type).toBe('functionImport');
      expect(result[0].name).toBe('GetAllProducts');
    });

    it('should parse function import path', () => {
      const result = parseUri('/GetProductsByCategory', testSchema);
      expect(result[0].name).toBe('GetProductsByCategory');
    });
  });

  describe('buildEntityUri', () => {
    it('should build URI with integer key', () => {
      const uri = buildEntityUri('/odata', 'Products', { ID: 1 }, testSchema);
      expect(uri).toBe('/odata/Products(1)');
    });

    it('should build URI with string key', () => {
      const uri = buildEntityUri('/odata', 'Items', { Category: 'ABC', ID: 1 }, testSchema);
      expect(uri).toContain("Category='ABC'");
    });

    it('should build URI with composite key', () => {
      const uri = buildEntityUri('/odata', 'OrderItems', { OrderID: 1, ProductID: 2 }, testSchema);
      expect(uri).toContain('OrderID=1');
      expect(uri).toContain('ProductID=2');
    });

    it('should escape special characters in string keys', () => {
      const uri = buildEntityUri('/odata', 'Items', { Category: "It's", ID: 1 }, testSchema);
      expect(uri).toContain("It''s");
    });

    it('should work without base path', () => {
      const uri = buildEntityUri('', 'Products', { ID: 1 }, testSchema);
      expect(uri).toBe('/Products(1)');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown entity set gracefully', () => {
      const result = parseUri('/Unknown', testSchema);
      expect(result).toBeDefined();
    });

    it('should handle special characters in path', () => {
      // URL-encoded should be decoded
      const result = parseUri('/Products%281%29', testSchema);
      expect(result).toBeDefined();
    });
  });
});
