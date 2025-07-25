/**
 * @file ERROR-HANDLER.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Centralized Error Handling System for Code Pulse
 * Implements singleton pattern for consistent error handling across components with multi-level
 * logging, user notifications, and specialized error recovery mechanisms.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';

// ------------ INTERFACES
/**
 * Error structure for complexity analysis errors
 */
interface ComplexityError {
  context: string;
  file: string;
  language: string;
  error: string;
  metrics?: any;
  timestamp: number;
  recoveryAttempted?: boolean;
  failedRecoveries?: number;
}

// ------------ CLASS
/**
 * Centralized error handling system with recovery mechanisms and multi-level logging
 */
export class ErrorHandler {
  /**
   * Singleton instance of ErrorHandler
   */
  private static instance: ErrorHandler;

  /**
   * VS Code output channel for error logging
   */
  private outputChannel: vscode.OutputChannel;

  /**
   * Error count tracking by context
   */
  private readonly errorMap: Map<string, number> = new Map();

  /**
   * Error recovery attempt tracking
   */
  private readonly errorRecoveryMap: Map<string, number> = new Map();

  /**
   * Maximum number of errors to track per context
   */
  private readonly MAX_ERRORS = 100;

  /**
   * Maximum recovery attempts before giving up
   */
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  /**
   * Cooldown period between recovery attempts (1 minute)
   */
  private readonly RECOVERY_COOLDOWN = 1000 * 60;

