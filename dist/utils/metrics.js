"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = exports.ODATA_METRICS = exports.DEFAULT_DURATION_BUCKETS = void 0;
exports.createMetricsMiddleware = createMetricsMiddleware;
exports.createMetricsHandler = createMetricsHandler;
/**
 * Maximum length for label values to prevent cardinality explosion
 */
const MAX_LABEL_VALUE_LENGTH = 64;
/**
 * Pattern for allowed label value characters
 */
const SAFE_LABEL_PATTERN = /^[a-zA-Z0-9_\-./]+$/;
/**
 * Sanitize a label value to prevent injection and limit cardinality.
 */
function sanitizeLabelValue(value) {
    // Truncate long values
    if (value.length > MAX_LABEL_VALUE_LENGTH) {
        value = value.slice(0, MAX_LABEL_VALUE_LENGTH);
    }
    // Replace unsafe characters
    if (!SAFE_LABEL_PATTERN.test(value)) {
        value = value.replace(/[^a-zA-Z0-9_\-./]/g, '_');
    }
    return value || 'unknown';
}
/**
 * Default histogram buckets for request duration (in ms)
 */
exports.DEFAULT_DURATION_BUCKETS = {
    boundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
};
/**
 * Predefined OData metrics
 */
exports.ODATA_METRICS = {
    requestsTotal: {
        name: 'odata_requests_total',
        type: 'counter',
        help: 'Total number of OData requests',
        labelNames: ['method', 'entity', 'status'],
    },
    requestDuration: {
        name: 'odata_request_duration_ms',
        type: 'histogram',
        help: 'OData request duration in milliseconds',
        labelNames: ['method', 'entity'],
        buckets: exports.DEFAULT_DURATION_BUCKETS,
    },
    requestsInFlight: {
        name: 'odata_requests_in_flight',
        type: 'gauge',
        help: 'Number of OData requests currently being processed',
        labelNames: [],
    },
    errorsTotal: {
        name: 'odata_errors_total',
        type: 'counter',
        help: 'Total number of OData errors',
        labelNames: ['method', 'entity', 'error_code'],
    },
    dbQueriesTotal: {
        name: 'odata_db_queries_total',
        type: 'counter',
        help: 'Total number of database queries',
        labelNames: ['operation', 'entity'],
    },
    dbQueryDuration: {
        name: 'odata_db_query_duration_ms',
        type: 'histogram',
        help: 'Database query duration in milliseconds',
        labelNames: ['operation', 'entity'],
        buckets: exports.DEFAULT_DURATION_BUCKETS,
    },
    cacheHits: {
        name: 'odata_cache_hits_total',
        type: 'counter',
        help: 'Total number of cache hits',
        labelNames: ['cache_type'],
    },
    cacheMisses: {
        name: 'odata_cache_misses_total',
        type: 'counter',
        help: 'Total number of cache misses',
        labelNames: ['cache_type'],
    },
    batchOperations: {
        name: 'odata_batch_operations_total',
        type: 'counter',
        help: 'Total number of batch operations',
        labelNames: ['status'],
    },
};
/**
 * Metrics collector for OData middleware.
 *
 * Collects and exposes metrics in Prometheus format.
 * Can be used standalone or integrated with existing Prometheus client.
 *
 * @example Standalone usage
 * ```typescript
 * import { MetricsCollector, createMetricsMiddleware } from 'odata-v2-sequelize';
 *
 * const metrics = new MetricsCollector();
 * app.use(createMetricsMiddleware(metrics));
 * app.get('/metrics', (req, res) => {
 *   res.type('text/plain').send(metrics.getPrometheusMetrics());
 * });
 * ```
 *
 * @example With custom metrics
 * ```typescript
 * const metrics = new MetricsCollector();
 * metrics.registerMetric({
 *   name: 'custom_metric',
 *   type: 'counter',
 *   help: 'My custom metric',
 *   labelNames: ['label1'],
 * });
 * metrics.incrementCounter('custom_metric', { label1: 'value1' });
 * ```
 */
