import { ExpandOption, ODataSchemaConfig } from '../config/types';
import { Model, ModelStatic, IncludeOptions, Includeable } from 'sequelize';

/**
 * Merge an array of ExpandOptions, combining nested expands for duplicate properties.
 * OData v2 clients emit e.g. "trees/treeType,trees/treeVariety" which parses into
 * two ExpandOptions both with property="trees" — they must be merged before building
 * Sequelize includes to avoid duplicate association errors.
 */
function mergeExpands(expands: ExpandOption[]): ExpandOption[] {
  const map = new Map<string, ExpandOption>();
  for (const e of expands) {
    const existing = map.get(e.property);
    if (existing) {
      existing.nested = mergeExpands([...(existing.nested ?? []), ...(e.nested ?? [])]);
    } else {
      map.set(e.property, { ...e, nested: e.nested ? mergeExpands(e.nested) : undefined });
    }
  }
  return Array.from(map.values());
}

/**
 * Build Sequelize includes from $expand options
 */
export function buildExpands(
  expands: ExpandOption[],
  entityName: string,
  schema: ODataSchemaConfig,
  models: Record<string, ModelStatic<Model>>
): IncludeOptions[] {
  const merged = mergeExpands(expands);
  const includes: IncludeOptions[] = [];

  for (const expand of merged) {
    const include = buildSingleExpand(expand, entityName, schema, models);
    if (include) {
      includes.push(include);
    }
  }

  return includes;
}

/**
 * Build a single include from expand option
 */
function buildSingleExpand(
  expand: ExpandOption,
  entityName: string,
  schema: ODataSchemaConfig,
  models: Record<string, ModelStatic<Model>>
): IncludeOptions | null {
  const entity = schema.entities[entityName];
  if (!entity) {
    return null;
  }

  const navProp = entity.navigationProperties?.[expand.property];
  if (!navProp) {
    return null;
  }

  const targetEntity = schema.entities[navProp.target];
  if (!targetEntity) {
    return null;
  }

  const targetModelName = targetEntity.model || navProp.target;
  const targetModel = models[targetModelName];
  if (!targetModel) {
    return null;
  }

  const include: IncludeOptions = {
    model: targetModel,
    as: expand.property,
  };

  // Handle $select within expand
  if (expand.select && expand.select.length > 0) {
    include.attributes = expand.select;
  }

  // Handle nested expands
  if (expand.nested && expand.nested.length > 0) {
    include.include = buildExpands(
      expand.nested,
      navProp.target,
      schema,
      models
    );
  }

  return include;
}

/**
 * Resolve navigation property path to target entity and build includes
 */
export function resolveNavigationPath(
  path: string[],
  entityName: string,
  schema: ODataSchemaConfig,
  models: Record<string, ModelStatic<Model>>
): { includes: IncludeOptions[]; targetEntity: string } | null {
  let currentEntity = entityName;
  const includes: IncludeOptions[] = [];
  let currentIncludeLevel: IncludeOptions[] = includes;

  for (const segment of path) {
    const entity = schema.entities[currentEntity];
    if (!entity) {
      return null;
    }

    const navProp = entity.navigationProperties?.[segment];
    if (!navProp) {
      return null;
    }

    const targetEntity = schema.entities[navProp.target];
    if (!targetEntity) {
      return null;
    }

    const targetModelName = targetEntity.model || navProp.target;
    const targetModel = models[targetModelName];
    if (!targetModel) {
      return null;
    }

    const include: IncludeOptions = {
      model: targetModel,
      as: segment,
    };

    currentIncludeLevel.push(include);

    // Set up for next level
    currentEntity = navProp.target;
    include.include = [];
    currentIncludeLevel = include.include as IncludeOptions[];
  }

  return { includes, targetEntity: currentEntity };
}

/**
 * Get the target entity type from a navigation property
 */
export function getNavigationTarget(
  entityName: string,
  navigationProperty: string,
  schema: ODataSchemaConfig
): string | null {
  const entity = schema.entities[entityName];
  if (!entity) {
    return null;
  }

  const navProp = entity.navigationProperties?.[navigationProperty];
  if (!navProp) {
    return null;
  }

  return navProp.target;
}

/**
 * Check if a navigation property returns a collection
 */
export function isNavigationCollection(
  entityName: string,
  navigationProperty: string,
  schema: ODataSchemaConfig
): boolean {
  const entity = schema.entities[entityName];
  if (!entity) {
    return false;
  }

  const navProp = entity.navigationProperties?.[navigationProperty];
  if (!navProp) {
    return false;
  }

  return navProp.multiplicity === '*';
}
