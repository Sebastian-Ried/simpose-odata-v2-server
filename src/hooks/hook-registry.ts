import {
  EntityHooks,
  HookContext,
} from '../config/types';

/**
 * Hook types supported by the system
 */
export type HookType =
  | 'beforeRead'
  | 'afterRead'
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete';

/**
 * Registry for entity hooks
 */
export class HookRegistry {
  private hooks: Map<string, EntityHooks> = new Map();

  /**
   * Register hooks for an entity
   */
  register(entityName: string, hooks: EntityHooks): void {
    const existing = this.hooks.get(entityName) || {};
    this.hooks.set(entityName, { ...existing, ...hooks });
  }

  /**
   * Get hooks for an entity
   */
  get(entityName: string): EntityHooks | undefined {
    return this.hooks.get(entityName);
  }

  /**
   * Check if entity has a specific hook
   */
  has(entityName: string, hookType: HookType): boolean {
    const hooks = this.hooks.get(entityName);
    return hooks !== undefined && hooks[hookType] !== undefined;
  }

  /**
   * Run beforeRead hook
   */
  async beforeRead(entityName: string, ctx: HookContext): Promise<void> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.beforeRead) {
      await hooks.beforeRead(ctx);
    }
  }

  /**
   * Run afterRead hook
   */
  async afterRead(
    entityName: string,
    ctx: HookContext,
    results: unknown[]
  ): Promise<unknown[]> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.afterRead) {
      return await hooks.afterRead(ctx, results);
    }
    return results;
  }

  /**
   * Run beforeCreate hook
   */
  async beforeCreate(
    entityName: string,
    ctx: HookContext,
    data: unknown
  ): Promise<unknown> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.beforeCreate) {
      return await hooks.beforeCreate(ctx, data);
    }
    return data;
  }

  /**
   * Run afterCreate hook
   */
  async afterCreate(
    entityName: string,
    ctx: HookContext,
    result: unknown
  ): Promise<unknown> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.afterCreate) {
      return await hooks.afterCreate(ctx, result);
    }
    return result;
  }

  /**
   * Run beforeUpdate hook
   */
  async beforeUpdate(
    entityName: string,
    ctx: HookContext,
    data: unknown
  ): Promise<unknown> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.beforeUpdate) {
      return await hooks.beforeUpdate(ctx, data);
    }
    return data;
  }

  /**
   * Run afterUpdate hook
   */
  async afterUpdate(
    entityName: string,
    ctx: HookContext,
    result: unknown
  ): Promise<unknown> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.afterUpdate) {
      return await hooks.afterUpdate(ctx, result);
    }
    return result;
  }

  /**
   * Run beforeDelete hook
   */
  async beforeDelete(entityName: string, ctx: HookContext): Promise<void> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.beforeDelete) {
      await hooks.beforeDelete(ctx);
    }
  }

  /**
   * Run afterDelete hook
   */
  async afterDelete(entityName: string, ctx: HookContext): Promise<void> {
    const hooks = this.hooks.get(entityName);
    if (hooks?.afterDelete) {
      await hooks.afterDelete(ctx);
    }
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
  }

  /**
   * Remove hooks for an entity
   */
  remove(entityName: string): void {
    this.hooks.delete(entityName);
  }
}

/**
 * Create a hook registry instance
 */
export function createHookRegistry(): HookRegistry {
  return new HookRegistry();
}
