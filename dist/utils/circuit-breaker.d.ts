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
export declare class CircuitOpenError extends Error {
    readonly isCircuitOpen = true;
    readonly resetTime: number;
    constructor(resetTime: number);
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
export declare class CircuitBreaker {
    private state;
    private failures;
    private consecutiveSuccesses;
    private totalFailures;
    private totalSuccesses;
    private blocked;
    private lastFailureTime;
    private lastStateChange;
    private resetTimer;
    private readonly options;
    constructor(options?: CircuitBreakerOptions);
    /**
     * Execute a function through the circuit breaker.
     *
     * @param fn - Function to execute
     * @returns Result of the function
     * @throws CircuitOpenError if circuit is open
     * @throws Original error if function fails
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Execute with a fallback value when circuit is open.
     *
     * @param fn - Function to execute
     * @param fallback - Fallback value or function
     * @returns Result or fallback
     */
    executeWithFallback<T>(fn: () => Promise<T>, fallback: T | (() => T | Promise<T>)): Promise<T>;
    /**
     * Handle successful execution.
     */
    private onSuccess;
    /**
     * Handle failed execution.
     */
    private onFailure;
    /**
     * Remove failures outside the time window.
     */
    private pruneFailures;
    /**
     * Transition to a new state.
     */
    private transitionTo;
    /**
     * Get the current circuit state.
     */
    getState(): CircuitState;
    /**
     * Check if the circuit is allowing requests.
     */
    isAllowing(): boolean;
    /**
     * Check if the circuit is open.
     */
    isOpen(): boolean;
    /**
     * Check if the circuit is closed (healthy).
     */
    isClosed(): boolean;
    /**
     * Get circuit breaker statistics.
     */
    getStats(): CircuitBreakerStats;
    /**
     * Manually reset the circuit breaker to closed state.
     */
    reset(): void;
    /**
     * Manually open the circuit.
     */
    trip(): void;
    /**
     * Get time until circuit will attempt reset (ms).
     * Returns 0 if not in open state.
     */
    getTimeUntilReset(): number;
    /**
     * Clean up resources (timers) when circuit breaker is no longer needed.
     * Call this to prevent memory leaks if discarding the circuit breaker.
     */
    destroy(): void;
}
/**
 * Create a circuit breaker with default options.
 *
 * @param options - Circuit breaker options
 * @returns CircuitBreaker instance
 */
export declare function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker;
/**
 * Create a database-specific circuit breaker with sensible defaults.
 *
 * @param options - Circuit breaker options
 * @returns CircuitBreaker configured for database operations
 */
export declare function createDatabaseCircuitBreaker(options?: Partial<CircuitBreakerOptions>): CircuitBreaker;
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
export declare function withCircuitBreaker<T, A extends any[]>(fn: (...args: A) => Promise<T>, breaker: CircuitBreaker): (...args: A) => Promise<T>;
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
export declare function circuitBreaker(breaker: CircuitBreaker): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=circuit-breaker.d.ts.map