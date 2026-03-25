"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_FUNCTIONS = void 0;
exports.configureFilterCache = configureFilterCache;
exports.getFilterCacheStats = getFilterCacheStats;
exports.clearFilterCache = clearFilterCache;
exports.parseFilter = parseFilter;
const type_mapping_1 = require("../metadata/type-mapping");
const cache_1 = require("../utils/cache");
/** Maximum filter expression length to prevent DoS */
const MAX_FILTER_LENGTH = 4096;
/** Maximum recursion depth for filter parsing */
const MAX_PARSE_DEPTH = 50;
/** Filter cache with TTL and LRU eviction */
let filterCache = (0, cache_1.createFilterCache)();
/**
 * Configure the filter cache.
 *
 * @param options - Cache configuration options
 *
 * @example
 * ```typescript
 * // Increase cache size and TTL
 * configureFilterCache({ maxSize: 500, ttl: 600000 });
 *
 * // Disable caching
 * configureFilterCache({ maxSize: 0 });
 * ```
 */
function configureFilterCache(options) {
    filterCache = (0, cache_1.createFilterCache)(options);
}
/**
 * Get filter cache statistics.
 */
function getFilterCacheStats() {
    return filterCache.getStats();
}
/**
 * Clear the filter cache.
 */
function clearFilterCache() {
    filterCache.clear();
}
/**
 * Lexer for OData $filter expressions
 */
