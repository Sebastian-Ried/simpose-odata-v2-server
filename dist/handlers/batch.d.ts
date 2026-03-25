import { Request, Response } from 'express';
import { ODataSchemaConfig, BatchResponsePart } from '../config/types';
/**
 * Handle $batch endpoint
 */
export declare function handleBatch(req: Request, res: Response, schema: ODataSchemaConfig, basePath: string, processRequest: (method: string, path: string, headers: Record<string, string>, body: unknown, contentId?: string) => Promise<BatchResponsePart>, sequelize: any): Promise<void>;
//# sourceMappingURL=batch.d.ts.map