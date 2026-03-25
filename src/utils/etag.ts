import * as crypto from 'crypto';

/**
 * Hash algorithm for ETag generation
 * Using SHA-256 instead of MD5 for cryptographic security
 * MD5 is vulnerable to collision attacks
 */
const ETAG_HASH_ALGORITHM = 'sha256';

/**
 * Generate an ETag for an entity based on its timestamp fields.
 * Uses updatedAt/updated_at (or createdAt/created_at as fallback) to produce
 * a deterministic, read-consistent ETag that doesn't depend on $select,
 * $expand, or the serialization of complex fields like PostGIS geometry.
 */
export function generateETag(entity: Record<string, unknown>): string {
  const ts = entity['updatedAt'] ?? entity['updated_at']
           ?? entity['createdAt'] ?? entity['created_at'];
  const content = ts instanceof Date ? ts.toISOString() : String(ts ?? '');
  const hash = crypto.createHash(ETAG_HASH_ALGORITHM).update(content).digest('hex');
  return `W/"${hash.substring(0, 32)}"`;
}

/**
 * Validate ETag from If-Match header
 */
export function validateETag(ifMatch: string, currentETag: string): boolean {
  // Wildcard matches everything
  if (ifMatch === '*') {
    return true;
  }

  // Parse multiple ETags (comma-separated)
  const etags = ifMatch.split(',').map((e) => e.trim());

  for (const etag of etags) {
    // Compare ETags (both weak and strong comparison)
    if (compareETags(etag, currentETag)) {
      return true;
    }
  }

  return false;
}

/**
 * Check If-None-Match header for conditional GET
 */
export function checkIfNoneMatch(ifNoneMatch: string, currentETag: string): boolean {
  // Wildcard matches everything
  if (ifNoneMatch === '*') {
    return true;
  }

  // Parse multiple ETags
  const etags = ifNoneMatch.split(',').map((e) => e.trim());

  for (const etag of etags) {
    if (compareETags(etag, currentETag)) {
      return true;
    }
  }

  return false;
}

/**
 * Compare two ETags
 * Supports both weak and strong comparison
 */
function compareETags(etag1: string, etag2: string): boolean {
  // Normalize ETags (remove W/ prefix for weak comparison)
  const normalize = (etag: string) => {
    return etag.replace(/^W\//, '').replace(/^"|"$/g, '');
  };

  return normalize(etag1) === normalize(etag2);
}

/**
 * Sort object keys recursively for deterministic serialization
 */
function sortObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as object).sort();

    for (const key of keys) {
      sorted[key] = sortObject((obj as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  return obj;
}

/**
 * Generate a strong ETag (for exact byte comparison)
 * Uses SHA-256 for cryptographic security
 */
export function generateStrongETag(content: Buffer | string): string {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const hash = crypto.createHash(ETAG_HASH_ALGORITHM).update(buffer).digest('hex');
  // Use first 32 chars of SHA-256 (128 bits) for reasonable length
  return `"${hash.substring(0, 32)}"`;
}

/**
 * Check if an ETag is weak
 */
export function isWeakETag(etag: string): boolean {
  return etag.startsWith('W/');
}

/**
 * Extract ETag value without prefix and quotes
 */
export function extractETagValue(etag: string): string {
  return etag.replace(/^W\//, '').replace(/^"|"$/g, '');
}
