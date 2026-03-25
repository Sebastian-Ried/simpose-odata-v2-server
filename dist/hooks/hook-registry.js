"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookRegistry = void 0;
exports.createHookRegistry = createHookRegistry;
/**
 * Registry for entity hooks
 */
class HookRegistry {
    hooks = new Map();
    /**
     * Register hooks for an entity
     */
    register(entityName, hooks) {
        const existing = this.hooks.get(entityName) || {};
        this.hooks.set(entityName, { ...existing, ...hooks });
    }
    /**
     * Get hooks for an entity
     */
    get(entityName) {
        return this.hooks.get(entityName);
    }
    /**
     * Check if entity has a specific hook
     */
    has(entityName, hookType) {
        const hooks = this.hooks.get(entityName);
        return hooks !== undefined && hooks[hookType] !== undefined;
    }
    /**
     * Run beforeRead hook
     */
    async beforeRead(entityName, ctx) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.beforeRead) {
            await hooks.beforeRead(ctx);
        }
    }
    /**
     * Run afterRead hook
     */
    async afterRead(entityName, ctx, results) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.afterRead) {
            return await hooks.afterRead(ctx, results);
        }
        return results;
    }
    /**
     * Run beforeCreate hook
     */
    async beforeCreate(entityName, ctx, data) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.beforeCreate) {
            return await hooks.beforeCreate(ctx, data);
        }
        return data;
    }
    /**
     * Run afterCreate hook
     */
    async afterCreate(entityName, ctx, result) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.afterCreate) {
            return await hooks.afterCreate(ctx, result);
        }
        return result;
    }
    /**
     * Run beforeUpdate hook
     */
    async beforeUpdate(entityName, ctx, data) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.beforeUpdate) {
            return await hooks.beforeUpdate(ctx, data);
        }
        return data;
    }
    /**
     * Run afterUpdate hook
     */
    async afterUpdate(entityName, ctx, result) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.afterUpdate) {
            return await hooks.afterUpdate(ctx, result);
        }
        return result;
    }
    /**
     * Run beforeDelete hook
     */
    async beforeDelete(entityName, ctx) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.beforeDelete) {
            await hooks.beforeDelete(ctx);
        }
    }
    /**
     * Run afterDelete hook
     */
    async afterDelete(entityName, ctx) {
        const hooks = this.hooks.get(entityName);
        if (hooks?.afterDelete) {
            await hooks.afterDelete(ctx);
        }
    }
    /**
     * Clear all hooks
     */
    clear() {
        this.hooks.clear();
    }
    /**
     * Remove hooks for an entity
     */
    remove(entityName) {
        this.hooks.delete(entityName);
    }
}
exports.HookRegistry = HookRegistry;
/**
 * Create a hook registry instance
 */
function createHookRegistry() {
    return new HookRegistry();
}
//# sourceMappingURL=hook-registry.js.map