class MetricsCollector {
    metrics = new Map();
    prefix;
    constructor(options = {}) {
        this.prefix = options.prefix || '';
        // Register default OData metrics
        for (const metric of Object.values(exports.ODATA_METRICS)) {
            this.registerMetric(metric);
        }
    }
    /**
     * Register a new metric.
     */
    registerMetric(definition) {
        const name = this.prefix + definition.name;
        this.metrics.set(name, {
            definition: { ...definition, name },
            values: new Map(),
        });
    }
    /**
     * Get labels key for storage lookup.
     * Optimized for common case of 0-3 labels.
     */
    getLabelsKey(labels) {
        const keys = Object.keys(labels);
        const len = keys.length;
        // Fast paths for common cases (no sorting needed for 0-1 keys)
        if (len === 0)
            return '';
        if (len === 1)
            return `${keys[0]}="${labels[keys[0]]}"`;
        // For 2+ keys, sort to ensure consistent ordering
        keys.sort();
        let result = `${keys[0]}="${labels[keys[0]]}"`;
        for (let i = 1; i < len; i++) {
            result += `,${keys[i]}="${labels[keys[i]]}"`;
        }
        return result;
    }
    /**
     * Increment a counter metric.
     */
    incrementCounter(name, labels = {}, value = 1) {
        const fullName = this.prefix + name;
        const metric = this.metrics.get(fullName);
        if (!metric || metric.definition.type !== 'counter') {
            return;
        }
        const key = this.getLabelsKey(labels);
        const current = metric.values.get(key) || 0;
        metric.values.set(key, current + value);
    }
    /**
     * Set a gauge metric value.
     */
    setGauge(name, labels = {}, value) {
        const fullName = this.prefix + name;
        const metric = this.metrics.get(fullName);
        if (!metric || metric.definition.type !== 'gauge') {
            return;
        }
        const key = this.getLabelsKey(labels);
        metric.values.set(key, value);
    }
    /**
     * Increment a gauge metric.
     */
    incrementGauge(name, labels = {}, value = 1) {
        const fullName = this.prefix + name;
        const metric = this.metrics.get(fullName);
        if (!metric || metric.definition.type !== 'gauge') {
            return;
        }
        const key = this.getLabelsKey(labels);
        const current = metric.values.get(key) || 0;
        metric.values.set(key, current + value);
    }
    /**
     * Decrement a gauge metric.
     */
    decrementGauge(name, labels = {}, value = 1) {
        this.incrementGauge(name, labels, -value);
    }
    /**
     * Observe a histogram value.
     */
    observeHistogram(name, labels = {}, value) {
        const fullName = this.prefix + name;
        const metric = this.metrics.get(fullName);
        if (!metric || metric.definition.type !== 'histogram') {
            return;
        }
        const key = this.getLabelsKey(labels);
        let data = metric.values.get(key);
        if (!data) {
            data = {
                sum: 0,
                count: 0,
                buckets: new Map(),
            };
            // Initialize buckets with non-cumulative counts
            const boundaries = metric.definition.buckets?.boundaries || exports.DEFAULT_DURATION_BUCKETS.boundaries;
            for (const boundary of boundaries) {
                data.buckets.set(boundary, 0);
            }
            data.buckets.set(Infinity, 0);
            metric.values.set(key, data);
        }
        data.sum += value;
        data.count += 1;
        // Find the appropriate bucket and increment only that one (non-cumulative storage)
        const boundaries = metric.definition.buckets?.boundaries || exports.DEFAULT_DURATION_BUCKETS.boundaries;
        let placed = false;
        for (const boundary of boundaries) {
            if (!placed && value <= boundary) {
                data.buckets.set(boundary, (data.buckets.get(boundary) || 0) + 1);
                placed = true;
                break;
            }
        }
        // If not placed in any bucket, it goes in +Inf
        if (!placed) {
            data.buckets.set(Infinity, (data.buckets.get(Infinity) || 0) + 1);
        }
    }
    /**
     * Get all metrics in Prometheus text format.
     */
    getPrometheusMetrics() {
        const lines = [];
        for (const [name, storage] of this.metrics) {
            const { definition, values } = storage;
            // Skip empty metrics
            if (values.size === 0) {
                continue;
            }
            // HELP line
            lines.push(`# HELP ${name} ${definition.help}`);
            // TYPE line
            lines.push(`# TYPE ${name} ${definition.type}`);
            if (definition.type === 'histogram') {
                for (const [labelsKey, data] of values) {
                    const histData = data;
                    const labelsStr = labelsKey ? `{${labelsKey}}` : '';
                    // Bucket lines
                    const boundaries = [...histData.buckets.keys()].sort((a, b) => a - b);
                    let cumulativeCount = 0;
                    for (const boundary of boundaries) {
                        cumulativeCount += histData.buckets.get(boundary) || 0;
                        const le = boundary === Infinity ? '+Inf' : String(boundary);
                        const bucketLabels = labelsKey ? `${labelsKey},le="${le}"` : `le="${le}"`;
                        lines.push(`${name}_bucket{${bucketLabels}} ${cumulativeCount}`);
                    }
                    // Sum and count
                    const sumLabels = labelsStr;
                    lines.push(`${name}_sum${sumLabels} ${histData.sum}`);
                    lines.push(`${name}_count${sumLabels} ${histData.count}`);
                }
            }
            else {
                for (const [labelsKey, value] of values) {
                    const labelsStr = labelsKey ? `{${labelsKey}}` : '';
                    lines.push(`${name}${labelsStr} ${value}`);
                }
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    /**
     * Reset all metrics.
     */
    reset() {
        for (const storage of this.metrics.values()) {
            storage.values.clear();
        }
    }
    /**
     * Get metric value (for testing).
     */
    getMetricValue(name, labels = {}) {
        const fullName = this.prefix + name;
        const metric = this.metrics.get(fullName);
        if (!metric) {
            return undefined;
        }
        const key = this.getLabelsKey(labels);
        return metric.values.get(key);
    }
}
exports.MetricsCollector = MetricsCollector;
/**
 * Create middleware that collects OData request metrics.
 *
 * @param collector - MetricsCollector instance
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const metrics = new MetricsCollector();
 * app.use(createMetricsMiddleware(metrics));
 * ```
 */
function createMetricsMiddleware(collector) {
    return (req, res, next) => {
        const startTime = Date.now();
        // Track in-flight requests
        collector.incrementGauge('odata_requests_in_flight');
        // Extract entity name from path and sanitize to prevent cardinality explosion
        const pathMatch = req.path.match(/^\/([^(/]+)/);
        const entity = sanitizeLabelValue(pathMatch?.[1] || 'unknown');
        // Track response
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const method = req.method;
            const status = String(res.statusCode);
            // Decrement in-flight
            collector.decrementGauge('odata_requests_in_flight');
            // Request count
            collector.incrementCounter('odata_requests_total', { method, entity, status });
            // Request duration
            collector.observeHistogram('odata_request_duration_ms', { method, entity }, duration);
            // Track errors
            if (res.statusCode >= 400) {
                collector.incrementCounter('odata_errors_total', {
                    method,
                    entity,
                    error_code: status,
                });
            }
        });
        next();
    };
}
/**
 * Create a metrics endpoint handler.
 *
 * @param collector - MetricsCollector instance
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * const metrics = new MetricsCollector();
 * app.get('/metrics', createMetricsHandler(metrics));
 * ```
 */
function createMetricsHandler(collector) {
    return (req, res) => {
        res.type('text/plain; charset=utf-8').send(collector.getPrometheusMetrics());
    };
}
//# sourceMappingURL=metrics.js.map