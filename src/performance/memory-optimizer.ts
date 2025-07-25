/**
 * Memory Optimizer
 * 
 * Advanced memory optimization system with object pooling,
 * weak references, automatic cleanup, and memory pressure handling.
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { PerformanceMonitor } from '../utils/performance-monitor';

// ------------ INTERFACES

export interface MemoryOptimizationConfig {
  enableObjectPooling: boolean;
  enableWeakReferences: boolean;
  enableAutoCleanup: boolean;
  maxPoolSize: number;
  cleanupInterval: number;
  memoryPressureThreshold: number;
  gcForceThreshold: number;
  enableMemoryProfiling: boolean;
}

export interface ObjectPool<T> {
  name: string;
  factory: () => T;
  reset: (obj: T) => void;
  validate: (obj: T) => boolean;
  maxSize: number;
  currentSize: number;
  available: T[];
  inUse: Set<T>;
  created: number;
  reused: number;
  disposed: number;
}

export interface WeakReferenceManager<T extends object> {
  refs: Map<string, WeakRef<T>>;
  cleanup: () => void;
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  delete: (key: string) => boolean;
  size: number;
}

export interface MemoryPressureInfo {
  level: 'low' | 'medium' | 'high' | 'critical';
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  percentage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface MemoryOptimizationMetrics {
  totalAllocations: number;
  totalDeallocations: number;
  poolHits: number;
  poolMisses: number;
  weakRefHits: number;
  weakRefMisses: number;
  gcForced: number;
  memoryFreed: number;
  cleanupOperations: number;
  currentMemoryUsage: number;
  peakMemoryUsage: number;
}

export interface DisposableResource {
  dispose(): void;
  isDisposed: boolean;
}

// ------------ MAIN CLASS

export class MemoryOptimizer {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private config: MemoryOptimizationConfig;
  private objectPools = new Map<string, ObjectPool<any>>();
  private weakRefManagers = new Map<string, WeakReferenceManager<any>>();
  private disposableResources = new Set<DisposableResource>();
  private memorySnapshots: NodeJS.MemoryUsage[] = [];
  private metrics: MemoryOptimizationMetrics;
  
  // Timers
  private cleanupTimer?: NodeJS.Timeout;
  private memoryMonitorTimer?: NodeJS.Timeout;
  private gcTimer?: NodeJS.Timeout;

  // Memory pressure tracking
  private memoryPressureHistory: MemoryPressureInfo[] = [];
  private lastGCTime = 0;
  private readonly MAX_SNAPSHOTS = 100;
  private readonly MEMORY_MONITOR_INTERVAL = 30000; // 30 seconds
  private readonly GC_COOLDOWN = 60000; // 1 minute

  constructor(private context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance(context);
    this.performanceMonitor = PerformanceMonitor.getInstance(context);
    
    this.config = {
      enableObjectPooling: true,
      enableWeakReferences: true,
      enableAutoCleanup: true,
      maxPoolSize: 100,
      cleanupInterval: 300000, // 5 minutes
      memoryPressureThreshold: 80, // 80% of heap
      gcForceThreshold: 90, // 90% of heap
      enableMemoryProfiling: true
    };

    this.metrics = {
      totalAllocations: 0,
      totalDeallocations: 0,
      poolHits: 0,
      poolMisses: 0,
      weakRefHits: 0,
      weakRefMisses: 0,
      gcForced: 0,
      memoryFreed: 0,
      cleanupOperations: 0,
      currentMemoryUsage: 0,
      peakMemoryUsage: 0
    };

    this.loadConfiguration();
    this.startMonitoring();
  }

  /**
   * Create object pool
   */
  public createObjectPool<T>(
    name: string,
    factory: () => T,
    reset: (obj: T) => void,
    validate: (obj: T) => boolean = () => true,
    maxSize: number = this.config.maxPoolSize
  ): ObjectPool<T> {
    const pool: ObjectPool<T> = {
      name,
      factory,
      reset,
      validate,
      maxSize,
      currentSize: 0,
      available: [],
      inUse: new Set(),
      created: 0,
      reused: 0,
      disposed: 0
    };

    this.objectPools.set(name, pool);
    this.logger.logInfo(`Object pool created: ${name}`, { maxSize });
    
    return pool;
  }

  /**
   * Get object from pool
   */
  public getFromPool<T>(poolName: string): T | null {
    const pool = this.objectPools.get(poolName) as ObjectPool<T>;
    if (!pool) {
      this.logger.logWarn(`Object pool not found: ${poolName}`);
      return null;
    }

    let obj: T;

    if (pool.available.length > 0) {
      obj = pool.available.pop()!;
      pool.reused++;
      this.metrics.poolHits++;
    } else {
      obj = pool.factory();
      pool.created++;
      pool.currentSize++;
      this.metrics.poolMisses++;
      this.metrics.totalAllocations++;
    }

    pool.inUse.add(obj);
    return obj;
  }

  /**
   * Return object to pool
   */
  public returnToPool<T>(poolName: string, obj: T): boolean {
    const pool = this.objectPools.get(poolName) as ObjectPool<T>;
    if (!pool || !pool.inUse.has(obj)) {
      return false;
    }

    pool.inUse.delete(obj);

    // Validate and reset object
    if (pool.validate(obj)) {
      pool.reset(obj);
      
      if (pool.available.length < pool.maxSize) {
        pool.available.push(obj);
        return true;
      }
    }

    // Object not returned to pool, dispose it
    pool.currentSize--;
    pool.disposed++;
    this.metrics.totalDeallocations++;
    
    return false;
  }

  /**
   * Create weak reference manager
   */
  public createWeakReferenceManager<T extends object>(name: string): WeakReferenceManager<T> {
    const manager: WeakReferenceManager<T> = {
      refs: new Map(),
      cleanup: () => this.cleanupWeakReferences(manager),
      get: (key: string) => {
        const ref = manager.refs.get(key);
        if (ref) {
          const value = ref.deref();
          if (value) {
            this.metrics.weakRefHits++;
            return value;
          } else {
            manager.refs.delete(key);
            this.metrics.weakRefMisses++;
          }
        }
        this.metrics.weakRefMisses++;
        return undefined;
      },
      set: (key: string, value: T) => {
        manager.refs.set(key, new WeakRef(value));
      },
      delete: (key: string) => {
        return manager.refs.delete(key);
      },
      get size() {
        return manager.refs.size;
      }
    };

    this.weakRefManagers.set(name, manager);
    this.logger.logInfo(`Weak reference manager created: ${name}`);
    
    return manager;
  }

  /**
   * Register disposable resource
   */
  public registerDisposable(resource: DisposableResource): void {
    this.disposableResources.add(resource);
  }

  /**
   * Unregister disposable resource
   */
  public unregisterDisposable(resource: DisposableResource): void {
    this.disposableResources.delete(resource);
  }

  /**
   * Force garbage collection
   */
  public forceGarbageCollection(): boolean {
    const now = Date.now();
    
    // Respect cooldown period
    if (now - this.lastGCTime < this.GC_COOLDOWN) {
      return false;
    }

    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      
      const freed = before.heapUsed - after.heapUsed;
      this.metrics.gcForced++;
      this.metrics.memoryFreed += freed;
      this.lastGCTime = now;
      
      this.logger.logInfo('Forced garbage collection', {
        freedMB: Math.round(freed / 1024 / 1024),
        heapBeforeMB: Math.round(before.heapUsed / 1024 / 1024),
        heapAfterMB: Math.round(after.heapUsed / 1024 / 1024)
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Cleanup all resources
   */
  public async performCleanup(): Promise<void> {
    const operationId = this.performanceMonitor.startOperation('memory-cleanup', 'memory-optimizer');
    
    try {
      let cleanedItems = 0;

      // Cleanup object pools
      for (const pool of this.objectPools.values()) {
        const beforeSize = pool.available.length;
        pool.available = pool.available.filter(obj => pool.validate(obj));
        cleanedItems += beforeSize - pool.available.length;
      }

      // Cleanup weak references
      for (const manager of this.weakRefManagers.values()) {
        const beforeSize = manager.refs.size;
        manager.cleanup();
        cleanedItems += beforeSize - manager.refs.size;
      }

      // Cleanup disposed resources
      const disposedResources: DisposableResource[] = [];
      for (const resource of this.disposableResources) {
        if (resource.isDisposed) {
          disposedResources.push(resource);
        }
      }
      
      disposedResources.forEach(resource => {
        this.disposableResources.delete(resource);
      });
      
      cleanedItems += disposedResources.length;

      this.metrics.cleanupOperations++;
      
      this.logger.logInfo('Memory cleanup completed', {
        cleanedItems,
        poolCount: this.objectPools.size,
        weakRefManagers: this.weakRefManagers.size,
        disposableResources: this.disposableResources.size
      });

      this.performanceMonitor.endOperation(operationId, true);
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false);
      this.logger.logError(error as Error, {
        component: 'memory-optimizer',
        operation: 'cleanup'
      });
    }
  }

  /**
   * Check memory pressure and take action
   */
  public async checkMemoryPressure(): Promise<MemoryPressureInfo> {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const percentage = (usedMemory / totalMemory) * 100;
    
    let level: MemoryPressureInfo['level'] = 'low';
    if (percentage > 90) {level = 'critical';}
    else if (percentage > 80) {level = 'high';}
    else if (percentage > 60) {level = 'medium';}

    const trend = this.calculateMemoryTrend();
    
    const pressureInfo: MemoryPressureInfo = {
      level,
      heapUsed: usedMemory,
      heapTotal: totalMemory,
      external: memUsage.external,
      rss: memUsage.rss,
      percentage,
      trend
    };

    // Take action based on pressure level
    if (level === 'critical') {
      await this.handleCriticalMemoryPressure();
    } else if (level === 'high') {
      await this.handleHighMemoryPressure();
    }

    // Update history
    this.memoryPressureHistory.push(pressureInfo);
    if (this.memoryPressureHistory.length > 50) {
      this.memoryPressureHistory = this.memoryPressureHistory.slice(-50);
    }

    return pressureInfo;
  }

  /**
   * Get optimization metrics
   */
  public getMetrics(): MemoryOptimizationMetrics {
    const memUsage = process.memoryUsage();
    this.metrics.currentMemoryUsage = memUsage.heapUsed;
    this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, memUsage.heapUsed);
    
    return { ...this.metrics };
  }

  /**
   * Get pool statistics
   */
  public getPoolStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, pool] of this.objectPools) {
      stats[name] = {
        maxSize: pool.maxSize,
        currentSize: pool.currentSize,
        available: pool.available.length,
        inUse: pool.inUse.size,
        created: pool.created,
        reused: pool.reused,
        disposed: pool.disposed,
        hitRate: pool.reused / (pool.created + pool.reused) * 100
      };
    }
    
    return stats;
  }

  /**
   * Update configuration
   */
  public updateConfiguration(newConfig: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
    
    // Restart monitoring if intervals changed
    if (newConfig.cleanupInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Cleanup weak references
   */
  private cleanupWeakReferences<T extends object>(manager: WeakReferenceManager<T>): void {
    const deadRefs: string[] = [];
    
    for (const [key, ref] of manager.refs) {
      if (!ref.deref()) {
        deadRefs.push(key);
      }
    }
    
    deadRefs.forEach(key => manager.refs.delete(key));
  }

  /**
   * Calculate memory trend
   */
  private calculateMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.memorySnapshots.length < 5) {
      return 'stable';
    }

    const recent = this.memorySnapshots.slice(-5);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;
    const change = (last - first) / first;

    if (change > 0.1) {return 'increasing';}
    if (change < -0.1) {return 'decreasing';}
    return 'stable';
  }

  /**
   * Handle critical memory pressure
   */
  private async handleCriticalMemoryPressure(): Promise<void> {
    this.logger.logWarn('Critical memory pressure detected, taking emergency action');
    
    // Force cleanup
    await this.performCleanup();
    
    // Force garbage collection
    this.forceGarbageCollection();
    
    // Clear least important caches
    this.clearNonEssentialCaches();
    
    // Dispose unused resources
    this.disposeUnusedResources();
  }

  /**
   * Handle high memory pressure
   */
  private async handleHighMemoryPressure(): Promise<void> {
    this.logger.logInfo('High memory pressure detected, performing cleanup');
    
    // Perform cleanup
    await this.performCleanup();
    
    // Consider garbage collection
    if (Date.now() - this.lastGCTime > this.GC_COOLDOWN / 2) {
      this.forceGarbageCollection();
    }
  }

  /**
   * Clear non-essential caches
   */
  private clearNonEssentialCaches(): void {
    // Clear object pools to minimum size
    for (const pool of this.objectPools.values()) {
      const keepCount = Math.min(5, pool.maxSize / 4);
      if (pool.available.length > keepCount) {
        const toRemove = pool.available.splice(keepCount);
        pool.currentSize -= toRemove.length;
        pool.disposed += toRemove.length;
      }
    }
  }

  /**
   * Dispose unused resources
   */
  private disposeUnusedResources(): void {
    const toDispose: DisposableResource[] = [];
    
    for (const resource of this.disposableResources) {
      if (!resource.isDisposed) {
        try {
          resource.dispose();
          toDispose.push(resource);
        } catch (error) {
          this.logger.logError(error as Error, {
            component: 'memory-optimizer',
            operation: 'dispose-resource'
          });
        }
      }
    }
    
    toDispose.forEach(resource => {
      this.disposableResources.delete(resource);
    });
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    if (this.config.enableAutoCleanup) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup();
      }, this.config.cleanupInterval);
    }

    this.memoryMonitorTimer = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memorySnapshots.push(memUsage);
      
      if (this.memorySnapshots.length > this.MAX_SNAPSHOTS) {
        this.memorySnapshots = this.memorySnapshots.slice(-this.MAX_SNAPSHOTS);
      }
      
      this.checkMemoryPressure();
    }, this.MEMORY_MONITOR_INTERVAL);
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = undefined;
    }
  }

  /**
   * Load configuration
   */
  private loadConfiguration(): void {
    try {
      const stored = this.context.globalState.get<Partial<MemoryOptimizationConfig>>('memoryOptimizerConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'memory-optimizer',
        operation: 'load-configuration'
      });
    }
  }

  /**
   * Save configuration
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('memoryOptimizerConfig', this.config);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'memory-optimizer',
        operation: 'save-configuration'
      });
    }
  }

  /**
   * Dispose memory optimizer
   */
  public dispose(): void {
    this.stopMonitoring();
    
    // Dispose all resources
    for (const resource of this.disposableResources) {
      if (!resource.isDisposed) {
        try {
          resource.dispose();
        } catch (error) {
          this.logger.logError(error as Error, {
            component: 'memory-optimizer',
            operation: 'dispose'
          });
        }
      }
    }
    
    // Clear all pools and managers
    this.objectPools.clear();
    this.weakRefManagers.clear();
    this.disposableResources.clear();
    
    this.logger.logInfo('Memory optimizer disposed');
  }
}
