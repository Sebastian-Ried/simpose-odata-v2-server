import { Request, Response } from 'express';
import { ODataSchemaConfig, FunctionImportHandler, FunctionImportDefinition } from '../config/types';
/**
 * Handle function import execution
 */
export declare function handleFunctionImport(req: Request, res: Response, functionName: string, schema: ODataSchemaConfig, basePath: string, models: Record<string, any>, functionImports: Record<string, FunctionImportHandler>, params: Record<string, unknown>): Promise<void>;
/**
 * Parse function import parameters from URL
 */
export declare function parseFunctionImportParams(urlParams: Record<string, unknown>, queryParams: Record<string, string | undefined>, funcDef: FunctionImportDefinition): Record<string, unknown>;
//# sourceMappingURL=function-import.d.ts.map