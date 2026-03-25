/**
 * Property-level validation utilities for OData entities.
 *
 * Provides validation rules that can be defined in the schema and applied
 * during create and update operations.
 */

import { PropertyDefinition, ODataSchemaConfig, EdmType } from '../config/types';

/**
 * Maximum size of the regex cache to prevent memory exhaustion.
 */
const MAX_REGEX_CACHE_SIZE = 100;

/**
 * Maximum allowed regex pattern length to mitigate ReDoS risk.
 */
const MAX_PATTERN_LENGTH = 500;

/**
 * Cache for compiled regex patterns to avoid recompilation on each validation.
 */
const regexCache = new Map<string, RegExp>();

/**
 * Get or create a cached regex pattern.
 * Includes protection against cache exhaustion and overly complex patterns.
 */
function getCachedRegex(pattern: string, flags?: string): RegExp | null {
  // Reject overly long patterns that could indicate ReDoS attempts
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return null;
  }

  const cacheKey = `${pattern}::${flags || ''}`;
  let regex = regexCache.get(cacheKey);
  if (!regex) {
    // Evict oldest entry if cache is full (simple FIFO eviction)
    if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
      const firstKey = regexCache.keys().next().value;
      if (firstKey) {
        regexCache.delete(firstKey);
      }
    }

    try {
      regex = new RegExp(pattern, flags);
      regexCache.set(cacheKey, regex);
    } catch {
      // Invalid regex pattern
      return null;
    }
  }
  return regex;
}

/**
 * Validation rule types
 */
export type ValidationRuleType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'min'
  | 'max'
  | 'enum'
  | 'custom';

/**
 * Validation error details
 */
export interface ValidationError {
  /** Property name that failed validation */
  property: string;
  /** Error message */
  message: string;
  /** Rule type that failed */
  rule: ValidationRuleType;
  /** The value that failed validation */
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Extended property definition with validation rules
 */
export interface ValidatedPropertyDefinition extends PropertyDefinition {
  /** Minimum string length */
  minLength?: number;
  /** Pattern for string validation (regex) */
  pattern?: string;
  /** Pattern flags (e.g., 'i' for case-insensitive) */
  patternFlags?: string;
  /** Human-readable pattern description for error messages */
  patternDescription?: string;
  /** Minimum numeric value */
  min?: number;
  /** Maximum numeric value */
  max?: number;
  /** Allowed values (enum) */
  enum?: (string | number | boolean)[];
  /** Custom validation function name (resolved at runtime) */
  customValidator?: string;
}

/**
 * Custom validator function type
 */
export type CustomValidator = (
  value: unknown,
  property: string,
  entity: Record<string, unknown>
) => string | null;

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Custom validators by name */
  customValidators?: Record<string, CustomValidator>;
  /** Whether to validate all properties or stop at first error */
  validateAll?: boolean;
  /** Whether this is an update (PATCH/PUT) - allows missing non-nullable fields */
  isUpdate?: boolean;
  /** Whether this is a partial update (MERGE/PATCH) - only validates provided fields */
  isPartialUpdate?: boolean;
}

/**
 * Validate data against entity schema.
 *
 * @param data - Data to validate
 * @param entityName - Entity name in schema
 * @param schema - OData schema configuration
 * @param options - Validation options
 * @returns Validation result with any errors
 *
 * @example
 * ```typescript
 * const result = validateEntityData(
 *   { Name: '', Price: -5 },
 *   'Product',
 *   schema
 * );
 *
 * if (!result.valid) {
 *   console.log(result.errors);
 *   // [
 *   //   { property: 'Name', message: 'Name must not be empty', rule: 'minLength' },
 *   //   { property: 'Price', message: 'Price must be at least 0', rule: 'min' }
 *   // ]
 * }
 * ```
 */
