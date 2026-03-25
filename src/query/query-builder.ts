import {
  ParsedQuery,
  ODataSchemaConfig,
  HookContext,
} from '../config/types';
import {
  Model,
  ModelStatic,
  FindOptions,
  IncludeOptions,
  WhereOptions,
  Sequelize,
} from 'sequelize';
import { translateFilter } from './filter-translator';
import { buildExpands } from './expand-handler';
import { buildSelect } from './select-handler';
import { buildOrderByWithAssociations } from './orderby-handler';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/defaults';

/**
 * Query builder for constructing Sequelize queries from OData options
 */
export class QueryBuilder {
  private schema: ODataSchemaConfig;
  private models: Record<string, ModelStatic<Model>>;
  private sequelize: Sequelize;

  constructor(
    schema: ODataSchemaConfig,
    models: Record<string, ModelStatic<Model>>,
    sequelize: Sequelize
  ) {
    this.schema = schema;
    this.models = models;
    this.sequelize = sequelize;
  }

  /**
   * Build Sequelize FindOptions from parsed OData query
   */
  buildFindOptions(
    entityName: string,
    query: ParsedQuery,
    additionalWhere?: WhereOptions
  ): FindOptions {
    const options: FindOptions = {};

    // $filter
    if (query.$filter) {
      options.where = translateFilter(
        query.$filter,
        entityName,
        this.schema,
        this.sequelize,
        this.models
      );
    }

    // Merge additional where conditions
    if (additionalWhere) {
      if (options.where) {
        options.where = {
          ...options.where,
          ...additionalWhere,
        } as WhereOptions;
      } else {
        options.where = additionalWhere;
      }
    }

    // Also merge query.where if present (from hooks)
    if (query.where) {
      if (options.where) {
        options.where = {
          ...options.where,
          ...query.where,
        } as WhereOptions;
      } else {
        options.where = query.where as WhereOptions;
      }
    }

    // $select
    if (query.$select && query.$select.length > 0) {
      options.attributes = buildSelect(query.$select, entityName, this.schema);
    }

    // $expand
    if (query.$expand && query.$expand.length > 0) {
      options.include = buildExpands(
        query.$expand,
        entityName,
        this.schema,
        this.models
      );
    }

    // Auto-include associations referenced in filters even when $expand is absent.
    // Without the JOIN, Sequelize generates SQL referencing a missing table.
    if (options.where && hasAssociationReference(options.where)) {
      // Disable subquery so the JOIN is in the outer SELECT with the WHERE.
      (options as any).subQuery = false;

      const filterAssocs = extractFilterAssociations(options.where);
      if (filterAssocs.size > 0) {
        this.ensureFilterIncludes(options, entityName, filterAssocs);
      }
    }

    // $orderby
    if (query.$orderby && query.$orderby.length > 0) {
      options.order = buildOrderByWithAssociations(
        query.$orderby,
        entityName,
        this.schema,
        this.models
      );

      // Auto-include associations referenced in $orderby (like filters).
      // Without the JOIN, Sequelize generates SQL referencing a missing table.
      const orderbyAssocs = new Set<string>();
      for (const item of query.$orderby) {
        if (item.property.includes('/')) {
          orderbyAssocs.add(item.property.split('/')[0]!);
        }
      }
      if (orderbyAssocs.size > 0) {
        (options as any).subQuery = false;
        this.ensureFilterIncludes(options, entityName, orderbyAssocs);
      }
    }

    // $top
    if (query.$top !== undefined) {
      options.limit = Math.min(query.$top, MAX_PAGE_SIZE);
    } else {
      // Apply default page size
      options.limit = DEFAULT_PAGE_SIZE;
    }

    // $skip
    if (query.$skip !== undefined) {
      options.offset = query.$skip;
    }

    return options;
  }

  /**
   * Build FindOptions for a single entity lookup
   */
  buildFindOneOptions(
    entityName: string,
    keys: Record<string, unknown>,
    query: ParsedQuery
  ): FindOptions {
    const options = this.buildFindOptions(entityName, query, keys as WhereOptions);

    // Remove pagination for single entity
    delete options.limit;
    delete options.offset;

    return options;
  }

  /**
   * Build count query options
   */
  buildCountOptions(
    entityName: string,
    query: ParsedQuery,
    additionalWhere?: WhereOptions
  ): FindOptions {
    const options: FindOptions = {};

    // Only apply $filter for counting
    if (query.$filter) {
      options.where = translateFilter(
        query.$filter,
        entityName,
        this.schema,
        this.sequelize,
        this.models
      );
    }

    // Merge additional where conditions
    if (additionalWhere) {
      if (options.where) {
        options.where = {
          ...options.where,
          ...additionalWhere,
        } as WhereOptions;
      } else {
        options.where = additionalWhere;
      }
    }

    // Merge query.where if present (from hooks)
    if (query.where) {
      if (options.where) {
        options.where = {
          ...options.where,
          ...query.where,
        } as WhereOptions;
      } else {
        options.where = query.where as WhereOptions;
      }
    }

    // Auto-include associations referenced in filters for count queries too.
    if (options.where && hasAssociationReference(options.where)) {
      (options as any).subQuery = false;
      const filterAssocs = extractFilterAssociations(options.where);
      if (filterAssocs.size > 0) {
        this.ensureFilterIncludes(options, entityName, filterAssocs);
      }
    }

    return options;
  }

