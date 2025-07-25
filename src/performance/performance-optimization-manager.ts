/**
 * Performance Optimization Manager
 * 
 * Coordinates all performance optimization systems including lazy loading,
 * memory optimization, background processing, and cache optimization.
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { LazyLoader } from './lazy-loader';
import { MemoryOptimizer } from './memory-optimizer';
import { BackgroundProcessor } from './background-processor';
import { CacheOptimizer } from './cache-optimizer';

// ------------ INTERFACES

export interface PerformanceOptimizationConfig {
  enableLazyLoading: boolean;
  enableMemoryOptimization: boolean;
  enableBackgroundProcessing: boolean;
  enableCacheOptimization: boolean;
  enableAutoOptimization: boolean;
  optimizationInterval: number;
  performanceThresholds: {
    maxMemoryUsageMB: number;
    maxResponseTimeMs: number;
    minCacheHitRate: number;
    maxCpuUsagePercent: number;
  };
  adaptiveOptimization: boolean;
  enablePerformanceReporting: boolean;
}

export interface PerformanceOptimizationMetrics {
  lazyLoading: {
    enabled: boolean;
    cacheHits: number;
    cacheMisses: number;
    virtualizedItems: number;
    memoryUsage: number;
  };
  memoryOptimization: {
    enabled: boolean;
    poolHits: number;
    poolMisses: number;
    gcForced: number;
    memoryFreed: number;
    currentMemoryUsage: number;
  };
  backgroundProcessing: {
    enabled: boolean;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageProcessingTime: number;
    workerUtilization: number;
  };
  cacheOptimization: {
    enabled: boolean;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    memoryUsage: number;
    compressionRatio: number;
  };
  overall: {
    performanceScore: number;
    optimizationLevel: 'low' | 'medium' | 'high' | 'maximum';
    lastOptimized: number;
    issuesDetected: number;
    recommendationsCount: number;
  };
}

export interface PerformanceRecommendation {
  id: string;
  type: 'memory' | 'cache' | 'processing' | 'loading' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number;
  effort: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
}

export interface OptimizationResult {
  success: boolean;
  improvements: {
    memoryReduction: number;
    speedImprovement: number;
    cacheHitRateImprovement: number;
    cpuReduction: number;
  };
  recommendations: PerformanceRecommendation[];
  nextOptimizationTime: number;
}

// ------------ MAIN CLASS

export class PerformanceOptimizationManager {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private config: PerformanceOptimizationConfig;
  
  // Optimization components
  private lazyLoader?: LazyLoader<any>;
  private memoryOptimizer?: MemoryOptimizer;
  private backgroundProcessor?: BackgroundProcessor;
  private cacheOptimizer?: CacheOptimizer;
  
  // State
  private isOptimizing = false;
  private lastOptimizationTime = 0;
  private optimizationHistory: OptimizationResult[] = [];
  private activeRecommendations: PerformanceRecommendation[] = [];
  
  // Timers
  private optimizationTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  
  private readonly MAX_OPTIMIZATION_HISTORY = 50;
  private readonly MONITORING_INTERVAL = 60000; // 1 minute

  constructor(private context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance(context);
    this.performanceMonitor = PerformanceMonitor.getInstance(context);
    
    this.config = {
      enableLazyLoading: true,
      enableMemoryOptimization: true,
      enableBackgroundProcessing: true,
      enableCacheOptimization: true,
      enableAutoOptimization: true,
      optimizationInterval: 1800000, // 30 minutes
      performanceThresholds: {
        maxMemoryUsageMB: 500,
        maxResponseTimeMs: 2000,
        minCacheHitRate: 70,
        maxCpuUsagePercent: 80
      },
      adaptiveOptimization: true,
      enablePerformanceReporting: true
    };

    this.loadConfiguration();
    this.initializeOptimizationComponents();
    this.startMonitoring();
  }

  /**
   * Initialize optimization components
   */
  private async initializeOptimizationComponents(): Promise<void> {
    try {
      if (this.config.enableLazyLoading) {
        // LazyLoader TODO: Would be initialized with specific data loaders
        this.logger.logInfo('Lazy loading optimization enabled');
      }

      if (this.config.enableMemoryOptimization) {
        this.memoryOptimizer = new MemoryOptimizer(this.context);
        this.logger.logInfo('Memory optimization enabled');
      }

      if (this.config.enableBackgroundProcessing) {
        this.backgroundProcessor = new BackgroundProcessor(this.context);
        this.logger.logInfo('Background processing optimization enabled');
      }

      if (this.config.enableCacheOptimization) {
        this.cacheOptimizer = new CacheOptimizer(this.context);
        this.logger.logInfo('Cache optimization enabled');
      }

      this.logger.logInfo('Performance optimization manager initialized');
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'initialize'
      });
    }
  }

  /**
   * Perform comprehensive performance optimization
   */
  public async optimizePerformance(): Promise<OptimizationResult> {
    if (this.isOptimizing) {
      throw new Error('Optimization already in progress');
    }

    this.isOptimizing = true;
    const operationId = this.performanceMonitor.startOperation('performance-optimization', 'optimization-manager');
    
    try {
      const beforeMetrics = await this.collectMetrics();
      const recommendations: PerformanceRecommendation[] = [];

      // Memory optimization
      if (this.memoryOptimizer && this.config.enableMemoryOptimization) {
        await this.optimizeMemory(recommendations);
      }

      // Cache optimization
      if (this.cacheOptimizer && this.config.enableCacheOptimization) {
        await this.optimizeCache(recommendations);
      }

      // Background processing optimization
      if (this.backgroundProcessor && this.config.enableBackgroundProcessing) {
        await this.optimizeBackgroundProcessing(recommendations);
      }

      // Lazy loading optimization
      if (this.config.enableLazyLoading) {
        await this.optimizeLazyLoading(recommendations);
      }

      // Collect metrics after optimization
      const afterMetrics = await this.collectMetrics();
      
      // Calculate improvements
      const improvements = this.calculateImprovements(beforeMetrics, afterMetrics);
      
      const result: OptimizationResult = {
        success: true,
        improvements,
        recommendations,
        nextOptimizationTime: Date.now() + this.config.optimizationInterval
      };

      // Update state
      this.lastOptimizationTime = Date.now();
      this.optimizationHistory.push(result);
      this.activeRecommendations = recommendations;

      // Maintain history size
      if (this.optimizationHistory.length > this.MAX_OPTIMIZATION_HISTORY) {
        this.optimizationHistory = this.optimizationHistory.slice(-this.MAX_OPTIMIZATION_HISTORY);
      }

      this.logger.logInfo('Performance optimization completed', {
        improvements,
        recommendationsCount: recommendations.length
      });

      this.performanceMonitor.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false);
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'optimize'
      });
      
      return {
        success: false,
        improvements: {
          memoryReduction: 0,
          speedImprovement: 0,
          cacheHitRateImprovement: 0,
          cpuReduction: 0
        },
        recommendations: [],
        nextOptimizationTime: Date.now() + this.config.optimizationInterval
      };
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Get current performance metrics
   */
  public async getPerformanceMetrics(): Promise<PerformanceOptimizationMetrics> {
    const metrics: PerformanceOptimizationMetrics = {
      lazyLoading: {
        enabled: this.config.enableLazyLoading,
        cacheHits: 0,
        cacheMisses: 0,
        virtualizedItems: 0,
        memoryUsage: 0
      },
      memoryOptimization: {
        enabled: this.config.enableMemoryOptimization,
        poolHits: 0,
        poolMisses: 0,
        gcForced: 0,
        memoryFreed: 0,
        currentMemoryUsage: 0
      },
      backgroundProcessing: {
        enabled: this.config.enableBackgroundProcessing,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageProcessingTime: 0,
        workerUtilization: 0
      },
      cacheOptimization: {
        enabled: this.config.enableCacheOptimization,
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        memoryUsage: 0,
        compressionRatio: 0
      },
      overall: {
        performanceScore: 0,
        optimizationLevel: 'medium',
        lastOptimized: this.lastOptimizationTime,
        issuesDetected: 0,
        recommendationsCount: this.activeRecommendations.length
      }
    };

    // Collect metrics from each component
    if (this.memoryOptimizer) {
      const memMetrics = this.memoryOptimizer.getMetrics();
      metrics.memoryOptimization = {
        enabled: true,
        poolHits: memMetrics.poolHits,
        poolMisses: memMetrics.poolMisses,
        gcForced: memMetrics.gcForced,
        memoryFreed: memMetrics.memoryFreed,
        currentMemoryUsage: memMetrics.currentMemoryUsage
      };
    }

    if (this.backgroundProcessor) {
      const bgMetrics = this.backgroundProcessor.getMetrics();
      metrics.backgroundProcessing = {
        enabled: true,
        totalTasks: bgMetrics.totalTasks,
        completedTasks: bgMetrics.completedTasks,
        failedTasks: bgMetrics.failedTasks,
        averageProcessingTime: bgMetrics.averageProcessingTime,
        workerUtilization: bgMetrics.workerUtilization
      };
    }

    if (this.cacheOptimizer) {
      const cacheMetrics = this.cacheOptimizer.getMetrics();
      metrics.cacheOptimization = {
        enabled: true,
        totalHits: cacheMetrics.totalHits,
        totalMisses: cacheMetrics.totalMisses,
        hitRate: cacheMetrics.hitRate,
        memoryUsage: cacheMetrics.memoryUsage,
        compressionRatio: cacheMetrics.compressionRatio
      };
    }

    // Calculate overall performance score
    metrics.overall.performanceScore = this.calculatePerformanceScore(metrics);
    metrics.overall.optimizationLevel = this.determineOptimizationLevel(metrics.overall.performanceScore);
    metrics.overall.issuesDetected = this.detectPerformanceIssues(metrics);

    return metrics;
  }

  /**
   * Get performance recommendations
   */
  public getRecommendations(): PerformanceRecommendation[] {
    return [...this.activeRecommendations];
  }

  /**
   * Apply automatic optimizations
   */
  public async applyAutoOptimizations(): Promise<number> {
    const autoRecommendations = this.activeRecommendations.filter(r => r.autoApplicable);
    let appliedCount = 0;

    for (const recommendation of autoRecommendations) {
      try {
        const applied = await this.applyRecommendation(recommendation);
        if (applied) {
          appliedCount++;
          this.logger.logInfo(`Auto-applied recommendation: ${recommendation.title}`);
        }
      } catch (error) {
        this.logger.logError(error as Error, {
          component: 'performance-optimization-manager',
          operation: 'apply-auto-optimization',
          metadata: { recommendationId: recommendation.id }
        });
      }
    }

    return appliedCount;
  }

  /**
   * Create lazy loader for specific data type
   */
  public createLazyLoader<T>(
    dataLoader: (page: number, pageSize: number) => Promise<{ items: T[]; totalCount: number }>,
    config?: any
  ): LazyLoader<T> {
    return new LazyLoader<T>(this.context, dataLoader, config);
  }

  /**
   * Get memory optimizer instance
   */
  public getMemoryOptimizer(): MemoryOptimizer | undefined {
    return this.memoryOptimizer;
  }

  /**
   * Get background processor instance
   */
  public getBackgroundProcessor(): BackgroundProcessor | undefined {
    return this.backgroundProcessor;
  }

  /**
   * Get cache optimizer instance
   */
  public getCacheOptimizer(): CacheOptimizer | undefined {
    return this.cacheOptimizer;
  }

  /**
   * Update configuration
   */
  public updateConfiguration(newConfig: Partial<PerformanceOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
    
    // Update component configurations
    if (this.memoryOptimizer && newConfig.enableMemoryOptimization !== undefined) {
      // Update memory optimizer config
    }
    
    if (this.backgroundProcessor && newConfig.enableBackgroundProcessing !== undefined) {
      // Update background processor config
    }
    
    if (this.cacheOptimizer && newConfig.enableCacheOptimization !== undefined) {
      // Update cache optimizer config
    }
    
    // Restart monitoring if interval changed
    if (newConfig.optimizationInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemory(recommendations: PerformanceRecommendation[]): Promise<void> {
    if (!this.memoryOptimizer) {return;}

    try {
      // Check memory pressure
      const memoryPressure = await this.memoryOptimizer.checkMemoryPressure();
      
      if (memoryPressure.level === 'high' || memoryPressure.level === 'critical') {
        await this.memoryOptimizer.performCleanup();
        
        recommendations.push({
          id: 'memory-cleanup',
          type: 'memory',
          priority: 'high',
          title: 'Memory Cleanup Performed',
          description: 'Automatic memory cleanup was triggered due to high memory pressure',
          impact: 'Reduced memory usage and improved performance',
          implementation: 'Automatic cleanup of object pools and weak references',
          estimatedImprovement: 15,
          effort: 'low',
          autoApplicable: true
        });
      }

      // Force GC if needed
      if (memoryPressure.percentage > this.config.performanceThresholds.maxMemoryUsageMB) {
        const gcResult = this.memoryOptimizer.forceGarbageCollection();
        if (gcResult) {
          recommendations.push({
            id: 'force-gc',
            type: 'memory',
            priority: 'medium',
            title: 'Garbage Collection Forced',
            description: 'Forced garbage collection to free up memory',
            impact: 'Immediate memory reduction',
            implementation: 'Called global.gc() to trigger garbage collection',
            estimatedImprovement: 10,
            effort: 'low',
            autoApplicable: true
          });
        }
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'optimize-memory'
      });
    }
  }

  /**
   * Optimize cache performance
   */
  private async optimizeCache(recommendations: PerformanceRecommendation[]): Promise<void> {
    if (!this.cacheOptimizer) {return;}

    try {
      await this.cacheOptimizer.optimizeCache();
      
      const metrics = this.cacheOptimizer.getMetrics();
      
      if (metrics.hitRate < this.config.performanceThresholds.minCacheHitRate) {
        recommendations.push({
          id: 'improve-cache-hit-rate',
          type: 'cache',
          priority: 'high',
          title: 'Improve Cache Hit Rate',
          description: `Cache hit rate is ${metrics.hitRate.toFixed(1)}%, below threshold of ${this.config.performanceThresholds.minCacheHitRate}%`,
          impact: 'Faster data access and reduced computation',
          implementation: 'Optimize cache eviction policies and increase cache size',
          estimatedImprovement: 25,
          effort: 'medium',
          autoApplicable: false
        });
      }

      if (metrics.compressionRatio > 80) {
        recommendations.push({
          id: 'optimize-compression',
          type: 'cache',
          priority: 'medium',
          title: 'Optimize Cache Compression',
          description: 'Cache compression ratio is high, consider adjusting compression threshold',
          impact: 'Better memory utilization',
          implementation: 'Adjust compression threshold based on data patterns',
          estimatedImprovement: 10,
          effort: 'low',
          autoApplicable: true
        });
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'optimize-cache'
      });
    }
  }

  /**
   * Optimize background processing
   */
  private async optimizeBackgroundProcessing(recommendations: PerformanceRecommendation[]): Promise<void> {
    if (!this.backgroundProcessor) {return;}

    try {
      const metrics = this.backgroundProcessor.getMetrics();
      
      if (metrics.workerUtilization > 90) {
        recommendations.push({
          id: 'increase-worker-pool',
          type: 'processing',
          priority: 'medium',
          title: 'Increase Worker Pool Size',
          description: `Worker utilization is ${metrics.workerUtilization.toFixed(1)}%, consider increasing pool size`,
          impact: 'Better task distribution and reduced queue times',
          implementation: 'Increase maxWorkers configuration',
          estimatedImprovement: 20,
          effort: 'low',
          autoApplicable: true
        });
      }

      if (metrics.averageProcessingTime > this.config.performanceThresholds.maxResponseTimeMs) {
        recommendations.push({
          id: 'optimize-task-processing',
          type: 'processing',
          priority: 'high',
          title: 'Optimize Task Processing',
          description: `Average processing time is ${metrics.averageProcessingTime}ms, above threshold`,
          impact: 'Faster task completion and better responsiveness',
          implementation: 'Review task implementations and optimize algorithms',
          estimatedImprovement: 30,
          effort: 'high',
          autoApplicable: false
        });
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'optimize-background-processing'
      });
    }
  }

  /**
   * Optimize lazy loading
   */
  private async optimizeLazyLoading(recommendations: PerformanceRecommendation[]): Promise<void> {
    // Lazy loading optimization TODO: Would be specific to each lazy loader instance
    recommendations.push({
      id: 'optimize-lazy-loading',
      type: 'loading',
      priority: 'low',
      title: 'Optimize Lazy Loading Configuration',
      description: 'Review lazy loading page sizes and prefetch strategies',
      impact: 'Improved data loading performance',
      implementation: 'Adjust page sizes and prefetch configurations based on usage patterns',
      estimatedImprovement: 15,
      effort: 'medium',
      autoApplicable: false
    });
  }

  /**
   * Collect comprehensive metrics
   */
  private async collectMetrics(): Promise<PerformanceOptimizationMetrics> {
    return this.getPerformanceMetrics();
  }

  /**
   * Calculate performance improvements
   */
  private calculateImprovements(
    before: PerformanceOptimizationMetrics,
    after: PerformanceOptimizationMetrics
  ): OptimizationResult['improvements'] {
    const memoryReduction = before.memoryOptimization.currentMemoryUsage > 0
      ? ((before.memoryOptimization.currentMemoryUsage - after.memoryOptimization.currentMemoryUsage) / before.memoryOptimization.currentMemoryUsage) * 100
      : 0;

    const speedImprovement = before.backgroundProcessing.averageProcessingTime > 0
      ? ((before.backgroundProcessing.averageProcessingTime - after.backgroundProcessing.averageProcessingTime) / before.backgroundProcessing.averageProcessingTime) * 100
      : 0;

    const cacheHitRateImprovement = after.cacheOptimization.hitRate - before.cacheOptimization.hitRate;

    const cpuReduction = 0; // Would need CPU metrics from performance monitor

    return {
      memoryReduction: Math.max(0, memoryReduction),
      speedImprovement: Math.max(0, speedImprovement),
      cacheHitRateImprovement: Math.max(0, cacheHitRateImprovement),
      cpuReduction: Math.max(0, cpuReduction)
    };
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(metrics: PerformanceOptimizationMetrics): number {
    let score = 100;

    // Memory score (25% weight)
    const memoryUsageMB = metrics.memoryOptimization.currentMemoryUsage / (1024 * 1024);
    const memoryScore = Math.max(0, 100 - (memoryUsageMB / this.config.performanceThresholds.maxMemoryUsageMB) * 100);
    score -= (100 - memoryScore) * 0.25;

    // Cache score (25% weight)
    const cacheScore = metrics.cacheOptimization.hitRate;
    score -= (100 - cacheScore) * 0.25;

    // Processing score (25% weight)
    const processingScore = metrics.backgroundProcessing.averageProcessingTime > 0
      ? Math.max(0, 100 - (metrics.backgroundProcessing.averageProcessingTime / this.config.performanceThresholds.maxResponseTimeMs) * 100)
      : 100;
    score -= (100 - processingScore) * 0.25;

    // Worker utilization score (25% weight)
    const utilizationScore = Math.min(100, metrics.backgroundProcessing.workerUtilization);
    score -= (100 - utilizationScore) * 0.25;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine optimization level based on score
   */
  private determineOptimizationLevel(score: number): 'low' | 'medium' | 'high' | 'maximum' {
    if (score >= 90) {return 'maximum';}
    if (score >= 75) {return 'high';}
    if (score >= 50) {return 'medium';}
    return 'low';
  }

  /**
   * Detect performance issues
   */
  private detectPerformanceIssues(metrics: PerformanceOptimizationMetrics): number {
    let issues = 0;

    // Memory issues
    const memoryUsageMB = metrics.memoryOptimization.currentMemoryUsage / (1024 * 1024);
    if (memoryUsageMB > this.config.performanceThresholds.maxMemoryUsageMB) {
      issues++;
    }

    // Cache issues
    if (metrics.cacheOptimization.hitRate < this.config.performanceThresholds.minCacheHitRate) {
      issues++;
    }

    // Processing issues
    if (metrics.backgroundProcessing.averageProcessingTime > this.config.performanceThresholds.maxResponseTimeMs) {
      issues++;
    }

    // Worker utilization issues
    if (metrics.backgroundProcessing.workerUtilization > 95) {
      issues++;
    }

    return issues;
  }

  /**
   * Apply specific recommendation
   */
  private async applyRecommendation(recommendation: PerformanceRecommendation): Promise<boolean> {
    try {
      switch (recommendation.id) {
        case 'memory-cleanup':
          if (this.memoryOptimizer) {
            await this.memoryOptimizer.performCleanup();
            return true;
          }
          break;

        case 'force-gc':
          if (this.memoryOptimizer) {
            return this.memoryOptimizer.forceGarbageCollection();
          }
          break;

        case 'optimize-compression':
          if (this.cacheOptimizer) {
            this.cacheOptimizer.updateConfiguration({
              enableCompressionThreshold: this.config.performanceThresholds.maxMemoryUsageMB * 1024 * 1024 * 0.1
            });
            return true;
          }
          break;

        case 'increase-worker-pool':
          if (this.backgroundProcessor) {
            const currentConfig = this.backgroundProcessor.getMetrics();
            this.backgroundProcessor.updateConfiguration({
              maxWorkers: Math.min(require('os').cpus().length, 8)
            });
            return true;
          }
          break;

        default:
          return false;
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'apply-recommendation',
        metadata: { recommendationId: recommendation.id }
      });
    }

    return false;
  }

  /**
   * Start monitoring and auto-optimization
   */
  private startMonitoring(): void {
    if (this.config.enableAutoOptimization) {
      this.optimizationTimer = setInterval(() => {
        this.performAutoOptimization();
      }, this.config.optimizationInterval);
    }

    this.monitoringTimer = setInterval(() => {
      this.performPerformanceCheck();
    }, this.MONITORING_INTERVAL);

    this.logger.logInfo('Performance optimization monitoring started');
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = undefined;
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  /**
   * Perform automatic optimization
   */
  private async performAutoOptimization(): Promise<void> {
    try {
      if (this.config.adaptiveOptimization) {
        const metrics = await this.getPerformanceMetrics();

        // Only optimize if performance score is below threshold
        if (metrics.overall.performanceScore < 70) {
          await this.optimizePerformance();
        }
      } else {
        await this.optimizePerformance();
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'auto-optimization'
      });
    }
  }

  /**
   * Perform performance check
   */
  private async performPerformanceCheck(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();

      // Log performance status
      this.logger.logDebug('Performance check completed', {
        score: metrics.overall.performanceScore,
        level: metrics.overall.optimizationLevel,
        issues: metrics.overall.issuesDetected,
        memoryUsageMB: Math.round(metrics.memoryOptimization.currentMemoryUsage / (1024 * 1024)),
        cacheHitRate: metrics.cacheOptimization.hitRate
      });

      // Trigger optimization if critical issues detected
      if (metrics.overall.issuesDetected > 2 && metrics.overall.performanceScore < 50) {
        this.logger.logWarn('Critical performance issues detected, triggering optimization');
        await this.optimizePerformance();
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'performance-check'
      });
    }
  }

  /**
   * Load configuration
   */
  private loadConfiguration(): void {
    try {
      const stored = this.context.globalState.get<Partial<PerformanceOptimizationConfig>>('performanceOptimizationConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'load-configuration'
      });
    }
  }

  /**
   * Save configuration
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('performanceOptimizationConfig', this.config);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'performance-optimization-manager',
        operation: 'save-configuration'
      });
    }
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Get configuration
   */
  public getConfiguration(): PerformanceOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Dispose optimization manager
   */
  public dispose(): void {
    this.stopMonitoring();

    // Dispose all optimization components
    if (this.memoryOptimizer) {
      this.memoryOptimizer.dispose();
    }

    if (this.backgroundProcessor) {
      this.backgroundProcessor.dispose();
    }

    if (this.cacheOptimizer) {
      this.cacheOptimizer.dispose();
    }

    this.logger.logInfo('Performance optimization manager disposed');
  }
}