export function validateEntityData(
  data: Record<string, unknown>,
  entityName: string,
  schema: ODataSchemaConfig,
  options: ValidationOptions = {}
): ValidationResult {
  const entity = schema.entities[entityName];
  if (!entity) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = [];
  const { validateAll = true, isPartialUpdate = false, isUpdate = false, customValidators = {} } = options;

  // Validate each property defined in schema
  for (const [propName, propDef] of Object.entries(entity.properties)) {
    const extendedDef = propDef as ValidatedPropertyDefinition;
    const value = data[propName];
    const hasValue = propName in data;

    // Skip validation for properties not provided in partial updates
    if (isPartialUpdate && !hasValue) {
      continue;
    }

    // Validate the property
    const propErrors = validateProperty(
      value,
      propName,
      extendedDef,
      data,
      { isUpdate, customValidators }
    );

    errors.push(...propErrors);

    // Stop on first error if not validating all
    if (!validateAll && errors.length > 0) {
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single property value.
 */
function validateProperty(
  value: unknown,
  propName: string,
  propDef: ValidatedPropertyDefinition,
  entity: Record<string, unknown>,
  options: { isUpdate: boolean; customValidators: Record<string, CustomValidator> }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const { isUpdate, customValidators } = options;

  // Check nullable constraint (required validation)
  if (propDef.nullable === false && !isUpdate) {
    if (value === null || value === undefined) {
      errors.push({
        property: propName,
        message: `${propName} is required`,
        rule: 'required',
        value,
      });
      // If required field is missing, skip other validations
      return errors;
    }
  }

  // Skip other validations for null/undefined values (they're allowed if nullable)
  if (value === null || value === undefined) {
    return errors;
  }

  // Type-specific validations
  const edmType = propDef.type;

  // String validations
  if (isStringType(edmType) && typeof value === 'string') {
    // Min length
    if (propDef.minLength !== undefined && value.length < propDef.minLength) {
      const msg = propDef.minLength === 1
        ? `${propName} must not be empty`
        : `${propName} must be at least ${propDef.minLength} characters`;
      errors.push({
        property: propName,
        message: msg,
        rule: 'minLength',
        value,
      });
    }

    // Max length (from OData maxLength property or validation)
    const maxLen = propDef.maxLength;
    if (maxLen !== undefined && value.length > maxLen) {
      errors.push({
        property: propName,
        message: `${propName} must not exceed ${maxLen} characters`,
        rule: 'maxLength',
        value,
      });
    }

    // Pattern validation
    if (propDef.pattern) {
      const regex = getCachedRegex(propDef.pattern, propDef.patternFlags);
      if (regex && !regex.test(value)) {
        const msg = propDef.patternDescription
          ? `${propName} ${propDef.patternDescription}`
          : `${propName} has invalid format`;
        errors.push({
          property: propName,
          message: msg,
          rule: 'pattern',
          value,
        });
      }
      // If regex is null (invalid/too long pattern), skip validation silently
    }
  }

  // Numeric validations
  if (isNumericType(edmType) && typeof value === 'number') {
    // Min value
    if (propDef.min !== undefined && value < propDef.min) {
      errors.push({
        property: propName,
        message: `${propName} must be at least ${propDef.min}`,
        rule: 'min',
        value,
      });
    }

    // Max value
    if (propDef.max !== undefined && value > propDef.max) {
      errors.push({
        property: propName,
        message: `${propName} must not exceed ${propDef.max}`,
        rule: 'max',
        value,
      });
    }
  }

  // Enum validation (works for any type)
  if (propDef.enum && propDef.enum.length > 0) {
    if (!propDef.enum.includes(value as string | number | boolean)) {
      errors.push({
        property: propName,
        message: `${propName} must be one of: ${propDef.enum.join(', ')}`,
        rule: 'enum',
        value,
      });
    }
  }

  // Custom validator
  if (propDef.customValidator) {
    const validator = customValidators[propDef.customValidator];
    if (validator) {
      const errorMessage = validator(value, propName, entity);
      if (errorMessage) {
        errors.push({
          property: propName,
          message: errorMessage,
          rule: 'custom',
          value,
        });
      }
    }
  }

  return errors;
}

/**
 * Check if EDM type is a string type.
 */
function isStringType(edmType: EdmType): boolean {
  return edmType === 'Edm.String';
}

/**
 * Check if EDM type is a numeric type.
 */
function isNumericType(edmType: EdmType): boolean {
  return [
    'Edm.Byte',
    'Edm.Decimal',
    'Edm.Double',
    'Edm.Int16',
    'Edm.Int32',
    'Edm.Int64',
    'Edm.SByte',
    'Edm.Single',
  ].includes(edmType);
}

/**
 * Create a validation middleware for express routes.
 *
 * @param entityName - Entity name to validate against
 * @param schema - OData schema configuration
 * @param options - Validation options
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * app.post('/products',
 *   createValidationMiddleware('Product', schema),
 *   (req, res) => {
 *     // Request body is validated
 *   }
 * );
 * ```
 */
export function createValidationMiddleware(
  entityName: string,
  schema: ODataSchemaConfig,
  options: ValidationOptions = {}
) {
  return (
    req: { body: Record<string, unknown>; method: string },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ): void => {
    const isPartialUpdate = req.method === 'PATCH' || req.method === 'MERGE';
    const isUpdate = isPartialUpdate || req.method === 'PUT';

    const result = validateEntityData(
      req.body || {},
      entityName,
      schema,
      { ...options, isUpdate, isPartialUpdate }
    );

    if (!result.valid) {
      res.status(400).json({
        error: {
          code: '400',
          message: {
            lang: 'en',
            value: 'Validation failed',
          },
          innererror: {
            validationErrors: result.errors,
          },
        },
      });
      return;
    }

    next();
  };
}

/**
 * Format validation errors for OData error response.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'Validation failed';
  }

  if (errors.length === 1) {
    return errors[0]!.message;
  }

  return errors.map((e) => e.message).join('; ');
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  /** Email address pattern */
  EMAIL: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  /** URL pattern */
  URL: '^https?://[^\\s/$.?#].[^\\s]*$',
  /** Phone number (international) */
  PHONE: '^\\+?[1-9]\\d{1,14}$',
  /** UUID pattern */
  UUID: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  /** Alphanumeric only */
  ALPHANUMERIC: '^[a-zA-Z0-9]+$',
  /** Alphanumeric with spaces */
  ALPHANUMERIC_SPACES: '^[a-zA-Z0-9 ]+$',
  /** No special characters */
  NO_SPECIAL_CHARS: '^[a-zA-Z0-9\\s\\-_]+$',
  /** ISO date (YYYY-MM-DD) */
  ISO_DATE: '^\\d{4}-\\d{2}-\\d{2}$',
  /** Positive integer */
  POSITIVE_INTEGER: '^[1-9]\\d*$',
};
