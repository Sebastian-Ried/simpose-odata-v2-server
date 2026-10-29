import { Request, Response } from 'express';
import { Model, ModelStatic, Sequelize } from 'sequelize';
import {
  ODataSchemaConfig,
  HookContext,
  ParsedQuery,
  EntityHooks,
} from '../config/types';
import { QueryBuilder } from '../query/query-builder';
import { TenantScope } from '../tenant';
import { ODataError } from '../utils/errors';

/**
 * Abstract base class for entity handlers
 * Provides default CRUD implementation that can be overridden
 */
export abstract class BaseHandler {
  protected model: ModelStatic<Model>;
  protected entityName: string;
  protected schema: ODataSchemaConfig;
  protected queryBuilder: QueryBuilder;
  protected sequelize: Sequelize;
  protected hooks?: EntityHooks;
  protected tenant?: TenantScope;

  constructor(
    model: ModelStatic<Model>,
    entityName: string,
    schema: ODataSchemaConfig,
    queryBuilder: QueryBuilder,
    sequelize: Sequelize,
    hooks?: EntityHooks,
    tenant?: TenantScope
  ) {
    this.model = model;
    this.entityName = entityName;
    this.schema = schema;
    this.queryBuilder = queryBuilder;
    this.sequelize = sequelize;
    this.hooks = hooks;
    this.tenant = tenant;
  }

  /**
   * Handle GET request for entity collection
   */
  abstract handleRead(ctx: HookContext): Promise<{ results: unknown[]; count?: number }>;

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
  abstract handleDelete(ctx: HookContext, options?: { deferAfterDelete?: boolean }): Promise<void>;

  /** Runs the afterDelete hook (see handleDelete's deferAfterDelete). */
  async runAfterDelete(ctx: HookContext): Promise<void> {
    if (this.hooks?.afterDelete) {
      await this.hooks.afterDelete(ctx);
    }
  }

  /**
   * Check if entity exists (within the request's tenant when ctx is given)
   */
  async exists(keys: Record<string, unknown>, ctx?: HookContext): Promise<boolean> {
    const where = this.keyWhere(keys, ctx);
    const count = await this.model.count({ where, transaction: ctx?.transaction });
    return count > 0;
  }

  /** The key condition, limited to the request's tenant when ctx is given. */
  protected keyWhere(keys: Record<string, unknown>, ctx?: HookContext) {
    const where = this.queryBuilder.buildKeyWhere(this.entityName, keys);
    if (!this.tenant || !ctx) return where;
    return this.tenant.where(this.model, this.tenant.resolve(ctx), where);
  }

  /** Limits find options to the request's tenant (also every include). */
  protected scopeFind<T extends object>(options: T, ctx: HookContext): T {
    if (!this.tenant) return options;
    return this.tenant.scopeFind(this.model, options as any, this.tenant.resolve(ctx)) as T;
  }

  /** Tenant rules for a create/update payload (see TenantScope.checkWrite). */
  protected async checkTenantWrite(ctx: HookContext, data: unknown, create: boolean): Promise<void> {
    if (!this.tenant) return;
    await this.tenant.checkWrite(this.model, data as Record<string, unknown>, this.tenant.resolve(ctx), {
      create,
      transaction: ctx.transaction,
      entityName: this.entityName,
    });
  }

  /**
   * Get entity definition
   */
  protected getEntityDefinition() {
    return this.schema.entities[this.entityName];
  }

  /**
   * Create hook context
   */
  protected createHookContext(
    req: Request,
    res: Response,
    query: ParsedQuery,
    keys?: Record<string, unknown>
  ): HookContext {
    return {
      req: req as any,
      res: res as any,
      query,
      entityName: this.entityName,
      models: {} as any, // Will be set by service
      user: (req as any).user,
      keys,
      data: {},
    };
  }
}

/**
 * Default handler implementation using Sequelize
 */
export class DefaultHandler extends BaseHandler {
  async handleRead(ctx: HookContext): Promise<{ results: unknown[]; count?: number }> {
    // Run beforeRead hook
    if (this.hooks?.beforeRead) {
      await this.hooks.beforeRead(ctx);
    }

    // Performance: Use findAndCountAll when count is needed to avoid separate query
    if (ctx.query.$inlinecount === 'allpages') {
      const options = this.scopeFind(this.queryBuilder.buildFindOptions(this.entityName, ctx.query), ctx);
      const { rows, count } = await this.model.findAndCountAll(options);

      // Run afterRead hook
      if (this.hooks?.afterRead) {
        const transformed = await this.hooks.afterRead(
          ctx,
          rows.map((r) => r.get({ plain: true }))
        );
        return { results: transformed, count };
      }

      return { results: rows.map((r) => r.get({ plain: true })), count };
    }

    // No count needed - use simple findAll
    const options = this.scopeFind(this.queryBuilder.buildFindOptions(this.entityName, ctx.query), ctx);
    const results = await this.model.findAll(options);

    // Run afterRead hook
    if (this.hooks?.afterRead) {
      const transformed = await this.hooks.afterRead(
        ctx,
        results.map((r) => r.get({ plain: true }))
      );
      return { results: transformed };
    }

    return { results: results.map((r) => r.get({ plain: true })) };
  }

