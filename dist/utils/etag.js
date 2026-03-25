"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateETag = generateETag;
exports.validateETag = validateETag;
exports.checkIfNoneMatch = checkIfNoneMatch;
exports.generateStrongETag = generateStrongETag;
exports.isWeakETag = isWeakETag;
exports.extractETagValue = extractETagValue;
const crypto = __importStar(require("crypto"));
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
function generateETag(entity) {
    const ts = entity['updatedAt'] ?? entity['updated_at']
        ?? entity['createdAt'] ?? entity['created_at'];
    const content = ts instanceof Date ? ts.toISOString() : String(ts ?? '');
    const hash = crypto.createHash(ETAG_HASH_ALGORITHM).update(content).digest('hex');
    return `W/"${hash.substring(0, 32)}"`;
}
/**
 * Validate ETag from If-Match header
 */
function validateETag(ifMatch, currentETag) {
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
function checkIfNoneMatch(ifNoneMatch, currentETag) {
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
function compareETags(etag1, etag2) {
    // Normalize ETags (remove W/ prefix for weak comparison)
    const normalize = (etag) => {
        return etag.replace(/^W\//, '').replace(/^"|"$/g, '');
    };
    return normalize(etag1) === normalize(etag2);
}
/**
 * Sort object keys recursively for deterministic serialization
 */
function sortObject(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObject);
    }
    if (typeof obj === 'object') {
        const sorted = {};
        const keys = Object.keys(obj).sort();
        for (const key of keys) {
            sorted[key] = sortObject(obj[key]);
        }
        return sorted;
    }
    return obj;
}
/**
 * Generate a strong ETag (for exact byte comparison)
 * Uses SHA-256 for cryptographic security
 */
function generateStrongETag(content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const hash = crypto.createHash(ETAG_HASH_ALGORITHM).update(buffer).digest('hex');
    // Use first 32 chars of SHA-256 (128 bits) for reasonable length
    return `"${hash.substring(0, 32)}"`;
}
/**
 * Check if an ETag is weak
 */
function isWeakETag(etag) {
    return etag.startsWith('W/');
}
/**
 * Extract ETag value without prefix and quotes
 */
function extractETagValue(etag) {
    return etag.replace(/^W\//, '').replace(/^"|"$/g, '');
}
//# sourceMappingURL=etag.js.map