class FilterLexer {
    input;
    position = 0;
    tokens = [];
    constructor(input) {
        this.input = input;
    }
    tokenize() {
        while (this.position < this.input.length) {
            this.skipWhitespace();
            if (this.position >= this.input.length)
                break;
            const char = this.input[this.position];
            // Single character tokens
            if (char === '(') {
                this.tokens.push({ type: 'LPAREN', value: '(', position: this.position });
                this.position++;
                continue;
            }
            if (char === ')') {
                this.tokens.push({ type: 'RPAREN', value: ')', position: this.position });
                this.position++;
                continue;
            }
            if (char === ',') {
                this.tokens.push({ type: 'COMMA', value: ',', position: this.position });
                this.position++;
                continue;
            }
            // String literal
            if (char === "'") {
                this.readString();
                continue;
            }
            // DateTime literal
            if (this.matchKeyword('datetime')) {
                this.readDateTime();
                continue;
            }
            // DateTimeOffset literal
            if (this.matchKeyword('datetimeoffset')) {
                this.readDateTimeOffset();
                continue;
            }
            // Guid literal
            if (this.matchKeyword('guid')) {
                this.readGuid();
                continue;
            }
            // Number
            if (char === '-' || (char >= '0' && char <= '9')) {
                this.readNumber();
                continue;
            }
            // Keywords and identifiers
            if (this.isIdentifierStart(char)) {
                this.readIdentifierOrKeyword();
                continue;
            }
            throw new Error(`Unexpected character '${char}' at position ${this.position}`);
        }
        this.tokens.push({ type: 'EOF', value: '', position: this.position });
        return this.tokens;
    }
    skipWhitespace() {
        while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
            this.position++;
        }
    }
    matchKeyword(keyword) {
        const slice = this.input.slice(this.position, this.position + keyword.length).toLowerCase();
        if (slice === keyword && !this.isIdentifierChar(this.input[this.position + keyword.length] || '')) {
            return true;
        }
        return false;
    }
    readString() {
        const start = this.position;
        this.position++; // Skip opening quote
        // Performance: Use array buffer instead of string concatenation
        const chars = [];
        while (this.position < this.input.length) {
            const char = this.input[this.position];
            if (char === "'") {
                if (this.input[this.position + 1] === "'") {
                    // Escaped quote
                    chars.push("'");
                    this.position += 2;
                }
                else {
                    // End of string
                    this.position++;
                    break;
                }
            }
            else {
                chars.push(char);
                this.position++;
            }
        }
        this.tokens.push({ type: 'STRING', value: chars.join(''), position: start });
    }
    readDateTime() {
        const start = this.position;
        this.position += 8; // Skip 'datetime'
        if (this.input[this.position] !== "'") {
            throw new Error(`Expected quote after datetime at position ${this.position}`);
        }
        this.position++;
        // Performance: Use substring instead of char-by-char
        const quoteEnd = this.input.indexOf("'", this.position);
        const value = quoteEnd > 0 ? this.input.slice(this.position, quoteEnd) : '';
        this.position = quoteEnd > 0 ? quoteEnd + 1 : this.input.length;
        this.tokens.push({ type: 'DATETIME', value: `datetime'${value}'`, position: start });
    }
    readDateTimeOffset() {
        const start = this.position;
        this.position += 14; // Skip 'datetimeoffset'
        if (this.input[this.position] !== "'") {
            throw new Error(`Expected quote after datetimeoffset at position ${this.position}`);
        }
        this.position++;
        let value = '';
        while (this.position < this.input.length && this.input[this.position] !== "'") {
            value += this.input[this.position];
            this.position++;
        }
        this.position++; // Skip closing quote
        this.tokens.push({ type: 'DATETIME', value: `datetimeoffset'${value}'`, position: start });
    }
    readGuid() {
        const start = this.position;
        this.position += 4; // Skip 'guid'
        if (this.input[this.position] !== "'") {
            throw new Error(`Expected quote after guid at position ${this.position}`);
        }
        this.position++;
        let value = '';
        while (this.position < this.input.length && this.input[this.position] !== "'") {
            value += this.input[this.position];
            this.position++;
        }
        this.position++; // Skip closing quote
        this.tokens.push({ type: 'GUID', value, position: start });
    }
    readNumber() {
        const start = this.position;
        let value = '';
        // Handle negative sign
        if (this.input[this.position] === '-') {
            value += '-';
            this.position++;
        }
        // Integer part
        while (this.position < this.input.length && /[0-9]/.test(this.input[this.position])) {
            value += this.input[this.position];
            this.position++;
        }
        // Decimal part
        if (this.input[this.position] === '.') {
            value += '.';
            this.position++;
            while (this.position < this.input.length && /[0-9]/.test(this.input[this.position])) {
                value += this.input[this.position];
                this.position++;
            }
        }
        // Type suffix (L, M, D, F)
        const suffix = this.input[this.position];
        if (suffix && /[LlMmDdFf]/.test(suffix)) {
            value += suffix;
            this.position++;
        }
        this.tokens.push({ type: 'NUMBER', value, position: start });
    }
    readIdentifierOrKeyword() {
        const start = this.position;
        let value = '';
        while (this.position < this.input.length && this.isIdentifierChar(this.input[this.position])) {
            value += this.input[this.position];
            this.position++;
        }
        const lower = value.toLowerCase();
        // Check for keywords
        switch (lower) {
            case 'and':
                this.tokens.push({ type: 'AND', value: lower, position: start });
                break;
            case 'or':
                this.tokens.push({ type: 'OR', value: lower, position: start });
                break;
            case 'not':
                this.tokens.push({ type: 'NOT', value: lower, position: start });
                break;
            case 'eq':
                this.tokens.push({ type: 'EQ', value: lower, position: start });
                break;
            case 'ne':
                this.tokens.push({ type: 'NE', value: lower, position: start });
                break;
            case 'lt':
                this.tokens.push({ type: 'LT', value: lower, position: start });
                break;
            case 'le':
                this.tokens.push({ type: 'LE', value: lower, position: start });
                break;
            case 'gt':
                this.tokens.push({ type: 'GT', value: lower, position: start });
                break;
            case 'ge':
                this.tokens.push({ type: 'GE', value: lower, position: start });
                break;
            case 'add':
                this.tokens.push({ type: 'ADD', value: lower, position: start });
                break;
            case 'sub':
                this.tokens.push({ type: 'SUB', value: lower, position: start });
                break;
            case 'mul':
                this.tokens.push({ type: 'MUL', value: lower, position: start });
                break;
            case 'div':
                this.tokens.push({ type: 'DIV', value: lower, position: start });
                break;
            case 'mod':
                this.tokens.push({ type: 'MOD', value: lower, position: start });
                break;
            case 'true':
            case 'false':
                this.tokens.push({ type: 'BOOLEAN', value: lower, position: start });
                break;
            case 'null':
                this.tokens.push({ type: 'NULL', value: lower, position: start });
                break;
            default:
                this.tokens.push({ type: 'IDENTIFIER', value, position: start });
        }
    }
    isIdentifierStart(char) {
        return /[a-zA-Z_]/.test(char);
    }
    isIdentifierChar(char) {
        // Include '/' for navigation property paths like Category/Name
        // Include '.' for nested property access
        return /[a-zA-Z0-9_./]/.test(char);
    }
}
/**
 * Parser for OData $filter expressions
 * Implements recursive descent parsing with proper operator precedence
 */
