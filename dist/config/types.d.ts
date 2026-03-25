import { Model, ModelStatic } from 'sequelize';
/**
 * Logger interface for pluggable logging support.
 *
 * This interface is designed to be compatible with common logging libraries
 * like winston, pino, bunyan, etc. Users can provide their own logger
 * implementation or use the built-in ConsoleLogger.
 */
export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
/**
 * EDM primitive types supported by OData V2
 */
export type EdmType = 'Edm.Binary' | 'Edm.Boolean' | 'Edm.Byte' | 'Edm.DateTime' | 'Edm.DateTimeOffset' | 'Edm.Decimal' | 'Edm.Double' | 'Edm.Guid' | 'Edm.Int16' | 'Edm.Int32' | 'Edm.Int64' | 'Edm.SByte' | 'Edm.Single' | 'Edm.String' | 'Edm.Time';
/**
 * Multiplicity for navigation properties and association ends
 */
export type Multiplicity = '0..1' | '1' | '*';
/**
 * HTTP methods allowed for function imports
 */
export type HttpMethod = 'GET' | 'POST';
/**
 * Property definition in the JSON schema
 */
export interface PropertyDefinition {
    type: EdmType;
    nullable?: boolean;
    maxLength?: number;
    precision?: number;
    scale?: number;
    defaultValue?: unknown;
    /** Column name in database if different from property name */
    column?: string;
    /** Computed by afterRead hook — never SELECTed from the database */
    virtual?: boolean;
}
/**
 * Navigation property definition
 */
export interface NavigationPropertyDefinition {
    /** Target entity set name */
    target: string;
    /** Association name */
    relationship: string;
    /** Relationship multiplicity on this end */
    multiplicity: Multiplicity;
}
/**
 * Association end definition
 */
export interface AssociationEnd {
    entity: string;
    multiplicity: Multiplicity;
}
/**
 * Referential constraint (foreign key relationship)
 */
export interface ReferentialConstraint {
    principal: {
        entity: string;
        property: string;
    };
    dependent: {
        entity: string;
        property: string;
    };
}
/**
 * Association definition
 */
export interface AssociationDefinition {
    ends: [AssociationEnd, AssociationEnd];
    referentialConstraint?: ReferentialConstraint;
}
/**
 * Function import parameter definition
 */
export interface FunctionImportParameter {
    type: EdmType;
    nullable?: boolean;
    mode?: 'In' | 'Out' | 'InOut';
}
/**
 * Function import definition
 */
export interface FunctionImportDefinition {
    returnType?: string;
    httpMethod: HttpMethod;
    parameters?: Record<string, FunctionImportParameter>;
    entitySet?: string;
}
/**
 * Entity definition in the JSON schema
 */
export interface EntityDefinition {
    /** Sequelize model name (defaults to entity name) */
    model?: string;
    /** Primary key property names */
    keys: string[];
    /** Property definitions */
    properties: Record<string, PropertyDefinition>;
    /** Navigation properties */
    navigationProperties?: Record<string, NavigationPropertyDefinition>;
    /** Whether this entity is read-only */
    readOnly?: boolean;
    /** Custom table name */
    table?: string;
}
/**
 * Complete OData schema configuration
 */
export interface ODataSchemaConfig {
    /** Namespace for the OData service */
    namespace: string;
    /** Container name (defaults to namespace + 'Container') */
    containerName?: string;
    /** Entity definitions */
    entities: Record<string, EntityDefinition>;
    /** Association definitions */
    associations?: Record<string, AssociationDefinition>;
    /** Function import definitions */
    functionImports?: Record<string, FunctionImportDefinition>;
}
/**
 * Hook context passed to all hooks
 */
export interface HookContext {
    /** Express request object */
    req: Express.Request;
    /** Express response object */
    res: Express.Response;
    /** Parsed OData query options */
    query: ParsedQuery;
    /** Entity name being operated on */
    entityName: string;
    /** Sequelize models */
    models: Record<string, ModelStatic<Model>>;
    /** User data from request (if auth middleware present) */
    user?: unknown;
    /** Entity key values for single-entity operations */
    keys?: Record<string, unknown>;
    /** Custom data store for passing data between hooks */
    data: Record<string, unknown>;
    /** Sequelize transaction for transactional operations */
    transaction?: import('sequelize').Transaction;
    /** Correlation ID for request tracing */
    correlationId?: string;
    /** Logger instance for this request */
    logger?: Logger;
}
/**
 * Parsed query options
 */
export interface ParsedQuery {
    $filter?: FilterExpression;
    $select?: string[];
    $expand?: ExpandOption[];
    $orderby?: OrderByOption[];
    $top?: number;
    $skip?: number;
    $count?: boolean;
    $inlinecount?: 'allpages' | 'none';
    $format?: 'json' | 'atom';
    where?: Record<string, unknown>;
}
/**
 * Filter expression AST node
 */
export interface FilterExpression {
    type: 'binary' | 'unary' | 'function' | 'property' | 'literal';
    operator?: string;
    left?: FilterExpression;
    right?: FilterExpression;
    operand?: FilterExpression;
    name?: string;
    args?: FilterExpression[];
    value?: unknown;
    dataType?: EdmType;
}
/**
 * $expand option
 */
