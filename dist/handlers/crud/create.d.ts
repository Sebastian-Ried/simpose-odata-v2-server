import { Request, Response } from 'express';
import { ODataSchemaConfig, ParsedQuery } from '../../config/types';
import { BaseHandler } from '../base-handler';
/**
 * Handle OData create operations (POST requests)
 */
export declare function handleCreate(req: Request, res: Response, handler: BaseHandler, entityName: string, schema: ODataSchemaConfig, query: ParsedQuery, basePath: string, models: Record<string, any>): Promise<void>;
/**
 * Handle deep create (POST with nested entities)
 */
export declare function handleDeepCreate(req: Request, res: Response, handler: BaseHandler, entityName: string, schema: ODataSchemaConfig, query: ParsedQuery, basePath: string, models: Record<string, any>, sequelize: any): Promise<void>;
/**
 * Handle POST to navigation property (create related entity)
 */
export declare function handleNavigationCreate(req: Request, res: Response, parentHandler: BaseHandler, parentEntityName: string, parentKeys: Record<string, unknown>, navigationProperty: string, schema: ODataSchemaConfig, query: ParsedQuery, basePath: string, models: Record<string, any>, handlers: Record<string, BaseHandler>): Promise<void>;
//# sourceMappingURL=create.d.ts.map