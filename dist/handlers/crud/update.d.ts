import { Request, Response } from 'express';
import { ODataSchemaConfig, ParsedQuery } from '../../config/types';
import { BaseHandler } from '../base-handler';
/**
 * Handle OData update operations (PUT requests - full replace)
 */
export declare function handleUpdate(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown>, schema: ODataSchemaConfig, query: ParsedQuery, basePath: string, models: Record<string, any>): Promise<void>;
/**
 * Handle OData merge operations (MERGE/PATCH requests - partial update)
 */
export declare function handleMerge(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown>, schema: ODataSchemaConfig, query: ParsedQuery, basePath: string, models: Record<string, any>): Promise<void>;
/**
 * Handle link creation (POST to $links)
 */
export declare function handleCreateLink(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown>, navigationProperty: string, schema: ODataSchemaConfig, models: Record<string, any>, sequelize: any): Promise<void>;
/**
 * Handle link deletion (DELETE to $links)
 */
export declare function handleDeleteLink(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown>, navigationProperty: string, targetKeys: Record<string, unknown> | undefined, schema: ODataSchemaConfig, models: Record<string, any>): Promise<void>;
//# sourceMappingURL=update.d.ts.map