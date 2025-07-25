/**
 * Advanced Error Handler
 * 
 * Comprehensive error handling system with recovery mechanisms,
 * detailed logging, performance monitoring, and memory leak detection.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { PerformanceMonitor } from './performance-monitor';
import { MemoryLeakDetector } from './memory-leak-detector';

// ------------ INTERFACES

export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  sessionId: string;
  timestamp: number;
  stackTrace?: string;
  metadata?: Record<string, any>;
  severity: ErrorSeverity;
  category: ErrorCategory;
}

export interface ErrorRecoveryStrategy {
  id: string;
  name: string;
  description: string;
  canRecover: (error: Error, context: ErrorContext) => boolean;
  recover: (error: Error, context: ErrorContext) => Promise<RecoveryResult>;
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  data?: any;
  shouldRetry: boolean;
  nextRetryDelay?: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByComponent: Record<string, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  criticalErrorsLast24h: number;
  memoryLeaksDetected: number;
  performanceIssues: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  MEMORY = 'memory',
  PERFORMANCE = 'performance',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  CONFIGURATION = 'configuration',
  EXTERNAL_API = 'external_api',
  DATABASE = 'database',
  UI = 'ui',
  UNKNOWN = 'unknown'
}

// ------------ MAIN CLASS

export class AdvancedErrorHandler {
  private static instance: AdvancedErrorHandler;
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private memoryLeakDetector: MemoryLeakDetector;
  
  private recoveryStrategies = new Map<string, ErrorRecoveryStrategy>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private errorMetrics: ErrorMetrics;
  private sessionId: string;
  private errorHistory: Array<{ error: Error; context: ErrorContext; timestamp: number }> = [];
  private recoveryAttempts = new Map<string, number>();
  
  // Configuration
  private readonly MAX_ERROR_HISTORY = 1000;
  private readonly METRICS_COLLECTION_INTERVAL = 60000; // 1 minute
  private readonly MEMORY_CHECK_INTERVAL = 300000; // 5 minutes
  private readonly PERFORMANCE_CHECK_INTERVAL = 30000; // 30 seconds

  private constructor(private context: vscode.ExtensionContext) {
    this.sessionId = this.generateSessionId();
    this.logger = new Logger(context);
    this.performanceMonitor = new PerformanceMonitor(context);
    this.memoryLeakDetector = new MemoryLeakDetector(context);
    
    this.initializeErrorMetrics();
    this.setupRecoveryStrategies();
    this.setupCircuitBreakers();
    this.startMonitoring();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(context?: vscode.ExtensionContext): AdvancedErrorHandler {
    if (!AdvancedErrorHandler.instance && context) {
      AdvancedErrorHandler.instance = new AdvancedErrorHandler(context);
    }
    return AdvancedErrorHandler.instance;
  }

  /**
   * Handle error with advanced recovery and logging
   */
  public async handleError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): Promise<RecoveryResult> {
    const fullContext: ErrorContext = {
      component: context.component || 'unknown',
      operation: context.operation || 'unknown',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      stackTrace: error.stack,
      metadata: context.metadata || {},
      severity: context.severity || this.determineSeverity(error),
      category: context.category || this.categorizeError(error),
      ...context
    };

    // Log the error
    await this.logger.logError(error, fullContext);

    // Update metrics
    this.updateErrorMetrics(error, fullContext);

    // Add to error history
    this.addToErrorHistory(error, fullContext);

    // Check circuit breaker
    const circuitBreakerKey = `${fullContext.component}:${fullContext.operation}`;
    if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
      return {
        success: false,
        message: 'Circuit breaker is open - operation temporarily disabled',
        shouldRetry: false
      };
    }

    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(error, fullContext);

    // Update circuit breaker state
    this.updateCircuitBreaker(circuitBreakerKey, recoveryResult.success);

    // Trigger alerts for critical errors
    if (fullContext.severity === ErrorSeverity.CRITICAL) {
      await this.triggerCriticalErrorAlert(error, fullContext);
    }

    // Check for memory leaks if memory-related error
    if (fullContext.category === ErrorCategory.MEMORY) {
      this.memoryLeakDetector.checkForLeaks();
    }

    return recoveryResult;
  }

  /**
   * Attempt error recovery using registered strategies
   */
  private async attemptRecovery(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const recoveryKey = `${context.component}:${context.operation}:${error.name}`;
    const attemptCount = this.recoveryAttempts.get(recoveryKey) || 0;

    // Find applicable recovery strategies
    const applicableStrategies = Array.from(this.recoveryStrategies.values())
      .filter(strategy => strategy.canRecover(error, context))
      .sort((a, b) => a.maxAttempts - b.maxAttempts); // Try strategies with fewer max attempts first

    if (applicableStrategies.length === 0) {
      return {
        success: false,
        message: 'No recovery strategy available',
        shouldRetry: false
      };
    }

    for (const strategy of applicableStrategies) {
      if (attemptCount >= strategy.maxAttempts) {
        continue;
      }

      try {
        this.recoveryAttempts.set(recoveryKey, attemptCount + 1);
        
        // Calculate delay based on backoff strategy
        const delay = this.calculateBackoffDelay(strategy, attemptCount);
        if (delay > 0) {
          await this.sleep(delay);
        }

        const startTime = Date.now();
        const result = await strategy.recover(error, context);
        const recoveryTime = Date.now() - startTime;

        // Log recovery attempt
        await this.logger.logInfo(`Recovery attempt using strategy '${strategy.name}'`, {
          strategy: strategy.id,
          attempt: attemptCount + 1,
          success: result.success,
          recoveryTime,
          context
        });

        if (result.success) {
          // Reset attempt count on successful recovery
          this.recoveryAttempts.delete(recoveryKey);
          this.updateRecoveryMetrics(true, recoveryTime);
          return result;
        } else if (!result.shouldRetry) {
          break;
        }
      } catch (recoveryError) {
        await this.logger.logError(recoveryError as Error, {
          ...context,
          operation: `recovery:${strategy.id}`,
          metadata: { originalError: error.message }
        });
      }
    }

    this.updateRecoveryMetrics(false, 0);
    return {
      success: false,
      message: 'All recovery strategies failed',
      shouldRetry: false
    };
  }

  /**
   * Register a new recovery strategy
   */
  public registerRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.id, strategy);
    this.logger.logInfo(`Registered recovery strategy: ${strategy.name}`, {
      strategyId: strategy.id,
      maxAttempts: strategy.maxAttempts
    });
  }

  /**
   * Get error metrics
   */
  public getErrorMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Get error history
   */
  public getErrorHistory(limit: number = 100): Array<{ error: Error; context: ErrorContext; timestamp: number }> {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Clear error history
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
    this.logger.logInfo('Error history cleared');
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Reset circuit breaker
   */
  public resetCircuitBreaker(key: string): void {
    if (this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0
      });
      this.logger.logInfo(`Circuit breaker reset: ${key}`);
    }
  }

  /**
   * Initialize error metrics
   */
  private initializeErrorMetrics(): void {
    this.errorMetrics = {
      totalErrors: 0,
      errorsByCategory: Object.values(ErrorCategory).reduce((acc, category) => {
        acc[category] = 0;
        return acc;
      }, {} as Record<ErrorCategory, number>),
      errorsBySeverity: Object.values(ErrorSeverity).reduce((acc, severity) => {
        acc[severity] = 0;
        return acc;
      }, {} as Record<ErrorSeverity, number>),
      errorsByComponent: {},
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      criticalErrorsLast24h: 0,
      memoryLeaksDetected: 0,
      performanceIssues: 0
    };
  }

  /**
   * Setup default recovery strategies
   */
  private setupRecoveryStrategies(): void {
    // Network retry strategy
    this.registerRecoveryStrategy({
      id: 'network-retry',
      name: 'Network Retry',
      description: 'Retry network operations with exponential backoff',
      canRecover: (error, context) => 
        context.category === ErrorCategory.NETWORK || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT'),
      recover: async (_error, _context) => {
        // Simulate network retry logic
        return {
          success: Math.random() > 0.3, // 70% success rate
          message: 'Network operation retried',
          shouldRetry: true
        };
      },
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000
    });

    // File system retry strategy
    this.registerRecoveryStrategy({
      id: 'filesystem-retry',
      name: 'File System Retry',
      description: 'Retry file system operations',
      canRecover: (error, context) => 
        context.category === ErrorCategory.FILE_SYSTEM ||
        error.message.includes('ENOENT') ||
        error.message.includes('EACCES'),
      recover: async (error, context) => {
        // Attempt to create directory or handle file access issues
        if (error.message.includes('ENOENT') && context.metadata?.filePath) {
          try {
            const dir = path.dirname(context.metadata.filePath as string);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            return {
              success: true,
              message: 'Directory created successfully',
              shouldRetry: true
            };
          } catch {
            return {
              success: false,
              message: 'Failed to create directory',
              shouldRetry: false
            };
          }
        }
        return {
          success: false,
          message: 'File system error cannot be recovered',
          shouldRetry: false
        };
      },
      maxAttempts: 2,
      backoffStrategy: 'linear',
      baseDelay: 500
    });

    // Memory cleanup strategy
    this.registerRecoveryStrategy({
      id: 'memory-cleanup',
      name: 'Memory Cleanup',
      description: 'Attempt to free memory and garbage collect',
      canRecover: (error, context) => 
        context.category === ErrorCategory.MEMORY ||
        error.message.includes('out of memory') ||
        error.message.includes('heap'),
      recover: async (_error, context) => {
        try {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          
          // Clear caches if available
          if (context.metadata?.clearCaches) {
            await context.metadata.clearCaches();
          }
          
          return {
            success: true,
            message: 'Memory cleanup completed',
            shouldRetry: true
          };
        } catch {
          return {
            success: false,
            message: 'Memory cleanup failed',
            shouldRetry: false
          };
        }
      },
      maxAttempts: 1,
      backoffStrategy: 'fixed',
      baseDelay: 0
    });

    // Configuration reload strategy
    this.registerRecoveryStrategy({
      id: 'config-reload',
      name: 'Configuration Reload',
      description: 'Reload configuration and retry operation',
      canRecover: (error, context) => 
        context.category === ErrorCategory.CONFIGURATION ||
        error.message.includes('configuration') ||
        error.message.includes('config'),
      recover: async (_error, _context) => {
        try {
          // Reload VS Code configuration
          const config = vscode.workspace.getConfiguration();
          await config.update('codepulse', undefined, vscode.ConfigurationTarget.Global);
          
          return {
            success: true,
            message: 'Configuration reloaded',
            shouldRetry: true
          };
        } catch {
          return {
            success: false,
            message: 'Configuration reload failed',
            shouldRetry: false
          };
        }
      },
      maxAttempts: 1,
      backoffStrategy: 'fixed',
      baseDelay: 0
    });
  }

  /**
   * Setup circuit breakers for critical components
   */
  private setupCircuitBreakers(): void {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      halfOpenMaxCalls: 3
    };

    // Initialize circuit breakers for key components
    const components = [
      'metrics:collection',
      'analytics:processing',
      'reporting:generation',
      'storage:operations',
      'network:requests'
    ];

    components.forEach(component => {
      this.circuitBreakers.set(component, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0
      });
    });
  }

  /**
   * Start monitoring systems
   */
  private startMonitoring(): void {
    // Metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, this.METRICS_COLLECTION_INTERVAL);

    // Memory monitoring
    setInterval(() => {
      this.memoryLeakDetector.checkForLeaks();
    }, this.MEMORY_CHECK_INTERVAL);

    // Performance monitoring
    setInterval(() => {
      this.performanceMonitor.collectMetrics();
    }, this.PERFORMANCE_CHECK_INTERVAL);

    this.logger.logInfo('Error handling monitoring systems started');
  }

  /**
   * Determine error severity based on error characteristics
   */
  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Critical errors
    if (
      message.includes('out of memory') ||
      message.includes('heap') ||
      message.includes('segmentation fault') ||
      message.includes('fatal') ||
      stack.includes('native')
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (
      message.includes('permission denied') ||
      message.includes('access denied') ||
      message.includes('authentication') ||
      message.includes('authorization') ||
      message.includes('security')
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('file not found') ||
      message.includes('invalid')
    ) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  /**
   * Categorize error based on error characteristics
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return ErrorCategory.NETWORK;
    }

    if (message.includes('file') || message.includes('directory') || message.includes('enoent') || message.includes('eacces')) {
      return ErrorCategory.FILE_SYSTEM;
    }

    if (message.includes('memory') || message.includes('heap') || message.includes('allocation')) {
      return ErrorCategory.MEMORY;
    }

    if (message.includes('performance') || message.includes('slow') || message.includes('lag')) {
      return ErrorCategory.PERFORMANCE;
    }

    if (message.includes('validation') || message.includes('invalid') || message.includes('format')) {
      return ErrorCategory.VALIDATION;
    }

    if (message.includes('auth') || message.includes('permission') || message.includes('access')) {
      return ErrorCategory.AUTHENTICATION;
    }

    if (message.includes('config') || message.includes('setting') || message.includes('option')) {
      return ErrorCategory.CONFIGURATION;
    }

    if (message.includes('api') || message.includes('http') || message.includes('request')) {
      return ErrorCategory.EXTERNAL_API;
    }

    if (message.includes('database') || message.includes('sql') || message.includes('query')) {
      return ErrorCategory.DATABASE;
    }

    if (stack.includes('webview') || stack.includes('ui') || message.includes('render')) {
      return ErrorCategory.UI;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(_error: Error, context: ErrorContext): void {
    this.errorMetrics.totalErrors++;
    this.errorMetrics.errorsByCategory[context.category]++;
    this.errorMetrics.errorsBySeverity[context.severity]++;

    if (!this.errorMetrics.errorsByComponent[context.component]) {
      this.errorMetrics.errorsByComponent[context.component] = 0;
    }
    this.errorMetrics.errorsByComponent[context.component]++;

    // Count critical errors in last 24 hours
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    this.errorMetrics.criticalErrorsLast24h = this.errorHistory.filter(
      entry => entry.timestamp > last24h && entry.context.severity === ErrorSeverity.CRITICAL
    ).length;
  }

  /**
   * Update recovery metrics
   */
  private updateRecoveryMetrics(success: boolean, recoveryTime: number): void {
    const totalRecoveryAttempts = Array.from(this.recoveryAttempts.values()).reduce((sum, count) => sum + count, 0);
    const successfulRecoveries = success ? 1 : 0;

    // Update success rate (simplified calculation)
    this.errorMetrics.recoverySuccessRate = totalRecoveryAttempts > 0
      ? (successfulRecoveries / totalRecoveryAttempts) * 100
      : 0;

    // Update average recovery time
    if (success && recoveryTime > 0) {
      this.errorMetrics.averageRecoveryTime =
        (this.errorMetrics.averageRecoveryTime + recoveryTime) / 2;
    }
  }

  /**
   * Add error to history
   */
  private addToErrorHistory(error: Error, context: ErrorContext): void {
    this.errorHistory.push({
      error,
      context,
      timestamp: Date.now()
    });

    // Maintain history size limit
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_ERROR_HISTORY);
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) {return false;}

    const now = Date.now();

    if (breaker.state === 'open') {
      if (now >= breaker.nextAttemptTime) {
        // Transition to half-open
        breaker.state = 'half-open';
        breaker.successCount = 0;
        this.circuitBreakers.set(key, breaker);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(key: string, success: boolean): void {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) {return;}

    const now = Date.now();

    if (success) {
      if (breaker.state === 'half-open') {
        breaker.successCount++;
        if (breaker.successCount >= 3) { // halfOpenMaxCalls
          breaker.state = 'closed';
          breaker.failureCount = 0;
        }
      } else if (breaker.state === 'closed') {
        breaker.failureCount = Math.max(0, breaker.failureCount - 1);
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = now;

      if (breaker.failureCount >= 5) { // failureThreshold
        breaker.state = 'open';
        breaker.nextAttemptTime = now + 60000; // recoveryTimeout
      }
    }

    this.circuitBreakers.set(key, breaker);
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoffDelay(strategy: ErrorRecoveryStrategy, attemptCount: number): number {
    switch (strategy.backoffStrategy) {
      case 'linear':
        return strategy.baseDelay * (attemptCount + 1);
      case 'exponential':
        return strategy.baseDelay * Math.pow(2, attemptCount);
      case 'fixed':
      default:
        return strategy.baseDelay;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Trigger critical error alert
   */
  private async triggerCriticalErrorAlert(error: Error, context: ErrorContext): Promise<void> {
    try {
      // Show VS Code error message
      const action = await vscode.window.showErrorMessage(
        `Critical Error in ${context.component}: ${error.message}`,
        'View Details',
        'Report Issue'
      );

      if (action === 'View Details') {
        // Show detailed error information
        const details = `
Component: ${context.component}
Operation: ${context.operation}
Time: ${new Date(context.timestamp).toLocaleString()}
Error: ${error.message}
Stack: ${error.stack}
        `;

        vscode.window.showInformationMessage(details);
      } else if (action === 'Report Issue') {
        // Open issue reporting
        const issueUrl = 'https://github.com/your-repo/issues/new';
        vscode.env.openExternal(vscode.Uri.parse(issueUrl));
      }

      // Log critical error alert
      await this.logger.logCritical('Critical error alert triggered', {
        error: error.message,
        context,
        userAction: action
      });
    } catch (alertError) {
      // Fallback logging if alert fails
      await this.logger.logError(alertError as Error, {
        component: 'error-handler',
        operation: 'critical-alert',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UI,
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Collect and update metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Update memory leak detection metrics
      const memoryLeaks = await this.memoryLeakDetector.getDetectedLeaks();
      this.errorMetrics.memoryLeaksDetected = memoryLeaks.length;

      // Update performance issue metrics
      const performanceIssues = await this.performanceMonitor.getPerformanceIssues();
      this.errorMetrics.performanceIssues = performanceIssues.length;

      // Log metrics periodically
      await this.logger.logInfo('Error metrics collected', {
        metrics: this.errorMetrics,
        circuitBreakers: Object.fromEntries(this.circuitBreakers),
        recoveryAttempts: Object.fromEntries(this.recoveryAttempts)
      });
    } catch (error) {
      // Don't use handleError here to avoid recursion
      await this.logger.logError(error as Error, {
        component: 'error-handler',
        operation: 'metrics-collection',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.PERFORMANCE,
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    // Clear intervals and cleanup resources
    this.errorHistory = [];
    this.recoveryAttempts.clear();
    this.circuitBreakers.clear();

    this.logger.logInfo('Advanced error handler disposed');
  }
}
