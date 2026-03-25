/**
 * Circuit Breaker pattern implementation for database operations.
 *
 * Prevents cascading failures by stopping requests to a failing service
 * and allowing it time to recover.
 */

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000) */
  resetTimeout?: number;
  /** Number of successful calls in half-open state to close circuit (default: 2) */
  successThreshold?: number;
  /** Time window in ms to count failures (default: 60000) */
  failureWindow?: number;
  /** Custom function to determine if an error should count as failure */
  isFailure?: (error: Error) => boolean;
  /** Callback when circuit state changes */
  onStateChange?: (state: CircuitState, previousState: CircuitState) => void;
  /** Callback when circuit opens */
  onOpen?: (failures: number) => void;
  /** Callback when circuit closes */
  onClose?: () => void;
  /** Callback when circuit goes half-open */
  onHalfOpen?: () => void;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current circuit state */
  state: CircuitState;
  /** Total number of failures */
  failures: number;
  /** Total number of successes */
  successes: number;
  /** Failures in current window */
  recentFailures: number;
  /** Consecutive successes in half-open state */
  consecutiveSuccesses: number;
  /** Time when circuit last opened */
  lastFailureTime: number | null;
  /** Time when circuit last state change occurred */
  lastStateChange: number;
  /** Total number of requests blocked by open circuit */
  blocked: number;
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  readonly isCircuitOpen = true;
  readonly resetTime: number;

  constructor(resetTime: number) {
    super('Circuit breaker is open');
    this.name = 'CircuitOpenError';
    this.resetTime = resetTime;
  }
}

/**
 * Failure record for sliding window
 * Only stores timestamp and error message (not full Error object) to avoid
 * retaining sensitive stack traces in memory.
 */
interface FailureRecord {
  timestamp: number;
  message: string;
}

/**
 * Circuit Breaker for protecting against cascading failures.
 *
 * The circuit breaker has three states:
 * - **Closed**: Normal operation, requests pass through
 * - **Open**: Failure threshold exceeded, requests fail immediately
 * - **Half-Open**: Testing if service has recovered
 *
 * @example Basic usage
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeout: 30000
 * });
 *
 * async function fetchData() {
 *   return breaker.execute(async () => {
 *     return await database.query('SELECT * FROM users');
 *   });
 * }
 * ```
 *
 * @example With callbacks
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 3,
 *   resetTimeout: 60000,
 *   onOpen: (failures) => {
 *     alerting.notify('Database circuit opened', { failures });
 *   },
 *   onClose: () => {
 *     alerting.notify('Database circuit recovered');
 *   }
 * });
 * ```
 *
 * @example Custom failure detection
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   isFailure: (error) => {
 *     // Only count connection errors as failures
 *     return error.message.includes('ECONNREFUSED') ||
 *            error.message.includes('ETIMEDOUT');
 *   }
 * });
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: FailureRecord[] = [];
  private consecutiveSuccesses = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private blocked = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number = Date.now();
  private resetTimer: NodeJS.Timeout | null = null;

  private readonly options: Required<Omit<CircuitBreakerOptions, 'onStateChange' | 'onOpen' | 'onClose' | 'onHalfOpen' | 'isFailure'>> &
    Pick<CircuitBreakerOptions, 'onStateChange' | 'onOpen' | 'onClose' | 'onHalfOpen' | 'isFailure'>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 30000,
      successThreshold: options.successThreshold ?? 2,
      failureWindow: options.failureWindow ?? 60000,
      isFailure: options.isFailure,
      onStateChange: options.onStateChange,
      onOpen: options.onOpen,
      onClose: options.onClose,
      onHalfOpen: options.onHalfOpen,
    };
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws CircuitOpenError if circuit is open
   * @throws Original error if function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      this.blocked++;
      const resetTime = this.lastFailureTime! + this.options.resetTimeout;
      throw new CircuitOpenError(resetTime);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute with a fallback value when circuit is open.
   *
   * @param fn - Function to execute
   * @param fallback - Fallback value or function
   * @returns Result or fallback
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: T | (() => T | Promise<T>)
  ): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return typeof fallback === 'function'
          ? await (fallback as () => T | Promise<T>)()
          : fallback;
      }
      throw error;
    }
  }

  /**
   * Handle successful execution.
   */
  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'half-open') {
      this.consecutiveSuccesses++;

      if (this.consecutiveSuccesses >= this.options.successThreshold) {
        this.transitionTo('closed');
      }
    }

    // Clear old failures outside the window
    this.pruneFailures();
  }

  /**
   * Handle failed execution.
   */
  private onFailure(error: Error): void {
    // Check if this error should count as a failure
    if (this.options.isFailure && !this.options.isFailure(error)) {
      return;
    }

    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.failures.push({ timestamp: Date.now(), message: error.message });

    // Reset consecutive successes in half-open state
    if (this.state === 'half-open') {
      this.consecutiveSuccesses = 0;
      this.transitionTo('open');
      return;
    }

    // Prune old failures and check threshold
    this.pruneFailures();

    if (this.state === 'closed' && this.failures.length >= this.options.failureThreshold) {
      this.transitionTo('open');
    }
  }

  /**
   * Remove failures outside the time window.
   */
  private pruneFailures(): void {
    const cutoff = Date.now() - this.options.failureWindow;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
  }

  /**
   * Transition to a new state.
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    if (previousState === newState) return;

    this.state = newState;
    this.lastStateChange = Date.now();

    // Clear any existing reset timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    // State-specific actions
    switch (newState) {
      case 'open':
        this.consecutiveSuccesses = 0;
        this.options.onOpen?.(this.failures.length);

        // Set timer to transition to half-open
        this.resetTimer = setTimeout(() => {
          if (this.state === 'open') {
            this.transitionTo('half-open');
          }
        }, this.options.resetTimeout);
        break;

      case 'half-open':
        this.consecutiveSuccesses = 0;
        this.options.onHalfOpen?.();
        break;

      case 'closed':
        this.failures = [];
        this.consecutiveSuccesses = 0;
        this.options.onClose?.();
        break;
    }

    this.options.onStateChange?.(newState, previousState);
  }

  /**
   * Get the current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if the circuit is allowing requests.
   */
  isAllowing(): boolean {
    return this.state !== 'open';
  }

  /**
   * Check if the circuit is open.
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if the circuit is closed (healthy).
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Get circuit breaker statistics.
   */
  getStats(): CircuitBreakerStats {
    this.pruneFailures();

    return {
      state: this.state,
      failures: this.totalFailures,
      successes: this.totalSuccesses,
      recentFailures: this.failures.length,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      blocked: this.blocked,
    };
  }

  /**
   * Manually reset the circuit breaker to closed state.
   */
  reset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.failures = [];
    this.consecutiveSuccesses = 0;
    this.blocked = 0;
    this.transitionTo('closed');
  }

  /**
   * Manually open the circuit.
   */
  trip(): void {
    this.transitionTo('open');
  }

  /**
   * Get time until circuit will attempt reset (ms).
   * Returns 0 if not in open state.
   */
  getTimeUntilReset(): number {
    if (this.state !== 'open' || !this.lastFailureTime) {
      return 0;
    }

    const resetTime = this.lastFailureTime + this.options.resetTimeout;
    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Clean up resources (timers) when circuit breaker is no longer needed.
   * Call this to prevent memory leaks if discarding the circuit breaker.
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}