  /**
   * Get the Sequelize model for an entity
   */
  getModel(entityName: string): ModelStatic<Model> | undefined {
    const entity = this.schema.entities[entityName];
    if (!entity) {
      return undefined;
    }

    const modelName = entity.model || entityName;
    return this.models[modelName];
  }

  /**
   * Ensure includes exist for associations referenced in filters.
   * Adds minimal includes (attributes: []) so the JOIN is present without
   * fetching unnecessary data.
   */
  private ensureFilterIncludes(
    options: FindOptions,
    entityName: string,
    assocNames: Set<string>
  ): void {
    const existing = (options.include as IncludeOptions[] | undefined) ?? [];
    const existingAliases = new Set(existing.map((inc) => inc.as));

    const entity = this.schema.entities[entityName];
    if (!entity) return;

    for (const assocName of assocNames) {
      if (existingAliases.has(assocName)) continue; // already included

      const navProp = entity.navigationProperties?.[assocName];
      if (!navProp) continue;

      const targetEntity = this.schema.entities[navProp.target];
      if (!targetEntity) continue;

      const targetModelName = targetEntity.model || navProp.target;
      const targetModel = this.models[targetModelName];
      if (!targetModel) continue;

      existing.push({
        model: targetModel,
        as: assocName,
        attributes: [], // only needed for the JOIN, don't fetch columns
      });
    }

    if (existing.length > 0) {
      options.include = existing;
    }
  }

  /**
   * Get primary key values from entity data
   */
  extractKeys(
    entityName: string,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const entity = this.schema.entities[entityName];
    if (!entity) {
      return {};
    }

    const keys: Record<string, unknown> = {};
    for (const keyName of entity.keys) {
      if (data[keyName] !== undefined) {
        keys[keyName] = data[keyName];
      }
    }

    return keys;
  }

  /**
   * Build WHERE clause for entity keys
   */
  buildKeyWhere(
    entityName: string,
    keys: Record<string, unknown>
  ): WhereOptions {
    const entity = this.schema.entities[entityName];
    if (!entity) {
      return keys as WhereOptions;
    }

    const where: Record<string, unknown> = {};

    for (const keyName of entity.keys) {
      if (keys[keyName] !== undefined) {
        // Handle column name mapping
        const prop = entity.properties[keyName];
        const columnName = prop?.column || keyName;
        where[columnName] = keys[keyName];
      } else if (keys[''] !== undefined && entity.keys.length === 1) {
        // Single key without name
        const prop = entity.properties[keyName];
        const columnName = prop?.column || keyName;
        where[columnName] = keys[''];
      }
    }

    return where as WhereOptions;
  }
}

/**
 * Recursively check whether a where clause contains Sequelize association
 * column references (keys like "$assoc.col$").
 */
function hasAssociationReference(obj: unknown): boolean {
  if (obj == null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(hasAssociationReference);
  // Use Reflect.ownKeys to also traverse Symbol-keyed entries (e.g. Op.or, Op.and)
  for (const key of Reflect.ownKeys(obj as Record<string | symbol, unknown>)) {
    if (typeof key === 'string' && key.startsWith('$') && key.endsWith('$') && key.includes('.')) return true;
    if (hasAssociationReference((obj as Record<string | symbol, unknown>)[key as string])) return true;
  }
  return false;
}

/**
 * Extract association names referenced in a where clause via $assoc.col$ patterns.
 * Returns a Set of top-level association names (e.g. "treeVariety" from "$treeVariety.name$").
 */
function extractFilterAssociations(obj: unknown): Set<string> {
  const assocs = new Set<string>();
  if (obj == null || typeof obj !== 'object') return assocs;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      for (const a of extractFilterAssociations(item)) assocs.add(a);
    }
    return assocs;
  }
  for (const key of Reflect.ownKeys(obj as Record<string | symbol, unknown>)) {
    if (typeof key === 'string' && key.startsWith('$') && key.endsWith('$') && key.includes('.')) {
      // Extract the association name: "$treeVariety.name$" → "treeVariety"
      const inner = key.slice(1, -1); // remove leading/trailing $
      const dotIdx = inner.indexOf('.');
      if (dotIdx > 0) {
        assocs.add(inner.substring(0, dotIdx));
      }
    }
    const val = (obj as Record<string | symbol, unknown>)[key as string];
    for (const a of extractFilterAssociations(val)) assocs.add(a);
  }
  return assocs;
}

/**
 * Create a query builder instance
 */
export function createQueryBuilder(
  schema: ODataSchemaConfig,
  models: Record<string, ModelStatic<Model>>,
  sequelize: Sequelize
): QueryBuilder {
  return new QueryBuilder(schema, models, sequelize);
}
