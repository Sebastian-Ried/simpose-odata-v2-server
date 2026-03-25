import { ParsedBatchRequest, BatchResponsePart } from '../config/types';
/**
 * Parse multipart/mixed batch request body
 */
export declare function parseBatchRequest(body: string, boundary: string): ParsedBatchRequest;
/**
 * Build batch response body
 */
export declare function buildBatchResponse(parts: (BatchResponsePart | BatchResponsePart[])[], boundary: string): string;
/**
 * Generate a cryptographically secure random boundary ID
 * Uses crypto.randomBytes() instead of Math.random() for security
 */
export declare function generateBoundaryId(): string;
//# sourceMappingURL=batch-parser.d.ts.map