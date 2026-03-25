"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateFilter = translateFilter;
const sequelize_1 = require("sequelize");
/**
 * Escape special LIKE pattern characters to prevent injection
 * This ensures user input is treated as literal text, not pattern syntax
 */
function escapeLikePattern(value) {
    // Escape %, _, and \ which are special in LIKE patterns
    return value
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
}
/**
 * Validate a property path against the schema to prevent unauthorized access.
 * Supports navigation paths like "Category/Name" or "Order/Customer/Address".
 *
 * @param propertyPath - The OData property path (e.g., "Category/Name")
 * @param entityName - The starting entity name
 * @param schema - The OData schema configuration
 * @returns true if the path is valid, throws an error otherwise
 */
function validatePropertyPath(propertyPath, entityName, schema) {
    const parts = propertyPath.split('/');
    let currentEntity = schema.entities[entityName];
    if (!currentEntity) {
        throw new Error(`Unknown entity: ${entityName}`);
    }
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        // Check if it's a direct property
        if (currentEntity.properties[part]) {
            if (!isLast) {
                // Can't navigate through a primitive property
                throw new Error(`Invalid property path: '${part}' is not a navigation property`);
            }
            return true;
        }
        // Check if it's a navigation property
        const navProp = currentEntity.navigationProperties?.[part];
        if (navProp) {
            if (isLast) {
                // Navigation property at the end is valid (selecting the related entity)
                return true;
            }
            // Navigate to the target entity
            const targetEntity = schema.entities[navProp.target];
            if (!targetEntity) {
                throw new Error(`Invalid navigation target: ${navProp.target}`);
            }
            currentEntity = targetEntity;
        }
        else {
            throw new Error(`Unknown property '${part}' on entity '${entityName}'`);
        }
    }
    return true;
}
/**
 * Translate OData filter AST to Sequelize WHERE clause
 */
function translateFilter(filter, entityName, schema, sequelize, models) {
    return translateNode(filter, entityName, schema, sequelize, models);
}
/**
 * Translate a single AST node to Sequelize format
 */
function translateNode(node, entityName, schema, sequelize, models) {
    switch (node.type) {
        case 'binary':
            return translateBinaryOp(node, entityName, schema, sequelize, models);
        case 'unary':
            return translateUnaryOp(node, entityName, schema, sequelize, models);
        case 'function':
            return translateFunction(node, entityName, schema, sequelize);
        case 'property':
            return translateProperty(node);
        case 'literal':
            return node.value;
        default:
            throw new Error(`Unknown filter node type: ${node.type}`);
    }
}
/**
 * Check if an operator is an arithmetic operator
 */
function isArithmeticOperator(operator) {
    return ['add', 'sub', 'mul', 'div', 'mod'].includes(operator);
}
/**
 * Check if an operator is a comparison operator
 */
function isComparisonOperator(operator) {
    return ['eq', 'ne', 'lt', 'le', 'gt', 'ge'].includes(operator);
}
/**
 * Build a SQL expression for an arithmetic operation, returning the SQL string
 * and any values that need to be parameterized
 */
