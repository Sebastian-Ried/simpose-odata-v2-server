"use strict";
/**
 * CSRF Protection Utility
 *
 * Implements CSRF token validation for OData services following SAP patterns:
 * - Fetch token via HEAD request with `X-CSRF-Token: Fetch`
 * - Validate token on state-changing requests (POST, PUT, MERGE, DELETE)
 * - Auto-refresh token on 403 response
 */
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
exports.DEFAULT_CSRF_HEADER = void 0;
exports.generateCsrfToken = generateCsrfToken;
exports.createCsrfProtection = createCsrfProtection;
exports.clearSessionTokens = clearSessionTokens;
exports.getCsrfStats = getCsrfStats;
const crypto = __importStar(require("crypto"));
/** Default CSRF token header name */
exports.DEFAULT_CSRF_HEADER = 'X-CSRF-Token';
/** Token expiry time in milliseconds (default: 30 minutes) */
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;
/** Maximum tokens to store per session (prevents memory exhaustion) */
const MAX_TOKENS_PER_SESSION = 100;
/**
 * In-memory token store (per-session)
 * In production, consider using Redis or another distributed cache
 */
const tokenStore = new Map();
/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}
/**
 * Get or create a session identifier from the request
 * Uses a combination of factors for session identification
 */
function getSessionId(req) {
    // Prefer explicit session ID if available
    if (req.sessionID) {
        return req.sessionID;
    }
    // Fall back to cookie-based session
    const sessionCookie = req.cookies?.['session'] || req.cookies?.['connect.sid'];
    if (sessionCookie) {
        return crypto.createHash('sha256').update(sessionCookie).digest('hex').substring(0, 32);
    }
    // Last resort: use IP + User-Agent hash (less secure, but provides some protection)
    const ua = Array.isArray(req.headers?.['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers?.['user-agent'] || '';
    const ip = req.ip || '127.0.0.1';
    return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 32);
}
/**
 * Clean expired tokens from a session
 */
function cleanExpiredTokens(sessionId) {
    const tokens = tokenStore.get(sessionId);
    if (!tokens)
        return;
    const now = Date.now();
    const validTokens = tokens.filter((t) => now - t.createdAt < TOKEN_EXPIRY_MS);
    if (validTokens.length === 0) {
        tokenStore.delete(sessionId);
    }
    else {
        tokenStore.set(sessionId, validTokens);
    }
}
/**
 * Store a CSRF token for a session
 */
function storeToken(sessionId, token) {
    cleanExpiredTokens(sessionId);
    const tokens = tokenStore.get(sessionId) || [];
    // Prevent memory exhaustion
    if (tokens.length >= MAX_TOKENS_PER_SESSION) {
        // Remove oldest tokens
        tokens.splice(0, tokens.length - MAX_TOKENS_PER_SESSION + 1);
    }
    tokens.push({ token, createdAt: Date.now() });
    tokenStore.set(sessionId, tokens);
}
/**
 * Validate and consume a CSRF token
 * Tokens are single-use to prevent replay attacks
 */
function validateAndConsumeToken(sessionId, token) {
    cleanExpiredTokens(sessionId);
    const tokens = tokenStore.get(sessionId);
    if (!tokens || tokens.length === 0) {
        return false;
    }
    const index = tokens.findIndex((t) => t.token === token);
    if (index === -1) {
        return false;
    }
    // Remove the used token (single-use)
    tokens.splice(index, 1);
    if (tokens.length === 0) {
        tokenStore.delete(sessionId);
    }
    else {
        tokenStore.set(sessionId, tokens);
    }
    return true;
}
const DEFAULT_OPTIONS = {
    headerName: exports.DEFAULT_CSRF_HEADER,
    protectedMethods: ['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE'],
    skipPaths: [],
    allowTokenReuse: false,
};
/**
 * Create CSRF protection middleware for Express
 */
function createCsrfProtection(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    return function csrfProtection(req, res, next) {
        const headerValue = req.headers[config.headerName.toLowerCase()];
        const tokenHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        // Skip paths that don't need CSRF
        if (config.skipPaths.some((p) => req.path.startsWith(p))) {
            next();
            return;
        }
        // Handle token fetch request (HEAD or GET with 'Fetch' header)
        if (tokenHeader?.toLowerCase() === 'fetch') {
            const sessionId = getSessionId(req);
            const token = generateCsrfToken();
            storeToken(sessionId, token);
            res.setHeader(config.headerName, token);
            next();
            return;
        }
        // Check if this method requires CSRF protection
        if (!config.protectedMethods.includes(req.method.toUpperCase())) {
            next();
            return;
        }
        // Validate CSRF token for protected methods
        if (!tokenHeader) {
            res.status(403).json({
                error: {
                    code: 'CSRF_TOKEN_MISSING',
                    message: {
                        lang: 'en',
                        value: 'CSRF token is required for this operation',
                    },
                },
            });
            return;
        }
        // Special case: 'Required' is returned by SAP systems when token is needed
        if (tokenHeader.toLowerCase() === 'required') {
            res.status(403).json({
                error: {
                    code: 'CSRF_TOKEN_REQUIRED',
                    message: {
                        lang: 'en',
                        value: 'CSRF token validation failed. Please fetch a new token.',
                    },
                },
            });
            return;
        }
        const sessionId = getSessionId(req);
        // Validate the token
        let isValid;
        if (config.allowTokenReuse) {
            // Less secure: just check if token exists
            const tokens = tokenStore.get(sessionId);
            isValid = tokens?.some((t) => t.token === tokenHeader) || false;
        }
        else {
            // More secure: single-use tokens
            isValid = validateAndConsumeToken(sessionId, tokenHeader);
        }
        if (!isValid) {
            // Return 403 with 'Required' header to signal client needs new token
            res.setHeader(config.headerName, 'Required');
            res.status(403).json({
                error: {
                    code: 'CSRF_TOKEN_INVALID',
                    message: {
                        lang: 'en',
                        value: 'CSRF token is invalid or expired. Please fetch a new token.',
                    },
                },
            });
            return;
        }
        next();
    };
}
/**
 * Clear all tokens for a session (call on logout)
 */
function clearSessionTokens(sessionId) {
    tokenStore.delete(sessionId);
}
/**
 * Get token store statistics (for monitoring)
 */
function getCsrfStats() {
    let totalTokens = 0;
    for (const tokens of tokenStore.values()) {
        totalTokens += tokens.length;
    }
    return {
        sessions: tokenStore.size,
        totalTokens,
    };
}
//# sourceMappingURL=csrf.js.map