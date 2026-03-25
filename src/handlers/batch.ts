import { Request, Response } from 'express';
import {
  ODataSchemaConfig,
  ParsedBatchRequest,
  BatchPart,
  BatchChangeset,
  BatchResponsePart,
  HookContext,
} from '../config/types';
import {
  parseBatchRequest,
  buildBatchResponse,
  generateBoundaryId,
} from '../parser/batch-parser';
import { parseQueryOptions } from '../parser/query-options';
import { parseUri } from '../parser/uri-parser';
import { ODataError, formatODataError } from '../utils/errors';
import { MAX_BATCH_SIZE } from '../config/defaults';

/** Maximum boundary length to prevent DoS */
const MAX_BOUNDARY_LENGTH = 70;

/** Allowed characters in boundary (RFC 2046) */
const BOUNDARY_REGEX = /^[\w'()+,\-./:=? ]{1,70}$/;

/**
 * Handle $batch endpoint
 */
export async function handleBatch(
  req: Request,
  res: Response,
  schema: ODataSchemaConfig,
  basePath: string,
  processRequest: (
    method: string,
    path: string,
    headers: Record<string, string>,
    body: unknown,
    contentId?: string
  ) => Promise<BatchResponsePart>,
  sequelize: any
): Promise<void> {
  // Parse content-type to get boundary
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);

  if (!boundaryMatch) {
    throw new ODataError(400, 'Missing boundary in Content-Type header');
  }

  const boundary = boundaryMatch[1]!.replace(/^["']|["']$/g, '').trim();

  // Validate boundary format and length (RFC 2046 compliance)
  if (boundary.length > MAX_BOUNDARY_LENGTH) {
    throw new ODataError(400, `Boundary exceeds maximum length of ${MAX_BOUNDARY_LENGTH} characters`);
  }

  if (!BOUNDARY_REGEX.test(boundary)) {
    throw new ODataError(400, 'Invalid boundary format');
  }

  // Get raw body
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // Parse batch request
  let batchRequest: ParsedBatchRequest;
  try {
    batchRequest = parseBatchRequest(rawBody, boundary);
  } catch (error) {
    throw new ODataError(400, `Failed to parse batch request: ${(error as Error).message}`);
  }

  // Validate batch size
  const totalParts = countBatchParts(batchRequest);
  if (totalParts > MAX_BATCH_SIZE) {
    throw new ODataError(400, `Batch request exceeds maximum size of ${MAX_BATCH_SIZE}`);
  }

  // Security: Check for duplicate Content-IDs
  const seenContentIds = new Set<string>();
  for (const part of batchRequest.parts) {
    if ('parts' in part) {
      // Changeset
      for (const subPart of part.parts) {
        if (subPart.contentId) {
          if (seenContentIds.has(subPart.contentId)) {
            throw new ODataError(400, `Duplicate Content-ID: ${subPart.contentId}`);
          }
          seenContentIds.add(subPart.contentId);
        }
      }
    } else if (part.contentId) {
      if (seenContentIds.has(part.contentId)) {
        throw new ODataError(400, `Duplicate Content-ID: ${part.contentId}`);
      }
      seenContentIds.add(part.contentId);
    }
  }

  // Process batch parts
  // Performance: Separate changesets (must be sequential) from individual requests (can be parallel)
  const responseParts: (BatchResponsePart | BatchResponsePart[])[] = [];
  const contentIdMap = new Map<string, BatchResponsePart>();

  // Group consecutive non-changeset parts for parallel processing
  let i = 0;
  while (i < batchRequest.parts.length) {
    const part = batchRequest.parts[i]!;

    if ('parts' in part) {
      // Changeset - process in transaction (must be sequential)
      const changesetResponses = await processChangeset(
        part,
        schema,
        basePath,
        processRequest,
        sequelize,
        contentIdMap
      );
      responseParts.push(changesetResponses);
      i++;
    } else {
      // Collect consecutive non-changeset requests that don't depend on each other
      const parallelParts: BatchPart[] = [];
      const parallelIndices: number[] = [];

      while (i < batchRequest.parts.length) {
        const currentPart = batchRequest.parts[i]!;
        if ('parts' in currentPart) break; // Stop at changeset

        // Check if this part references a content-ID (has dependency)
        const hasContentIdRef = currentPart.url.includes('$') ||
          (currentPart.body && JSON.stringify(currentPart.body).includes('$'));

        if (hasContentIdRef && parallelParts.length > 0) {
          // This part depends on previous - process previous batch first
          break;
        }

        parallelParts.push(currentPart);
        parallelIndices.push(i);
        i++;

        // Limit parallel batch size to avoid overwhelming the database
        if (parallelParts.length >= 10) break;
      }

      // Process non-dependent requests in parallel
      if (parallelParts.length > 1) {
        const parallelResponses = await Promise.all(
          parallelParts.map((p) =>
            processBatchPart(p, schema, basePath, processRequest, contentIdMap)
          )
        );

        // Add responses and update content-ID map
        for (let j = 0; j < parallelParts.length; j++) {
          const response = parallelResponses[j]!;
          responseParts.push(response);
          if (parallelParts[j]!.contentId) {
            contentIdMap.set(parallelParts[j]!.contentId!, response);
          }
        }
      } else if (parallelParts.length === 1) {
        // Single request - process normally
        const response = await processBatchPart(
          parallelParts[0]!,
          schema,
          basePath,
          processRequest,
          contentIdMap
        );
        responseParts.push(response);
        if (parallelParts[0]!.contentId) {
          contentIdMap.set(parallelParts[0]!.contentId, response);
        }
      }
    }
  }

  // Build response
  const responseBoundary = `batch_${generateBoundaryId()}`;
  const responseBody = buildBatchResponse(responseParts, responseBoundary);

  res.status(200)
    .header('Content-Type', `multipart/mixed; boundary=${responseBoundary}`)
    .send(responseBody);
}

/**
 * Process a changeset (transactional group of requests)
 */
async function processChangeset(
  changeset: BatchChangeset,
  schema: ODataSchemaConfig,
  basePath: string,
  processRequest: (
    method: string,
    path: string,
    headers: Record<string, string>,
    body: unknown,
    contentId?: string
  ) => Promise<BatchResponsePart>,
  sequelize: any,
  contentIdMap: Map<string, BatchResponsePart>
): Promise<BatchResponsePart[]> {
  const transaction = await sequelize.transaction();
  const responses: BatchResponsePart[] = [];
  const localContentIdMap = new Map(contentIdMap);
  let rollbackError: Error | null = null;

  try {
    for (const part of changeset.parts) {
      // Replace $contentId references in URL and body
      const resolvedPart = resolveContentIdReferences(part, localContentIdMap);

      const response = await processBatchPart(
        resolvedPart,
        schema,
        basePath,
        processRequest,
        localContentIdMap
      );

      responses.push(response);

      // Track content ID for this response
      if (part.contentId) {
        localContentIdMap.set(part.contentId, response);
      }

      // If any request fails, rollback entire changeset
      if (response.statusCode >= 400) {
        rollbackError = new Error(`Request failed with status ${response.statusCode}`);
        break;
      }
    }

    if (rollbackError) {
      throw rollbackError;
    }

    await transaction.commit();
    return responses;
  } catch (error) {
    // Ensure rollback happens even if commit fails
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      // Log but don't throw - the original error is more important
      console.error('Failed to rollback transaction:', rollbackErr);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Return error response for all parts
    return changeset.parts.map((part) => ({
      contentId: part.contentId,
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: formatODataError(500, `Changeset rolled back: ${errorMessage}`),
    }));
  }
}

/**
 * Process a single batch part
 */
async function processBatchPart(
  part: BatchPart,
  schema: ODataSchemaConfig,
  basePath: string,
  processRequest: (
    method: string,
    path: string,
    headers: Record<string, string>,
    body: unknown,
    contentId?: string
  ) => Promise<BatchResponsePart>,
  contentIdMap: Map<string, BatchResponsePart>
): Promise<BatchResponsePart> {
  try {
    // Resolve content ID references
    const resolvedPart = resolveContentIdReferences(part, contentIdMap);

    return await processRequest(
      resolvedPart.method,
      resolvedPart.url,
      resolvedPart.headers,
      resolvedPart.body,
      resolvedPart.contentId
    );
  } catch (error) {
    const statusCode = error instanceof ODataError ? error.statusCode : 500;
    const message = error instanceof ODataError ? error.message : 'Internal server error';

    return {
      contentId: part.contentId,
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: formatODataError(statusCode, message),
    };
  }
}

/** Dangerous keys that could cause prototype pollution */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Resolve $contentId references in request
 */
function resolveContentIdReferences(
  part: BatchPart,
  contentIdMap: Map<string, BatchResponsePart>
): BatchPart {
  let { url, body } = part;

  // Replace $contentId references in URL
  const urlMatch = url.match(/\$(\d+)/);
  if (urlMatch) {
    const contentId = urlMatch[1]!;
    const referencedResponse = contentIdMap.get(contentId);

    if (referencedResponse?.body) {
      // Extract entity URI from response
      const responseBody = referencedResponse.body as any;
      const entityUri = responseBody?.d?.__metadata?.uri;

      if (entityUri) {
        url = url.replace(`$${contentId}`, entityUri);
      }
    }
  }

  // Replace $contentId references in body
  if (body && typeof body === 'object') {
    // Security: Use safe JSON parse with prototype pollution guard
    const bodyStr = JSON.stringify(body);
    const replacedStr = bodyStr.replace(/"\$(\d+)"/g, (match, contentId) => {
      const referencedResponse = contentIdMap.get(contentId);
      const responseBody = referencedResponse?.body as any;
      const entityUri = responseBody?.d?.__metadata?.uri;
      return entityUri ? `"${entityUri}"` : match;
    });

    // Parse with reviver to prevent prototype pollution
    body = JSON.parse(replacedStr, (key, value) => {
      if (DANGEROUS_KEYS.includes(key)) {
        return undefined; // Skip dangerous keys
      }
      return value;
    });
  }

  return { ...part, url, body };
}

/**
 * Count total parts in batch request
 */
function countBatchParts(batchRequest: ParsedBatchRequest): number {
  let count = 0;
  for (const part of batchRequest.parts) {
    if ('parts' in part) {
      count += part.parts.length;
    } else {
      count++;
    }
  }
  return count;
}