function buildArithmeticExpression(node, entityName, schema, sequelize) {
    if (node.type === 'literal') {
        // Literal values - escape them properly
        const value = node.value;
        const escaped = sequelize.escape(value);
        return { sql: escaped, hasColumn: false };
    }
    if (node.type === 'property') {
        // Column reference - use identifier quoting
        const propPath = getPropertyPath(node.name);
        // Use proper column quoting based on dialect
        const dialect = sequelize.getDialect();
        let quotedCol;
        if (dialect === 'mysql' || dialect === 'mariadb') {
            quotedCol = `\`${propPath.replace(/`/g, '``')}\``;
        }
        else if (dialect === 'mssql') {
            quotedCol = `[${propPath.replace(/]/g, ']]')}]`;
        }
        else {
            // PostgreSQL, SQLite use double quotes
            quotedCol = `"${propPath.replace(/"/g, '""')}"`;
        }
        return { sql: quotedCol, hasColumn: true };
    }
    if (node.type === 'function') {
        // Function call - translate and convert to SQL
        const funcResult = translateFunction(node, entityName, schema, sequelize);
        // If it's a Sequelize function object, we need to get its SQL representation
        if (funcResult && typeof funcResult === 'object' && funcResult.fn) {
            // This is a fn() result - for simplicity, we'll use a placeholder approach
            // In practice, this works because Sequelize handles the escaping
            return { sql: funcResult.toString(), hasColumn: true };
        }
        return { sql: sequelize.escape(funcResult), hasColumn: false };
    }
    if (node.type === 'binary' && isArithmeticOperator(node.operator)) {
        // Nested arithmetic expression
        const leftExpr = buildArithmeticExpression(node.left, entityName, schema, sequelize);
        const rightExpr = buildArithmeticExpression(node.right, entityName, schema, sequelize);
        const sqlOp = getArithmeticSqlOperator(node.operator);
        return {
            sql: `(${leftExpr.sql} ${sqlOp} ${rightExpr.sql})`,
            hasColumn: leftExpr.hasColumn || rightExpr.hasColumn,
        };
    }
    if (node.type === 'unary' && node.operator === '-') {
        // Unary negation
        const operandExpr = buildArithmeticExpression(node.operand, entityName, schema, sequelize);
        return {
            sql: `(-${operandExpr.sql})`,
            hasColumn: operandExpr.hasColumn,
        };
    }
    // Fallback - translate and escape
    const value = translateNode(node, entityName, schema, sequelize);
    return { sql: sequelize.escape(value), hasColumn: false };
}
/**
 * Get SQL operator for arithmetic operations
 */
function getArithmeticSqlOperator(operator) {
    switch (operator) {
        case 'add': return '+';
        case 'sub': return '-';
        case 'mul': return '*';
        case 'div': return '/';
        case 'mod': return '%';
        default: throw new Error(`Unknown arithmetic operator: ${operator}`);
    }
}
/**
 * Translate binary operations
 */
