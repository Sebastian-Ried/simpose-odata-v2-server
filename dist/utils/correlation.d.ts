import { Request } from 'express';
/**
 * Generate a UUID v4 correlation ID.
 *
 * Uses crypto.randomUUID() when available (Node.js 14.17+), with a
 * cryptographically secure fallback implementation for older environments.
 *
 * @returns A UUID v4 string (e.g., 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
 *
 * @example
 * ```typescript
 * const id = generateCorrelationId();
 * console.log(id); // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * ```
 */
export declare function generateCorrelationId(): string;
/**
 * Extract correlation ID from request headers.
 *
 * Looks for the correlation ID in the specified header (case-insensitive).
 * Returns undefined if the header is not present or empty.
 *
 * @param req - Express request object
 * @param headerName - Name of the header to extract from (default: 'x-correlation-id')
 * @returns The correlation ID if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // Request with header: x-correlation-id: abc-123
 * const id = extractCorrelationId(req, 'x-correlation-id');
 * console.log(id); // 'abc-123'
 *
 * // Request without header
 * const id = extractCorrelationId(req, 'x-correlation-id');
 * console.log(id); // undefined
 * ```
 */
export declare function extractCorrelationId(req: Request, headerName?: string): string | undefined;
/**
 * Get an existing correlation ID from request headers or generate a new one.
 *
 * This is the main helper for correlation ID handling. It first attempts to
 * extract an existing correlation ID from the request headers. If not found,
 * it generates a new UUID v4 correlation ID.
 *
 * @param req - Express request object
 * @param headerName - Name of the header to extract from (default: 'x-correlation-id')
 * @returns The existing correlation ID from headers, or a newly generated one
 *
 * @example
 * ```typescript
 * // In middleware
 * const correlationId = getOrCreateCorrelationId(req, 'x-correlation-id');
 * res.setHeader('x-correlation-id', correlationId);
 * ```
 */
export declare function getOrCreateCorrelationId(req: Request, headerName?: string): string;
/**
 * Validate that a string is a valid UUID format.
 *
 * @param id - String to validate
 * @returns true if the string is a valid UUID, false otherwise
 *
 * @example
 * ```typescript
 * isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479'); // true
 * isValidUUID('not-a-uuid'); // false
 * ```
 */
export declare function isValidUUID(id: string): boolean;
//# sourceMappingURL=correlation.d.ts.map