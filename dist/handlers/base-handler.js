"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultHandler = exports.BaseHandler = void 0;
/**
 * Abstract base class for entity handlers
 * Provides default CRUD implementation that can be overridden
 */
class BaseHandler {
    model;
    entityName;
    schema;
    queryBuilder;
    sequelize;
    hooks;
    constructor(model, entityName, schema, queryBuilder, sequelize, hooks) {
        this.model = model;
        this.entityName = entityName;
        this.schema = schema;
        this.queryBuilder = queryBuilder;
        this.sequelize = sequelize;
        this.hooks = hooks;
    }
    /**
     * Check if entity exists
     */
    async exists(keys) {
        const where = this.queryBuilder.buildKeyWhere(this.entityName, keys);
        const count = await this.model.count({ where });
        return count > 0;
    }
    /**
     * Get entity definition
     */
    getEntityDefinition() {
        return this.schema.entities[this.entityName];
    }
    /**
     * Create hook context
     */
    createHookContext(req, res, query, keys) {
        return {
            req: req,
            res: res,
            query,
            entityName: this.entityName,
            models: {}, // Will be set by service
            user: req.user,
            keys,
            data: {},
        };
    }
}
exports.BaseHandler = BaseHandler;
/**
 * Default handler implementation using Sequelize
 */
class DefaultHandler extends BaseHandler {
    async handleRead(ctx) {
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
                const transformed = await this.hooks.afterRead(ctx, rows.map((r) => r.get({ plain: true })));
                return { results: transformed, count };
            }
            return { results: rows.map((r) => r.get({ plain: true })), count };
        }
        // No count needed - use simple findAll
        const options = this.queryBuilder.buildFindOptions(this.entityName, ctx.query);
        const results = await this.model.findAll(options);
        // Run afterRead hook
        if (this.hooks?.afterRead) {
            const transformed = await this.hooks.afterRead(ctx, results.map((r) => r.get({ plain: true })));
            return { results: transformed };
        }
        return { results: results.map((r) => r.get({ plain: true })) };
    }
    async handleReadSingle(ctx) {
        if (!ctx.keys) {
            return null;
        }
        // Run beforeRead hook
        if (this.hooks?.beforeRead) {
            await this.hooks.beforeRead(ctx);
        }
        const options = this.queryBuilder.buildFindOneOptions(this.entityName, ctx.keys, ctx.query);
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
    async handleCreate(ctx, data) {
        let createData = data;
        // Run beforeCreate hook
        if (this.hooks?.beforeCreate) {
            createData = await this.hooks.beforeCreate(ctx, createData);
        }
        // Handle deep create (nested entities)
        const { mainData, nestedData } = this.separateNestedData(createData);
        // Create main entity (with transaction if available)
        const createOptions = ctx.transaction ? { transaction: ctx.transaction } : {};
        const result = await this.model.create(mainData, createOptions);
        // Handle nested creates if any
        await this.handleNestedCreates(result, nestedData, ctx.transaction);
        let plainResult = result.get({ plain: true });
        // Run afterCreate hook
        if (this.hooks?.afterCreate) {
            plainResult = await this.hooks.afterCreate(ctx, plainResult);
        }
        return plainResult;
    }
    async handleUpdate(ctx, data) {
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
        const existing = await this.model.findOne(options);
        if (!existing) {
            return null;
        }
        // Update the entity within transaction context
        await existing.update(updateData, transaction ? { transaction } : undefined);
        let plainResult = existing.get({ plain: true });
        // Run afterUpdate hook
        if (this.hooks?.afterUpdate && plainResult) {
            plainResult = await this.hooks.afterUpdate(ctx, plainResult);
        }
        return plainResult;
    }
    async handleMerge(ctx, data) {
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
        const existing = await this.model.findOne(options);
        if (!existing) {
            return null;
        }
        // Partial update within transaction context
        await existing.update(updateData, transaction ? { transaction } : undefined);
        let plainResult = existing.get({ plain: true });
        // Run afterUpdate hook
        if (this.hooks?.afterUpdate && plainResult) {
            plainResult = await this.hooks.afterUpdate(ctx, plainResult);
        }
        return plainResult;
    }
    async handleDelete(ctx) {
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
    separateNestedData(data) {
        const entity = this.getEntityDefinition();
        const mainData = {};
        const nestedData = {};
        for (const [key, value] of Object.entries(data)) {
            if (entity?.navigationProperties?.[key]) {
                nestedData[key] = value;
            }
            else {
                mainData[key] = value;
            }
        }
        return { mainData, nestedData };
    }
    /**
     * Handle creation of nested entities (deep create)
     */
    async handleNestedCreates(parentInstance, nestedData, transaction) {
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
            const createMethod = parentInstance[methodName];
            if (typeof createMethod === 'function') {
                const options = transaction ? { transaction } : {};
                if (Array.isArray(data)) {
                    for (const item of data) {
                        await createMethod.call(parentInstance, item, options);
                    }
                }
                else {
                    await createMethod.call(parentInstance, data, options);
                }
            }
        }
    }
}
exports.DefaultHandler = DefaultHandler;
//# sourceMappingURL=base-handler.js.map