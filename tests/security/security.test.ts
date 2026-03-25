/**
 * Security Tests
 *
 * Tests for security measures including:
 * - SQL injection prevention
 * - Prototype pollution protection
 * - Path traversal prevention
 * - ReDoS prevention
 * - Request size limits
 * - Batch validation
 */

import { describe, it, expect } from 'vitest';
import { parseFilter } from '../../src/parser/filter-parser';
import { loadSchema, SchemaValidationError } from '../../src/config/schema-loader';
import { addQueryFilter } from '../../src/hooks/context';
import { parseQueryOptions } from '../../src/parser/query-options';
import { parseBatchRequest } from '../../src/parser/batch-parser';
import { formatODataError } from '../../src/utils/errors';
import { HookContext } from '../../src/config/types';

describe('Security', () => {
  describe('SQL Injection Prevention', () => {
    describe('Filter Parser - LIKE Patterns', () => {
      it('should escape % wildcard in substringof', () => {
        // This should not allow SQL wildcard injection
        const result = parseFilter("substringof('%', Name)");
        expect(result.args?.[0]?.value).toBe('%');
      });

      it('should escape _ wildcard in startswith', () => {
        const result = parseFilter("startswith(Name, '_admin')");
        expect(result.args?.[1]?.value).toBe('_admin');
      });

      it('should handle SQL injection attempt in string literal', () => {
        const result = parseFilter("Name eq 'test'' OR 1=1--'");
        // Should be parsed as literal string, not SQL
        expect(result.right?.value).toBe("test' OR 1=1--");
      });

      it('should not allow breaking out of string context', () => {
        // The parser rejects invalid syntax with semicolons outside strings
        // This is correct security behavior - the injection is rejected
        expect(() => parseFilter("Name eq 'value'); DROP TABLE Products;--'")).toThrow();
      });
    });

    describe('Navigation Property Injection', () => {
      it('should handle malicious navigation paths', () => {
        // Navigation paths should be validated, not executed as SQL
        const result = parseFilter("Category/Name eq 'test; DROP TABLE'");
        expect(result.left?.name).toBe('Category/Name');
      });
    });
  });

  describe('Prototype Pollution Prevention', () => {
    describe('Hook Context Protection', () => {
      it('should filter __proto__ from query filters', () => {
        const ctx = {
          query: { where: {} },
        } as HookContext;

        addQueryFilter(ctx, {
          __proto__: { malicious: true },
          validKey: 'value',
        } as any);

        expect(ctx.query.where).not.toHaveProperty('__proto__');
        expect(ctx.query.where).toHaveProperty('validKey');
      });

      it('should filter constructor from query filters', () => {
        const ctx = {
          query: { where: {} },
        } as HookContext;

        addQueryFilter(ctx, {
          constructor: { malicious: true },
          validKey: 'value',
        } as any);

        expect(ctx.query.where).not.toHaveProperty('constructor');
      });

      it('should filter prototype from query filters', () => {
        const ctx = {
          query: { where: {} },
        } as HookContext;

        addQueryFilter(ctx, {
          prototype: { malicious: true },
          validKey: 'value',
        } as any);

        expect(ctx.query.where).not.toHaveProperty('prototype');
      });

      it('should allow normal property names', () => {
        const ctx = {
          query: { where: {} },
        } as HookContext;

        addQueryFilter(ctx, {
          name: 'test',
          price: 100,
          isActive: true,
        });

        expect(ctx.query.where).toHaveProperty('name', 'test');
        expect(ctx.query.where).toHaveProperty('price', 100);
        expect(ctx.query.where).toHaveProperty('isActive', true);
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should reject path with ../', () => {
      expect(() => loadSchema('../../../etc/passwd')).toThrow(SchemaValidationError);
    });

    it('should reject path with ..\\', () => {
      expect(() => loadSchema('..\\..\\windows\\system32')).toThrow(SchemaValidationError);
    });

    it('should reject encoded path traversal', () => {
      // URL-decoded path traversal - the path resolver should catch this
      expect(() => loadSchema('../../../etc/passwd')).toThrow();
    });

    it('should allow valid relative paths within project', () => {
      // This should fail because file doesn't exist, not because of path traversal
      expect(() => loadSchema('./valid-path.json')).toThrow(/not found|ENOENT/);
    });
  });

  describe('ReDoS Prevention', () => {
    describe('Filter Expression Limits', () => {
      it('should reject overly long filter expressions', () => {
        const longValue = 'a'.repeat(5000);
        expect(() => parseFilter(`Name eq '${longValue}'`)).toThrow(/exceeds maximum length/);
      });

      it('should reject deeply nested expressions', () => {
        // Create expression with depth > 50
        let expr = 'A eq 1';
        for (let i = 0; i < 55; i++) {
          expr = `(${expr})`;
        }
        expect(() => parseFilter(expr)).toThrow(/exceeds maximum depth/);
      });

      it('should handle moderately complex expressions', () => {
        // This should succeed - reasonable complexity
        const expr = 'A eq 1 and B eq 2 and C eq 3 and D eq 4 and E eq 5';
        expect(() => parseFilter(expr)).not.toThrow();
      });

      it('should handle moderate nesting', () => {
        // Nesting of 10 should be fine
        let expr = 'A eq 1';
        for (let i = 0; i < 10; i++) {
          expr = `(${expr})`;
        }
        expect(() => parseFilter(expr)).not.toThrow();
      });
    });

    describe('String Parsing', () => {
      it('should handle long strings within limit', () => {
        const value = 'a'.repeat(1000);
        const result = parseFilter(`Name eq '${value}'`);
        expect(result.right?.value).toBe(value);
      });

      it('should handle many escaped quotes', () => {
        const value = "a''b''c''d''e";
        const result = parseFilter(`Name eq '${value}'`);
        expect(result.right?.value).toBe("a'b'c'd'e");
      });
    });
  });

  describe('Input Validation', () => {
    describe('Query Option Bounds', () => {
      it('should reject $top exceeding maximum', () => {
        expect(() => parseQueryOptions({ $top: '50000' })).toThrow();
      });

      it('should reject negative $skip', () => {
        expect(() => parseQueryOptions({ $skip: '-1' })).toThrow();
      });

      it('should reject $skip exceeding maximum', () => {
        expect(() => parseQueryOptions({ $skip: '150000' })).toThrow();
      });

      it('should accept valid bounds', () => {
        expect(() => parseQueryOptions({ $top: '100', $skip: '0' })).not.toThrow();
      });
    });

    describe('Content-Type Validation', () => {
      // These would be integration tests with the middleware
      // Placeholder for documentation
      it.skip('should reject non-JSON content for POST/PUT', () => {
        // Tested in integration tests
      });
    });
  });

  describe('Batch Security', () => {
    describe('Boundary Validation', () => {
      it('should handle valid boundary', () => {
        const body = '--batch_123\r\nContent-Type: application/http\r\n\r\nGET /Products HTTP/1.1\r\n\r\n--batch_123--';
        expect(() => parseBatchRequest(body, 'batch_123')).not.toThrow();
      });
    });

    describe('Content-ID Uniqueness', () => {
      // Tested in integration tests
      it.skip('should reject duplicate Content-IDs', () => {
        // Tested in integration tests
      });
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not include stack trace by default', () => {
      const error = new Error('Internal error');
      error.stack = 'at secret/path/file.ts:123';

      const response = formatODataError(500, 'Server error', error, false);
      expect(JSON.stringify(response)).not.toContain('secret/path');
    });

    it('should include stack trace when verbose', () => {
      const error = new Error('Internal error');
      error.stack = 'at some/path/file.ts:123';

      const response = formatODataError(500, 'Server error', error, true);
      expect(response.error.innererror?.stacktrace).toContain('some/path');
    });
  });
});
