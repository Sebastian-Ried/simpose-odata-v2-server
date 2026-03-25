import { Request, Response } from 'express';
import { ODataSchemaConfig } from '../config/types';
import { MetadataGenerator } from '../metadata/generator';
/**
 * Handle $metadata endpoint
 */
export declare function handleMetadata(req: Request, res: Response, metadataGenerator: MetadataGenerator): Promise<void>;
/**
 * Handle service document (root endpoint)
 */
export declare function handleServiceDocument(req: Request, res: Response, schema: ODataSchemaConfig, basePath: string): Promise<void>;
//# sourceMappingURL=metadata.d.ts.map