function translateBinaryOp(node, entityName, schema, sequelize, models) {
    const { operator, left, right } = node;
    if (!left || !right) {
        throw new Error('Binary operation missing left or right operand');
    }
    // Logical operators
    if (operator === 'and') {
        return {
            [sequelize_1.Op.and]: [
                translateNode(left, entityName, schema, sequelize, models),
                translateNode(right, entityName, schema, sequelize, models),
            ],
        };
    }
    if (operator === 'or') {
        return {
            [sequelize_1.Op.or]: [
                translateNode(left, entityName, schema, sequelize, models),
                translateNode(right, entityName, schema, sequelize, models),
            ],
        };
    }
    // Arithmetic operators - return as arithmetic expression for use in comparisons
    if (isArithmeticOperator(operator)) {
        const expr = buildArithmeticExpression(node, entityName, schema, sequelize);
        if (expr.hasColumn) {
            // Contains column reference - return as literal SQL
            return (0, sequelize_1.literal)(expr.sql);
        }
        // Pure literal arithmetic - evaluate it
        const leftValue = translateNode(left, entityName, schema, sequelize, models);
        const rightValue = translateNode(right, entityName, schema, sequelize, models);
        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            switch (operator) {
                case 'add': return leftValue + rightValue;
                case 'sub': return leftValue - rightValue;
                case 'mul': return leftValue * rightValue;
                case 'div': return rightValue !== 0 ? leftValue / rightValue : 0;
                case 'mod': return rightValue !== 0 ? leftValue % rightValue : 0;
            }
        }
        return (0, sequelize_1.literal)(expr.sql);
    }
    // Comparison operators
    if (isComparisonOperator(operator)) {
        // Check if either side contains arithmetic operations
        const leftHasArithmetic = left.type === 'binary' && isArithmeticOperator(left.operator);
        const rightHasArithmetic = right.type === 'binary' && isArithmeticOperator(right.operator);
        if (leftHasArithmetic || rightHasArithmetic) {
            // Build the full comparison with arithmetic as a literal SQL expression
            const leftExpr = buildArithmeticExpression(left, entityName, schema, sequelize);
            const rightExpr = buildArithmeticExpression(right, entityName, schema, sequelize);
            const compOp = getSqlOperator(operator);
            return (0, sequelize_1.literal)(`(${leftExpr.sql} ${compOp} ${rightExpr.sql})`);
        }
        // Standard comparison without arithmetic
        const leftValue = translateNode(left, entityName, schema, sequelize, models);
        const rightValue = translateNode(right, entityName, schema, sequelize, models);
        // If left is a property path, build proper WHERE condition
        if (left.type === 'property') {
            const propertyPath = getPropertyPath(left.name);
            const sequelizeOp = getSequelizeOperator(operator);
            // Security: Validate property path against schema to prevent path traversal
            if (propertyPath.includes('.')) {
                // Navigation property — use $assoc.col$ notation so Sequelize resolves
                // the column via the included association rather than a literal col ref.
                // where(col(...)) objects are rejected by Sequelize inside Op.or arrays.
                validatePropertyPath(left.name, entityName, schema);
                // Resolve the actual DB column name via Sequelize model rawAttributes
                const resolvedPath = resolveColumnPath(propertyPath, entityName, schema, models);
                return { [`$${resolvedPath}$`]: { [sequelizeOp]: rightValue } };
            }
            // Simple property - validate it exists
            const entity = schema.entities[entityName];
            if (entity && !entity.properties[propertyPath] && !entity.navigationProperties?.[propertyPath]) {
                throw new Error(`Unknown property '${propertyPath}' on entity '${entityName}'`);
            }
            return { [propertyPath]: { [sequelizeOp]: rightValue } };
        }
        // If left is a function, use where() to compare
        if (left.type === 'function') {
            const sqlOp = getSqlOperator(operator);
            return (0, sequelize_1.where)(leftValue, sqlOp, rightValue);
        }
        // Fallback for other cases
        return (0, sequelize_1.where)((0, sequelize_1.literal)(String(leftValue)), getSqlOperator(operator), rightValue);
    }
    throw new Error(`Unknown binary operator: ${operator}`);
}
/**
 * Translate unary operations
 */
function translateUnaryOp(node, entityName, schema, sequelize, models) {
    const { operator, operand } = node;
    if (!operand) {
        throw new Error('Unary operation missing operand');
    }
    if (operator === 'not') {
        return {
            [sequelize_1.Op.not]: translateNode(operand, entityName, schema, sequelize, models),
        };
    }
    if (operator === '-') {
        const value = translateNode(operand, entityName, schema, sequelize, models);
        if (typeof value === 'number') {
            return -value;
        }
        return (0, sequelize_1.literal)(`-${value}`);
    }
    throw new Error(`Unknown unary operator: ${operator}`);
}
/**
 * Translate OData functions to Sequelize
 */
