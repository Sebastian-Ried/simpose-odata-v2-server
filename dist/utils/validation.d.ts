/**
 * Property-level validation utilities for OData entities.
 *
 * Provides validation rules that can be defined in the schema and applied
 * during create and update operations.
 */
import { PropertyDefinition, ODataSchemaConfig } from '../config/types';
/**
 * Validation rule types
 */
export type ValidationRuleType = 'required' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'enum' | 'custom';
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
export type CustomValidator = (value: unknown, property: string, entity: Record<string, unknown>) => string | null;
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
export declare function validateEntityData(data: Record<string, unknown>, entityName: string, schema: ODataSchemaConfig, options?: ValidationOptions): ValidationResult;
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
export declare function createValidationMiddleware(entityName: string, schema: ODataSchemaConfig, options?: ValidationOptions): (req: {
    body: Record<string, unknown>;
    method: string;
}, res: {
    status: (code: number) => {
        json: (body: unknown) => void;
    };
}, next: () => void) => void;
/**
 * Format validation errors for OData error response.
 */
export declare function formatValidationErrors(errors: ValidationError[]): string;
/**
 * Common validation patterns
 */
export declare const ValidationPatterns: {
    /** Email address pattern */
    EMAIL: string;
    /** URL pattern */
    URL: string;
    /** Phone number (international) */
    PHONE: string;
    /** UUID pattern */
    UUID: string;
    /** Alphanumeric only */
    ALPHANUMERIC: string;
    /** Alphanumeric with spaces */
    ALPHANUMERIC_SPACES: string;
    /** No special characters */
    NO_SPECIAL_CHARS: string;
    /** ISO date (YYYY-MM-DD) */
    ISO_DATE: string;
    /** Positive integer */
    POSITIVE_INTEGER: string;
};
//# sourceMappingURL=validation.d.ts.map