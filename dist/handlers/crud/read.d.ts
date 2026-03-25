import { Request, Response } from 'express';
import { ODataSchemaConfig, ParsedQuery } from '../../config/types';
import { BaseHandler } from '../base-handler';
/**
 * Handle OData read operations (GET requests)
 */
export declare function handleRead(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown> | undefined, schema: ODataSchemaConfig, query: ParsedQuery, basePath: string, models: Record<string, any>): Promise<void>;
/**
 * Handle $count requests
 */
export declare function handleCount(req: Request, res: Response, handler: BaseHandler, entityName: string, schema: ODataSchemaConfig, query: ParsedQuery, models: Record<string, any>): Promise<void>;
/**
 * Handle navigation property read
 */
export declare function handleNavigationRead(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown>, navigationProperty: string, schema: ODataSchemaConfig, query: ParsedQuery, basePath: string, models: Record<string, any>): Promise<void>;
/**
 * Handle property value read ($value)
 */
export declare function handlePropertyValue(req: Request, res: Response, handler: BaseHandler, entityName: string, keys: Record<string, unknown>, propertyName: string, schema: ODataSchemaConfig, query: ParsedQuery, models: Record<string, any>): Promise<void>;
//# sourceMappingURL=read.d.ts.map