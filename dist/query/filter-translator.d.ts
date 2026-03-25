import { FilterExpression, ODataSchemaConfig } from '../config/types';
import { WhereOptions, Sequelize } from 'sequelize';
/**
 * Translate OData filter AST to Sequelize WHERE clause
 */
export declare function translateFilter(filter: FilterExpression, entityName: string, schema: ODataSchemaConfig, sequelize: Sequelize, models?: Record<string, any>): WhereOptions;
//# sourceMappingURL=filter-translator.d.ts.map