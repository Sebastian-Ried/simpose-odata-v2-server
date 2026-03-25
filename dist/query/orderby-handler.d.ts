import { OrderByOption, ODataSchemaConfig } from '../config/types';
import { Order } from 'sequelize';
/**
 * Build Sequelize order clause from $orderby options
 */
export declare function buildOrderBy(orderby: OrderByOption[], entityName: string, schema: ODataSchemaConfig): Order;
/**
 * Parse orderby path for navigation properties
 * Returns an array suitable for Sequelize ordering with associations
 */
export declare function parseOrderByPath(path: string, entityName: string, schema: ODataSchemaConfig): {
    segments: string[];
    property: string;
} | null;
/**
 * Build Sequelize order clause with association support
 */
export declare function buildOrderByWithAssociations(orderby: OrderByOption[], entityName: string, schema: ODataSchemaConfig, models: Record<string, import('sequelize').ModelStatic<import('sequelize').Model>>): Order;
//# sourceMappingURL=orderby-handler.d.ts.map