class FilterParser {
    tokens;
    position = 0;
    depth = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parse() {
        const expr = this.parseOr();
        if (this.current().type !== 'EOF') {
            throw new Error(`Unexpected token '${this.current().value}' at position ${this.current().position}`);
        }
        return expr;
    }
    current() {
        return this.tokens[this.position] || { type: 'EOF', value: '', position: -1 };
    }
    advance() {
        const token = this.current();
        this.position++;
        return token;
    }
    /**
     * Check and increment depth, returning a cleanup function to decrement
     */
    enterScope() {
        if (++this.depth > MAX_PARSE_DEPTH) {
            this.depth--; // Restore before throwing
            throw new Error(`Filter expression nesting exceeds maximum depth of ${MAX_PARSE_DEPTH}`);
        }
        return () => { this.depth--; };
    }
    parseOr() {
        const exitScope = this.enterScope();
        try {
            let left = this.parseAnd();
            while (this.current().type === 'OR') {
                this.advance();
                const right = this.parseAnd();
                left = {
                    type: 'binary',
                    operator: 'or',
                    left,
                    right,
                };
            }
            return left;
        }
        finally {
            exitScope();
        }
    }
    parseAnd() {
        let left = this.parseNot();
        while (this.current().type === 'AND') {
            this.advance();
            const right = this.parseNot();
            left = {
                type: 'binary',
                operator: 'and',
                left,
                right,
            };
        }
        return left;
    }
    parseNot() {
        if (this.current().type === 'NOT') {
            this.advance();
            const operand = this.parseNot();
            return {
                type: 'unary',
                operator: 'not',
                operand,
            };
        }
        return this.parseComparison();
    }
    parseComparison() {
        let left = this.parseAdditive();
        const comparisonOps = ['EQ', 'NE', 'LT', 'LE', 'GT', 'GE'];
        if (comparisonOps.includes(this.current().type)) {
            const op = this.advance().value;
            const right = this.parseAdditive();
            return {
                type: 'binary',
                operator: op,
                left,
                right,
            };
        }
        return left;
    }
    parseAdditive() {
        let left = this.parseMultiplicative();
        while (this.current().type === 'ADD' || this.current().type === 'SUB') {
            const op = this.advance().value;
            const right = this.parseMultiplicative();
            left = {
                type: 'binary',
                operator: op,
                left,
                right,
            };
        }
        return left;
    }
    parseMultiplicative() {
        let left = this.parseUnary();
        while (this.current().type === 'MUL' ||
            this.current().type === 'DIV' ||
            this.current().type === 'MOD') {
            const op = this.advance().value;
            const right = this.parseUnary();
            left = {
                type: 'binary',
                operator: op,
                left,
                right,
            };
        }
        return left;
    }
    parseUnary() {
        // Negative numbers
        if (this.current().type === 'SUB') {
            this.advance();
            const operand = this.parseUnary();
            return {
                type: 'unary',
                operator: '-',
                operand,
            };
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        const token = this.current();
        // Parenthesized expression
        if (token.type === 'LPAREN') {
            this.advance();
            const expr = this.parseOr();
            if (this.current().type !== 'RPAREN') {
                throw new Error(`Expected ')' at position ${this.current().position}`);
            }
            this.advance();
            return expr;
        }
        // String literal
        if (token.type === 'STRING') {
            this.advance();
            return {
                type: 'literal',
                value: token.value,
                dataType: 'Edm.String',
            };
        }
        // Number literal
        if (token.type === 'NUMBER') {
            this.advance();
            const value = (0, type_mapping_1.odataLiteralToValue)(token.value);
            let dataType = 'Edm.Int32';
            if (token.value.includes('.')) {
                dataType = 'Edm.Double';
            }
            if (token.value.endsWith('L') || token.value.endsWith('l')) {
                dataType = 'Edm.Int64';
            }
            if (token.value.endsWith('M') || token.value.endsWith('m')) {
                dataType = 'Edm.Decimal';
            }
            if (token.value.endsWith('D') || token.value.endsWith('d')) {
                dataType = 'Edm.Double';
            }
            if (token.value.endsWith('F') || token.value.endsWith('f')) {
                dataType = 'Edm.Single';
            }
            return {
                type: 'literal',
                value,
                dataType,
            };
        }
        // Boolean literal
        if (token.type === 'BOOLEAN') {
            this.advance();
            return {
                type: 'literal',
                value: token.value === 'true',
                dataType: 'Edm.Boolean',
            };
        }
        // Null literal
        if (token.type === 'NULL') {
            this.advance();
            return {
                type: 'literal',
                value: null,
            };
        }
        // DateTime literal
        if (token.type === 'DATETIME') {
            this.advance();
            return {
                type: 'literal',
                value: (0, type_mapping_1.odataLiteralToValue)(token.value),
                dataType: 'Edm.DateTime',
            };
        }
        // Guid literal
        if (token.type === 'GUID') {
            this.advance();
            return {
                type: 'literal',
                value: token.value,
                dataType: 'Edm.Guid',
            };
        }
        // Identifier (property or function)
        if (token.type === 'IDENTIFIER') {
            this.advance();
            // Check if it's a function call
            if (this.current().type === 'LPAREN') {
                this.advance();
                const args = [];
                if (this.current().type !== 'RPAREN') {
                    args.push(this.parseOr());
                    while (this.current().type === 'COMMA') {
                        this.advance();
                        args.push(this.parseOr());
                    }
                }
                if (this.current().type !== 'RPAREN') {
                    throw new Error(`Expected ')' at position ${this.current().position}`);
                }
                this.advance();
                return {
                    type: 'function',
                    name: token.value,
                    args,
                };
            }
            // Property access (may contain '/')
            return {
                type: 'property',
                name: token.value,
            };
        }
        throw new Error(`Unexpected token '${token.value}' at position ${token.position}`);
    }
}
/**
 * Parse an OData $filter expression into an AST
 */
function parseFilter(filter) {
    // Security: Limit filter length to prevent DoS
    if (filter.length > MAX_FILTER_LENGTH) {
        throw new Error(`Filter expression exceeds maximum length of ${MAX_FILTER_LENGTH} characters`);
    }
    // Performance: Check cache first
    const cached = filterCache.get(filter);
    if (cached) {
        return cached;
    }
    const lexer = new FilterLexer(filter);
    const tokens = lexer.tokenize();
    const parser = new FilterParser(tokens);
    const expr = parser.parse();
    // Cache the result
    filterCache.set(filter, expr);
    return expr;
}
/**
 * List of supported OData V2 filter functions
 */
exports.SUPPORTED_FUNCTIONS = [
    // String functions
    'substringof',
    'startswith',
    'endswith',
    'length',
    'indexof',
    'replace',
    'substring',
    'tolower',
    'toupper',
    'trim',
    'concat',
    // Date functions
    'year',
    'month',
    'day',
    'hour',
    'minute',
    'second',
    // Math functions
    'round',
    'floor',
    'ceiling',
    // Type functions
    'isof',
    'cast',
];
//# sourceMappingURL=filter-parser.js.map