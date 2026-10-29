import { Request, Response } from 'express';
import { Model, ModelStatic, Sequelize } from 'sequelize';
import { ODataSchemaConfig, HookContext, ParsedQuery, EntityHooks } from '../config/types';
import { QueryBuilder } from '../query/query-builder';
import { TenantScope } from '../tenant';
/**
 * Abstract base class for entity handlers
 * Provides default CRUD implementation that can be overridden
 */
export declare abstract class BaseHandler {
    protected model: ModelStatic<Model>;
    protected entityName: string;
    protected schema: ODataSchemaConfig;
    protected queryBuilder: QueryBuilder;
    protected sequelize: Sequelize;
    protected hooks?: EntityHooks;
    protected tenant?: TenantScope;
    constructor(model: ModelStatic<Model>, entityName: string, schema: ODataSchemaConfig, queryBuilder: QueryBuilder, sequelize: Sequelize, hooks?: EntityHooks, tenant?: TenantScope);
    /**
     * Handle GET request for entity collection
     */
    abstract handleRead(ctx: HookContext): Promise<{
        results: unknown[];
        count?: number;
    }>;
    /**
     * Handle GET request for single entity
     */
    abstract handleReadSingle(ctx: HookContext): Promise<unknown | null>;
    /**
     * Handle POST request to create entity
     */
    abstract handleCreate(ctx: HookContext, data: unknown): Promise<unknown>;
    /**
     * Handle PUT request to fully replace entity
     */
    abstract handleUpdate(ctx: HookContext, data: unknown): Promise<unknown>;
    /**
     * Handle MERGE/PATCH request to partially update entity
     */
    abstract handleMerge(ctx: HookContext, data: unknown): Promise<unknown>;
    /**
     * Handle DELETE request. With deferAfterDelete the afterDelete hook is left
     * to the caller (runAfterDelete), to run once the delete is committed.
     */
    abstract handleDelete(ctx: HookContext, options?: {
        deferAfterDelete?: boolean;
    }): Promise<void>;
    /** Runs the afterDelete hook (see handleDelete's deferAfterDelete). */
    runAfterDelete(ctx: HookContext): Promise<void>;
    /**
     * Check if entity exists (within the request's tenant when ctx is given)
     */
    exists(keys: Record<string, unknown>, ctx?: HookContext): Promise<boolean>;
    /** The key condition, limited to the request's tenant when ctx is given. */
    protected keyWhere(keys: Record<string, unknown>, ctx?: HookContext): import("sequelize").WhereOptions | undefined;
    /** Limits find options to the request's tenant (also every include). */
    protected scopeFind<T extends object>(options: T, ctx: HookContext): T;
    /** Tenant rules for a create/update payload (see TenantScope.checkWrite). */
    protected checkTenantWrite(ctx: HookContext, data: unknown, create: boolean): Promise<void>;
    /**
     * Get entity definition
     */
    protected getEntityDefinition(): import("../config/types").EntityDefinition | undefined;
    /**
     * Create hook context
     */
    protected createHookContext(req: Request, res: Response, query: ParsedQuery, keys?: Record<string, unknown>): HookContext;
}
/**
 * Default handler implementation using Sequelize
 */
export declare class DefaultHandler extends BaseHandler {
    handleRead(ctx: HookContext): Promise<{
        results: unknown[];
        count?: number;
    }>;
    handleReadSingle(ctx: HookContext): Promise<unknown | null>;
    handleCreate(ctx: HookContext, data: unknown): Promise<unknown>;
    handleUpdate(ctx: HookContext, data: unknown): Promise<unknown>;
    handleMerge(ctx: HookContext, data: unknown): Promise<unknown>;
    handleDelete(ctx: HookContext, options?: {
        deferAfterDelete?: boolean;
    }): Promise<void>;
    /**
     * Separate nested entity data from main entity data
     */
    private separateNestedData;
}
//# sourceMappingURL=base-handler.d.ts.map