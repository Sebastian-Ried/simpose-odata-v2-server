import { Request, Response, NextFunction } from 'express';
/**
 * Content types for OData responses
 */
export declare const CONTENT_TYPES: {
    JSON: string;
    ATOM: string;
    XML: string;
    TEXT: string;
    MULTIPART: string;
};
/**
 * Determine response format based on request
 */
export declare function getResponseFormat(req: Request): 'json' | 'atom';
/**
 * Content negotiation middleware
 */
export declare function contentNegotiation(req: Request, res: Response, next: NextFunction): void;
/**
 * Check if request accepts JSON
 */
export declare function acceptsJson(req: Request): boolean;
/**
 * Check if request accepts Atom/XML
 */
export declare function acceptsAtom(req: Request): boolean;
/**
 * Parse content type from request
 */
export declare function parseContentType(contentType: string): {
    type: string;
    parameters: Record<string, string>;
};
/**
 * Build content type with parameters
 */
export declare function buildContentType(type: string, parameters?: Record<string, string>): string;
//# sourceMappingURL=content-negotiation.d.ts.map