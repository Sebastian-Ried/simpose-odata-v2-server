import { Model, ModelStatic, FindOptions, Transaction, WhereOptions } from 'sequelize';
import { HookContext, ODataSchemaConfig, TenantOptions } from './config/types';
type TenantId = string | number;
/**
 * Row-level tenant isolation (the `tenant` middleware option).
 *
 * Every model with the tenant attribute is scoped: reads (also every $expand,
 * $filter and $orderby join), updates and deletes only see rows of the
 * request's tenant; creates get it; writes may not move a row to another
 * tenant, and every belongs-to foreign key written must point at a row of the
 * same tenant. Models without the attribute are not scoped.
 */
export declare class TenantScope {
    readonly attribute: string;
    private readonly resolveFn;
    private schema?;
    private models;
    constructor(options: TenantOptions);
    /** The schema and models, for the foreign keys declared by referential constraints. */
    setSchema(schema: ODataSchemaConfig, models: Record<string, ModelStatic<Model>>): void;
    /**
     * Foreign keys of an entity: its model's belongs-to associations and every
     * referential constraint in the schema where the entity is the dependent.
     */
    private foreignKeys;
    /** Whether rows of the model belong to a tenant. */
    isScoped(model: ModelStatic<Model> | undefined): boolean;
    /** Marks a $batch part's mock request with the outer request's tenant. */
    static setBatchTenant(mockReq: Record<PropertyKey, unknown>, tenantId: TenantId | null): void;
    /** The request's tenant or null (a $batch part: the outer request's). */
    resolveRequest(req: unknown): TenantId | null;
    /** The request's tenant; 403 when there is none (fail closed). */
    resolve(ctx: HookContext): TenantId;
    /** `where` limited to the tenant (unchanged for unscoped models). */
    where(model: ModelStatic<Model>, tenantId: TenantId, where?: WhereOptions): WhereOptions | undefined;
    /** Limits a find to the tenant, including every (nested) include. */
    scopeFind<T extends FindOptions>(model: ModelStatic<Model>, options: T, tenantId: TenantId): T;
    private scopeIncludes;
    /**
     * Prepares a create/update payload: the tenant attribute is the request's
     * (another value is 403, an update drops it), and every foreign key in the
     * payload (belongs-to association or referential constraint) must
     * reference a row of the tenant (404 otherwise).
     */
    checkWrite(model: ModelStatic<Model>, data: Record<string, unknown>, tenantId: TenantId, { create, transaction, entityName }: {
        create: boolean;
        transaction?: Transaction;
        entityName?: string;
    }): Promise<void>;
}
export {};
//# sourceMappingURL=tenant.d.ts.map