/**
 * Metrics Tests
 *
 * Tests for Prometheus-compatible metrics collection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import {
  MetricsCollector,
  createMetricsMiddleware,
  createMetricsHandler,
  ODATA_METRICS,
} from '../../src/utils/metrics';

// Helper to make requests
function makeRequest(
  app: express.Express,
  method: string,
  path: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;

      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path,
          method,
          headers: { Accept: 'application/json' },
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode, body: data });
          });
        }
      );

      req.on('error', (err: Error) => {
        server.close();
        reject(err);
      });

      req.end();
    });
  });
}

describe('Metrics Utilities', () => {
  describe('MetricsCollector', () => {
    let collector: MetricsCollector;

    beforeEach(() => {
      collector = new MetricsCollector();
    });

    describe('Counter metrics', () => {
      it('should increment counter', () => {
        collector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' });

        const value = collector.getMetricValue('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' });
        expect(value).toBe(1);
      });

      it('should increment counter by custom value', () => {
        collector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' }, 5);

        const value = collector.getMetricValue('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' });
        expect(value).toBe(5);
      });

      it('should track separate label combinations', () => {
        collector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' });
        collector.incrementCounter('odata_requests_total', { method: 'POST', entity: 'Product', status: '201' });
        collector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Category', status: '200' });

        expect(collector.getMetricValue('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' })).toBe(1);
        expect(collector.getMetricValue('odata_requests_total', { method: 'POST', entity: 'Product', status: '201' })).toBe(1);
        expect(collector.getMetricValue('odata_requests_total', { method: 'GET', entity: 'Category', status: '200' })).toBe(1);
      });
    });

    describe('Gauge metrics', () => {
      it('should set gauge value', () => {
        collector.setGauge('odata_requests_in_flight', {}, 5);

        const value = collector.getMetricValue('odata_requests_in_flight', {});
        expect(value).toBe(5);
      });

      it('should increment gauge', () => {
        collector.setGauge('odata_requests_in_flight', {}, 5);
        collector.incrementGauge('odata_requests_in_flight', {});

        const value = collector.getMetricValue('odata_requests_in_flight', {});
        expect(value).toBe(6);
      });

      it('should decrement gauge', () => {
        collector.setGauge('odata_requests_in_flight', {}, 5);
        collector.decrementGauge('odata_requests_in_flight', {});

        const value = collector.getMetricValue('odata_requests_in_flight', {});
        expect(value).toBe(4);
      });
    });

    describe('Histogram metrics', () => {
      it('should observe histogram values', () => {
        collector.observeHistogram('odata_request_duration_ms', { method: 'GET', entity: 'Product' }, 50);
        collector.observeHistogram('odata_request_duration_ms', { method: 'GET', entity: 'Product' }, 150);

        const data = collector.getMetricValue('odata_request_duration_ms', { method: 'GET', entity: 'Product' }) as any;
        expect(data.count).toBe(2);
        expect(data.sum).toBe(200);
      });

      it('should populate histogram buckets', () => {
        collector.observeHistogram('odata_request_duration_ms', { method: 'GET', entity: 'Product' }, 50);
        collector.observeHistogram('odata_request_duration_ms', { method: 'GET', entity: 'Product' }, 150);
        collector.observeHistogram('odata_request_duration_ms', { method: 'GET', entity: 'Product' }, 500);

        const data = collector.getMetricValue('odata_request_duration_ms', { method: 'GET', entity: 'Product' }) as any;

        // Internal storage is non-cumulative (each value in exactly one bucket)
        // 50ms goes into bucket 50, 150ms into bucket 250, 500ms into bucket 500
        expect(data.buckets.get(50)).toBe(1);   // 50ms <= 50
        expect(data.buckets.get(100)).toBe(0);  // nothing in (50, 100]
        expect(data.buckets.get(250)).toBe(1);  // 150ms <= 250
        expect(data.buckets.get(500)).toBe(1);  // 500ms <= 500
        expect(data.buckets.get(Infinity)).toBe(0); // nothing > 10000

        // Verify Prometheus output shows cumulative counts
        const output = collector.getPrometheusMetrics();
        expect(output).toContain('_bucket{entity="Product",method="GET",le="50"} 1');
        expect(output).toContain('_bucket{entity="Product",method="GET",le="100"} 1');
        expect(output).toContain('_bucket{entity="Product",method="GET",le="250"} 2');
        expect(output).toContain('_bucket{entity="Product",method="GET",le="500"} 3');
        expect(output).toContain('_bucket{entity="Product",method="GET",le="+Inf"} 3');
      });
    });

    describe('Prometheus format output', () => {
      it('should generate valid Prometheus format for counters', () => {
        collector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' }, 10);

        const output = collector.getPrometheusMetrics();

        expect(output).toContain('# HELP odata_requests_total');
        expect(output).toContain('# TYPE odata_requests_total counter');
        expect(output).toContain('odata_requests_total{entity="Product",method="GET",status="200"} 10');
      });

      it('should generate valid Prometheus format for gauges', () => {
        collector.setGauge('odata_requests_in_flight', {}, 5);

        const output = collector.getPrometheusMetrics();

        expect(output).toContain('# HELP odata_requests_in_flight');
        expect(output).toContain('# TYPE odata_requests_in_flight gauge');
        expect(output).toContain('odata_requests_in_flight 5');
      });

      it('should generate valid Prometheus format for histograms', () => {
        collector.observeHistogram('odata_request_duration_ms', { method: 'GET', entity: 'Product' }, 50);

        const output = collector.getPrometheusMetrics();

        expect(output).toContain('# HELP odata_request_duration_ms');
        expect(output).toContain('# TYPE odata_request_duration_ms histogram');
        // Buckets should show cumulative counts
        expect(output).toContain('odata_request_duration_ms_bucket{entity="Product",method="GET",le="50"}');
        expect(output).toContain('odata_request_duration_ms_bucket{entity="Product",method="GET",le="+Inf"}');
        expect(output).toContain('odata_request_duration_ms_sum{entity="Product",method="GET"} 50');
        expect(output).toContain('odata_request_duration_ms_count{entity="Product",method="GET"} 1');
      });

      it('should skip empty metrics', () => {
        const output = collector.getPrometheusMetrics();

        // Should not contain metric lines for unused metrics
        expect(output).not.toContain('odata_requests_total{');
      });
    });

    describe('Custom metrics', () => {
      it('should allow registering custom metrics', () => {
        collector.registerMetric({
          name: 'custom_counter',
          type: 'counter',
          help: 'A custom counter metric',
          labelNames: ['custom_label'],
        });

        collector.incrementCounter('custom_counter', { custom_label: 'test' });

        const value = collector.getMetricValue('custom_counter', { custom_label: 'test' });
        expect(value).toBe(1);
      });

      it('should support metric prefix', () => {
        const prefixedCollector = new MetricsCollector({ prefix: 'myapp_' });

        prefixedCollector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' });

        const output = prefixedCollector.getPrometheusMetrics();
        expect(output).toContain('myapp_odata_requests_total');
      });
    });

    describe('reset', () => {
      it('should reset all metrics', () => {
        collector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' }, 10);
        collector.setGauge('odata_requests_in_flight', {}, 5);

        collector.reset();

        expect(collector.getMetricValue('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' })).toBeUndefined();
        expect(collector.getMetricValue('odata_requests_in_flight', {})).toBeUndefined();
      });
    });
  });

  describe('createMetricsMiddleware', () => {
    it('should track request metrics', async () => {
      const collector = new MetricsCollector();
      const app = express();

      app.use(createMetricsMiddleware(collector));
      app.get('/Product', (req, res) => res.json({ success: true }));

      await makeRequest(app, 'GET', '/Product');

      const requestCount = collector.getMetricValue('odata_requests_total', {
        method: 'GET',
        entity: 'Product',
        status: '200',
      });
      expect(requestCount).toBe(1);

      const duration = collector.getMetricValue('odata_request_duration_ms', {
        method: 'GET',
        entity: 'Product',
      }) as any;
      expect(duration.count).toBe(1);
      expect(duration.sum).toBeGreaterThan(0);
    });

    it('should track error metrics', async () => {
      const collector = new MetricsCollector();
      const app = express();

      app.use(createMetricsMiddleware(collector));
      app.get('/Product', (req, res) => res.status(404).json({ error: 'Not found' }));

      await makeRequest(app, 'GET', '/Product');

      const errorCount = collector.getMetricValue('odata_errors_total', {
        method: 'GET',
        entity: 'Product',
        error_code: '404',
      });
      expect(errorCount).toBe(1);
    });

    it('should track in-flight requests', async () => {
      const collector = new MetricsCollector();
      const app = express();

      app.use(createMetricsMiddleware(collector));
      app.get('/Product', (req, res) => {
        // Check in-flight during request
        const inFlight = collector.getMetricValue('odata_requests_in_flight', {});
        res.json({ inFlight });
      });

      const { body } = await makeRequest(app, 'GET', '/Product');
      const parsed = JSON.parse(body);

      // Should have been 1 during request
      expect(parsed.inFlight).toBe(1);

      // Should be 0 after request
      const afterInFlight = collector.getMetricValue('odata_requests_in_flight', {});
      expect(afterInFlight).toBe(0);
    });
  });

  describe('createMetricsHandler', () => {
    it('should return metrics in Prometheus format', async () => {
      const collector = new MetricsCollector();
      collector.incrementCounter('odata_requests_total', { method: 'GET', entity: 'Product', status: '200' });

      const app = express();
      app.get('/metrics', createMetricsHandler(collector));

      const { status, body } = await makeRequest(app, 'GET', '/metrics');

      expect(status).toBe(200);
      expect(body).toContain('# HELP odata_requests_total');
      expect(body).toContain('odata_requests_total{entity="Product",method="GET",status="200"} 1');
    });
  });

  describe('ODATA_METRICS', () => {
    it('should have all expected metrics defined', () => {
      expect(ODATA_METRICS.requestsTotal).toBeDefined();
      expect(ODATA_METRICS.requestDuration).toBeDefined();
      expect(ODATA_METRICS.requestsInFlight).toBeDefined();
      expect(ODATA_METRICS.errorsTotal).toBeDefined();
      expect(ODATA_METRICS.dbQueriesTotal).toBeDefined();
      expect(ODATA_METRICS.dbQueryDuration).toBeDefined();
      expect(ODATA_METRICS.cacheHits).toBeDefined();
      expect(ODATA_METRICS.cacheMisses).toBeDefined();
      expect(ODATA_METRICS.batchOperations).toBeDefined();
    });
  });
});
