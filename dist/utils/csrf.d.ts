/**
 * CSRF Protection Utility
 *
 * Implements CSRF token validation for OData services following SAP patterns:
 * - Fetch token via HEAD request with `X-CSRF-Token: Fetch`
 * - Validate token on state-changing requests (POST, PUT, MERGE, DELETE)
 * - Auto-refresh token on 403 response
 */
/** Default CSRF token header name */
export declare const DEFAULT_CSRF_HEADER = "X-CSRF-Token";
/**
 * Generate a cryptographically secure CSRF token
 */
export declare function generateCsrfToken(): string;
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
/**
 * Create CSRF protection middleware for Express
 */
export declare function createCsrfProtection(options?: CsrfProtectionOptions): (req: {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
    sessionID?: string;
    ip?: string;
}, res: {
    setHeader(name: string, value: string): void;
    status(code: number): {
        json(body: unknown): void;
    };
}, next: (err?: Error) => void) => void;
/**
 * Clear all tokens for a session (call on logout)
 */
export declare function clearSessionTokens(sessionId: string): void;
/**
 * Get token store statistics (for monitoring)
 */
export declare function getCsrfStats(): {
    sessions: number;
    totalTokens: number;
};
//# sourceMappingURL=csrf.d.ts.map