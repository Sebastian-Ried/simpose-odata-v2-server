import { Request, Response } from 'express';
import { Model, ModelStatic } from 'sequelize';
import { HookContext, ParsedQuery, Logger } from '../config/types';
/**
 * Options for creating a hook context
 */
export interface CreateHookContextOptions {
    req: Request;
    res: Response;
    query: ParsedQuery;
    entityName: string;
    models: Record<string, ModelStatic<Model>>;
    keys?: Record<string, unknown>;
    correlationId?: string;
    logger?: Logger;
}
/**
 * Create a hook context for request processing
 */
export declare function createHookContext(req: Request, res: Response, query: ParsedQuery, entityName: string, models: Record<string, ModelStatic<Model>>, keys?: Record<string, unknown>, correlationId?: string, logger?: Logger): HookContext;
/**
 * Clone a hook context with modified properties
 */
export declare function cloneContext(ctx: HookContext, overrides: Partial<HookContext>): HookContext;
/**
 * Get value from context data store
 */
export declare function getContextData<T>(ctx: HookContext, key: string): T | undefined;
/**
 * Set value in context data store
 */
export declare function setContextData<T>(ctx: HookContext, key: string, value: T): void;
/**
 * Get the Sequelize model from context
 */
export declare function getModel(ctx: HookContext, entityName?: string): ModelStatic<Model> | undefined;
/**
 * Check if user is authenticated
 */
export declare function isAuthenticated(ctx: HookContext): boolean;
/**
 * Get user from context
 */
export declare function getUser<T>(ctx: HookContext): T | undefined;
/**
 * Add filter to query
 */
export declare function addQueryFilter(ctx: HookContext, filter: Record<string, unknown>): void;
/**
 * Get request headers
 */
export declare function getHeader(ctx: HookContext, name: string): string | undefined;
/**
 * Get query parameter
 */
export declare function getQueryParam(ctx: HookContext, name: string): string | undefined;
/**
 * Get request body
 */
export declare function getRequestBody<T>(ctx: HookContext): T | undefined;
/**
 * Get the logger from context with fallback to no-op.
 *
 * Returns a safe logger that can always be called without null checks.
 * If no logger is configured, returns a no-op logger.
 *
 * @param ctx - Hook context
 * @returns Logger instance (never undefined)
 *
 * @example
 * ```typescript
 * const logger = getLogger(ctx);
 * logger.info('Processing entity', { entityName: ctx.entityName });
 * ```
 */
export declare function getLogger(ctx: HookContext): Logger;
//# sourceMappingURL=context.d.ts.map