export interface ExpandOption {
    property: string;
    nested?: ExpandOption[];
    select?: string[];
    filter?: FilterExpression;
}
/**
 * $orderby option
 */
export interface OrderByOption {
    property: string;
    direction: 'asc' | 'desc';
}
/**
 * Hook functions for an entity
 */
export interface EntityHooks {
    beforeRead?: (ctx: HookContext) => Promise<void>;
    afterRead?: (ctx: HookContext, results: unknown[]) => Promise<unknown[]>;
    beforeCreate?: (ctx: HookContext, data: unknown) => Promise<unknown>;
    afterCreate?: (ctx: HookContext, result: unknown) => Promise<unknown>;
    beforeUpdate?: (ctx: HookContext, data: unknown) => Promise<unknown>;
    afterUpdate?: (ctx: HookContext, result: unknown) => Promise<unknown>;
    beforeDelete?: (ctx: HookContext) => Promise<void>;
    afterDelete?: (ctx: HookContext) => Promise<void>;
}
/**
 * Function import handler
 */
export type FunctionImportHandler = (ctx: HookContext, params: Record<string, unknown>) => Promise<unknown>;
/**
 * CSRF protection configuration options
 */
export interface CsrfOptions {
    /** Enable CSRF protection (defaults to true) */
    enabled?: boolean;
    /** Header name for CSRF token (default: 'X-CSRF-Token') */
    headerName?: string;
    /** Whether to allow token reuse (less secure, default: false) */
    allowTokenReuse?: boolean;
    /** Paths to skip CSRF validation (e.g., ['/health']) */
    skipPaths?: string[];
}
/**
 * Middleware configuration options
 */
export interface ODataMiddlewareOptions {
    /** Sequelize instance */
    sequelize: import('sequelize').Sequelize;
    /** OData schema configuration (path to JSON file or inline object) */
    schema: string | ODataSchemaConfig;
    /** Sequelize models (entity name → model) */
    models: Record<string, ModelStatic<Model>>;
    /** Entity hooks */
    hooks?: Record<string, EntityHooks>;
    /** Custom entity handlers */
    handlers?: Record<string, new () => EntityHandler>;
    /** Function import implementations */
    functionImports?: Record<string, FunctionImportHandler>;
    /** Base path for OData URIs (defaults to request base URL) */
    basePath?: string;
    /** Whether to expose metadata (defaults to true) */
    exposeMetadata?: boolean;
    /** Enable batch requests (defaults to true) */
    enableBatch?: boolean;
    /** Enable verbose error messages (defaults to false) */
    verboseErrors?: boolean;
    /** Logger instance for request logging */
    logger?: Logger;
    /** Header name for correlation ID (defaults to 'x-correlation-id') */
    correlationIdHeader?: string;
    /** Whether to log requests (defaults to true when logger is provided) */
    logRequests?: boolean;
    /** CSRF protection options (enabled by default) */
    csrf?: CsrfOptions;
}
/**
 * Abstract base class for entity handlers
 */
export declare abstract class EntityHandler {
    protected model: ModelStatic<Model>;
    protected entityName: string;
    protected schema: ODataSchemaConfig;
    initialize(model: ModelStatic<Model>, entityName: string, schema: ODataSchemaConfig): void;
    onRead(ctx: HookContext): Promise<unknown[]>;
    onReadSingle(ctx: HookContext): Promise<unknown | null>;
    onCreate(ctx: HookContext, data: unknown): Promise<unknown>;
    onUpdate(ctx: HookContext, data: unknown, merge: boolean): Promise<unknown>;
    onDelete(ctx: HookContext): Promise<void>;
    protected buildIncludes(ctx: HookContext): unknown[];
}
/**
 * Parsed URI segment
 */
export interface UriSegment {
    type: 'entitySet' | 'entity' | 'navigation' | 'property' | 'value' | '$count' | '$metadata' | '$batch' | 'functionImport';
    name: string;
    keys?: Record<string, unknown>;
}
/**
 * Parsed OData request
 */
export interface ParsedODataRequest {
    segments: UriSegment[];
    queryOptions: ParsedQuery;
    resourcePath: string;
}
/**
 * OData error structure
 */
export interface ODataErrorDetails {
    code: string;
    message: {
        lang: string;
        value: string;
    };
    innererror?: {
        message: string;
        type: string;
        stacktrace?: string;
    };
}
/**
 * Serialized entity metadata
 */
export interface EntityMetadata {
    uri: string;
    type: string;
    etag?: string;
}
/**
 * Batch request part
 */
export interface BatchPart {
    contentId?: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
}
/**
 * Batch changeset
 */
export interface BatchChangeset {
    parts: BatchPart[];
}
/**
 * Parsed batch request
 */
export interface ParsedBatchRequest {
    parts: (BatchPart | BatchChangeset)[];
}
/**
 * Batch response part
 */
export interface BatchResponsePart {
    contentId?: string;
    statusCode: number;
    headers: Record<string, string>;
    body?: unknown;
}
//# sourceMappingURL=types.d.ts.map