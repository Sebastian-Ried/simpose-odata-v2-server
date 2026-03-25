"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityHandler = void 0;
/**
 * Abstract base class for entity handlers
 */
class EntityHandler {
    model;
    entityName;
    schema;
    initialize(model, entityName, schema) {
        this.model = model;
        this.entityName = entityName;
        this.schema = schema;
    }
    async onRead(ctx) {
        throw new Error('Not implemented');
    }
    async onReadSingle(ctx) {
        throw new Error('Not implemented');
    }
    async onCreate(ctx, data) {
        throw new Error('Not implemented');
    }
    async onUpdate(ctx, data, merge) {
        throw new Error('Not implemented');
    }
    async onDelete(ctx) {
        throw new Error('Not implemented');
    }
    buildIncludes(ctx) {
        return [];
    }
}
exports.EntityHandler = EntityHandler;
//# sourceMappingURL=types.js.map