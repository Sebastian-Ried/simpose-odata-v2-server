import { Request, Response, NextFunction } from 'express';
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
export declare const DEFAULT_DURATION_BUCKETS: HistogramBuckets;
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
 * Predefined OData metrics
 */
export declare const ODATA_METRICS: Record<string, MetricDefinition>;
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
export declare class MetricsCollector {
    private metrics;
    private prefix;
    constructor(options?: {
        prefix?: string;
    });
    /**
     * Register a new metric.
     */
    registerMetric(definition: MetricDefinition): void;
    /**
     * Get labels key for storage lookup.
     * Optimized for common case of 0-3 labels.
     */
    private getLabelsKey;
    /**
     * Increment a counter metric.
     */
    incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
    /**
     * Set a gauge metric value.
     */
    setGauge(name: string, labels: MetricLabels | undefined, value: number): void;
    /**
     * Increment a gauge metric.
     */
    incrementGauge(name: string, labels?: MetricLabels, value?: number): void;
    /**
     * Decrement a gauge metric.
     */
    decrementGauge(name: string, labels?: MetricLabels, value?: number): void;
    /**
     * Observe a histogram value.
     */
    observeHistogram(name: string, labels: MetricLabels | undefined, value: number): void;
    /**
     * Get all metrics in Prometheus text format.
     */
    getPrometheusMetrics(): string;
    /**
     * Reset all metrics.
     */
    reset(): void;
    /**
     * Get metric value (for testing).
     */
    getMetricValue(name: string, labels?: MetricLabels): number | HistogramData | undefined;
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
export declare function createMetricsMiddleware(collector: MetricsCollector): (req: Request, res: Response, next: NextFunction) => void;
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
export declare function createMetricsHandler(collector: MetricsCollector): (req: Request, res: Response) => void;
export {};
//# sourceMappingURL=metrics.d.ts.map