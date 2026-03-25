"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryOptionError = void 0;
exports.parseQueryOptions = parseQueryOptions;
exports.validateQueryOptions = validateQueryOptions;
const filter_parser_1 = require("./filter-parser");
const defaults_1 = require("../config/defaults");
/** Maximum allowed $skip value to prevent resource exhaustion */
const MAX_SKIP = 100000;
/**
 * Parse all OData query options from URL query string
 */
function parseQueryOptions(query) {
    const parsed = {};
    // $filter
    if (query['$filter']) {
        try {
            parsed.$filter = (0, filter_parser_1.parseFilter)(query['$filter']);
        }
        catch (e) {
            throw new QueryOptionError('$filter', e.message);
        }
    }
    // $select
    if (query['$select']) {
        parsed.$select = parseSelect(query['$select']);
    }
    // $expand
    if (query['$expand']) {
        try {
            parsed.$expand = parseExpand(query['$expand']);
        }
        catch (e) {
            throw new QueryOptionError('$expand', e.message);
        }
    }
    // $orderby
    if (query['$orderby']) {
        parsed.$orderby = parseOrderBy(query['$orderby']);
    }
    // $top
    if (query['$top']) {
        const top = parseInt(query['$top'], 10);
        if (isNaN(top) || top < 0) {
            throw new QueryOptionError('$top', 'must be a non-negative integer');
        }
        if (top > defaults_1.MAX_PAGE_SIZE) {
            throw new QueryOptionError('$top', `exceeds maximum of ${defaults_1.MAX_PAGE_SIZE}`);
        }
        parsed.$top = top;
    }
    // $skip
    if (query['$skip']) {
        const skip = parseInt(query['$skip'], 10);
        if (isNaN(skip) || skip < 0) {
            throw new QueryOptionError('$skip', 'must be a non-negative integer');
        }
        if (skip > MAX_SKIP) {
            throw new QueryOptionError('$skip', `exceeds maximum of ${MAX_SKIP}`);
        }
        parsed.$skip = skip;
    }
    // $count (for $count segment)
    if (query['$count'] === 'true' || query['$count'] === '') {
        parsed.$count = true;
    }
    // $inlinecount
    if (query['$inlinecount']) {
        const value = query['$inlinecount'].toLowerCase();
        if (value !== 'allpages' && value !== 'none') {
            throw new QueryOptionError('$inlinecount', 'must be "allpages" or "none"');
        }
        parsed.$inlinecount = value;
    }
    // $format
    if (query['$format']) {
        const format = query['$format'].toLowerCase();
        if (format !== 'json' && format !== 'atom') {
            throw new QueryOptionError('$format', 'must be "json" or "atom"');
        }
        parsed.$format = format;
    }
    return parsed;
}
/**
 * Parse $select option
 */
function parseSelect(select) {
    return select
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
/**
 * Parse $expand option
 * Supports nested expansion like: Category,Supplier,Category/Parent
 */
function parseExpand(expand) {
    const result = [];
    const items = splitExpandItems(expand);
    for (const item of items) {
        const option = parseExpandItem(item.trim());
        if (option) {
            result.push(option);
        }
    }
    return result;
}
/**
 * Split expand string by comma, respecting parentheses
 */
function splitExpandItems(expand) {
    const items = [];
    let current = '';
    let depth = 0;
    for (const char of expand) {
        if (char === '(') {
            depth++;
            current += char;
        }
        else if (char === ')') {
            depth--;
            current += char;
        }
        else if (char === ',' && depth === 0) {
            if (current.trim()) {
                items.push(current.trim());
            }
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current.trim()) {
        items.push(current.trim());
    }
    return items;
}
/**
 * Parse a single $expand item
 * Handles nested paths like Category/Parent
 */
function parseExpandItem(item) {
    if (!item)
        return null;
    // Check for OData V4-style options (not fully supported in V2, but handle gracefully)
    const optionsMatch = item.match(/^([^(]+)\((.+)\)$/);
    if (optionsMatch) {
        const property = optionsMatch[1].trim();
        const optionsStr = optionsMatch[2];
        const nested = parseExpandOptions(property, optionsStr);
        return nested;
    }
    // Handle path segments (Category/Parent)
    if (item.includes('/')) {
        const parts = item.split('/');
        let current = null;
        // Build from end to start
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();
            if (!part)
                continue;
            const newOption = { property: part };
            if (current) {
                newOption.nested = [current];
            }
            current = newOption;
        }
        return current;
    }
    return { property: item };
}
/**
 * Parse nested expand options (limited V2 support)
 */
function parseExpandOptions(property, optionsStr) {
    const option = { property };
    // Very basic parsing for V2 compatibility
    // V2 doesn't officially support nested options, but some implementations do
    const selectMatch = optionsStr.match(/\$select=([^;)]+)/);
    if (selectMatch) {
        option.select = selectMatch[1].split(',').map((s) => s.trim());
    }
    const expandMatch = optionsStr.match(/\$expand=([^;)]+)/);
    if (expandMatch) {
        option.nested = parseExpand(expandMatch[1]);
    }
    return option;
}
/**
 * Parse $orderby option
 */
function parseOrderBy(orderby) {
    return orderby
        .split(',')
        .map((item) => {
        const parts = item.trim().split(/\s+/);
        const property = parts[0] || '';
        const direction = parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc';
        return { property, direction };
    })
        .filter((item) => item.property.length > 0);
}
/**
 * Query option parsing error
 */
class QueryOptionError extends Error {
    option;
    constructor(option, message) {
        super(`Invalid ${option}: ${message}`);
        this.option = option;
        this.name = 'QueryOptionError';
    }
}
exports.QueryOptionError = QueryOptionError;
/**
 * Validate and normalize query options for an entity
 */
function validateQueryOptions(options, entityName, schema) {
    const entity = schema.entities[entityName];
    if (!entity) {
        return options;
    }
    // Validate $select properties exist
    if (options.$select) {
        const invalidProps = options.$select.filter((prop) => !entity.properties[prop] && !entity.navigationProperties?.[prop]);
        if (invalidProps.length > 0) {
            throw new QueryOptionError('$select', `Unknown properties: ${invalidProps.join(', ')}`);
        }
    }
    // Validate $expand navigation properties exist
    if (options.$expand) {
        for (const expand of options.$expand) {
            if (!entity.navigationProperties?.[expand.property]) {
                throw new QueryOptionError('$expand', `Unknown navigation property: ${expand.property}`);
            }
        }
    }
    // Validate $orderby properties exist
    if (options.$orderby) {
        for (const order of options.$orderby) {
            // Handle navigation property paths
            const baseProp = order.property.split('/')[0];
            if (!entity.properties[baseProp] && !entity.navigationProperties?.[baseProp]) {
                throw new QueryOptionError('$orderby', `Unknown property: ${order.property}`);
            }
        }
    }
    return options;
}
//# sourceMappingURL=query-options.js.map