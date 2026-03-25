import { OrderByOption, ODataSchemaConfig } from '../config/types';
import { Order } from 'sequelize';

/**
 * Build Sequelize order clause from $orderby options
 */
export function buildOrderBy(
  orderby: OrderByOption[],
  entityName: string,
  schema: ODataSchemaConfig
): Order {
  const order: Order = [];

  for (const item of orderby) {
    const orderItem = buildOrderItem(item, entityName, schema);
    if (orderItem) {
      order.push(orderItem);
    }
  }

  return order;
}

/**
 * Build a single order item
 */
function buildOrderItem(
  item: OrderByOption,
  entityName: string,
  schema: ODataSchemaConfig
): [string, string] | [any, string] | null {
  const entity = schema.entities[entityName];
  if (!entity) {
    return [item.property, item.direction.toUpperCase()];
  }

  const property = item.property;
  const direction = item.direction.toUpperCase();

  // Handle navigation property paths (Category/Name)
  if (property.includes('/')) {
    const parts = property.split('/');
    // For navigation properties, we need to use association syntax
    // This depends on how the query is structured with includes
    // For now, return the path as-is and let the query builder handle it
    return [parts, direction] as any;
  }

  // Validate property exists
  if (!entity.properties[property]) {
    // Check if it's a navigation property
    if (entity.navigationProperties?.[property]) {
      // Can't order by navigation property directly
      return null;
    }
    // Unknown property - include anyway, let database handle error
  }

  return [property, direction];
}

/**
 * Parse orderby path for navigation properties
 * Returns an array suitable for Sequelize ordering with associations
 */
export function parseOrderByPath(
  path: string,
  entityName: string,
  schema: ODataSchemaConfig
): { segments: string[]; property: string } | null {
  const parts = path.split('/');

  if (parts.length === 1) {
    return { segments: [], property: parts[0]! };
  }

  // Validate navigation path
  let currentEntity = entityName;
  const segments: string[] = [];

  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i]!;
    const entity = schema.entities[currentEntity];

    if (!entity) {
      return null;
    }

    const navProp = entity.navigationProperties?.[segment];
    if (!navProp) {
      return null;
    }

    segments.push(segment);
    currentEntity = navProp.target;
  }

  // Validate final property
  const finalEntity = schema.entities[currentEntity];
  const finalProperty = parts[parts.length - 1]!;

  if (!finalEntity?.properties[finalProperty]) {
    return null;
  }

  return { segments, property: finalProperty };
}

/**
 * Build Sequelize order clause with association support
 */
export function buildOrderByWithAssociations(
  orderby: OrderByOption[],
  entityName: string,
  schema: ODataSchemaConfig,
  models: Record<string, import('sequelize').ModelStatic<import('sequelize').Model>>
): Order {
  const order: Order = [];

  for (const item of orderby) {
    const parsed = parseOrderByPath(item.property, entityName, schema);
    if (!parsed) {
      continue;
    }

    const direction = item.direction.toUpperCase() as 'ASC' | 'DESC';

    if (parsed.segments.length === 0) {
      // Simple property
      order.push([parsed.property, direction]);
    } else {
      // Navigation property path
      const orderItem: any[] = [];
      let currentEntity = entityName;

      for (const segment of parsed.segments) {
        const entity = schema.entities[currentEntity];
        const navProp = entity?.navigationProperties?.[segment];
        if (!navProp) break;

        const targetEntity = schema.entities[navProp.target];
        const modelName = targetEntity?.model || navProp.target;
        const model = models[modelName];

        if (model) {
          orderItem.push({ model, as: segment });
        }
        currentEntity = navProp.target;
      }

      orderItem.push(parsed.property);
      orderItem.push(direction);
      order.push(orderItem as any);
    }
  }

  return order;
}
