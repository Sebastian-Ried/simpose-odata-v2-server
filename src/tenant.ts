import { Op, Model, ModelStatic, FindOptions, Includeable, IncludeOptions, Transaction, WhereOptions } from 'sequelize';
import { HookContext, ODataSchemaConfig, TenantOptions } from './config/types';
import { ODataError } from './utils/errors';

type TenantId = string | number;

/** Tenant of a $batch part, resolved from the outer request (never from the part). */
const BATCH_TENANT = Symbol('odataBatchTenant');

/**
 * A foreign key a payload may write: `foreignKey` references
 * `target.targetKey`. `payloadKeys` are every name it can arrive under (the
 * attribute, its schema `column`, its database field).
 */
interface ForeignKeyRef {
  foreignKey: string;
  payloadKeys: string[];
  target: ModelStatic<Model>;
  targetKey: string;
}

/**
 * Row-level tenant isolation (the `tenant` middleware option).
 *
 * Every model with the tenant attribute is scoped: reads (also every $expand,
 * $filter and $orderby join), updates and deletes only see rows of the
 * request's tenant; creates get it; writes may not move a row to another
 * tenant, and every belongs-to foreign key written must point at a row of the
 * same tenant. Models without the attribute are not scoped.
 */
export class TenantScope {
  readonly attribute: string;
  private readonly resolveFn: TenantOptions['resolve'];
  private readonly exclude: Set<string>;
  private schema?: ODataSchemaConfig;
  private models: Record<string, ModelStatic<Model>> = {};

  constructor(options: TenantOptions) {
    if (!options?.attribute || typeof options.resolve !== 'function') {
      throw new Error('tenant needs an attribute and a resolve function');
    }
    this.attribute = options.attribute;
    this.resolveFn = options.resolve;
    this.exclude = new Set(options.exclude ?? []);
  }

  /** The schema and models, for the foreign keys declared by referential constraints. */
  setSchema(schema: ODataSchemaConfig, models: Record<string, ModelStatic<Model>>): void {
    this.schema = schema;
    this.models = models;
  }

  /**
   * Foreign keys of an entity: its model's belongs-to associations and every
   * referential constraint in the schema where the entity is the dependent.
   */
  private foreignKeys(model: ModelStatic<Model>, entityName?: string): ForeignKeyRef[] {
    const entity = entityName ? this.schema?.entities[entityName] : undefined;
    const payloadKeys = (attribute: string): string[] => [...new Set([
      attribute,
      entity?.properties[attribute]?.column,
      (model as any).rawAttributes?.[attribute]?.field,
    ].filter((k): k is string => typeof k === 'string' && k.length > 0))];
    const refs = new Map<string, ForeignKeyRef>();
    for (const assoc of Object.values((model as any).associations ?? {}) as any[]) {
      if (assoc.associationType !== 'BelongsTo') continue;
      refs.set(assoc.foreignKey, {
        foreignKey: assoc.foreignKey, payloadKeys: payloadKeys(assoc.foreignKey), target: assoc.target, targetKey: assoc.targetKey,
      });
    }
    for (const association of Object.values(this.schema?.associations ?? {})) {
      const rc = association.referentialConstraint;
      if (!rc || !entityName || rc.dependent.entity !== entityName || refs.has(rc.dependent.property)) continue;
      const principal = this.schema!.entities[rc.principal.entity];
      const target = principal && this.models[principal.model || rc.principal.entity];
      if (target) {
        refs.set(rc.dependent.property, {
          foreignKey: rc.dependent.property, payloadKeys: payloadKeys(rc.dependent.property), target, targetKey: rc.principal.property,
        });
      }
    }
    return [...refs.values()];
  }

  /** Whether rows of the model belong to a tenant (has the attribute, not excluded). */
  isScoped(model: ModelStatic<Model> | undefined): boolean {
    return !!(model as any)?.rawAttributes?.[this.attribute] && !this.exclude.has((model as any).name);
  }

  /** Marks a $batch part's mock request with the outer request's tenant. */
  static setBatchTenant(mockReq: Record<PropertyKey, unknown>, tenantId: TenantId | null): void {
    mockReq[BATCH_TENANT] = tenantId;
  }

  /** The request's tenant or null (a $batch part: the outer request's). */
  resolveRequest(req: unknown): TenantId | null {
    const r = req as Record<PropertyKey, unknown>;
    const id = r && Object.prototype.hasOwnProperty.call(r, BATCH_TENANT)
      ? (r[BATCH_TENANT] as TenantId | null)
      : this.resolveFn(req as any);
    return id === undefined || id === null || id === '' ? null : id;
  }

  /** The request's tenant; 403 when there is none (fail closed). */
  resolve(ctx: HookContext): TenantId {
    const id = this.resolveRequest(ctx.req);
    if (id === null) {
      throw new ODataError(403, 'Forbidden');
    }
    return id;
  }

  /** `where` limited to the tenant (unchanged for unscoped models). */
  where(model: ModelStatic<Model>, tenantId: TenantId, where?: WhereOptions): WhereOptions | undefined {
    if (!this.isScoped(model)) return where;
    const own = { [this.attribute]: tenantId };
    return where ? ({ [Op.and]: [where, own] } as WhereOptions) : own;
  }

  /** Limits a find to the tenant, including every (nested) include. */
  scopeFind<T extends FindOptions>(model: ModelStatic<Model>, options: T, tenantId: TenantId): T {
    options.where = this.where(model, tenantId, options.where);
    if (options.include) this.scopeIncludes(options.include as Includeable[], tenantId);
    return options;
  }

  private scopeIncludes(includes: Includeable | Includeable[], tenantId: TenantId): void {
    for (const include of Array.isArray(includes) ? includes : [includes]) {
      const inc = include as IncludeOptions;
      if (!inc || typeof inc !== 'object' || !inc.model) continue;
      const model = inc.model as ModelStatic<Model>;
      if (this.isScoped(model)) {
        inc.where = this.where(model, tenantId, inc.where);
        // A where makes an include an INNER JOIN by default; a row whose
        // related row belongs to another tenant keeps the relation empty.
        if (inc.required === undefined) inc.required = false;
      }
      if (inc.include) this.scopeIncludes(inc.include as Includeable[], tenantId);
    }
  }

  /**
   * Prepares a create/update payload: the tenant attribute is the request's
   * (another value is 403, an update drops it), and every foreign key in the
   * payload (belongs-to association or referential constraint) must
   * reference a row of the tenant (404 otherwise).
   */
  async checkWrite(
    model: ModelStatic<Model>,
    data: Record<string, unknown>,
    tenantId: TenantId,
    { create, transaction, entityName }: { create: boolean; transaction?: Transaction; entityName?: string }
  ): Promise<void> {
    if (!data || typeof data !== 'object') return;
    if (this.isScoped(model)) {
      const value = data[this.attribute];
      if (value !== undefined && value !== null && value !== tenantId) {
        throw new ODataError(403, 'Forbidden');
      }
      if (create) data[this.attribute] = tenantId;
      else delete data[this.attribute];
    }
    for (const ref of this.foreignKeys(model, entityName)) {
      if (!this.isScoped(ref.target)) continue;
      for (const key of ref.payloadKeys) {
        const value = data[key];
        if (value === undefined || value === null) continue;
        const found = await ref.target.count({
          where: { [ref.targetKey]: value, [this.attribute]: tenantId },
          transaction,
        });
        if (!found) throw new ODataError(404, `${ref.target.name} not found`);
      }
    }
  }
}
