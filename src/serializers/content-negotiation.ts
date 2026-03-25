import { Request, Response, NextFunction } from 'express';

/**
 * Content types for OData responses
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  ATOM: 'application/atom+xml',
  XML: 'application/xml',
  TEXT: 'text/plain',
  MULTIPART: 'multipart/mixed',
};

/**
 * Determine response format based on request
 */
export function getResponseFormat(req: Request): 'json' | 'atom' {
  // Check $format query parameter
  const formatParam = req.query['$format'];
  if (formatParam === 'json') {
    return 'json';
  }
  if (formatParam === 'atom' || formatParam === 'xml') {
    return 'atom';
  }

  // Check Accept header
  const accept = req.headers.accept || '';

  if (accept.includes('application/json')) {
    return 'json';
  }

  if (accept.includes('application/atom+xml') || accept.includes('application/xml')) {
    return 'atom';
  }

  // Default to JSON for OData V2 (most clients expect JSON)
  return 'json';
}

/**
 * Content negotiation middleware
 */
export function contentNegotiation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const format = getResponseFormat(req);

  // Store format in request for later use
  (req as any).odataFormat = format;

  // Set appropriate content type
  if (format === 'json') {
    res.setHeader('Content-Type', CONTENT_TYPES.JSON + '; charset=utf-8');
  } else {
    res.setHeader('Content-Type', CONTENT_TYPES.ATOM + '; charset=utf-8');
  }

  next();
}

/**
 * Check if request accepts JSON
 */
export function acceptsJson(req: Request): boolean {
  const accept = req.headers.accept || '';
  return accept.includes('application/json') || accept.includes('*/*') || !accept;
}

/**
 * Check if request accepts Atom/XML
 */
export function acceptsAtom(req: Request): boolean {
  const accept = req.headers.accept || '';
  return accept.includes('application/atom+xml') || accept.includes('application/xml');
}

/**
 * Parse content type from request
 */
export function parseContentType(contentType: string): {
  type: string;
  parameters: Record<string, string>;
} {
  const parts = contentType.split(';').map((p) => p.trim());
  const type = parts[0] || '';
  const parameters: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const param = parts[i]!;
    const eqIndex = param.indexOf('=');
    if (eqIndex > 0) {
      const name = param.slice(0, eqIndex).trim().toLowerCase();
      let value = param.slice(eqIndex + 1).trim();
      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      parameters[name] = value;
    }
  }

  return { type: type.toLowerCase(), parameters };
}

/**
 * Build content type with parameters
 */
export function buildContentType(
  type: string,
  parameters?: Record<string, string>
): string {
  let contentType = type;

  if (parameters) {
    for (const [name, value] of Object.entries(parameters)) {
      contentType += `; ${name}=${value}`;
    }
  }

  return contentType;
}
