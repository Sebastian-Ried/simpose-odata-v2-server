import { Request, Response } from 'express';
import { Model, ModelStatic } from 'sequelize';
import {
  HookContext,
  ParsedQuery,
  ODataSchemaConfig,
  Logger,
} from '../config/types';

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
export function createHookContext(
  req: Request,
  res: Response,
  query: ParsedQuery,
  entityName: string,
  models: Record<string, ModelStatic<Model>>,
  keys?: Record<string, unknown>,
  correlationId?: string,
  logger?: Logger
): HookContext {
  return {
    req: req as any,
    res: res as any,
    query,
    entityName,
    models,
    user: (req as any).user,
    keys,
    data: {},
    correlationId,
    logger,
  };
}

/**
 * Clone a hook context with modified properties
 */
export function cloneContext(
  ctx: HookContext,
  overrides: Partial<HookContext>
): HookContext {
  return {
    ...ctx,
    query: { ...ctx.query },
    data: { ...ctx.data },
    ...overrides,
  };
}

/**
 * Get value from context data store
 */
export function getContextData<T>(ctx: HookContext, key: string): T | undefined {
  return ctx.data[key] as T | undefined;
}

/**
 * Set value in context data store
 */
export function setContextData<T>(ctx: HookContext, key: string, value: T): void {
  ctx.data[key] = value;
}

/**
 * Get the Sequelize model from context
 */
export function getModel(
  ctx: HookContext,
  entityName?: string
): ModelStatic<Model> | undefined {
  const name = entityName || ctx.entityName;
  return ctx.models[name];
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(ctx: HookContext): boolean {
  return ctx.user !== undefined && ctx.user !== null;
}

/**
 * Get user from context
 */
export function getUser<T>(ctx: HookContext): T | undefined {
  return ctx.user as T | undefined;
}

/**
 * Dangerous prototype keys that should never be merged
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Add filter to query
 */
export function addQueryFilter(
  ctx: HookContext,
  filter: Record<string, unknown>
): void {
  if (!ctx.query.where) {
    ctx.query.where = {};
  }
  // Sanitize filter to prevent prototype pollution
  const safeFilter = Object.fromEntries(
    Object.entries(filter).filter(([key]) => !DANGEROUS_KEYS.includes(key))
  );
  Object.assign(ctx.query.where, safeFilter);
}

/**
 * Get request headers
 */
export function getHeader(ctx: HookContext, name: string): string | undefined {
  return (ctx.req as any).headers?.[name.toLowerCase()];
}

/**
 * Get query parameter
 */
export function getQueryParam(ctx: HookContext, name: string): string | undefined {
  return (ctx.req as any).query?.[name];
}

/**
 * Get request body
 */
export function getRequestBody<T>(ctx: HookContext): T | undefined {
  return (ctx.req as any).body as T;
}

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
export function getLogger(ctx: HookContext): Logger {
  if (ctx.logger) {
    return ctx.logger;
  }
  // Return a no-op logger if none configured
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}
