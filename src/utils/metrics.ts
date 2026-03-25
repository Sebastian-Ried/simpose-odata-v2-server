import { Request, Response, NextFunction } from 'express';

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
function sanitizeLabelValue(value: string): string {
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
 * Metric types supported by the metrics collector
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Labels for metric data points
 */
export type MetricLabels = Record<string, string>;

/**
 * Histogram bucket configuration
 */
export interface HistogramBuckets {
  /** Bucket boundaries in ascending order */
  boundaries: number[];
}

/**
 * Default histogram buckets for request duration (in ms)
 */
export const DEFAULT_DURATION_BUCKETS: HistogramBuckets = {
  boundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
};

/**
 * Metric definition
 */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  labelNames?: string[];
  buckets?: HistogramBuckets;
}

/**
 * Histogram data point
 */
interface HistogramData {
  sum: number;
  count: number;
  buckets: Map<number, number>;
}

/**
 * Internal metric storage
 */
interface MetricStorage {
  definition: MetricDefinition;
  values: Map<string, number | HistogramData>;
}

/**
 * Predefined OData metrics
 */
export const ODATA_METRICS: Record<string, MetricDefinition> = {
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
    buckets: DEFAULT_DURATION_BUCKETS,
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
    buckets: DEFAULT_DURATION_BUCKETS,
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
export class MetricsCollector {
  private metrics: Map<string, MetricStorage> = new Map();
  private prefix: string;

  constructor(options: { prefix?: string } = {}) {
    this.prefix = options.prefix || '';

    // Register default OData metrics
    for (const metric of Object.values(ODATA_METRICS)) {
      this.registerMetric(metric);
    }
  }

  /**
   * Register a new metric.
   */
  registerMetric(definition: MetricDefinition): void {
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
  private getLabelsKey(labels: MetricLabels): string {
    const keys = Object.keys(labels);
    const len = keys.length;

    // Fast paths for common cases (no sorting needed for 0-1 keys)
    if (len === 0) return '';
    if (len === 1) return `${keys[0]}="${labels[keys[0]!]}"`;

    // For 2+ keys, sort to ensure consistent ordering
    keys.sort();
    let result = `${keys[0]}="${labels[keys[0]!]}"`;
    for (let i = 1; i < len; i++) {
      result += `,${keys[i]}="${labels[keys[i]!]}"`;
    }
    return result;
  }

  /**
   * Increment a counter metric.
   */
  incrementCounter(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const fullName = this.prefix + name;
    const metric = this.metrics.get(fullName);
    if (!metric || metric.definition.type !== 'counter') {
      return;
    }

    const key = this.getLabelsKey(labels);
    const current = (metric.values.get(key) as number) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Set a gauge metric value.
   */
  setGauge(name: string, labels: MetricLabels = {}, value: number): void {
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
  incrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const fullName = this.prefix + name;
    const metric = this.metrics.get(fullName);
    if (!metric || metric.definition.type !== 'gauge') {
      return;
    }

    const key = this.getLabelsKey(labels);
    const current = (metric.values.get(key) as number) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Decrement a gauge metric.
   */
  decrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    this.incrementGauge(name, labels, -value);
  }

  /**
   * Observe a histogram value.
   */
  observeHistogram(name: string, labels: MetricLabels = {}, value: number): void {
    const fullName = this.prefix + name;
    const metric = this.metrics.get(fullName);
    if (!metric || metric.definition.type !== 'histogram') {
      return;
    }

    const key = this.getLabelsKey(labels);
    let data = metric.values.get(key) as HistogramData | undefined;

    if (!data) {
      data = {
        sum: 0,
        count: 0,
        buckets: new Map(),
      };
      // Initialize buckets with non-cumulative counts
      const boundaries = metric.definition.buckets?.boundaries || DEFAULT_DURATION_BUCKETS.boundaries;
      for (const boundary of boundaries) {
        data.buckets.set(boundary, 0);
      }
      data.buckets.set(Infinity, 0);
      metric.values.set(key, data);
    }

    data.sum += value;
    data.count += 1;

    // Find the appropriate bucket and increment only that one (non-cumulative storage)
    const boundaries = metric.definition.buckets?.boundaries || DEFAULT_DURATION_BUCKETS.boundaries;
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
  getPrometheusMetrics(): string {
    const lines: string[] = [];

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
          const histData = data as HistogramData;
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
      } else {
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
  reset(): void {
    for (const storage of this.metrics.values()) {
      storage.values.clear();
    }
  }

  /**
   * Get metric value (for testing).
   */
  getMetricValue(name: string, labels: MetricLabels = {}): number | HistogramData | undefined {
    const fullName = this.prefix + name;
    const metric = this.metrics.get(fullName);
    if (!metric) {
      return undefined;
    }
    const key = this.getLabelsKey(labels);
    return metric.values.get(key) as number | HistogramData | undefined;
  }
}

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
export function createMetricsMiddleware(collector: MetricsCollector) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
export function createMetricsHandler(collector: MetricsCollector) {
  return (req: Request, res: Response): void => {
    res.type('text/plain; charset=utf-8').send(collector.getPrometheusMetrics());
  };
}