function translateFunction(node, entityName, schema, sequelize) {
    const { name, args } = node;
    if (!name || !args) {
        throw new Error('Function missing name or arguments');
    }
    const funcName = name.toLowerCase();
    const translatedArgs = args.map((arg) => translateNode(arg, entityName, schema, sequelize));
    switch (funcName) {
        // String functions
        case 'substringof': {
            // substringof(needle, haystack) returns true if haystack contains needle
            // Note: OData V2 has reversed parameter order compared to contains
            const [needle, haystack] = translatedArgs;
            if (args[1]?.type === 'property') {
                const propName = getPropertyPath(args[1].name);
                const escapedNeedle = typeof needle === 'string' ? escapeLikePattern(needle) : String(needle);
                // Navigation property paths use $assoc.col$ notation — where(col(...))
                // objects are rejected by Sequelize when nested inside Op.or arrays.
                if (propName.includes('.')) {
                    return { [`$${propName}$`]: { [sequelize_1.Op.iLike]: `%${escapedNeedle}%` } };
                }
                return { [propName]: { [sequelize_1.Op.iLike]: `%${escapedNeedle}%` } };
            }
            const escapedNeedle = typeof needle === 'string' ? escapeLikePattern(needle) : String(needle);
            return (0, sequelize_1.where)((0, sequelize_1.col)(String(haystack)), sequelize_1.Op.iLike, `%${escapedNeedle}%`);
        }
        case 'startswith': {
            const [prop, value] = translatedArgs;
            if (args[0]?.type === 'property') {
                const propName = getPropertyPath(args[0].name);
                const escapedValue = typeof value === 'string' ? escapeLikePattern(value) : String(value);
                if (propName.includes('.')) {
                    return { [`$${propName}$`]: { [sequelize_1.Op.iLike]: `${escapedValue}%` } };
                }
                return { [propName]: { [sequelize_1.Op.iLike]: `${escapedValue}%` } };
            }
            const escapedValue = typeof value === 'string' ? escapeLikePattern(value) : String(value);
            return (0, sequelize_1.where)((0, sequelize_1.col)(String(prop)), sequelize_1.Op.iLike, `${escapedValue}%`);
        }
        case 'endswith': {
            const [prop, value] = translatedArgs;
            if (args[0]?.type === 'property') {
                const propName = getPropertyPath(args[0].name);
                const escapedValue = typeof value === 'string' ? escapeLikePattern(value) : String(value);
                if (propName.includes('.')) {
                    return { [`$${propName}$`]: { [sequelize_1.Op.iLike]: `%${escapedValue}` } };
                }
                return { [propName]: { [sequelize_1.Op.iLike]: `%${escapedValue}` } };
            }
            const escapedValue = typeof value === 'string' ? escapeLikePattern(value) : String(value);
            return (0, sequelize_1.where)((0, sequelize_1.col)(String(prop)), sequelize_1.Op.iLike, `%${escapedValue}`);
        }
        case 'length': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('LENGTH', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('LENGTH', prop);
        }
        case 'indexof': {
            const [prop, search] = translatedArgs;
            // Note: OData uses 0-based index, most DBs use 1-based
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.literal)(`INSTR(${getPropertyPath(args[0].name)}, ${sequelize.escape(search)}) - 1`);
            }
            return (0, sequelize_1.literal)(`INSTR(${prop}, ${sequelize.escape(search)}) - 1`);
        }
        case 'substring': {
            const [prop, start, length] = translatedArgs;
            // OData uses 0-based index
            const startPos = start + 1;
            if (args[0]?.type === 'property') {
                const propName = getPropertyPath(args[0].name);
                if (length !== undefined) {
                    return (0, sequelize_1.fn)('SUBSTRING', (0, sequelize_1.col)(propName), startPos, length);
                }
                return (0, sequelize_1.fn)('SUBSTRING', (0, sequelize_1.col)(propName), startPos);
            }
            if (length !== undefined) {
                return (0, sequelize_1.fn)('SUBSTRING', prop, startPos, length);
            }
            return (0, sequelize_1.fn)('SUBSTRING', prop, startPos);
        }
        case 'tolower': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('LOWER', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('LOWER', prop);
        }
        case 'toupper': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('UPPER', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('UPPER', prop);
        }
        case 'trim': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('TRIM', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('TRIM', prop);
        }
        case 'concat': {
            const [a, b] = translatedArgs;
            return (0, sequelize_1.fn)('CONCAT', a, b);
        }
        case 'replace': {
            const [prop, search, replacement] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('REPLACE', (0, sequelize_1.col)(getPropertyPath(args[0].name)), search, replacement);
            }
            return (0, sequelize_1.fn)('REPLACE', prop, search, replacement);
        }
        // Date functions
        case 'year': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('YEAR', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('YEAR', prop);
        }
        case 'month': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('MONTH', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('MONTH', prop);
        }
        case 'day': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('DAY', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('DAY', prop);
        }
        case 'hour': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('HOUR', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('HOUR', prop);
        }
        case 'minute': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('MINUTE', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('MINUTE', prop);
        }
        case 'second': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('SECOND', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('SECOND', prop);
        }
        // Math functions
        case 'round': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('ROUND', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('ROUND', prop);
        }
        case 'floor': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('FLOOR', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('FLOOR', prop);
        }
        case 'ceiling': {
            const [prop] = translatedArgs;
            if (args[0]?.type === 'property') {
                return (0, sequelize_1.fn)('CEILING', (0, sequelize_1.col)(getPropertyPath(args[0].name)));
            }
            return (0, sequelize_1.fn)('CEILING', prop);
        }
        default:
            throw new Error(`Unsupported filter function: ${name}`);
    }
}
/**
 * Translate property reference
 */
