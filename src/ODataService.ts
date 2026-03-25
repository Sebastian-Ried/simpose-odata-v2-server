import { Request, Response, NextFunction } from 'express';
import { Model, ModelStatic, Sequelize } from 'sequelize';
import {
  ODataSchemaConfig,
  ODataMiddlewareOptions,
  ParsedQuery,
  FunctionImportHandler,
  EntityHooks,
  BatchResponsePart,
} from './config/types';
import { loadSchema } from './config/schema-loader';
import { defaults, ODATA_VERSION } from './config/defaults';
import { MetadataGenerator } from './metadata/generator';
import { QueryBuilder } from './query/query-builder';
import { BaseHandler, DefaultHandler } from './handlers/base-handler';
import { HookRegistry } from './hooks/hook-registry';
import { parseUri } from './parser/uri-parser';
import { parseQueryOptions } from './parser/query-options';
import { handleRead, handleCount, handleNavigationRead, handlePropertyValue } from './handlers/crud/read';
import { handleCreate, handleNavigationCreate } from './handlers/crud/create';
import { handleUpdate, handleMerge, handleCreateLink, handleDeleteLink } from './handlers/crud/update';
import { handleDelete } from './handlers/crud/delete';
import { handleMetadata, handleServiceDocument } from './handlers/metadata';
import { handleBatch } from './handlers/batch';
import { handleFunctionImport, parseFunctionImportParams } from './handlers/function-import';
import { ODataError, createErrorHandler, formatODataError } from './utils/errors';
import { contentNegotiation } from './serializers/content-negotiation';

/**
 * OData Service - Core orchestrator for OData operations
 */
export class ODataService {
  private schema: ODataSchemaConfig;
  private models: Record<string, ModelStatic<Model>>;
  private sequelize: Sequelize;
  private metadataGenerator: MetadataGenerator;
  private queryBuilder: QueryBuilder;
  private hookRegistry: HookRegistry;
  private handlers: Map<string, BaseHandler> = new Map();
  private functionImports: Record<string, FunctionImportHandler>;
  private basePath: string;
  private verboseErrors: boolean;

  constructor(options: ODataMiddlewareOptions) {
    // Load and validate schema
    this.schema = loadSchema(options.schema);
    this.models = options.models;
    this.sequelize = options.sequelize;
    this.basePath = options.basePath || '';
    this.verboseErrors = options.verboseErrors ?? defaults.verboseErrors;
    this.functionImports = options.functionImports || {};

    // Initialize metadata generator
    this.metadataGenerator = new MetadataGenerator(
      this.schema,
      this.models,
      this.basePath
    );

    // Promote the enriched schema (auto-detected Sequelize attributes included)
    // so that $metadata and all query/serialization logic share the same property set.
    // Without this, auto-detected attributes appear in $metadata but are never fetched,
    // causing UI5 OData model warnings like "No data loaded for select property: created_at".
    this.schema = this.metadataGenerator.getEnrichedSchema();

    // Initialize query builder
    this.queryBuilder = new QueryBuilder(
      this.schema,
      this.models,
      this.sequelize
    );

    // Initialize hook registry
    this.hookRegistry = new HookRegistry();

    // Register hooks
    if (options.hooks) {
      for (const [entityName, hooks] of Object.entries(options.hooks)) {
        this.hookRegistry.register(entityName, hooks);
      }
    }

    // Initialize handlers
    this.initializeHandlers(options.handlers);
  }

  /**
   * Initialize entity handlers
   */
  private initializeHandlers(
    customHandlers?: Record<string, new () => any>
  ): void {
    for (const entityName of Object.keys(this.schema.entities)) {
      const entityDef = this.schema.entities[entityName]!;
      const modelName = entityDef.model || entityName;
      const model = this.models[modelName];

      if (!model) {
        console.warn(`No model found for entity ${entityName}`);
        continue;
      }

      const hooks = this.hookRegistry.get(entityName);

      // Check for custom handler
      if (customHandlers?.[entityName]) {
        const CustomHandler = customHandlers[entityName]!;
        const handler = new CustomHandler();
        handler.initialize?.(model, entityName, this.schema);
        this.handlers.set(entityName, handler);
      } else {
        // Use default handler
        const handler = new DefaultHandler(
          model,
          entityName,
          this.schema,
          this.queryBuilder,
          this.sequelize,
          hooks
        );
        this.handlers.set(entityName, handler);
      }
    }
  }

  /**
   * Get handler for entity
   */
  getHandler(entityName: string): BaseHandler | undefined {
    return this.handlers.get(entityName);
  }

