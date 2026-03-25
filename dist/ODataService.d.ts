import { Request, Response } from 'express';
import { ODataSchemaConfig, ODataMiddlewareOptions } from './config/types';
import { BaseHandler } from './handlers/base-handler';
/**
 * OData Service - Core orchestrator for OData operations
 */
export declare class ODataService {
    private schema;
    private models;
    private sequelize;
    private metadataGenerator;
    private queryBuilder;
    private hookRegistry;
    private handlers;
    private functionImports;
    private basePath;
    private verboseErrors;
    constructor(options: ODataMiddlewareOptions);
    /**
     * Initialize entity handlers
     */
    private initializeHandlers;
    /**
     * Get handler for entity
     */
    getHandler(entityName: string): BaseHandler | undefined;
    /**
     * Process an OData request
     */
    processRequest(req: Request, res: Response): Promise<void>;
    /**
     * Handle entity set request
     */
    private handleEntitySetRequest;
    /**
     * Handle single entity request
     */
    private handleEntityRequest;
    /**
     * Handle navigation property request
     */
    private handleNavigationRequest;
    /**
     * Handle $links request
     */
    private handleLinksRequest;
    /**
     * Handle function import request
     */
    private handleFunctionImportRequest;
    /**
     * Handle batch request
     */
    private handleBatchRequest;
    /**
     * Process a single batch part
     */
    private processBatchPart;
    /**
     * Parse query string from URL
     */
    private parseQueryString;
    /**
     * Get the schema
     */
    getSchema(): ODataSchemaConfig;
    /**
     * Invalidate metadata cache
     */
    invalidateMetadataCache(): void;
}
//# sourceMappingURL=ODataService.d.ts.map