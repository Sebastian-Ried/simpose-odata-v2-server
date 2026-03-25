/**
 * Generate an ETag for an entity based on its timestamp fields.
 * Uses updatedAt/updated_at (or createdAt/created_at as fallback) to produce
 * a deterministic, read-consistent ETag that doesn't depend on $select,
 * $expand, or the serialization of complex fields like PostGIS geometry.
 */
export declare function generateETag(entity: Record<string, unknown>): string;
/**
 * Validate ETag from If-Match header
 */
export declare function validateETag(ifMatch: string, currentETag: string): boolean;
/**
 * Check If-None-Match header for conditional GET
 */
export declare function checkIfNoneMatch(ifNoneMatch: string, currentETag: string): boolean;
/**
 * Generate a strong ETag (for exact byte comparison)
 * Uses SHA-256 for cryptographic security
 */
export declare function generateStrongETag(content: Buffer | string): string;
/**
 * Check if an ETag is weak
 */
export declare function isWeakETag(etag: string): boolean;
/**
 * Extract ETag value without prefix and quotes
 */
export declare function extractETagValue(etag: string): string;
//# sourceMappingURL=etag.d.ts.map