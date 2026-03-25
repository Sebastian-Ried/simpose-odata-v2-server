"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEdmx = buildEdmx;
const xmlbuilder2_1 = require("xmlbuilder2");
const defaults_1 = require("../config/defaults");
/**
 * Build EDMX metadata document from OData schema configuration
 */
function buildEdmx(schema, basePath) {
    const doc = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' })
        .ele('edmx:Edmx', {
        'xmlns:edmx': 'http://schemas.microsoft.com/ado/2007/06/edmx',
        Version: '1.0',
    })
        .ele('edmx:DataServices', {
        'm:DataServiceVersion': defaults_1.ODATA_VERSION,
        'xmlns:m': 'http://schemas.microsoft.com/ado/2007/08/dataservices/metadata',
    });
    // Schema element
    const schemaEle = doc.ele('Schema', {
        xmlns: 'http://schemas.microsoft.com/ado/2008/09/edm',
        Namespace: schema.namespace,
    });
    // Entity Types
    for (const [entityName, entity] of Object.entries(schema.entities)) {
        buildEntityType(schemaEle, entityName, entity, schema);
    }
    // Associations
    if (schema.associations) {
        for (const [assocName, assoc] of Object.entries(schema.associations)) {
            buildAssociation(schemaEle, assocName, assoc, schema);
        }
    }
    // Entity Container
    const containerEle = schemaEle.ele('EntityContainer', {
        Name: schema.containerName,
        'm:IsDefaultEntityContainer': 'true',
    });
    // Entity Sets
    for (const entityName of Object.keys(schema.entities)) {
        containerEle.ele('EntitySet', {
            Name: entityName,
            EntityType: `${schema.namespace}.${entityName}`,
        });
    }
    // Association Sets
    if (schema.associations) {
        for (const [assocName, assoc] of Object.entries(schema.associations)) {
            buildAssociationSet(containerEle, assocName, assoc, schema);
        }
    }
    // Function Imports
    if (schema.functionImports) {
        for (const [funcName, func] of Object.entries(schema.functionImports)) {
            buildFunctionImport(containerEle, funcName, func, schema);
        }
    }
    return doc.end({ prettyPrint: true });
}
/**
 * Build EntityType element
 */
function buildEntityType(parent, name, entity, schema) {
    const entityEle = parent.ele('EntityType', { Name: name });
    // Key
    const keyEle = entityEle.ele('Key');
    for (const keyProp of entity.keys) {
        keyEle.ele('PropertyRef', { Name: keyProp });
    }
    // Properties
    for (const [propName, prop] of Object.entries(entity.properties)) {
        buildProperty(entityEle, propName, prop, entity.keys.includes(propName));
    }
    // Navigation Properties
    if (entity.navigationProperties) {
        for (const [navName, nav] of Object.entries(entity.navigationProperties)) {
            entityEle.ele('NavigationProperty', {
                Name: navName,
                Relationship: `${schema.namespace}.${nav.relationship}`,
                FromRole: `${name}Role`,
                ToRole: `${nav.target}Role`,
            });
        }
    }
}
/**
 * Build Property element
 */
function buildProperty(parent, name, prop, isKey) {
    const attrs = {
        Name: name,
        Type: prop.type,
    };
    // Key properties are never nullable
    if (isKey) {
        attrs['Nullable'] = 'false';
    }
    else if (prop.nullable !== undefined) {
        attrs['Nullable'] = String(prop.nullable);
    }
    if (prop.maxLength !== undefined) {
        attrs['MaxLength'] = String(prop.maxLength);
    }
    if (prop.precision !== undefined) {
        attrs['Precision'] = String(prop.precision);
    }
    if (prop.scale !== undefined) {
        attrs['Scale'] = String(prop.scale);
    }
    if (prop.defaultValue !== undefined) {
        attrs['DefaultValue'] = String(prop.defaultValue);
    }
    parent.ele('Property', attrs);
}
/**
 * Build Association element
 */
function buildAssociation(parent, name, assoc, schema) {
    const assocEle = parent.ele('Association', { Name: name });
    // Ends
    for (const end of assoc.ends) {
        assocEle.ele('End', {
            Type: `${schema.namespace}.${end.entity}`,
            Multiplicity: formatMultiplicity(end.multiplicity),
            Role: `${end.entity}Role`,
        });
    }
    // Referential Constraint
    if (assoc.referentialConstraint) {
        const refEle = assocEle.ele('ReferentialConstraint');
        refEle.ele('Principal', {
            Role: `${assoc.referentialConstraint.principal.entity}Role`,
        }).ele('PropertyRef', {
            Name: assoc.referentialConstraint.principal.property,
        });
        refEle.ele('Dependent', {
            Role: `${assoc.referentialConstraint.dependent.entity}Role`,
        }).ele('PropertyRef', {
            Name: assoc.referentialConstraint.dependent.property,
        });
    }
}
/**
 * Build AssociationSet element
 */
function buildAssociationSet(parent, name, assoc, schema) {
    const assocSetEle = parent.ele('AssociationSet', {
        Name: `${name}Set`,
        Association: `${schema.namespace}.${name}`,
    });
    for (const end of assoc.ends) {
        assocSetEle.ele('End', {
            EntitySet: end.entity,
            Role: `${end.entity}Role`,
        });
    }
}
/**
 * Build FunctionImport element
 */
function buildFunctionImport(parent, name, func, schema) {
    const attrs = {
        Name: name,
        'm:HttpMethod': func.httpMethod,
    };
    if (func.returnType) {
        attrs['ReturnType'] = formatReturnType(func.returnType, schema.namespace);
    }
    if (func.entitySet) {
        attrs['EntitySet'] = func.entitySet;
    }
    const funcEle = parent.ele('FunctionImport', attrs);
    // Parameters
    if (func.parameters) {
        for (const [paramName, param] of Object.entries(func.parameters)) {
            const paramAttrs = {
                Name: paramName,
                Type: param.type,
            };
            if (param.nullable !== undefined) {
                paramAttrs['Nullable'] = String(param.nullable);
            }
            if (param.mode && param.mode !== 'In') {
                paramAttrs['Mode'] = param.mode;
            }
            funcEle.ele('Parameter', paramAttrs);
        }
    }
}
/**
 * Format multiplicity for EDMX
 */
function formatMultiplicity(mult) {
    switch (mult) {
        case '0..1':
            return '0..1';
        case '1':
            return '1';
        case '*':
            return '*';
        default:
            return '*';
    }
}
/**
 * Format return type for function imports
 */
function formatReturnType(returnType, namespace) {
    // Check for collection types
    const collectionMatch = returnType.match(/^Collection\((.+)\)$/);
    if (collectionMatch) {
        const innerType = collectionMatch[1];
        if (innerType.startsWith('Edm.')) {
            return `Collection(${innerType})`;
        }
        return `Collection(${namespace}.${innerType})`;
    }
    // Primitive types
    if (returnType.startsWith('Edm.')) {
        return returnType;
    }
    // Entity types
    return `${namespace}.${returnType}`;
}
//# sourceMappingURL=edmx-builder.js.map