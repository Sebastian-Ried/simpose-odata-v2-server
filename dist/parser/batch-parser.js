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
exports.parseBatchRequest = parseBatchRequest;
exports.buildBatchResponse = buildBatchResponse;
exports.generateBoundaryId = generateBoundaryId;
const crypto = __importStar(require("crypto"));
/**
 * Parse multipart/mixed batch request body
 */
function parseBatchRequest(body, boundary) {
    const parts = [];
    const boundaryDelimiter = `--${boundary}`;
    const endBoundary = `--${boundary}--`;
    // Split by boundary
    const sections = body.split(boundaryDelimiter);
    for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        // Check if end of batch
        if (section.trim().startsWith('--')) {
            break;
        }
        // Parse section
        const parsed = parseBatchSection(section.trim());
        if (parsed) {
            parts.push(parsed);
        }
    }
    return { parts };
}
/**
 * Parse a single batch section (either a request or a changeset)
 */
function parseBatchSection(section) {
    // Split headers from body
    const headerEndIndex = section.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
        const altIndex = section.indexOf('\n\n');
        if (altIndex === -1) {
            return null;
        }
    }
    const normalizedSection = section.replace(/\r\n/g, '\n');
    const parts = normalizedSection.split('\n\n');
    const headerPart = parts[0] || '';
    const bodyPart = parts.slice(1).join('\n\n').trim();
    // Parse headers
    const headers = parseHeaders(headerPart);
    const contentType = headers['content-type'] || '';
    // Check if this is a changeset
    if (contentType.includes('multipart/mixed')) {
        const changesetBoundary = extractBoundary(contentType);
        if (changesetBoundary) {
            return parseChangeset(bodyPart, changesetBoundary);
        }
    }
    // Parse as individual request
    return parseIndividualRequest(bodyPart, headers);
}
/**
 * Parse headers from header block
 */
function parseHeaders(headerBlock) {
    const headers = {};
    const lines = headerBlock.split('\n');
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const name = line.slice(0, colonIndex).trim().toLowerCase();
            const value = line.slice(colonIndex + 1).trim();
            headers[name] = value;
        }
    }
    return headers;
}
/**
 * Extract boundary from Content-Type header
 */
function extractBoundary(contentType) {
    const match = contentType.match(/boundary=([^;]+)/i);
    if (match) {
        return match[1].replace(/^["']|["']$/g, '').trim();
    }
    return null;
}
/**
 * Parse a changeset
 */
function parseChangeset(body, boundary) {
    const parts = [];
    const boundaryDelimiter = `--${boundary}`;
    const sections = body.split(boundaryDelimiter);
    for (let i = 1; i < sections.length; i++) {
        const section = sections[i].trim();
        if (section.startsWith('--')) {
            break;
        }
        const parsed = parseBatchSection(section);
        if (parsed && !('parts' in parsed)) {
            parts.push(parsed);
        }
    }
    return { parts };
}
/**
 * Parse an individual HTTP request from batch
 */
function parseIndividualRequest(body, outerHeaders) {
    // The body should contain the HTTP request
    const lines = body.split('\n');
    if (lines.length === 0) {
        return null;
    }
    // First line should be the request line
    const requestLine = lines[0].trim();
    const requestMatch = requestLine.match(/^(GET|POST|PUT|PATCH|MERGE|DELETE)\s+(.+?)(?:\s+HTTP\/\d\.\d)?$/i);
    if (!requestMatch) {
        return null;
    }
    const method = requestMatch[1].toUpperCase();
    const url = requestMatch[2].trim();
    // Parse request headers
    const headers = {};
    let bodyStartIndex = 1;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') {
            bodyStartIndex = i + 1;
            break;
        }
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const name = line.slice(0, colonIndex).trim().toLowerCase();
            const value = line.slice(colonIndex + 1).trim();
            headers[name] = value;
        }
    }
    // Parse body if present
    let requestBody;
    if (bodyStartIndex < lines.length) {
        const bodyStr = lines.slice(bodyStartIndex).join('\n').trim();
        if (bodyStr) {
            try {
                requestBody = JSON.parse(bodyStr);
            }
            catch {
                requestBody = bodyStr;
            }
        }
    }
    // Get content ID
    const contentId = outerHeaders['content-id'] || headers['content-id'];
    return {
        contentId,
        method,
        url,
        headers,
        body: requestBody,
    };
}
/**
 * Build batch response body
 */
function buildBatchResponse(parts, boundary) {
    const lines = [];
    for (const part of parts) {
        lines.push(`--${boundary}`);
        if (Array.isArray(part)) {
            // Changeset response
            const changesetBoundary = `changeset_${generateBoundaryId()}`;
            lines.push(`Content-Type: multipart/mixed; boundary=${changesetBoundary}`);
            lines.push('');
            for (const changesetPart of part) {
                lines.push(`--${changesetBoundary}`);
                lines.push(...buildResponsePart(changesetPart));
            }
            lines.push(`--${changesetBoundary}--`);
        }
        else {
            // Individual response
            lines.push(...buildResponsePart(part));
        }
    }
    lines.push(`--${boundary}--`);
    return lines.join('\r\n');
}
/**
 * Build a single response part
 */
function buildResponsePart(part) {
    const lines = [];
    lines.push('Content-Type: application/http');
    lines.push('Content-Transfer-Encoding: binary');
    lines.push('');
    // HTTP response line
    lines.push(`HTTP/1.1 ${part.statusCode} ${getStatusText(part.statusCode)}`);
    // Headers
    for (const [name, value] of Object.entries(part.headers)) {
        lines.push(`${name}: ${value}`);
    }
    if (part.contentId) {
        lines.push(`Content-ID: ${part.contentId}`);
    }
    // Body
    if (part.body !== undefined) {
        const bodyStr = typeof part.body === 'string' ? part.body : JSON.stringify(part.body);
        lines.push(`Content-Length: ${Buffer.byteLength(bodyStr)}`);
        lines.push('');
        lines.push(bodyStr);
    }
    else {
        lines.push('');
    }
    return lines;
}
/**
 * Generate a cryptographically secure random boundary ID
 * Uses crypto.randomBytes() instead of Math.random() for security
 */
function generateBoundaryId() {
    return crypto.randomBytes(16).toString('hex');
}
/**
 * Get HTTP status text
 */
function getStatusText(statusCode) {
    const statusTexts = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        409: 'Conflict',
        412: 'Precondition Failed',
        500: 'Internal Server Error',
    };
    return statusTexts[statusCode] || 'Unknown';
}
//# sourceMappingURL=batch-parser.js.map