  /**
   * Process an OData request
   */
  async processRequest(req: Request, res: Response): Promise<void> {
    // Set OData headers
    res.setHeader('DataServiceVersion', ODATA_VERSION);
    res.setHeader('OData-Version', ODATA_VERSION);

    // Get the path relative to the mount point
    const path = req.path;

    // Parse URI
    const segments = parseUri(path, this.schema);

    // Handle empty path (service document)
    if (segments.length === 0 || path === '/') {
      await handleServiceDocument(req, res, this.schema, this.basePath);
      return;
    }

    // Parse query options
    const queryOptions = parseQueryOptions(req.query as Record<string, string>);

    // Handle based on first segment
    const firstSegment = segments[0]!;

    switch (firstSegment.type) {
      case '$metadata':
        await handleMetadata(req, res, this.metadataGenerator);
        break;

      case '$batch':
        await this.handleBatchRequest(req, res);
        break;

      case 'entitySet':
        await this.handleEntitySetRequest(req, res, firstSegment.name, segments, queryOptions);
        break;

      case 'entity':
        await this.handleEntityRequest(
          req,
          res,
          firstSegment.name,
          firstSegment.keys!,
          segments,
          queryOptions
        );
        break;

      case 'functionImport':
        await this.handleFunctionImportRequest(
          req,
          res,
          firstSegment.name,
          firstSegment.keys || {},
          queryOptions
        );
        break;

      default:
        throw new ODataError(404, `Resource not found: ${path}`);
    }
  }

  /**
   * Handle entity set request
   */
  private async handleEntitySetRequest(
    req: Request,
    res: Response,
    entityName: string,
    segments: any[],
    query: ParsedQuery
  ): Promise<void> {
    const handler = this.getHandler(entityName);
    if (!handler) {
      throw new ODataError(404, `Entity set ${entityName} not found`);
    }

    // Check for $count segment
    if (segments.length > 1 && segments[1]?.type === '$count') {
      await handleCount(req, res, handler, entityName, this.schema, query, this.models);
      return;
    }

    switch (req.method) {
      case 'GET':
        await handleRead(
          req,
          res,
          handler,
          entityName,
          undefined,
          this.schema,
          query,
          this.basePath,
          this.models
        );
        break;

      case 'POST':
        await handleCreate(
          req,
          res,
          handler,
          entityName,
          this.schema,
          query,
          this.basePath,
          this.models
        );
        break;

      default:
        throw new ODataError(405, `Method ${req.method} not allowed on entity set`);
    }
  }

  /**
   * Handle single entity request
   */
  private async handleEntityRequest(
    req: Request,
    res: Response,
    entityName: string,
    keys: Record<string, unknown>,
    segments: any[],
    query: ParsedQuery
  ): Promise<void> {
    const handler = this.getHandler(entityName);
    if (!handler) {
      throw new ODataError(404, `Entity ${entityName} not found`);
    }

    // Check for navigation or property segments
    if (segments.length > 1) {
      const secondSegment = segments[1]!;

      if (secondSegment.type === 'navigation') {
        await this.handleNavigationRequest(
          req,
          res,
          handler,
          entityName,
          keys,
          secondSegment.name,
          segments.slice(2),
          query
        );
        return;
      }

      if (secondSegment.type === 'property') {
        if (segments.length > 2 && segments[2]?.type === 'value') {
          await handlePropertyValue(
            req,
            res,
            handler,
            entityName,
            keys,
            secondSegment.name,
            this.schema,
            query,
            this.models
          );
          return;
        }
        // Return just the property value wrapped in OData format
        throw new ODataError(501, 'Property access not yet implemented');
      }

      if (secondSegment.type === '$count') {
        throw new ODataError(400, '$count is not valid on single entity');
      }

      if (secondSegment.name === '$links') {
        await this.handleLinksRequest(req, res, handler, entityName, keys, segments.slice(2), query);
        return;
      }
    }

    // Standard entity operations
    switch (req.method) {
      case 'GET':
        await handleRead(
          req,
          res,
          handler,
          entityName,
          keys,
          this.schema,
          query,
          this.basePath,
          this.models
        );
        break;

      case 'PUT':
        await handleUpdate(
          req,
          res,
          handler,
          entityName,
          keys,
          this.schema,
          query,
          this.basePath,
          this.models
        );
        break;

      case 'PATCH':
      case 'MERGE':
        await handleMerge(
          req,
          res,
          handler,
          entityName,
          keys,
          this.schema,
          query,
          this.basePath,
          this.models
        );
        break;

      case 'DELETE':
        await handleDelete(
          req,
          res,
          handler,
          entityName,
          keys,
          this.schema,
          query,
          this.models
        );
        break;

      default:
        throw new ODataError(405, `Method ${req.method} not allowed`);
    }
  }

  /**
   * Handle navigation property request
   */
  private async handleNavigationRequest(
    req: Request,
    res: Response,
    handler: BaseHandler,
    entityName: string,
    keys: Record<string, unknown>,
    navigationProperty: string,
    remainingSegments: any[],
    query: ParsedQuery
  ): Promise<void> {
    switch (req.method) {
      case 'GET':
        await handleNavigationRead(
          req,
          res,
          handler,
          entityName,
          keys,
          navigationProperty,
          this.schema,
          query,
          this.basePath,
          this.models
        );
        break;

      case 'POST':
        await handleNavigationCreate(
          req,
          res,
          handler,
          entityName,
          keys,
          navigationProperty,
          this.schema,
          query,
          this.basePath,
          this.models,
          Object.fromEntries(this.handlers)
        );
        break;

      default:
        throw new ODataError(405, `Method ${req.method} not allowed on navigation property`);
    }
  }

