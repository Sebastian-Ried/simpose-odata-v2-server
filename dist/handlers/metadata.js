"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMetadata = handleMetadata;
exports.handleServiceDocument = handleServiceDocument;
const defaults_1 = require("../config/defaults");
/**
 * Handle $metadata endpoint
 */
async function handleMetadata(req, res, metadataGenerator) {
    const edmx = metadataGenerator.generateEdmx();
    res.status(200)
        .header('Content-Type', 'application/xml')
        .header('DataServiceVersion', defaults_1.ODATA_VERSION)
        .send(edmx);
}
/**
 * Handle service document (root endpoint)
 */
async function handleServiceDocument(req, res, schema, basePath) {
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
    }
    else {
        // Atom format (default for OData V2)
        const entitySets = Object.keys(schema.entities);
        const xml = buildServiceDocumentXml(schema, basePath, entitySets);
        res.status(200)
            .header('Content-Type', 'application/atomsvc+xml')
            .header('DataServiceVersion', defaults_1.ODATA_VERSION)
            .send(xml);
    }
}
/**
 * Build service document XML
 */
function buildServiceDocumentXml(schema, basePath, entitySets) {
    const lines = [
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
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
//# sourceMappingURL=metadata.js.map