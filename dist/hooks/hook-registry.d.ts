import { EntityHooks, HookContext } from '../config/types';
/**
 * Hook types supported by the system
 */
export type HookType = 'beforeRead' | 'afterRead' | 'beforeCreate' | 'afterCreate' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete';
/**
 * Registry for entity hooks
 */
export declare class HookRegistry {
    private hooks;
    /**
     * Register hooks for an entity
     */
    register(entityName: string, hooks: EntityHooks): void;
    /**
     * Get hooks for an entity
     */
    get(entityName: string): EntityHooks | undefined;
    /**
     * Check if entity has a specific hook
     */
    has(entityName: string, hookType: HookType): boolean;
    /**
     * Run beforeRead hook
     */
    beforeRead(entityName: string, ctx: HookContext): Promise<void>;
    /**
     * Run afterRead hook
     */
    afterRead(entityName: string, ctx: HookContext, results: unknown[]): Promise<unknown[]>;
    /**
     * Run beforeCreate hook
     */
    beforeCreate(entityName: string, ctx: HookContext, data: unknown): Promise<unknown>;
    /**
     * Run afterCreate hook
     */
    afterCreate(entityName: string, ctx: HookContext, result: unknown): Promise<unknown>;
    /**
     * Run beforeUpdate hook
     */
    beforeUpdate(entityName: string, ctx: HookContext, data: unknown): Promise<unknown>;
    /**
     * Run afterUpdate hook
     */
    afterUpdate(entityName: string, ctx: HookContext, result: unknown): Promise<unknown>;
    /**
     * Run beforeDelete hook
     */
    beforeDelete(entityName: string, ctx: HookContext): Promise<void>;
    /**
     * Run afterDelete hook
     */
    afterDelete(entityName: string, ctx: HookContext): Promise<void>;
    /**
     * Clear all hooks
     */
    clear(): void;
    /**
     * Remove hooks for an entity
     */
    remove(entityName: string): void;
}
/**
 * Create a hook registry instance
 */
export declare function createHookRegistry(): HookRegistry;
//# sourceMappingURL=hook-registry.d.ts.map