function translateProperty(node) {
    if (!node.name) {
        throw new Error('Property node missing name');
    }
    // Return the property path - will be used as column reference
    return (0, sequelize_1.col)(getPropertyPath(node.name));
}
/**
 * Convert OData property path to Sequelize column reference
 * Handles navigation properties like Category/Name
 */
function getPropertyPath(odataPath) {
    // Replace OData path separator with Sequelize's nested reference
    return odataPath.replace(/\//g, '.');
}
/**
 * Resolve a dotted property path (e.g. "batch.fruitTypeId") to the actual
 * database column path (e.g. "batch.fruit_type_id") by looking up the
 * Sequelize model's rawAttributes for the `field` mapping.
 */
function resolveColumnPath(dottedPath, entityName, schema, models) {
    if (!models)
        return dottedPath;
    const parts = dottedPath.split('.');
    if (parts.length < 2)
        return dottedPath;
    // Walk the navigation path to find the target model
    let currentEntity = schema.entities[entityName];
    let targetModelName;
    for (let i = 0; i < parts.length - 1; i++) {
        const navProp = currentEntity?.navigationProperties?.[parts[i]];
        if (navProp) {
            const targetEntity = schema.entities[navProp.target];
            if (targetEntity) {
                targetModelName = targetEntity.model || navProp.target;
                currentEntity = targetEntity;
            }
        }
    }
    // Resolve the final property's field name from the model
    const lastPart = parts[parts.length - 1];
    if (targetModelName && models[targetModelName]) {
        const model = models[targetModelName];
        const rawAttr = model.rawAttributes?.[lastPart];
        if (rawAttr?.field && rawAttr.field !== lastPart) {
            return [...parts.slice(0, -1), rawAttr.field].join('.');
        }
    }
    return dottedPath;
}
/**
 * Get Sequelize operator symbol from OData operator
 */
function getSequelizeOperator(operator) {
    switch (operator) {
        case 'eq':
            return sequelize_1.Op.eq;
        case 'ne':
            return sequelize_1.Op.ne;
        case 'lt':
            return sequelize_1.Op.lt;
        case 'le':
            return sequelize_1.Op.lte;
        case 'gt':
            return sequelize_1.Op.gt;
        case 'ge':
            return sequelize_1.Op.gte;
        default:
            throw new Error(`Unknown comparison operator: ${operator}`);
    }
}
/**
 * Get SQL operator string from OData operator
 */
function getSqlOperator(operator) {
    switch (operator) {
        case 'eq':
            return '=';
        case 'ne':
            return '!=';
        case 'lt':
            return '<';
        case 'le':
            return '<=';
        case 'gt':
            return '>';
        case 'ge':
            return '>=';
        case 'add':
            return '+';
        case 'sub':
            return '-';
        case 'mul':
            return '*';
        case 'div':
            return '/';
        case 'mod':
            return '%';
        default:
            throw new Error(`Unknown operator: ${operator}`);
    }
}
//# sourceMappingURL=filter-translator.js.map