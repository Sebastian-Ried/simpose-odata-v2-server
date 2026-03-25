/**
 * Property-level Validation Tests
 *
 * Tests for entity data validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateEntityData,
  formatValidationErrors,
  ValidationPatterns,
  CustomValidator,
} from '../../src/utils/validation';
import { ODataSchemaConfig } from '../../src/config/types';

// Test schema with validation rules
const testSchema: ODataSchemaConfig = {
  namespace: 'TestService',
  entities: {
    Product: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: {
          type: 'Edm.String',
          nullable: false,
          maxLength: 100,
          minLength: 1,
        } as any,
        Description: {
          type: 'Edm.String',
          nullable: true,
          maxLength: 500,
        },
        Price: {
          type: 'Edm.Decimal',
          nullable: false,
          min: 0,
          max: 99999.99,
        } as any,
        Quantity: {
          type: 'Edm.Int32',
          nullable: true,
          min: 0,
        } as any,
        SKU: {
          type: 'Edm.String',
          nullable: true,
          pattern: '^[A-Z]{3}-\\d{4}$',
          patternDescription: 'must be in format XXX-0000',
        } as any,
        Email: {
          type: 'Edm.String',
          nullable: true,
          pattern: ValidationPatterns.EMAIL,
          patternDescription: 'must be a valid email address',
        } as any,
        Status: {
          type: 'Edm.String',
          nullable: true,
          enum: ['active', 'inactive', 'pending'],
        } as any,
        Rating: {
          type: 'Edm.Int32',
          nullable: true,
          min: 1,
          max: 5,
          customValidator: 'validateRating',
        } as any,
      },
    },
    Category: {
      keys: ['ID'],
      properties: {
        ID: { type: 'Edm.Int32', nullable: false },
        Name: { type: 'Edm.String', nullable: false },
      },
    },
  },
};

describe('Validation Utilities', () => {
  describe('validateEntityData', () => {
    describe('Required validation', () => {
      it('should pass when all required fields are provided', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test Product', Price: 19.99 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail when required field is missing', () => {
        const result = validateEntityData(
          { ID: 1, Price: 19.99 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({
          property: 'Name',
          rule: 'required',
        });
      });

      it('should fail when required field is null', () => {
        const result = validateEntityData(
          { ID: 1, Name: null, Price: 19.99 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]?.property).toBe('Name');
        expect(result.errors[0]?.rule).toBe('required');
      });

      it('should allow missing required fields in partial updates', () => {
        const result = validateEntityData(
          { Price: 29.99 },
          'Product',
          testSchema,
          { isPartialUpdate: true }
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('String length validation', () => {
      it('should fail when string is too short', () => {
        const result = validateEntityData(
          { ID: 1, Name: '', Price: 19.99 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({
          property: 'Name',
          rule: 'minLength',
        });
        expect(result.errors[0]?.message).toContain('must not be empty');
      });

      it('should fail when string exceeds maxLength', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'A'.repeat(101), Price: 19.99 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({
          property: 'Name',
          rule: 'maxLength',
        });
      });

      it('should pass when string is within length limits', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Valid Product Name', Price: 19.99 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Numeric range validation', () => {
      it('should fail when value is below minimum', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: -5 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({
          property: 'Price',
          rule: 'min',
        });
        expect(result.errors[0]?.message).toContain('at least 0');
      });

      it('should fail when value exceeds maximum', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 100000 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({
          property: 'Price',
          rule: 'max',
        });
        expect(result.errors[0]?.message).toContain('must not exceed');
      });

      it('should pass when value is within range', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 50000 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Pattern validation', () => {
      it('should fail when value does not match pattern', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, SKU: 'invalid' },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({
          property: 'SKU',
          rule: 'pattern',
        });
        expect(result.errors[0]?.message).toContain('XXX-0000');
      });

      it('should pass when value matches pattern', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, SKU: 'ABC-1234' },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(true);
      });

      it('should validate email pattern', () => {
        const invalidResult = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, Email: 'not-an-email' },
          'Product',
          testSchema
        );

        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.errors[0]?.property).toBe('Email');

        const validResult = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, Email: 'test@example.com' },
          'Product',
          testSchema
        );

        expect(validResult.valid).toBe(true);
      });
    });

    describe('Enum validation', () => {
      it('should fail when value is not in enum', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, Status: 'invalid' },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({
          property: 'Status',
          rule: 'enum',
        });
        expect(result.errors[0]?.message).toContain('active, inactive, pending');
      });

      it('should pass when value is in enum', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, Status: 'active' },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Custom validators', () => {
      it('should call custom validator function', () => {
        const customValidators: Record<string, CustomValidator> = {
          validateRating: (value, prop) => {
            if (typeof value === 'number' && value === 3) {
              return 'Rating of 3 is not allowed';
            }
            return null;
          },
        };

        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, Rating: 3 },
          'Product',
          testSchema,
          { customValidators }
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({
          property: 'Rating',
          rule: 'custom',
          message: 'Rating of 3 is not allowed',
        });
      });

      it('should pass when custom validator returns null', () => {
        const customValidators: Record<string, CustomValidator> = {
          validateRating: () => null,
        };

        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, Rating: 5 },
          'Product',
          testSchema,
          { customValidators }
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Nullable fields', () => {
      it('should allow null for nullable fields', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99, Description: null },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(true);
      });

      it('should allow undefined for nullable fields', () => {
        const result = validateEntityData(
          { ID: 1, Name: 'Test', Price: 19.99 },
          'Product',
          testSchema
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Multiple errors', () => {
      it('should collect all errors when validateAll is true', () => {
        const result = validateEntityData(
          { ID: 1, Name: '', Price: -5, SKU: 'invalid' },
          'Product',
          testSchema,
          { validateAll: true }
        );

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });

      it('should stop at first error when validateAll is false', () => {
        const result = validateEntityData(
          { ID: 1, Name: '', Price: -5, SKU: 'invalid' },
          'Product',
          testSchema,
          { validateAll: false }
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
      });
    });

    describe('Unknown entity', () => {
      it('should return valid for unknown entities', () => {
        const result = validateEntityData(
          { anything: 'goes' },
          'UnknownEntity',
          testSchema
        );

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('formatValidationErrors', () => {
    it('should format single error', () => {
      const errors = [{ property: 'Name', message: 'Name is required', rule: 'required' as const }];
      const formatted = formatValidationErrors(errors);

      expect(formatted).toBe('Name is required');
    });

    it('should format multiple errors', () => {
      const errors = [
        { property: 'Name', message: 'Name is required', rule: 'required' as const },
        { property: 'Price', message: 'Price must be at least 0', rule: 'min' as const },
      ];
      const formatted = formatValidationErrors(errors);

      expect(formatted).toBe('Name is required; Price must be at least 0');
    });

    it('should return default message for empty errors', () => {
      const formatted = formatValidationErrors([]);

      expect(formatted).toBe('Validation failed');
    });
  });

  describe('ValidationPatterns', () => {
    it('should have valid EMAIL pattern', () => {
      const regex = new RegExp(ValidationPatterns.EMAIL);

      expect(regex.test('test@example.com')).toBe(true);
      expect(regex.test('user.name+tag@domain.co.uk')).toBe(true);
      expect(regex.test('invalid')).toBe(false);
      expect(regex.test('@nodomain.com')).toBe(false);
    });

    it('should have valid UUID pattern', () => {
      const regex = new RegExp(ValidationPatterns.UUID);

      expect(regex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(regex.test('not-a-uuid')).toBe(false);
    });

    it('should have valid URL pattern', () => {
      const regex = new RegExp(ValidationPatterns.URL);

      expect(regex.test('https://example.com')).toBe(true);
      expect(regex.test('http://localhost:3000/path')).toBe(true);
      expect(regex.test('not-a-url')).toBe(false);
    });

    it('should have valid PHONE pattern', () => {
      const regex = new RegExp(ValidationPatterns.PHONE);

      expect(regex.test('+14155552671')).toBe(true);
      expect(regex.test('14155552671')).toBe(true);
      expect(regex.test('abc')).toBe(false);
    });
  });
});
