/**
 * Graceful Shutdown Tests
 *
 * Tests for graceful shutdown handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { Sequelize } from 'sequelize';
import {
  GracefulShutdownManager,
  createShutdownMiddleware,
  registerShutdownSignals,
} from '../../src/utils/shutdown';
import { Logger } from '../../src/config/types';

describe('Graceful Shutdown Utilities', () => {
  describe('GracefulShutdownManager', () => {
    it('should track in-flight requests', () => {
      const manager = new GracefulShutdownManager();

      expect(manager.getInFlightCount()).toBe(0);

      manager.requestStart();
      expect(manager.getInFlightCount()).toBe(1);

      manager.requestStart();
      expect(manager.getInFlightCount()).toBe(2);

      manager.requestEnd();
      expect(manager.getInFlightCount()).toBe(1);

      manager.requestEnd();
      expect(manager.getInFlightCount()).toBe(0);
    });

    it('should not go below zero in-flight count', () => {
      const manager = new GracefulShutdownManager();

      manager.requestEnd();
      manager.requestEnd();
      manager.requestEnd();

      expect(manager.getInFlightCount()).toBe(0);
    });

    it('should reject new requests during shutdown', async () => {
      const manager = new GracefulShutdownManager({ timeout: 100 });

      expect(manager.requestStart()).toBe(true);
      manager.requestEnd();

      // Start shutdown
      const shutdownPromise = manager.shutdown();

      // New requests should be rejected
      expect(manager.requestStart()).toBe(false);
      expect(manager.isInShutdown()).toBe(true);

      await shutdownPromise;
    });

    it('should wait for in-flight requests before completing', async () => {
      const manager = new GracefulShutdownManager({ timeout: 5000 });

      // Start a request
      manager.requestStart();
      expect(manager.getInFlightCount()).toBe(1);

      // Start shutdown
      const shutdownPromise = manager.shutdown();

      // Should be shutting down
      expect(manager.isInShutdown()).toBe(true);

      // Complete the request after a delay
      setTimeout(() => {
        manager.requestEnd();
      }, 100);

      // Shutdown should complete after request finishes
      await shutdownPromise;
      expect(manager.getInFlightCount()).toBe(0);
    });

    it('should force shutdown after timeout', async () => {
      const logs: string[] = [];
      const logger: Logger = {
        debug: () => {},
        info: () => {},
        warn: (msg) => logs.push(msg),
        error: () => {},
      };

      const manager = new GracefulShutdownManager({ timeout: 200, logger });

      // Start a request but never complete it
      manager.requestStart();

      const start = Date.now();
      await manager.shutdown();
      const duration = Date.now() - start;

      // Should have timed out
      expect(duration).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThan(500);
      expect(logs).toContain('Shutdown timeout reached, forcing shutdown');
    });

    it('should close sequelize connection', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });
      const closeSpy = vi.spyOn(sequelize, 'close');

      const manager = new GracefulShutdownManager({ sequelize, timeout: 100 });

      await manager.shutdown();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should run cleanup handlers', async () => {
      const cleanupCalls: number[] = [];

      const manager = new GracefulShutdownManager({
        timeout: 100,
        cleanupHandlers: [
          () => cleanupCalls.push(1),
          async () => {
            await new Promise((r) => setTimeout(r, 10));
            cleanupCalls.push(2);
          },
          () => cleanupCalls.push(3),
        ],
      });

      await manager.shutdown();

      expect(cleanupCalls).toEqual([1, 2, 3]);
    });

    it('should continue cleanup even if one handler fails', async () => {
      const cleanupCalls: number[] = [];

      const manager = new GracefulShutdownManager({
        timeout: 100,
        cleanupHandlers: [
          () => cleanupCalls.push(1),
          () => {
            throw new Error('Cleanup failed');
          },
          () => cleanupCalls.push(3),
        ],
      });

      await manager.shutdown();

      expect(cleanupCalls).toEqual([1, 3]);
    });

    it('should call onShutdownStart and onShutdownComplete', async () => {
      const calls: string[] = [];

      const manager = new GracefulShutdownManager({
        timeout: 100,
        onShutdownStart: () => {
          calls.push('start');
        },
        onShutdownComplete: () => {
          calls.push('complete');
        },
      });

      await manager.shutdown();

      expect(calls).toEqual(['start', 'complete']);
    });

    it('should only shutdown once', async () => {
      let shutdownCount = 0;

      const manager = new GracefulShutdownManager({
        timeout: 100,
        onShutdownStart: () => {
          shutdownCount++;
        },
      });

      // Call shutdown multiple times concurrently
      await Promise.all([
        manager.shutdown(),
        manager.shutdown(),
        manager.shutdown(),
      ]);

      expect(shutdownCount).toBe(1);
    });
  });

  describe('createShutdownMiddleware', () => {
    it('should track requests through middleware', async () => {
      const manager = new GracefulShutdownManager();
      const middleware = createShutdownMiddleware(manager);

      const mockReq = {};
      const mockRes = {
        on: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(manager.getInFlightCount()).toBe(1);
      expect(mockNext).toHaveBeenCalled();

      // Simulate response finish
      const finishCallback = mockRes.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )?.[1];
      finishCallback?.();

      expect(manager.getInFlightCount()).toBe(0);
    });

    it('should reject requests during shutdown', async () => {
      const manager = new GracefulShutdownManager({ timeout: 100 });
      const middleware = createShutdownMiddleware(manager);

      // Start shutdown
      const shutdownPromise = manager.shutdown();

      const mockReq = {};
      const mockRes = {
        on: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: '503',
          message: { lang: 'en', value: 'Service is shutting down' },
        },
      });
      expect(mockNext).not.toHaveBeenCalled();

      await shutdownPromise;
    });
  });

  describe('registerShutdownSignals', () => {
    it('should register signal handlers', () => {
      const manager = new GracefulShutdownManager({ timeout: 100 });

      const onSpy = vi.spyOn(process, 'on');

      const unregister = registerShutdownSignals(manager, { exitOnComplete: false });

      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      unregister();
      onSpy.mockRestore();
    });

    it('should unregister signal handlers', () => {
      const manager = new GracefulShutdownManager({ timeout: 100 });

      const offSpy = vi.spyOn(process, 'off');

      const unregister = registerShutdownSignals(manager, { exitOnComplete: false });
      unregister();

      expect(offSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      offSpy.mockRestore();
    });
  });
});
