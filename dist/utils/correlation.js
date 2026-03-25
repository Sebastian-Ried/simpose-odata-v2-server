"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = generateCorrelationId;
exports.extractCorrelationId = extractCorrelationId;
exports.getOrCreateCorrelationId = getOrCreateCorrelationId;
exports.isValidUUID = isValidUUID;
const crypto_1 = require("crypto");
/** Maximum length for correlation IDs to prevent abuse */
const MAX_CORRELATION_ID_LENGTH = 128;
/** Pattern for allowed correlation ID characters (alphanumeric, hyphens, underscores) */
const SAFE_CORRELATION_ID_PATTERN = /^[a-zA-Z0-9\-_]+$/;
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
function generateCorrelationId() {
    // Use crypto.randomUUID if available (Node.js 14.17+)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Cryptographically secure fallback using Node.js crypto module
    const bytes = (0, crypto_1.randomBytes)(16);
    // Set version (4) and variant (8, 9, A, or B)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/**
 * Sanitize a correlation ID to prevent log injection attacks.
 *
 * @param id - The correlation ID to sanitize
 * @returns Sanitized correlation ID, or undefined if invalid
 */
function sanitizeCorrelationId(id) {
    if (!id) {
        return undefined;
    }
    // Truncate overly long IDs
    if (id.length > MAX_CORRELATION_ID_LENGTH) {
        id = id.slice(0, MAX_CORRELATION_ID_LENGTH);
    }
    // Only allow safe characters to prevent log injection
    if (!SAFE_CORRELATION_ID_PATTERN.test(id)) {
        // Remove unsafe characters
        id = id.replace(/[^a-zA-Z0-9\-_]/g, '');
    }
    return id || undefined;
}
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
function extractCorrelationId(req, headerName = 'x-correlation-id') {
    const headerValue = req.headers[headerName.toLowerCase()];
    // Handle array of header values (take first one)
    let rawValue;
    if (Array.isArray(headerValue)) {
        rawValue = headerValue[0] || undefined;
    }
    else {
        rawValue = headerValue || undefined;
    }
    // Sanitize to prevent log injection attacks
    return sanitizeCorrelationId(rawValue);
}
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
function getOrCreateCorrelationId(req, headerName = 'x-correlation-id') {
    const existing = extractCorrelationId(req, headerName);
    return existing || generateCorrelationId();
}
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
function isValidUUID(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
//# sourceMappingURL=correlation.js.map