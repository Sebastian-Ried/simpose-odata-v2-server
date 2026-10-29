"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultHandler = exports.BaseHandler = void 0;
const errors_1 = require("../utils/errors");
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
    tenant;
    constructor(model, entityName, schema, queryBuilder, sequelize, hooks, tenant) {
        this.model = model;
        this.entityName = entityName;
        this.schema = schema;
        this.queryBuilder = queryBuilder;
        this.sequelize = sequelize;
        this.hooks = hooks;
        this.tenant = tenant;
    }
    /** Runs the afterDelete hook (see handleDelete's deferAfterDelete). */
    async runAfterDelete(ctx) {
        if (this.hooks?.afterDelete) {
            await this.hooks.afterDelete(ctx);
        }
    }
    /**
     * Check if entity exists (within the request's tenant when ctx is given)
     */
    async exists(keys, ctx) {
        const where = this.keyWhere(keys, ctx);
        const count = await this.model.count({ where, transaction: ctx?.transaction });
        return count > 0;
    }
    /** The key condition, limited to the request's tenant when ctx is given. */
    keyWhere(keys, ctx) {
        const where = this.queryBuilder.buildKeyWhere(this.entityName, keys);
        if (!this.tenant || !ctx)
            return where;
        return this.tenant.where(this.model, this.tenant.resolve(ctx), where);
    }
    /** Limits find options to the request's tenant (also every include). */
    scopeFind(options, ctx) {
        if (!this.tenant)
            return options;
        return this.tenant.scopeFind(this.model, options, this.tenant.resolve(ctx));
    }
    /** Tenant rules for a create/update payload (see TenantScope.checkWrite). */
    async checkTenantWrite(ctx, data, create) {
        if (!this.tenant)
            return;
        await this.tenant.checkWrite(this.model, data, this.tenant.resolve(ctx), {
            create,
            transaction: ctx.transaction,
            entityName: this.entityName,
        });
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
            const options = this.scopeFind(this.queryBuilder.buildFindOptions(this.entityName, ctx.query), ctx);
            const { rows, count } = await this.model.findAndCountAll(options);
            // Run afterRead hook
            if (this.hooks?.afterRead) {
                const transformed = await this.hooks.afterRead(ctx, rows.map((r) => r.get({ plain: true })));
                return { results: transformed, count };
            }
            return { results: rows.map((r) => r.get({ plain: true })), count };
        }
        // No count needed - use simple findAll
        const options = this.scopeFind(this.queryBuilder.buildFindOptions(this.entityName, ctx.query), ctx);
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
        const options = this.scopeFind(this.queryBuilder.buildFindOneOptions(this.entityName, ctx.keys, ctx.query), ctx);
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
        // Deep insert is refused: nested entities would be created without their
        // own hooks (authorization, validation) and outside the tenant rules.
        const { mainData, nestedData } = this.separateNestedData(createData);
        if (Object.keys(nestedData).length > 0) {
            throw new errors_1.ODataError(400, 'Deep insert is not supported');
        }
        await this.checkTenantWrite(ctx, mainData, true);
        // Create main entity (with transaction if available)
        const createOptions = ctx.transaction ? { transaction: ctx.transaction } : {};
        const result = await this.model.create(mainData, createOptions);
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
        await this.checkTenantWrite(ctx, updateData, false);
        const where = this.keyWhere(ctx.keys, ctx);
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
        await this.checkTenantWrite(ctx, updateData, false);
        const where = this.keyWhere(ctx.keys, ctx);
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
    async handleDelete(ctx, options = {}) {
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
}
exports.DefaultHandler = DefaultHandler;
//# sourceMappingURL=base-handler.js.map