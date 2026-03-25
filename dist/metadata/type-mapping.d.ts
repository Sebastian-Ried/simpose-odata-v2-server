import { DataType } from 'sequelize';
import { EdmType } from '../config/types';
/**
 * Map Sequelize data types to OData EDM types
 */
export declare function sequelizeToEdmType(sequelizeType: DataType): EdmType;
/**
 * Map OData EDM types to Sequelize data types
 */
export declare function edmToSequelizeType(edmType: EdmType): DataType;
/**
 * Convert a JavaScript value to OData literal format
 */
export declare function valueToODataLiteral(value: unknown, edmType: EdmType): string;
/**
 * Parse an OData literal value to JavaScript
 */
export declare function odataLiteralToValue(literal: string | unknown, edmType?: EdmType): unknown;
/**
 * Get the default SRID for EDM Geometry types
 */
export declare function getDefaultSrid(edmType: EdmType): number | undefined;
//# sourceMappingURL=type-mapping.d.ts.map