  /**
   * Private constructor for singleton pattern
   * Creates dedicated output channel for errors and ensures single instance through static access
   */
  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Productivity Dashboard Errors');
  }

  /**
   * Singleton accessor
   * @returns Single instance of ErrorHandler
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Unified logging method with tiered handling
   * @param message Descriptive error message
   * @param type Severity level (info|warn|error)
   */
  public log(message: string, type: 'info' | 'warn' | 'error' = 'error') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;

    switch (type) {
      case 'info':

        // Silent logging for diagnostics
        console.log(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
        break;
      case 'warn':

        // Non-critical issues with user alert
        console.warn(formattedMessage);
        vscode.window.showWarningMessage(message);
        this.outputChannel.appendLine(`WARNING: ${formattedMessage}`);
        break;
      case 'error':

        // Critical errors with user notification
        console.error(formattedMessage);
        vscode.window.showErrorMessage(message);
        this.outputChannel.appendLine(`ERROR: ${formattedMessage}`);
        break;
    }
  }

  /**
   * Specialized handling for complexity analysis errors
   * @param error Error details for complexity analysis
   */
  public logComplexityError(error: ComplexityError) {
    const formattedError = {
      type: 'COMPLEXITY_ERROR',
      ...error,
      formattedTime: new Date(error.timestamp).toISOString()
    };

    // Log to output channel
    this.outputChannel.appendLine(
      `[COMPLEXITY ERROR] ${JSON.stringify(formattedError, null, 2)}`
    );

    // Show notification based on context
    if (error.context === 'deepAnalysis') {
      vscode.window.showErrorMessage(
        `Complex code analysis failed in ${error.file}. See output for details.`
      );
    } else {
      // Just log for quick analysis
      console.error('Quick analysis error:', error.error);
    }
  }

  /**
   * Monitor and log performance issues
   * @param metrics Performance metrics from analysis
   */
  public checkPerformanceIssues(metrics: { 
    analysisTime: number;
    memoryUsage: number;
    nodeCount: number;
  }) {
    if (metrics.analysisTime > 1000) { // 1 second
      this.log(`Long analysis time detected: ${metrics.analysisTime}ms`, 'warn');
    }

    // Lowered memory threshold to 50MB
    if (metrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
      this.log(`High memory usage: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`, 'warn');
    }

    if (metrics.nodeCount > 1000) {
      this.log(`Large AST detected: ${metrics.nodeCount} nodes`, 'warn');
    }
  }

  /**
   * Specialized handling for Live Share errors
   * @param error Error object
   * @param context Context of the error
   */
  public logLiveShareError(error: Error, context: string) {
    const formattedError = {
      type: 'LIVE_SHARE_ERROR',
      context,
      message: error.message,
      timestamp: new Date().toISOString()
    };

    this.outputChannel.appendLine(
      `[LIVE_SHARE ERROR] ${JSON.stringify(formattedError, null, 2)}`
    );

    if (context === 'initialization') {
      vscode.window.showWarningMessage(
        'Live Share integration unavailable. Some features may be limited.'
      );
    }
  }

  /**
   * Generic error handler for all error types
   * @param error The error to handle
   * @param context Optional context information
   */
  public handleError(error: Error, context?: string): void {
    const errorMessage = context ? `[${context}] ${error.message}` : error.message;
    this.log(errorMessage, 'error');

    // Log stack trace for debugging
    if (error.stack) {
      this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
    }
  }

  /**
   * Unified handler for analysis errors
   * @param language The language being analyzed
   * @param error The caught error
   * @param context Additional context about where the error occurred
   */
  public handleAnalysisError(language: string, error: Error, context: string): never {
    this.logError(language, error);
    throw new Error(`[${language}] Analysis failed in ${context}: ${error.message}`);
  }

  /**
   * Log error with frequency tracking
   * @param language Language being analyzed
   * @param error Error to log
   * @private
   */
  private logError(language: string, error: Error): void {
    const count = this.errorMap.get(language) || 0;
    if (count < this.MAX_ERRORS) {
        console.error(`[${language}] Analysis error:`, error);
        this.errorMap.set(language, count + 1);
    }
  }

  /**
   * Specialized handling for worker errors
   * @param error Error object
   * @param context Context of the error
   */
  public handleWorkerError(error: Error, context: string): void {
    const errorDetails = {
      type: 'WORKER_ERROR',
      context,
      message: error.message,
      timestamp: Date.now()
    };

    this.outputChannel.appendLine(
      `[WORKER ERROR] ${JSON.stringify(errorDetails, null, 2)}`
    );

    vscode.window.showErrorMessage(
      `Worker error in ${context}: ${error.message}`
    );
  }

  /**
   * Specialized handling for cache errors
   * @param error - Error object
   * @param context - Context of the error
   */
  public handleCacheError(error: Error, context: string): void {
    const errorDetails = {
      type: 'CACHE_ERROR',
      context,
      message: error.message,
      timestamp: Date.now()
    };

    this.outputChannel.appendLine(
      `[CACHE ERROR] ${JSON.stringify(errorDetails, null, 2)}`
    );

    // Only show warnings for cache errors as they're typically non-critical
    vscode.window.showWarningMessage(
      `Cache operation failed in ${context}: ${error.message}`
    );
  }

  /**
   * Handle cache corruption errors with recovery attempts
   */
  public async handleCacheCorruption(error: Error, context: string): Promise<void> {
    const errorKey = `cache:${context}`;
    const attempts = this.errorRecoveryMap.get(errorKey) || 0;

    if (attempts >= this.MAX_RECOVERY_ATTEMPTS) {
      this.log(`Cache recovery failed after ${attempts} attempts: ${error.message}`, 'error');
      throw new Error(`Cache recovery failed: ${error.message}`);
    }

    this.errorRecoveryMap.set(errorKey, attempts + 1);

    try {
      // Attempt cache recovery
      await this.recoverCache(context);
      this.log(`Cache recovered successfully for ${context}`, 'info');
      this.errorRecoveryMap.delete(errorKey);
    } catch (recoveryError) {
      this.log(`Cache recovery attempt ${attempts + 1} failed: ${recoveryError}`, 'warn');
      throw recoveryError;
    }
  }

  /**
   * Handle network-related errors with retries
   */
  public async handleNetworkError(error: Error, context: string): Promise<void> {
    const errorKey = `network:${context}`;
    const attempts = this.errorRecoveryMap.get(errorKey) || 0;

    if (attempts >= this.MAX_RECOVERY_ATTEMPTS) {
      this.log(`Network operation failed after ${attempts} attempts: ${error.message}`, 'error');
      throw new Error(`Network operation failed: ${error.message}`);
    }

    this.errorRecoveryMap.set(errorKey, attempts + 1);

    // Exponential backoff
    const delay = Math.pow(2, attempts) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    this.log(`Retrying network operation for ${context}`, 'info');
  }

  /**
   * Handle concurrent analysis conflicts
   */
  public handleConcurrencyConflict(error: Error, context: string): void {
    const errorKey = `concurrency:${context}`;
    
    if (this.errorRecoveryMap.has(errorKey)) {
      const lastAttempt = this.errorRecoveryMap.get(errorKey) || 0;
      const now = Date.now();
      
      if (now - lastAttempt < this.RECOVERY_COOLDOWN) {
        this.log(`Concurrency conflict cooling down for ${context}`, 'warn');
        throw new Error(`Analysis conflict: ${error.message}`);
      }
    }

    this.errorRecoveryMap.set(errorKey, Date.now());
    this.log(`Rescheduling analysis for ${context}`, 'info');
  }

  private async recoverCache(context: string): Promise<void> {
    try {
      // Clear corrupted entries
      const storageKey = `cache:${context}`;
      await vscode.workspace.getConfiguration('productivityDashboard')
        .update(storageKey, undefined, vscode.ConfigurationTarget.Global);

      // Rebuild cache index
      await this.rebuildCacheIndex(context);
    } catch (error) {
      throw new Error(`Cache recovery failed: ${error}`);
    }
  }

  private async rebuildCacheIndex(context: string): Promise<void> {
    // Scan for valid cache entries
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    const cachePattern = new RegExp(`^cache:${context}:`);
    
    const validEntries = Object.keys(config)
      .filter(key => cachePattern.test(key) && this.isValidCacheEntry(config.get(key)));

    // Rebuild index with valid entries
    await config.update(`cache:${context}:index`, validEntries, vscode.ConfigurationTarget.Global);
  }

  private isValidCacheEntry(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object') {return false;}
    const requiredKeys = ['timestamp', 'data', 'version'];
    return requiredKeys.every(key => key in (entry as object));
  }

  public clearErrorRecovery(context: string): void {
    for (const prefix of ['cache:', 'network:', 'concurrency:']) {
      this.errorRecoveryMap.delete(`${prefix}${context}`);
    }
  }
}