/**
 * Create a circuit breaker with default options.
 *
 * @param options - Circuit breaker options
 * @returns CircuitBreaker instance
 */
export function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}

/**
 * Create a database-specific circuit breaker with sensible defaults.
 *
 * @param options - Circuit breaker options
 * @returns CircuitBreaker configured for database operations
 */
export function createDatabaseCircuitBreaker(
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 30000,
    successThreshold: 2,
    failureWindow: 60000,
    isFailure: (error) => {
      const message = error.message.toLowerCase();
      // Only trip for connection-related errors
      return (
        message.includes('econnrefused') ||
        message.includes('etimedout') ||
        message.includes('enotfound') ||
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('pool') ||
        message.includes('too many connections')
      );
    },
    ...options,
  });
}

/**
 * Wrap a function with circuit breaker protection.
 *
 * @param fn - Function to wrap
 * @param breaker - Circuit breaker instance
 * @returns Wrapped function
 *
 * @example
 * ```typescript
 * const breaker = createDatabaseCircuitBreaker();
 * const safeQuery = withCircuitBreaker(
 *   async (sql: string) => database.query(sql),
 *   breaker
 * );
 *
 * const result = await safeQuery('SELECT * FROM users');
 * ```
 */
export function withCircuitBreaker<T, A extends any[]>(
  fn: (...args: A) => Promise<T>,
  breaker: CircuitBreaker
): (...args: A) => Promise<T> {
  return (...args: A) => breaker.execute(() => fn(...args));
}

/**
 * Decorator for adding circuit breaker to a method.
 *
 * @param breaker - Circuit breaker instance
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * const dbBreaker = createDatabaseCircuitBreaker();
 *
 * class UserService {
 *   @circuitBreaker(dbBreaker)
 *   async getUsers(): Promise<User[]> {
 *     return await database.query('SELECT * FROM users');
 *   }
 * }
 * ```
 */
export function circuitBreaker(breaker: CircuitBreaker) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]): Promise<any> {
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
