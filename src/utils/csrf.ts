/**
 * CSRF Protection Utility
 *
 * Implements CSRF token validation for OData services following SAP patterns:
 * - Fetch token via HEAD request with `X-CSRF-Token: Fetch`
 * - Validate token on state-changing requests (POST, PUT, MERGE, DELETE)
 * - Auto-refresh token on 403 response
 */

import * as crypto from 'crypto';

/** Default CSRF token header name */
export const DEFAULT_CSRF_HEADER = 'X-CSRF-Token';

/** Token expiry time in milliseconds (default: 30 minutes) */
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

/** Maximum tokens to store per session (prevents memory exhaustion) */
const MAX_TOKENS_PER_SESSION = 100;

/**
 * CSRF token store interface
 */
interface CsrfTokenEntry {
  token: string;
  createdAt: number;
}

/**
 * In-memory token store (per-session)
 * In production, consider using Redis or another distributed cache
 */
const tokenStore = new Map<string, CsrfTokenEntry[]>();

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get or create a session identifier from the request
 * Uses a combination of factors for session identification
 */
function getSessionId(req: {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  sessionID?: string;
  ip?: string;
}): string {
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
function cleanExpiredTokens(sessionId: string): void {
  const tokens = tokenStore.get(sessionId);
  if (!tokens) return;

  const now = Date.now();
  const validTokens = tokens.filter((t) => now - t.createdAt < TOKEN_EXPIRY_MS);

  if (validTokens.length === 0) {
    tokenStore.delete(sessionId);
  } else {
    tokenStore.set(sessionId, validTokens);
  }
}

/**
 * Store a CSRF token for a session
 */
function storeToken(sessionId: string, token: string): void {
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
function validateAndConsumeToken(sessionId: string, token: string): boolean {
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
  } else {
    tokenStore.set(sessionId, tokens);
  }

  return true;
}

/**
 * CSRF protection options
 */
export interface CsrfProtectionOptions {
  /** Header name for CSRF token (default: 'X-CSRF-Token') */
  headerName?: string;
  /** Methods that require CSRF validation */
  protectedMethods?: string[];
  /** Skip CSRF for these paths (e.g., ['/health', '/metrics']) */
  skipPaths?: string[];
  /** Whether to allow token reuse (less secure, default: false) */
  allowTokenReuse?: boolean;
}

const DEFAULT_OPTIONS: Required<CsrfProtectionOptions> = {
  headerName: DEFAULT_CSRF_HEADER,
  protectedMethods: ['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE'],
  skipPaths: [],
  allowTokenReuse: false,
};

/**
 * Create CSRF protection middleware for Express
 */
export function createCsrfProtection(options: CsrfProtectionOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return function csrfProtection(
    req: {
      method: string;
      path: string;
      headers: Record<string, string | string[] | undefined>;
      cookies?: Record<string, string>;
      sessionID?: string;
      ip?: string;
    },
    res: {
      setHeader(name: string, value: string): void;
      status(code: number): { json(body: unknown): void };
    },
    next: (err?: Error) => void
  ): void {
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
    let isValid: boolean;
    if (config.allowTokenReuse) {
      // Less secure: just check if token exists
      const tokens = tokenStore.get(sessionId);
      isValid = tokens?.some((t) => t.token === tokenHeader) || false;
    } else {
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
export function clearSessionTokens(sessionId: string): void {
  tokenStore.delete(sessionId);
}

/**
 * Get token store statistics (for monitoring)
 */
export function getCsrfStats(): { sessions: number; totalTokens: number } {
  let totalTokens = 0;
  for (const tokens of tokenStore.values()) {
    totalTokens += tokens.length;
  }
  return {
    sessions: tokenStore.size,
    totalTokens,
  };
}
