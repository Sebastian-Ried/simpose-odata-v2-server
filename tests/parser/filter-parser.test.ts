/**
 * Filter Parser Tests
 *
 * Tests for OData $filter expression parsing including:
 * - Comparison operators (eq, ne, gt, ge, lt, le)
 * - Logical operators (and, or, not)
 * - String functions (substringof, startswith, endswith, etc.)
 * - Date functions (year, month, day, etc.)
 * - Math functions (round, floor, ceiling)
 * - Arithmetic operations
 * - Literals (string, number, boolean, null, datetime, guid)
 * - Security limits (max length, max depth)
 */

import { describe, it, expect } from 'vitest';
import { parseFilter, SUPPORTED_FUNCTIONS } from '../../src/parser/filter-parser';

describe('Filter Parser', () => {
  describe('Comparison Operators', () => {
    it('should parse eq operator', () => {
      const result = parseFilter("Name eq 'Test'");
      expect(result.type).toBe('binary');
      expect(result.operator).toBe('eq');
      expect(result.left?.type).toBe('property');
      expect(result.left?.name).toBe('Name');
      expect(result.right?.type).toBe('literal');
      expect(result.right?.value).toBe('Test');
    });

    it('should parse ne operator', () => {
      const result = parseFilter('Status ne null');
      expect(result.operator).toBe('ne');
      expect(result.right?.value).toBe(null);
    });

    it('should parse gt operator with number', () => {
      const result = parseFilter('Price gt 100');
      expect(result.operator).toBe('gt');
      expect(result.right?.value).toBe(100);
    });

    it('should parse ge operator', () => {
      const result = parseFilter('Stock ge 10');
      expect(result.operator).toBe('ge');
    });

    it('should parse lt operator', () => {
      const result = parseFilter('Price lt 50.99');
      expect(result.operator).toBe('lt');
      expect(result.right?.value).toBe(50.99);
    });

    it('should parse le operator', () => {
      const result = parseFilter('Quantity le 100');
      expect(result.operator).toBe('le');
    });
  });

  describe('Logical Operators', () => {
    it('should parse and operator', () => {
      const result = parseFilter('Price gt 10 and Price lt 100');
      expect(result.type).toBe('binary');
      expect(result.operator).toBe('and');
      expect(result.left?.operator).toBe('gt');
      expect(result.right?.operator).toBe('lt');
    });

    it('should parse or operator', () => {
      const result = parseFilter("Status eq 'Active' or Status eq 'Pending'");
      expect(result.operator).toBe('or');
    });

    it('should parse not operator', () => {
      const result = parseFilter('not IsActive');
      expect(result.type).toBe('unary');
      expect(result.operator).toBe('not');
      expect(result.operand?.type).toBe('property');
    });

    it('should parse complex logical expression', () => {
      const result = parseFilter("(Price gt 10 and Price lt 100) or Status eq 'Sale'");
      expect(result.operator).toBe('or');
    });

    it('should respect operator precedence (and before or)', () => {
      const result = parseFilter("A eq 1 or B eq 2 and C eq 3");
      // Should be: A eq 1 or (B eq 2 and C eq 3)
      expect(result.operator).toBe('or');
      expect(result.right?.operator).toBe('and');
    });
  });

  describe('String Functions', () => {
    it('should parse substringof function', () => {
      const result = parseFilter("substringof('test', Name)");
      expect(result.type).toBe('function');
      expect(result.name).toBe('substringof');
      expect(result.args).toHaveLength(2);
      expect(result.args?.[0]?.value).toBe('test');
    });

    it('should parse startswith function', () => {
      const result = parseFilter("startswith(Name, 'A')");
      expect(result.name).toBe('startswith');
      expect(result.args?.[0]?.name).toBe('Name');
      expect(result.args?.[1]?.value).toBe('A');
    });

    it('should parse endswith function', () => {
      const result = parseFilter("endswith(Name, 'Z')");
      expect(result.name).toBe('endswith');
    });

    it('should parse length function', () => {
      const result = parseFilter('length(Name) gt 5');
      expect(result.left?.name).toBe('length');
    });

    it('should parse tolower function', () => {
      const result = parseFilter("tolower(Name) eq 'test'");
      expect(result.left?.name).toBe('tolower');
    });

    it('should parse toupper function', () => {
      const result = parseFilter("toupper(Name) eq 'TEST'");
      expect(result.left?.name).toBe('toupper');
    });

    it('should parse trim function', () => {
      const result = parseFilter("trim(Name) eq 'test'");
      expect(result.left?.name).toBe('trim');
    });

    it('should parse concat function', () => {
      const result = parseFilter("concat(FirstName, LastName) eq 'JohnDoe'");
      expect(result.left?.name).toBe('concat');
      expect(result.left?.args).toHaveLength(2);
    });

    it('should parse indexof function', () => {
      const result = parseFilter("indexof(Name, 'test') ge 0");
      expect(result.left?.name).toBe('indexof');
    });

    it('should parse substring function', () => {
      const result = parseFilter("substring(Name, 0, 5) eq 'Hello'");
      expect(result.left?.name).toBe('substring');
      expect(result.left?.args).toHaveLength(3);
    });

    it('should parse replace function', () => {
      const result = parseFilter("replace(Name, 'old', 'new') eq 'newvalue'");
      expect(result.left?.name).toBe('replace');
    });
  });

  describe('Date Functions', () => {
    it('should parse year function', () => {
      const result = parseFilter('year(CreatedAt) eq 2024');
      expect(result.left?.name).toBe('year');
    });

    it('should parse month function', () => {
      const result = parseFilter('month(CreatedAt) eq 12');
      expect(result.left?.name).toBe('month');
    });

    it('should parse day function', () => {
      const result = parseFilter('day(CreatedAt) eq 25');
      expect(result.left?.name).toBe('day');
    });

    it('should parse hour function', () => {
      const result = parseFilter('hour(CreatedAt) eq 14');
      expect(result.left?.name).toBe('hour');
    });

    it('should parse minute function', () => {
      const result = parseFilter('minute(CreatedAt) eq 30');
      expect(result.left?.name).toBe('minute');
    });

    it('should parse second function', () => {
      const result = parseFilter('second(CreatedAt) eq 45');
      expect(result.left?.name).toBe('second');
    });
  });

  describe('Math Functions', () => {
    it('should parse round function', () => {
      const result = parseFilter('round(Price) eq 100');
      expect(result.left?.name).toBe('round');
    });

    it('should parse floor function', () => {
      const result = parseFilter('floor(Price) eq 99');
      expect(result.left?.name).toBe('floor');
    });

    it('should parse ceiling function', () => {
      const result = parseFilter('ceiling(Price) eq 100');
      expect(result.left?.name).toBe('ceiling');
    });
  });

  describe('Literals', () => {
    it('should parse string literals with single quotes', () => {
      const result = parseFilter("Name eq 'Hello World'");
      expect(result.right?.value).toBe('Hello World');
      expect(result.right?.dataType).toBe('Edm.String');
    });

    it('should parse escaped quotes in strings', () => {
      const result = parseFilter("Name eq 'It''s a test'");
      expect(result.right?.value).toBe("It's a test");
    });

    it('should parse integer literals', () => {
      const result = parseFilter('Count eq 42');
      expect(result.right?.value).toBe(42);
      expect(result.right?.dataType).toBe('Edm.Int32');
    });

    it('should parse decimal literals', () => {
      const result = parseFilter('Price eq 99.99');
      expect(result.right?.value).toBe(99.99);
      expect(result.right?.dataType).toBe('Edm.Double');
    });

    it('should parse negative numbers', () => {
      const result = parseFilter('Temperature eq -10');
      expect(result.right?.value).toBe(-10);
    });

    it('should parse boolean true', () => {
      const result = parseFilter('IsActive eq true');
      expect(result.right?.value).toBe(true);
      expect(result.right?.dataType).toBe('Edm.Boolean');
    });

    it('should parse boolean false', () => {
      const result = parseFilter('IsActive eq false');
      expect(result.right?.value).toBe(false);
    });

    it('should parse null', () => {
      const result = parseFilter('DeletedAt eq null');
      expect(result.right?.value).toBe(null);
    });

    it('should parse datetime literal', () => {
      const result = parseFilter("CreatedAt eq datetime'2024-01-15T10:30:00'");
      expect(result.right?.dataType).toBe('Edm.DateTime');
    });

    it('should parse guid literal', () => {
      const result = parseFilter("ID eq guid'12345678-1234-1234-1234-123456789012'");
      expect(result.right?.dataType).toBe('Edm.Guid');
    });

    it('should parse long literal with L suffix', () => {
      const result = parseFilter('BigNumber eq 9999999999L');
      expect(result.right?.dataType).toBe('Edm.Int64');
    });

    it('should parse decimal literal with M suffix', () => {
      const result = parseFilter('Price eq 99.99M');
      expect(result.right?.dataType).toBe('Edm.Decimal');
    });
  });

  describe('Arithmetic Operations', () => {
    it('should parse add operation', () => {
      const result = parseFilter('Price add 10 gt 100');
      expect(result.left?.operator).toBe('add');
    });

    it('should parse sub operation', () => {
      const result = parseFilter('Price sub 10 lt 50');
      expect(result.left?.operator).toBe('sub');
    });

    it('should parse mul operation', () => {
      const result = parseFilter('Quantity mul Price gt 1000');
      expect(result.left?.operator).toBe('mul');
    });

    it('should parse div operation', () => {
      const result = parseFilter('Total div Count eq 10');
      expect(result.left?.operator).toBe('div');
    });

    it('should parse mod operation', () => {
      const result = parseFilter('ID mod 2 eq 0');
      expect(result.left?.operator).toBe('mod');
    });
  });

  describe('Navigation Properties', () => {
    it('should parse navigation property path', () => {
      const result = parseFilter("Category/Name eq 'Electronics'");
      expect(result.left?.name).toBe('Category/Name');
    });

    it('should parse deep navigation path', () => {
      const result = parseFilter("Order/Customer/Name eq 'John'");
      expect(result.left?.name).toBe('Order/Customer/Name');
    });
  });

  describe('Parentheses and Grouping', () => {
    it('should parse parenthesized expressions', () => {
      const result = parseFilter('(Price gt 10)');
      expect(result.operator).toBe('gt');
    });

    it('should handle nested parentheses', () => {
      const result = parseFilter('((Price gt 10))');
      expect(result.operator).toBe('gt');
    });

    it('should use parentheses to change precedence', () => {
      const result = parseFilter('(A eq 1 or B eq 2) and C eq 3');
      expect(result.operator).toBe('and');
      expect(result.left?.operator).toBe('or');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid syntax', () => {
      expect(() => parseFilter('Name eq')).toThrow();
    });

    it('should throw error for unclosed parentheses', () => {
      expect(() => parseFilter('(Name eq "test"')).toThrow();
    });

    it('should throw error for unknown operator', () => {
      expect(() => parseFilter('Name xyz "test"')).toThrow();
    });
  });

  describe('Security Limits', () => {
    it('should reject filter exceeding max length', () => {
      const longFilter = 'Name eq ' + "'a".repeat(5000) + "'";
      expect(() => parseFilter(longFilter)).toThrow(/exceeds maximum length/);
    });

    it('should reject deeply nested expressions', () => {
      // Create deeply nested expression
      let filter = 'A eq 1';
      for (let i = 0; i < 60; i++) {
        filter = `(${filter})`;
      }
      expect(() => parseFilter(filter)).toThrow(/exceeds maximum depth/);
    });
  });

  describe('SUPPORTED_FUNCTIONS constant', () => {
    it('should include all string functions', () => {
      expect(SUPPORTED_FUNCTIONS).toContain('substringof');
      expect(SUPPORTED_FUNCTIONS).toContain('startswith');
      expect(SUPPORTED_FUNCTIONS).toContain('endswith');
      expect(SUPPORTED_FUNCTIONS).toContain('length');
      expect(SUPPORTED_FUNCTIONS).toContain('tolower');
      expect(SUPPORTED_FUNCTIONS).toContain('toupper');
      expect(SUPPORTED_FUNCTIONS).toContain('trim');
      expect(SUPPORTED_FUNCTIONS).toContain('concat');
    });

    it('should include all date functions', () => {
      expect(SUPPORTED_FUNCTIONS).toContain('year');
      expect(SUPPORTED_FUNCTIONS).toContain('month');
      expect(SUPPORTED_FUNCTIONS).toContain('day');
      expect(SUPPORTED_FUNCTIONS).toContain('hour');
      expect(SUPPORTED_FUNCTIONS).toContain('minute');
      expect(SUPPORTED_FUNCTIONS).toContain('second');
    });

    it('should include all math functions', () => {
      expect(SUPPORTED_FUNCTIONS).toContain('round');
      expect(SUPPORTED_FUNCTIONS).toContain('floor');
      expect(SUPPORTED_FUNCTIONS).toContain('ceiling');
    });
  });

  describe('Filter Caching', () => {
    it('should return cached result for same filter', () => {
      const filter = "Name eq 'CacheTest'";
      const result1 = parseFilter(filter);
      const result2 = parseFilter(filter);
      // Results should be structurally identical
      expect(result1).toEqual(result2);
    });
  });
});