  /**
   * Handle $links request
   */
  private async handleLinksRequest(
    req: Request,
    res: Response,
    handler: BaseHandler,
    entityName: string,
    keys: Record<string, unknown>,
    segments: any[],
    query: ParsedQuery
  ): Promise<void> {
    if (segments.length === 0) {
      throw new ODataError(400, 'Navigation property required for $links');
    }

    const navigationProperty = segments[0]!.name;
    const targetKeys = segments[0]!.keys;

    switch (req.method) {
      case 'POST':
        await handleCreateLink(
          req,
          res,
          handler,
          entityName,
          keys,
          navigationProperty,
          this.schema,
          this.models,
          this.sequelize
        );
        break;

      case 'DELETE':
        await handleDeleteLink(
          req,
          res,
          handler,
          entityName,
          keys,
          navigationProperty,
          targetKeys,
          this.schema,
          this.models
        );
        break;

      default:
        throw new ODataError(405, `Method ${req.method} not allowed on $links`);
    }
  }

  /**
   * Handle function import request
   */
  private async handleFunctionImportRequest(
    req: Request,
    res: Response,
    functionName: string,
    urlParams: Record<string, unknown>,
    query: ParsedQuery
  ): Promise<void> {
    const funcDef = this.schema.functionImports?.[functionName];
    if (!funcDef) {
      throw new ODataError(404, `Function import ${functionName} not found`);
    }

    const params = parseFunctionImportParams(
      urlParams,
      req.query as Record<string, string>,
      funcDef
    );

    await handleFunctionImport(
      req,
      res,
      functionName,
      this.schema,
      this.basePath,
      this.models,
      this.functionImports,
      params
    );
  }

  /**
   * Handle batch request
   */
  private async handleBatchRequest(req: Request, res: Response): Promise<void> {
    await handleBatch(
      req,
      res,
      this.schema,
      this.basePath,
      async (method, path, headers, body, contentId) => {
        return this.processBatchPart(method, path, headers, body, contentId);
      },
      this.sequelize
    );
  }

  /**
   * Process a single batch part
   */
  private async processBatchPart(
    method: string,
    path: string,
    headers: Record<string, string>,
    body: unknown,
    contentId?: string
  ): Promise<BatchResponsePart> {
    // Create mock request/response for batch processing
    const mockReq: any = {
      method,
      path,
      url: path,
      headers,
      body,
      query: this.parseQueryString(path),
    };

    const responseData: {
      statusCode: number;
      headers: Record<string, string>;
      body: unknown;
    } = {
      statusCode: 200,
      headers: {},
      body: undefined,
    };

    const mockRes: any = {
      status: (code: number) => {
        responseData.statusCode = code;
        return mockRes;
      },
      header: (name: string, value: string) => {
        responseData.headers[name] = value;
        return mockRes;
      },
      setHeader: (name: string, value: string) => {
        responseData.headers[name] = value;
        return mockRes;
      },
      json: (data: unknown) => {
        responseData.body = data;
        responseData.headers['Content-Type'] = 'application/json';
        return mockRes;
      },
      send: (data?: unknown) => {
        if (data !== undefined) {
          responseData.body = data;
        }
        return mockRes;
      },
      type: (type: string) => {
        responseData.headers['Content-Type'] = type;
        return mockRes;
      },
    };

    try {
      await this.processRequest(mockReq, mockRes);
    } catch (err) {
      const error = err as Error;
      const statusCode = error instanceof ODataError ? error.statusCode : 500;
      const message = error instanceof ODataError ? error.message : 'Internal server error';
      responseData.statusCode = statusCode;
      responseData.body = formatODataError(statusCode, message);
      responseData.headers['Content-Type'] = 'application/json';
    }

    return {
      contentId,
      statusCode: responseData.statusCode,
      headers: responseData.headers,
      body: responseData.body,
    };
  }

  /**
   * Parse query string from URL
   */
  private parseQueryString(url: string): Record<string, string> {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) {
      return {};
    }

    const queryString = url.slice(queryIndex + 1);
    const query: Record<string, string> = {};

    for (const pair of queryString.split('&')) {
      const [key, value] = pair.split('=');
      if (key) {
        try {
          query[decodeURIComponent(key)] = decodeURIComponent(value || '');
        } catch {
          // Invalid URI encoding - skip this parameter
          throw new ODataError(400, `Invalid encoding in query parameter: ${key}`);
        }
      }
    }

    return query;
  }

  /**
   * Get the schema
   */
  getSchema(): ODataSchemaConfig {
    return this.schema;
  }

  /**
   * Invalidate metadata cache
   */
  invalidateMetadataCache(): void {
    this.metadataGenerator.invalidateCache();
  }
}
