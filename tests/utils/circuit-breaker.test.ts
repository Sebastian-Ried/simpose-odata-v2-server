/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
  createDatabaseCircuitBreaker,
  withCircuitBreaker,
} from '../../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic operation', () => {
    it('should execute successful operations', async () => {
      const breaker = new CircuitBreaker();

      const result = await breaker.execute(async () => 'success');

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should pass through errors', async () => {
      const breaker = new CircuitBreaker();

      await expect(
        breaker.execute(async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });

    it('should start in closed state', () => {
      const breaker = new CircuitBreaker();

      expect(breaker.getState()).toBe('closed');
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.isOpen()).toBe(false);
    });
  });

  describe('State transitions', () => {
    it('should open after failure threshold', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });

      // Cause 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('failure');
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');
      expect(breaker.isOpen()).toBe(true);
    });

    it('should reject requests when open', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Cause failure to open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      // Next request should fail with CircuitOpenError
      await expect(breaker.execute(async () => 'test')).rejects.toThrow(
        CircuitOpenError
      );
    });

    it('should transition to half-open after reset timeout', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('open');

      // Advance time past reset timeout
      vi.advanceTimersByTime(5000);

      expect(breaker.getState()).toBe('half-open');
    });

    it('should close after success threshold in half-open', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        successThreshold: 2,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      // Go to half-open
      vi.advanceTimersByTime(5000);
      expect(breaker.getState()).toBe('half-open');

      // Two successful calls
      await breaker.execute(async () => 'success1');
      await breaker.execute(async () => 'success2');

      expect(breaker.getState()).toBe('closed');
    });

    it('should re-open on failure in half-open', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      // Go to half-open
      vi.advanceTimersByTime(5000);
      expect(breaker.getState()).toBe('half-open');

      // Fail again
      try {
        await breaker.execute(async () => {
          throw new Error('still failing');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Failure window', () => {
    it('should only count failures within window', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        failureWindow: 10000,
      });

      // Two failures
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('failure');
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('closed');

      // Wait for failures to expire
      vi.advanceTimersByTime(11000);

      // One more failure shouldn't open (previous ones expired)
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Custom failure detection', () => {
    it('should use custom isFailure function', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        isFailure: (error) => error.message.includes('connection'),
      });

      // This error should not count
      try {
        await breaker.execute(async () => {
          throw new Error('validation error');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('closed');

      // This error should count
      try {
        await breaker.execute(async () => {
          throw new Error('connection refused');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Callbacks', () => {
    it('should call onOpen when circuit opens', async () => {
      const onOpen = vi.fn();
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        onOpen,
      });

      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      expect(onOpen).toHaveBeenCalledWith(1);
    });

    it('should call onClose when circuit closes', async () => {
      const onClose = vi.fn();
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        successThreshold: 1,
        onClose,
      });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      // Go to half-open
      vi.advanceTimersByTime(5000);

      // Close with success
      await breaker.execute(async () => 'success');

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onHalfOpen when entering half-open', async () => {
      const onHalfOpen = vi.fn();
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        onHalfOpen,
      });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      vi.advanceTimersByTime(5000);

      expect(onHalfOpen).toHaveBeenCalled();
    });

    it('should call onStateChange on any state change', async () => {
      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5000,
        successThreshold: 1,
        onStateChange,
      });

      // closed -> open
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      expect(onStateChange).toHaveBeenCalledWith('open', 'closed');

      // open -> half-open
      vi.advanceTimersByTime(5000);

      expect(onStateChange).toHaveBeenCalledWith('half-open', 'open');

      // half-open -> closed
      await breaker.execute(async () => 'success');

      expect(onStateChange).toHaveBeenCalledWith('closed', 'half-open');
    });
  });

  describe('executeWithFallback', () => {
    it('should return fallback when circuit is open', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      const result = await breaker.executeWithFallback(
        async () => 'primary',
        'fallback'
      );

      expect(result).toBe('fallback');
    });

    it('should support fallback function', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      const result = await breaker.executeWithFallback(
        async () => 'primary',
        () => 'computed fallback'
      );

      expect(result).toBe('computed fallback');
    });

    it('should throw non-circuit errors', async () => {
      const breaker = new CircuitBreaker();

      await expect(
        breaker.executeWithFallback(
          async () => {
            throw new Error('other error');
          },
          'fallback'
        )
      ).rejects.toThrow('other error');
    });
  });

  describe('Statistics', () => {
    it('should track failures and successes', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 10 });

      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      const stats = breaker.getStats();

      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(1);
    });

    it('should track blocked requests', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      // Try blocked requests
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => 'test');
        } catch {
          // Expected
        }
      }

      expect(breaker.getStats().blocked).toBe(3);
    });
  });

  describe('Manual controls', () => {
    it('should reset to closed state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('open');

      breaker.reset();

      expect(breaker.getState()).toBe('closed');
      expect(breaker.getStats().blocked).toBe(0);
    });

    it('should manually trip the circuit', () => {
      const breaker = new CircuitBreaker();

      expect(breaker.getState()).toBe('closed');

      breaker.trip();

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('getTimeUntilReset', () => {
    it('should return time until reset when open', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 10000,
      });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('failure');
        });
      } catch {
        // Expected
      }

      expect(breaker.getTimeUntilReset()).toBe(10000);

      vi.advanceTimersByTime(3000);

      expect(breaker.getTimeUntilReset()).toBe(7000);
    });

    it('should return 0 when not open', () => {
      const breaker = new CircuitBreaker();

      expect(breaker.getTimeUntilReset()).toBe(0);
    });
  });
});

describe('createDatabaseCircuitBreaker', () => {
  it('should create breaker with database-specific defaults', async () => {
    const breaker = createDatabaseCircuitBreaker();

    // Non-connection error should not trip
    try {
      await breaker.execute(async () => {
        throw new Error('validation error');
      });
    } catch {
      // Expected
    }

    expect(breaker.getState()).toBe('closed');

    // Connection error should trip
    try {
      await breaker.execute(async () => {
        throw new Error('ECONNREFUSED');
      });
    } catch {
      // Expected
    }

    // Still need more failures to trip (threshold is 5)
    expect(breaker.getState()).toBe('closed');
  });
});

describe('withCircuitBreaker', () => {
  it('should wrap function with circuit breaker', async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockResolvedValue('result');

    const wrapped = withCircuitBreaker(fn, breaker);

    const result = await wrapped('arg1', 'arg2');

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should reject when circuit is open', async () => {
    vi.useFakeTimers();

    const breaker = createCircuitBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('failure'));

    const wrapped = withCircuitBreaker(fn, breaker);

    // Trip the circuit
    await expect(wrapped()).rejects.toThrow('failure');

    // Next call should be rejected by circuit
    fn.mockResolvedValue('success');
    await expect(wrapped()).rejects.toThrow(CircuitOpenError);

    vi.useRealTimers();
  });
});
