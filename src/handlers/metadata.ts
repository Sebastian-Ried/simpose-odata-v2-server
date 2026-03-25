import { Request, Response } from 'express';
import { ODataSchemaConfig } from '../config/types';
import { MetadataGenerator } from '../metadata/generator';
import { ODATA_VERSION } from '../config/defaults';

/**
 * Handle $metadata endpoint
 */
export async function handleMetadata(
  req: Request,
  res: Response,
  metadataGenerator: MetadataGenerator
): Promise<void> {
  const edmx = metadataGenerator.generateEdmx();

  res.status(200)
    .header('Content-Type', 'application/xml')
    .header('DataServiceVersion', ODATA_VERSION)
    .send(edmx);
}

/**
 * Handle service document (root endpoint)
 */
export async function handleServiceDocument(
  req: Request,
  res: Response,
  schema: ODataSchemaConfig,
  basePath: string
): Promise<void> {
  const accept = req.headers.accept || '';

  if (accept.includes('application/json')) {
    // JSON format
    const entitySets = Object.keys(schema.entities).map((name) => ({
      name,
      url: name,
    }));

    res.status(200).json({
      d: {
        EntitySets: entitySets,
      },
    });
  } else {
    // Atom format (default for OData V2)
    const entitySets = Object.keys(schema.entities);
    const xml = buildServiceDocumentXml(schema, basePath, entitySets);

    res.status(200)
      .header('Content-Type', 'application/atomsvc+xml')
      .header('DataServiceVersion', ODATA_VERSION)
      .send(xml);
  }
}

/**
 * Build service document XML
 */
function buildServiceDocumentXml(
  schema: ODataSchemaConfig,
  basePath: string,
  entitySets: string[]
): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<service xml:base="' + escapeXml(basePath) + '/" xmlns="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <workspace>',
    '    <atom:title>' + escapeXml(schema.namespace) + '</atom:title>',
  ];

  for (const entitySet of entitySets) {
    lines.push(`    <collection href="${escapeXml(entitySet)}">`);
    lines.push(`      <atom:title>${escapeXml(entitySet)}</atom:title>`);
    lines.push('    </collection>');
  }

  lines.push('  </workspace>');
  lines.push('</service>');

  return lines.join('\n');
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