  async handleReadSingle(ctx: HookContext): Promise<unknown | null> {
    if (!ctx.keys) {
      return null;
    }

    // Run beforeRead hook
    if (this.hooks?.beforeRead) {
      await this.hooks.beforeRead(ctx);
    }

    const options = this.scopeFind(this.queryBuilder.buildFindOneOptions(
      this.entityName,
      ctx.keys,
      ctx.query
    ), ctx);

    const result = await this.model.findOne(options);

    if (!result) {
      return null;
    }

    const plainResult = result.get({ plain: true });

    // Run afterRead hook
    if (this.hooks?.afterRead) {
      const transformed = await this.hooks.afterRead(ctx, [plainResult]);
      return transformed[0] ?? null;
    }

    return plainResult;
  }

  async handleCreate(ctx: HookContext, data: unknown): Promise<unknown> {
    let createData = data;

    // Run beforeCreate hook
    if (this.hooks?.beforeCreate) {
      createData = await this.hooks.beforeCreate(ctx, createData);
    }

    // Deep insert is refused: nested entities would be created without their
    // own hooks (authorization, validation) and outside the tenant rules.
    const { mainData, nestedData } = this.separateNestedData(createData as Record<string, unknown>);
    if (Object.keys(nestedData).length > 0) {
      throw new ODataError(400, 'Deep insert is not supported');
    }
    await this.checkTenantWrite(ctx, mainData, true);

    // Create main entity (with transaction if available)
    const createOptions = ctx.transaction ? { transaction: ctx.transaction } : {};
    const result = await this.model.create(mainData as any, createOptions);

    let plainResult = result.get({ plain: true });

    // Run afterCreate hook
    if (this.hooks?.afterCreate) {
      plainResult = await this.hooks.afterCreate(ctx, plainResult);
    }

    return plainResult;
  }

  async handleUpdate(ctx: HookContext, data: unknown): Promise<unknown> {
    if (!ctx.keys) {
      throw new Error('Keys required for update');
    }

    let updateData = data;

    // Run beforeUpdate hook
    if (this.hooks?.beforeUpdate) {
      updateData = await this.hooks.beforeUpdate(ctx, updateData);
    }
    await this.checkTenantWrite(ctx, updateData, false);

    const where = this.keyWhere(ctx.keys, ctx);

    // Use transaction if available for atomic operation
    const transaction = ctx.transaction;
    const options = transaction ? { where, transaction, lock: true } : { where };

    // Fetch entity with lock if in transaction to prevent race conditions
    const existing = await this.model.findOne(options as any);
    if (!existing) {
      return null;
    }

    // Update the entity within transaction context
    await existing.update(updateData as any, transaction ? { transaction } : undefined);

    let plainResult = existing.get({ plain: true });

    // Run afterUpdate hook
    if (this.hooks?.afterUpdate && plainResult) {
      plainResult = await this.hooks.afterUpdate(ctx, plainResult);
    }

    return plainResult;
  }

  async handleMerge(ctx: HookContext, data: unknown): Promise<unknown> {
    if (!ctx.keys) {
      throw new Error('Keys required for merge');
    }

    let updateData = data;

    // Run beforeUpdate hook
    if (this.hooks?.beforeUpdate) {
      updateData = await this.hooks.beforeUpdate(ctx, updateData);
    }
    await this.checkTenantWrite(ctx, updateData, false);

    const where = this.keyWhere(ctx.keys, ctx);

    // Use transaction if available for atomic operation
    const transaction = ctx.transaction;
    const options = transaction ? { where, transaction, lock: true } : { where };

    // Fetch entity with lock if in transaction to prevent race conditions
    const existing = await this.model.findOne(options as any);
    if (!existing) {
      return null;
    }

    // Partial update within transaction context
    await existing.update(updateData as any, transaction ? { transaction } : undefined);

    let plainResult = existing.get({ plain: true });

    // Run afterUpdate hook
    if (this.hooks?.afterUpdate && plainResult) {
      plainResult = await this.hooks.afterUpdate(ctx, plainResult);
    }

    return plainResult;
  }

  async handleDelete(ctx: HookContext, options: { deferAfterDelete?: boolean } = {}): Promise<void> {
    if (!ctx.keys) {
      throw new Error('Keys required for delete');
    }

    // Run beforeDelete hook
    if (this.hooks?.beforeDelete) {
      await this.hooks.beforeDelete(ctx);
    }

    const where = this.keyWhere(ctx.keys, ctx);
    await this.model.destroy({ where, transaction: ctx.transaction });

    if (!options.deferAfterDelete) {
      await this.runAfterDelete(ctx);
    }
  }

  /**
   * Separate nested entity data from main entity data
   */
  private separateNestedData(data: Record<string, unknown>): {
    mainData: Record<string, unknown>;
    nestedData: Record<string, unknown>;
  } {
    const entity = this.getEntityDefinition();
    const mainData: Record<string, unknown> = {};
    const nestedData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (entity?.navigationProperties?.[key]) {
        nestedData[key] = value;
      } else {
        mainData[key] = value;
      }
    }

    return { mainData, nestedData };
  }
}
