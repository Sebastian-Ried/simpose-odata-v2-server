/**
 * Filter Translator Tests
 *
 * Tests for translating OData $filter AST to Sequelize WHERE clauses
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Sequelize, Op } from 'sequelize';
import { parseFilter } from '../../src/parser/filter-parser';
import { translateFilter } from '../../src/query/filter-translator';
import { ODataSchemaConfig } from '../../src/config/types';

describe('Filter Translator', () => {
  let sequelize: Sequelize;
  const schema: ODataSchemaConfig = {
    namespace: 'Test',
    entities: {
      Products: {
        keys: ['ID'],
        properties: {
          ID: { type: 'Edm.Int32' },
          Name: { type: 'Edm.String' },
          Price: { type: 'Edm.Decimal' },
          Stock: { type: 'Edm.Int32' },
          IsActive: { type: 'Edm.Boolean' },
          CreatedAt: { type: 'Edm.DateTime' },
        },
        navigationProperties: {
          Category: {
            target: 'Categories',
            relationship: 'ProductCategory',
            multiplicity: '0..1',
          },
        },
      },
      Categories: {
        keys: ['ID'],
        properties: {
          ID: { type: 'Edm.Int32' },
          Name: { type: 'Edm.String' },
        },
      },
    },
  };

  beforeAll(async () => {
    sequelize = new Sequelize('sqlite::memory:', { logging: false });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Arithmetic Operations', () => {
    it('should translate add operation in filter', () => {
      const filter = parseFilter('Price add 10 gt 100');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      // Should produce a literal SQL expression
      expect(where).toBeDefined();
      // The result should be a Sequelize literal containing the arithmetic
      expect(JSON.stringify(where)).toContain('+');
    });

    it('should translate sub operation in filter', () => {
      const filter = parseFilter('Price sub 10 lt 50');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      expect(JSON.stringify(where)).toContain('-');
    });

    it('should translate mul operation in filter', () => {
      const filter = parseFilter('Stock mul Price gt 1000');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      expect(JSON.stringify(where)).toContain('*');
    });

    it('should translate div operation in filter', () => {
      const filter = parseFilter('Price div 2 eq 50');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      expect(JSON.stringify(where)).toContain('/');
    });

    it('should translate mod operation in filter', () => {
      const filter = parseFilter('ID mod 2 eq 0');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      expect(JSON.stringify(where)).toContain('%');
    });

    it('should handle complex arithmetic expressions', () => {
      const filter = parseFilter('Price mul 2 add 10 gt 100');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      // Should contain both * and +
      const json = JSON.stringify(where);
      expect(json).toContain('*');
      expect(json).toContain('+');
    });

    it('should handle arithmetic on both sides of comparison', () => {
      const filter = parseFilter('Price add 10 gt Stock mul 2');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      const json = JSON.stringify(where);
      expect(json).toContain('+');
      expect(json).toContain('*');
    });

    it('should translate arithmetic with literal on right side', () => {
      // When right side has arithmetic with literals
      const filter = parseFilter('Price gt 10 add 5');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      // Should produce valid SQL - either evaluated or as expression
      const json = JSON.stringify(where);
      // The expression should contain either the evaluated result (15) or the + operator
      expect(json.includes('15') || json.includes('+')).toBe(true);
    });
  });

  describe('Comparison Operations', () => {
    it('should translate eq operator', () => {
      const filter = parseFilter("Name eq 'Test'");
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Name');
      expect(where.Name[Op.eq]).toBe('Test');
    });

    it('should translate ne operator', () => {
      const filter = parseFilter("Name ne 'Test'");
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Name');
      expect(where.Name[Op.ne]).toBe('Test');
    });

    it('should translate gt operator', () => {
      const filter = parseFilter('Price gt 100');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Price');
      expect(where.Price[Op.gt]).toBe(100);
    });

    it('should translate ge operator', () => {
      const filter = parseFilter('Price ge 100');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Price');
      expect(where.Price[Op.gte]).toBe(100);
    });

    it('should translate lt operator', () => {
      const filter = parseFilter('Price lt 100');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Price');
      expect(where.Price[Op.lt]).toBe(100);
    });

    it('should translate le operator', () => {
      const filter = parseFilter('Price le 100');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Price');
      expect(where.Price[Op.lte]).toBe(100);
    });
  });

  describe('Logical Operations', () => {
    it('should translate and operator', () => {
      const filter = parseFilter('Price gt 10 and Price lt 100');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where[Op.and]).toBeDefined();
      expect(Array.isArray(where[Op.and])).toBe(true);
    });

    it('should translate or operator', () => {
      const filter = parseFilter("Name eq 'A' or Name eq 'B'");
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where[Op.or]).toBeDefined();
      expect(Array.isArray(where[Op.or])).toBe(true);
    });

    it('should translate not operator', () => {
      const filter = parseFilter('not IsActive');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where[Op.not]).toBeDefined();
    });
  });

  describe('String Functions', () => {
    it('should translate substringof function', () => {
      const filter = parseFilter("substringof('test', Name)");
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Name');
      expect(where.Name[Op.iLike]).toBe('%test%');
    });

    it('should translate startswith function', () => {
      const filter = parseFilter("startswith(Name, 'A')");
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Name');
      expect(where.Name[Op.iLike]).toBe('A%');
    });

    it('should translate endswith function', () => {
      const filter = parseFilter("endswith(Name, 'Z')");
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Name');
      expect(where.Name[Op.iLike]).toBe('%Z');
    });
  });

  describe('Function Comparisons', () => {
    it('should translate length function with comparison', () => {
      const filter = parseFilter('length(Name) gt 5');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
    });

    it('should translate tolower function with comparison', () => {
      const filter = parseFilter("tolower(Name) eq 'test'");
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
    });

    it('should translate year function with comparison', () => {
      const filter = parseFilter('year(CreatedAt) eq 2024');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
    });
  });

  describe('Unary Operations', () => {
    it('should translate negative numbers', () => {
      const filter = parseFilter('Price gt -10');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where).toHaveProperty('Price');
      expect(where.Price[Op.gt]).toBe(-10);
    });
  });

  describe('Complex Expressions', () => {
    it('should handle arithmetic combined with logical operators', () => {
      const filter = parseFilter('Price add 10 gt 100 and Stock mul 2 lt 50');
      const where = translateFilter(filter, 'Products', schema, sequelize) as any;

      expect(where[Op.and]).toBeDefined();
      expect(Array.isArray(where[Op.and])).toBe(true);
    });

    it('should handle arithmetic with functions', () => {
      const filter = parseFilter('round(Price) add 10 gt 100');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
    });

    it('should handle nested arithmetic in parentheses', () => {
      const filter = parseFilter('(Price add 10) mul 2 gt 200');
      const where = translateFilter(filter, 'Products', schema, sequelize);

      expect(where).toBeDefined();
      const json = JSON.stringify(where);
      expect(json).toContain('+');
      expect(json).toContain('*');
    });
  });
});
