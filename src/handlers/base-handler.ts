import { Request, Response } from 'express';
import { Model, ModelStatic, Sequelize, Transaction } from 'sequelize';
import {
  ODataSchemaConfig,
  HookContext,
  ParsedQuery,
  EntityHooks,
} from '../config/types';
import { QueryBuilder } from '../query/query-builder';

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

  constructor(
    model: ModelStatic<Model>,
    entityName: string,
    schema: ODataSchemaConfig,
    queryBuilder: QueryBuilder,
    sequelize: Sequelize,
    hooks?: EntityHooks
  ) {
    this.model = model;
    this.entityName = entityName;
    this.schema = schema;
    this.queryBuilder = queryBuilder;
    this.sequelize = sequelize;
    this.hooks = hooks;
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
   * Handle DELETE request
   */
  abstract handleDelete(ctx: HookContext): Promise<void>;

  /**
   * Check if entity exists
   */
  async exists(keys: Record<string, unknown>): Promise<boolean> {
    const where = this.queryBuilder.buildKeyWhere(this.entityName, keys);
    const count = await this.model.count({ where });
    return count > 0;
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
      const options = this.queryBuilder.buildFindOptions(this.entityName, ctx.query);
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
    const options = this.queryBuilder.buildFindOptions(this.entityName, ctx.query);
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

    const options = this.queryBuilder.buildFindOneOptions(
      this.entityName,
      ctx.keys,
      ctx.query
    );

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

    // Handle deep create (nested entities)
    const { mainData, nestedData } = this.separateNestedData(createData as Record<string, unknown>);

    // Create main entity (with transaction if available)
    const createOptions = ctx.transaction ? { transaction: ctx.transaction } : {};
    const result = await this.model.create(mainData as any, createOptions);

    // Handle nested creates if any
    await this.handleNestedCreates(result, nestedData, ctx.transaction);

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

    const where = this.queryBuilder.buildKeyWhere(this.entityName, ctx.keys);

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

    const where = this.queryBuilder.buildKeyWhere(this.entityName, ctx.keys);

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

  async handleDelete(ctx: HookContext): Promise<void> {
    if (!ctx.keys) {
      throw new Error('Keys required for delete');
    }

    // Run beforeDelete hook
    if (this.hooks?.beforeDelete) {
      await this.hooks.beforeDelete(ctx);
    }

    const where = this.queryBuilder.buildKeyWhere(this.entityName, ctx.keys);
    await this.model.destroy({ where });

    // Run afterDelete hook
    if (this.hooks?.afterDelete) {
      await this.hooks.afterDelete(ctx);
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

  /**
   * Handle creation of nested entities (deep create)
   */
  private async handleNestedCreates(
    parentInstance: Model,
    nestedData: Record<string, unknown>,
    transaction?: Transaction
  ): Promise<void> {
    const entity = this.getEntityDefinition();
    if (!entity?.navigationProperties) {
      return;
    }

    for (const [navProp, data] of Object.entries(nestedData)) {
      const navDef = entity.navigationProperties[navProp];
      if (!navDef || !data) {
        continue;
      }

      // Get the association method
      const methodName = `create${navProp}`;
      const createMethod = (parentInstance as any)[methodName];

      if (typeof createMethod === 'function') {
        const options = transaction ? { transaction } : {};
        if (Array.isArray(data)) {
          for (const item of data) {
            await createMethod.call(parentInstance, item, options);
          }
        } else {
          await createMethod.call(parentInstance, data, options);
        }
      }
    }
  }
}
