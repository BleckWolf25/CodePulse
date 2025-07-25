/**
 * Performance Monitor
 * 
 * Comprehensive performance monitoring system with metrics collection,
 * bottleneck detection, resource usage tracking, and optimization suggestions.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { Logger } from './logger';

// ------------ INTERFACES

export interface PerformanceMetrics {
  timestamp: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  operations: OperationMetrics;
  system: SystemMetrics;
  extension: ExtensionMetrics;
}

export interface CPUMetrics {
  usage: number;
  loadAverage: number[];
  cores: number;
  model: string;
  speed: number;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  heap: NodeJS.MemoryUsage;
  external: number;
  buffers: number;
}

export interface OperationMetrics {
  totalOperations: number;
  averageResponseTime: number;
  slowOperations: SlowOperation[];
  operationsByType: Record<string, OperationStats>;
  throughput: number;
  errorRate: number;
}

export interface SlowOperation {
  name: string;
  duration: number;
  timestamp: number;
  component: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface OperationStats {
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  lastExecuted: number;
}

export interface SystemMetrics {
  platform: string;
  arch: string;
  nodeVersion: string;
  vscodeVersion: string;
  uptime: number;
  freeMemory: number;
  totalMemory: number;
}

export interface ExtensionMetrics {
  activationTime: number;
  commandExecutions: number;
  webviewCreations: number;
  fileOperations: number;
  networkRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface PerformanceIssue {
  id: string;
  type: 'memory_leak' | 'slow_operation' | 'high_cpu' | 'high_memory' | 'bottleneck';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  component: string;
  detectedAt: number;
  metrics: Record<string, any>;
  suggestions: string[];
  impact: string;
}

export interface PerformanceThresholds {
  slowOperationMs: number;
  highCpuPercent: number;
  highMemoryPercent: number;
  maxResponseTimeMs: number;
  maxErrorRate: number;
  memoryLeakThresholdMB: number;
}

export interface PerformanceBenchmark {
  name: string;
  operation: () => Promise<any>;
  iterations: number;
  warmupIterations: number;
  timeout: number;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  operationsPerSecond: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: NodeJS.MemoryUsage;
  };
}

// ------------ MAIN CLASS

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;

  private logger: Logger;
  private metrics: PerformanceMetrics[] = [];
  private operations = new Map<string, OperationStats>();
  private slowOperations: SlowOperation[] = [];
  private performanceIssues: PerformanceIssue[] = [];
  private activeOperations = new Map<string, { start: number; name: string; component: string }>();
  
  private thresholds: PerformanceThresholds = {
    slowOperationMs: 1000,
    highCpuPercent: 80,
    highMemoryPercent: 85,
    maxResponseTimeMs: 5000,
    maxErrorRate: 5,
    memoryLeakThresholdMB: 100
  };

  private extensionMetrics: ExtensionMetrics = {
    activationTime: 0,
    commandExecutions: 0,
    webviewCreations: 0,
    fileOperations: 0,
    networkRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly MAX_SLOW_OPERATIONS = 100;
  private readonly MAX_PERFORMANCE_ISSUES = 50;
  private readonly COLLECTION_INTERVAL = 30000; // 30 seconds

  private collectionTimer?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor(private context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance(context);
    this.loadConfiguration();
    this.recordActivationTime();
  }

  /**
   * Get singleton instance of PerformanceMonitor
   */
  public static getInstance(context: vscode.ExtensionContext): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(context);
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  public start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.COLLECTION_INTERVAL);

    this.logger.logInfo('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  public stop(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }
    this.isMonitoring = false;
    this.logger.logInfo('Performance monitoring stopped');
  }

  /**
   * Start operation timing
   */
  public startOperation(name: string, component: string = 'unknown'): string {
    const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeOperations.set(operationId, {
      start: Date.now(),
      name,
      component
    });

    return operationId;
  }

  /**
   * End operation timing
   */
  public endOperation(
    operationId: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): number {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.logWarn(`Operation not found: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - operation.start;
    this.activeOperations.delete(operationId);

    // Update operation statistics
    this.updateOperationStats(operation.name, duration, success);

    // Check for slow operations
    if (duration > this.thresholds.slowOperationMs) {
      this.recordSlowOperation(operation.name, duration, operation.component, metadata);
    }

    // Log performance measurement
    this.logger.logDebug(`Operation completed: ${operation.name}`, {
      duration,
      success,
      component: operation.component,
      metadata
    });

    return duration;
  }

  /**
   * Record extension activation time
   */
  public recordActivationTime(): void {
    this.extensionMetrics.activationTime = Date.now();
  }

  /**
   * Increment command execution counter
   */
  public incrementCommandExecutions(): void {
    this.extensionMetrics.commandExecutions++;
  }

  /**
   * Increment webview creation counter
   */
  public incrementWebviewCreations(): void {
    this.extensionMetrics.webviewCreations++;
  }

  /**
   * Increment file operation counter
   */
  public incrementFileOperations(): void {
    this.extensionMetrics.fileOperations++;
  }

  /**
   * Increment network request counter
   */
  public incrementNetworkRequests(): void {
    this.extensionMetrics.networkRequests++;
  }

  /**
   * Record cache hit
   */
  public recordCacheHit(): void {
    this.extensionMetrics.cacheHits++;
  }

  /**
   * Record cache miss
   */
  public recordCacheMiss(): void {
    this.extensionMetrics.cacheMisses++;
  }

  /**
   * Collect performance metrics
   */
  public async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = Date.now();
    
    const metrics: PerformanceMetrics = {
      timestamp,
      cpu: await this.collectCPUMetrics(),
      memory: this.collectMemoryMetrics(),
      operations: this.collectOperationMetrics(),
      system: this.collectSystemMetrics(),
      extension: { ...this.extensionMetrics }
    };

    // Add to metrics history
    this.metrics.push(metrics);
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }

    // Analyze for performance issues
    await this.analyzePerformanceIssues(metrics);

    return metrics;
  }

  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get slow operations
   */
  public getSlowOperations(limit: number = 50): SlowOperation[] {
    return this.slowOperations.slice(-limit);
  }

  /**
   * Get performance issues
   */
  public getPerformanceIssues(): PerformanceIssue[] {
    return [...this.performanceIssues];
  }

  /**
   * Get operation statistics
   */
  public getOperationStats(): Map<string, OperationStats> {
    return new Map(this.operations);
  }

  /**
   * Run performance benchmark
   */
  public async runBenchmark(benchmark: PerformanceBenchmark): Promise<BenchmarkResult> {
    const times: number[] = [];
    const memoryBefore = process.memoryUsage();

    // Warmup iterations
    for (let i = 0; i < benchmark.warmupIterations; i++) {
      try {
        await Promise.race([
          benchmark.operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Benchmark timeout')), benchmark.timeout)
          )
        ]);
      } catch (error) {
        this.logger.logWarn(`Benchmark warmup iteration ${i} failed`, { error: error.message });
      }
    }

    // Actual benchmark iterations
    for (let i = 0; i < benchmark.iterations; i++) {
      const start = Date.now();
      
      try {
        await Promise.race([
          benchmark.operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Benchmark timeout')), benchmark.timeout)
          )
        ]);
        
        const duration = Date.now() - start;
        times.push(duration);
      } catch (error) {
        this.logger.logWarn(`Benchmark iteration ${i} failed`, { error: error.message });
        times.push(benchmark.timeout); // Record timeout as max time
      }
    }

    const memoryAfter = process.memoryUsage();
    
    // Calculate statistics
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);
    
    const operationsPerSecond = 1000 / averageTime;

    const result: BenchmarkResult = {
      name: benchmark.name,
      iterations: benchmark.iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      operationsPerSecond,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        delta: {
          rss: memoryAfter.rss - memoryBefore.rss,
          heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
          heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          external: memoryAfter.external - memoryBefore.external,
          arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers
        }
      }
    };

    this.logger.logInfo(`Benchmark completed: ${benchmark.name}`, result);
    return result;
  }

  /**
   * Clear performance data
   */
  public clearPerformanceData(): void {
    this.metrics = [];
    this.operations.clear();
    this.slowOperations = [];
    this.performanceIssues = [];
    this.activeOperations.clear();
    
    this.logger.logInfo('Performance data cleared');
  }

  /**
   * Update performance thresholds
   */
  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.saveConfiguration();
    this.logger.logInfo('Performance thresholds updated', newThresholds);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    averageResponseTime: number;
    totalOperations: number;
    slowOperationsCount: number;
    criticalIssuesCount: number;
    memoryUsageMB: number;
    cpuUsage: number;
  } {
    const currentMetrics = this.getCurrentMetrics();
    const criticalIssues = this.performanceIssues.filter(issue => issue.severity === 'critical');
    
    return {
      averageResponseTime: currentMetrics?.operations.averageResponseTime || 0,
      totalOperations: currentMetrics?.operations.totalOperations || 0,
      slowOperationsCount: this.slowOperations.length,
      criticalIssuesCount: criticalIssues.length,
      memoryUsageMB: currentMetrics ? Math.round(currentMetrics.memory.used / 1024 / 1024) : 0,
      cpuUsage: currentMetrics?.cpu.usage || 0
    };
  }

  /**
   * Collect CPU metrics
   */
  private async collectCPUMetrics(): Promise<CPUMetrics> {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage (simplified)
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const usage = 100 - (totalIdle / totalTick) * 100;
    
    return {
      usage: Math.max(0, Math.min(100, usage)),
      loadAverage: loadAvg,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0
    };
  }

  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(): MemoryMetrics {
    const heap = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const used = totalMemory - freeMemory;
    
    return {
      used,
      total: totalMemory,
      percentage: (used / totalMemory) * 100,
      heap,
      external: heap.external,
      buffers: 0 // Would need platform-specific implementation
    };
  }

  /**
   * Collect operation metrics
   */
  private collectOperationMetrics(): OperationMetrics {
    const operations = Array.from(this.operations.values());
    const totalOperations = operations.reduce((sum, op) => sum + op.count, 0);
    const totalTime = operations.reduce((sum, op) => sum + op.totalTime, 0);
    const totalErrors = operations.reduce((sum, op) => sum + op.errorCount, 0);
    
    return {
      totalOperations,
      averageResponseTime: totalOperations > 0 ? totalTime / totalOperations : 0,
      slowOperations: [...this.slowOperations],
      operationsByType: Object.fromEntries(this.operations),
      throughput: totalOperations / (this.COLLECTION_INTERVAL / 1000), // ops per second
      errorRate: totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0
    };
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): SystemMetrics {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      vscodeVersion: vscode.version,
      uptime: os.uptime(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    };
  }

  /**
   * Update operation statistics
   */
  private updateOperationStats(name: string, duration: number, success: boolean): void {
    const existing = this.operations.get(name) || {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errorCount: 0,
      lastExecuted: 0
    };

    existing.count++;
    existing.totalTime += duration;
    existing.averageTime = existing.totalTime / existing.count;
    existing.minTime = Math.min(existing.minTime, duration);
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.lastExecuted = Date.now();

    if (!success) {
      existing.errorCount++;
    }

    this.operations.set(name, existing);
  }

  /**
   * Record slow operation
   */
  private recordSlowOperation(
    name: string,
    duration: number,
    component: string,
    metadata?: Record<string, any>
  ): void {
    const slowOp: SlowOperation = {
      name,
      duration,
      timestamp: Date.now(),
      component,
      stackTrace: new Error().stack,
      metadata
    };

    this.slowOperations.push(slowOp);

    // Maintain size limit
    if (this.slowOperations.length > this.MAX_SLOW_OPERATIONS) {
      this.slowOperations = this.slowOperations.slice(-this.MAX_SLOW_OPERATIONS);
    }

    this.logger.logWarn(`Slow operation detected: ${name}`, {
      duration,
      component,
      metadata
    });
  }

  /**
   * Analyze performance issues
   */
  private async analyzePerformanceIssues(metrics: PerformanceMetrics): Promise<void> {
    const issues: PerformanceIssue[] = [];

    // Check for high CPU usage
    if (metrics.cpu.usage > this.thresholds.highCpuPercent) {
      issues.push({
        id: `high_cpu_${Date.now()}`,
        type: 'high_cpu',
        severity: metrics.cpu.usage > 95 ? 'critical' : 'high',
        title: 'High CPU Usage Detected',
        description: `CPU usage is at ${metrics.cpu.usage.toFixed(1)}%`,
        component: 'system',
        detectedAt: metrics.timestamp,
        metrics: { cpuUsage: metrics.cpu.usage },
        suggestions: [
          'Check for infinite loops or blocking operations',
          'Consider optimizing heavy computations',
          'Review recent code changes for performance regressions'
        ],
        impact: 'May cause VS Code to become unresponsive'
      });
    }

    // Check for high memory usage
    if (metrics.memory.percentage > this.thresholds.highMemoryPercent) {
      issues.push({
        id: `high_memory_${Date.now()}`,
        type: 'high_memory',
        severity: metrics.memory.percentage > 95 ? 'critical' : 'high',
        title: 'High Memory Usage Detected',
        description: `Memory usage is at ${metrics.memory.percentage.toFixed(1)}%`,
        component: 'system',
        detectedAt: metrics.timestamp,
        metrics: {
          memoryUsage: metrics.memory.percentage,
          memoryUsedMB: Math.round(metrics.memory.used / 1024 / 1024)
        },
        suggestions: [
          'Check for memory leaks in recent code',
          'Clear unnecessary caches and data structures',
          'Review object lifecycle management'
        ],
        impact: 'May cause system instability and crashes'
      });
    }

    // Check for slow operations
    const recentSlowOps = this.slowOperations.filter(
      op => op.timestamp > Date.now() - 300000 // Last 5 minutes
    );

    if (recentSlowOps.length > 5) {
      issues.push({
        id: `slow_operations_${Date.now()}`,
        type: 'slow_operation',
        severity: 'medium',
        title: 'Multiple Slow Operations Detected',
        description: `${recentSlowOps.length} slow operations in the last 5 minutes`,
        component: 'operations',
        detectedAt: metrics.timestamp,
        metrics: {
          slowOperationsCount: recentSlowOps.length,
          averageDuration: recentSlowOps.reduce((sum, op) => sum + op.duration, 0) / recentSlowOps.length
        },
        suggestions: [
          'Review operation implementations for optimization opportunities',
          'Consider adding caching for frequently accessed data',
          'Implement async processing for heavy operations'
        ],
        impact: 'Reduced user experience and responsiveness'
      });
    }

    // Check for high error rate
    if (metrics.operations.errorRate > this.thresholds.maxErrorRate) {
      issues.push({
        id: `high_error_rate_${Date.now()}`,
        type: 'bottleneck',
        severity: metrics.operations.errorRate > 20 ? 'critical' : 'high',
        title: 'High Error Rate Detected',
        description: `Error rate is at ${metrics.operations.errorRate.toFixed(1)}%`,
        component: 'operations',
        detectedAt: metrics.timestamp,
        metrics: { errorRate: metrics.operations.errorRate },
        suggestions: [
          'Review error logs for common failure patterns',
          'Implement better error handling and recovery',
          'Check external dependencies and network connectivity'
        ],
        impact: 'Features may not work correctly for users'
      });
    }

    // Check for potential memory leaks
    if (this.metrics.length >= 10) {
      const memoryTrend = this.analyzeMemoryTrend();
      if (memoryTrend.isIncreasing && memoryTrend.rate > this.thresholds.memoryLeakThresholdMB) {
        issues.push({
          id: `memory_leak_${Date.now()}`,
          type: 'memory_leak',
          severity: 'high',
          title: 'Potential Memory Leak Detected',
          description: `Memory usage increasing by ${memoryTrend.rate.toFixed(1)}MB over time`,
          component: 'memory',
          detectedAt: metrics.timestamp,
          metrics: {
            memoryTrendRate: memoryTrend.rate,
            currentMemoryMB: Math.round(metrics.memory.used / 1024 / 1024)
          },
          suggestions: [
            'Review object lifecycle and cleanup procedures',
            'Check for event listener leaks',
            'Implement proper disposal of resources',
            'Use memory profiling tools to identify leak sources'
          ],
          impact: 'Progressive memory consumption leading to system instability'
        });
      }
    }

    // Add new issues
    issues.forEach(issue => {
      this.performanceIssues.push(issue);
      this.logger.logWarn(`Performance issue detected: ${issue.title}`, issue);
    });

    // Maintain size limit
    if (this.performanceIssues.length > this.MAX_PERFORMANCE_ISSUES) {
      this.performanceIssues = this.performanceIssues.slice(-this.MAX_PERFORMANCE_ISSUES);
    }
  }

  /**
   * Analyze memory usage trend
   */
  private analyzeMemoryTrend(): { isIncreasing: boolean; rate: number } {
    if (this.metrics.length < 10) {
      return { isIncreasing: false, rate: 0 };
    }

    const recentMetrics = this.metrics.slice(-10);
    const memoryValues = recentMetrics.map(m => m.memory.used / 1024 / 1024); // Convert to MB

    // Simple linear regression to detect trend
    const n = memoryValues.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0 to n-1
    const sumY = memoryValues.reduce((sum, val) => sum + val, 0);
    const sumXY = memoryValues.reduce((sum, val, index) => sum + (index * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    return {
      isIncreasing: slope > 0,
      rate: Math.abs(slope)
    };
  }

  /**
   * Load configuration from storage
   */
  private loadConfiguration(): void {
    try {
      const stored = this.context.globalState.get<Partial<PerformanceThresholds>>('performanceThresholds');
      if (stored) {
        this.thresholds = { ...this.thresholds, ...stored };
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-monitor',
        operation: 'load-configuration'
      });
    }
  }

  /**
   * Save configuration to storage
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('performanceThresholds', this.thresholds);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-monitor',
        operation: 'save-configuration'
      });
    }
  }

  /**
   * Dispose performance monitor and cleanup resources
   */
  public dispose(): void {
    this.stop();
    this.clearPerformanceData();
    this.logger.logInfo('Performance monitor disposed');
  }
}
