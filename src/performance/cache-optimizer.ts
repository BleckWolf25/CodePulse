/**
 * @file CACHE-OPTIMIZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @summary 
 * Advanced caching system with multiple cache levels, intelligent eviction,
 * cache warming, and performance-based optimization strategies.
 * 
 * @since 1.0.0
 * 
 * @requires vscode
 * @requires utils/logger
 * @requires utils/performance-monitor
 */

// ------------ IMPORTS

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { PerformanceMonitor } from '../utils/performance-monitor';

// ------------ INTERFACES

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  ttl?: number;
  priority: CachePriority;
  tags?: string[];
  computeCost: number;
  hitCount: number;
}

export interface CacheLevel<T> {
  name: string;
  maxSize: number;
  maxMemory: number;
  ttl: number;
  evictionPolicy: EvictionPolicy;
  entries: Map<string, CacheEntry<T>>;
  stats: CacheLevelStats;
}

export interface CacheLevelStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
  hitRate: number;
  averageAccessTime: number;
}

export interface CacheOptimizerConfig {
  enableMultiLevel: boolean;
  enableIntelligentPrefetch: boolean;
  enableAdaptiveEviction: boolean;
  enableCompressionThreshold: number;
  enablePerformanceTracking: boolean;
  maxTotalMemory: number;
  optimizationInterval: number;
  warmupOnStart: boolean;
}

export interface CacheMetrics {
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  hitRate: number;
  memoryUsage: number;
  compressionRatio: number;
  averageRetrievalTime: number;
  prefetchHits: number;
  levels: Record<string, CacheLevelStats>;
}

export interface PrefetchStrategy<_T = any> {
  name: string;
  predict: (key: string, context?: any) => string[];
  priority: CachePriority;
  maxPrefetch: number;
}

export enum CachePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum EvictionPolicy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  ADAPTIVE = 'adaptive',
  SIZE_BASED = 'size_based'
}

// ------------ MAIN CLASS

export class CacheOptimizer<T = any> {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private config: CacheOptimizerConfig;
  private cacheLevels = new Map<string, CacheLevel<T>>();
  private prefetchStrategies = new Map<string, PrefetchStrategy<T>>();
  private accessPatterns = new Map<string, number[]>();
  private compressionCache = new Map<string, { compressed: Buffer; originalSize: number }>();
  private metrics: CacheMetrics;
  
  // Timers
  private optimizationTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private warmupTimer?: NodeJS.Timeout;
  
  // Performance tracking
  private accessTimes = new Map<string, number[]>();
  private readonly MAX_ACCESS_HISTORY = 100;
  private readonly OPTIMIZATION_INTERVAL = 300000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 600000; // 10 minutes

  constructor(private context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance(context);
    this.performanceMonitor = PerformanceMonitor.getInstance(context);
    
    this.config = {
      enableMultiLevel: true,
      enableIntelligentPrefetch: true,
      enableAdaptiveEviction: true,
      enableCompressionThreshold: 1024 * 1024, // 1MB
      enablePerformanceTracking: true,
      maxTotalMemory: 100 * 1024 * 1024, // 100MB
      optimizationInterval: this.OPTIMIZATION_INTERVAL,
      warmupOnStart: true
    };

    this.metrics = {
      totalHits: 0,
      totalMisses: 0,
      totalEvictions: 0,
      hitRate: 0,
      memoryUsage: 0,
      compressionRatio: 0,
      averageRetrievalTime: 0,
      prefetchHits: 0,
      levels: {}
    };

    this.loadConfiguration();
    this.setupDefaultCacheLevels();
    this.setupDefaultPrefetchStrategies();
    this.startOptimization();
  }

  /**
   * Create cache level
   */
  public createCacheLevel(
    name: string,
    maxSize: number,
    maxMemory: number,
    ttl: number = 3600000, // 1 hour
    evictionPolicy: EvictionPolicy = EvictionPolicy.LRU
  ): CacheLevel<T> {
    const level: CacheLevel<T> = {
      name,
      maxSize,
      maxMemory,
      ttl,
      evictionPolicy,
      entries: new Map(),
      stats: {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        memoryUsage: 0,
        hitRate: 0,
        averageAccessTime: 0
      }
    };

    this.cacheLevels.set(name, level);
    this.metrics.levels[name] = level.stats;
    
    this.logger.logInfo(`Cache level created: ${name}`, {
      maxSize,
      maxMemory,
      ttl,
      evictionPolicy
    });

    return level;
  }

  /**
   * Get value from cache
   */
  public async get(key: string, levelName?: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Try specific level if provided
      if (levelName) {
        const level = this.cacheLevels.get(levelName);
        if (level) {
          const result = await this.getFromLevel(key, level);
          this.recordAccessTime(key, Date.now() - startTime);
          return result;
        }
      }

      // Try all levels in order (L1, L2, L3, etc.)
      const levels = Array.from(this.cacheLevels.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const level of levels) {
        const result = await this.getFromLevel(key, level);
        if (result !== null) {
          // Promote to higher level if applicable
          await this.promoteToHigherLevel(key, result, level);
          this.recordAccessTime(key, Date.now() - startTime);
          return result;
        }
      }

      // Cache miss - trigger prefetch if enabled
      if (this.config.enableIntelligentPrefetch) {
        this.triggerPrefetch(key);
      }

      this.metrics.totalMisses++;
      this.recordAccessTime(key, Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'get',
        metadata: { key, levelName }
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set(
    key: string,
    value: T,
    options: {
      levelName?: string;
      ttl?: number;
      priority?: CachePriority;
      tags?: string[];
      computeCost?: number;
    } = {}
  ): Promise<boolean> {
    try {
      const size = this.calculateSize(value);
      const entry: CacheEntry<T> = {
        key,
        value,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        size,
        ttl: options.ttl,
        priority: options.priority || CachePriority.NORMAL,
        tags: options.tags,
        computeCost: options.computeCost || 1,
        hitCount: 0
      };

      // Compress if above threshold
      if (size > this.config.enableCompressionThreshold) {
        await this.compressEntry(entry);
      }

      // Determine target level
      const targetLevel = options.levelName 
        ? this.cacheLevels.get(options.levelName)
        : this.selectOptimalLevel(entry);

      if (!targetLevel) {
        return false;
      }

      // Check if eviction is needed
      await this.ensureCapacity(targetLevel, entry);

      // Store entry
      targetLevel.entries.set(key, entry);
      this.updateLevelStats(targetLevel);
      this.recordAccessPattern(key);

      this.logger.logDebug(`Cache entry stored: ${key}`, {
        level: targetLevel.name,
        size,
        priority: CachePriority[entry.priority]
      });

      return true;
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'set',
        metadata: { key, options }
      });
      return false;
    }
  }

  /**
   * Remove value from cache
   */
  public remove(key: string, levelName?: string): boolean {
    try {
      if (levelName) {
        const level = this.cacheLevels.get(levelName);
        if (level && level.entries.has(key)) {
          level.entries.delete(key);
          this.updateLevelStats(level);
          return true;
        }
        return false;
      }

      // Remove from all levels
      let removed = false;
      for (const level of this.cacheLevels.values()) {
        if (level.entries.has(key)) {
          level.entries.delete(key);
          this.updateLevelStats(level);
          removed = true;
        }
      }

      // Clean up related data
      this.accessPatterns.delete(key);
      this.accessTimes.delete(key);
      this.compressionCache.delete(key);

      return removed;
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'remove',
        metadata: { key, levelName }
      });
      return false;
    }
  }

  /**
   * Clear cache level or all levels
   */
  public clear(levelName?: string): void {
    try {
      if (levelName) {
        const level = this.cacheLevels.get(levelName);
        if (level) {
          level.entries.clear();
          this.updateLevelStats(level);
        }
      } else {
        // Clear all levels
        for (const level of this.cacheLevels.values()) {
          level.entries.clear();
          this.updateLevelStats(level);
        }
        
        // Clear related data
        this.accessPatterns.clear();
        this.accessTimes.clear();
        this.compressionCache.clear();
      }

      this.logger.logInfo(`Cache cleared: ${levelName || 'all levels'}`);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'clear',
        metadata: { levelName }
      });
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  public async warmup(dataLoader: (key: string) => Promise<T>, keys: string[]): Promise<void> {
    const operationId = this.performanceMonitor.startOperation('cache-warmup', 'cache-optimizer');
    
    try {
      const warmupPromises = keys.map(async (key) => {
        try {
          const value = await dataLoader(key);
          await this.set(key, value, { priority: CachePriority.HIGH });
        } catch (error) {
          this.logger.logWarn(`Cache warmup failed for key: ${key}`, { error: error.message });
        }
      });

      await Promise.all(warmupPromises);
      
      this.logger.logInfo(`Cache warmup completed`, {
        keysWarmed: keys.length,
        successfulWarmups: keys.length - warmupPromises.length
      });

      this.performanceMonitor.endOperation(operationId, true);
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false);
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'warmup'
      });
    }
  }

  /**
   * Register prefetch strategy
   */
  public registerPrefetchStrategy(strategy: PrefetchStrategy<T>): void {
    this.prefetchStrategies.set(strategy.name, strategy);
    this.logger.logInfo(`Prefetch strategy registered: ${strategy.name}`);
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): CacheMetrics {
    this.updateGlobalMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache statistics by level
   */
  public getLevelStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, level] of this.cacheLevels) {
      stats[name] = {
        ...level.stats,
        entries: level.entries.size,
        maxSize: level.maxSize,
        maxMemory: level.maxMemory,
        ttl: level.ttl,
        evictionPolicy: level.evictionPolicy,
        utilizationPercent: (level.entries.size / level.maxSize) * 100,
        memoryUtilizationPercent: (level.stats.memoryUsage / level.maxMemory) * 100
      };
    }
    
    return stats;
  }

  /**
   * Optimize cache performance
   */
  public async optimizeCache(): Promise<void> {
    const operationId = this.performanceMonitor.startOperation('cache-optimization', 'cache-optimizer');
    
    try {
      // Analyze access patterns
      await this.analyzeAccessPatterns();
      
      // Optimize eviction policies
      if (this.config.enableAdaptiveEviction) {
        await this.optimizeEvictionPolicies();
      }
      
      // Rebalance cache levels
      await this.rebalanceCacheLevels();
      
      // Cleanup expired entries
      await this.cleanupExpiredEntries();
      
      // Update metrics
      this.updateGlobalMetrics();
      
      this.logger.logInfo('Cache optimization completed');
      this.performanceMonitor.endOperation(operationId, true);
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false);
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'optimize'
      });
    }
  }

  /**
   * Get value from specific cache level
   */
  private async getFromLevel(key: string, level: CacheLevel<T>): Promise<T | null> {
    const entry = level.entries.get(key);
    if (!entry) {
      level.stats.misses++;
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.createdAt > entry.ttl) {
      level.entries.delete(key);
      level.stats.evictions++;
      this.updateLevelStats(level);
      return null;
    }

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    entry.hitCount++;
    level.stats.hits++;
    this.metrics.totalHits++;

    // Decompress if needed
    let value = entry.value;
    if (this.compressionCache.has(key)) {
      value = await this.decompressEntry(key);
    }

    this.updateLevelStats(level);
    return value;
  }

  /**
   * Promote entry to higher cache level
   */
  private async promoteToHigherLevel(key: string, value: T, currentLevel: CacheLevel<T>): Promise<void> {
    const levels = Array.from(this.cacheLevels.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const currentIndex = levels.indexOf(currentLevel);
    if (currentIndex > 0) {
      const higherLevel = levels[currentIndex - 1];
      
      // Check if promotion is beneficial
      const entry = currentLevel.entries.get(key);
      if (entry && entry.accessCount > 5) { // Promote frequently accessed items
        await this.set(key, value, {
          levelName: higherLevel.name,
          priority: entry.priority,
          tags: entry.tags
        });
      }
    }
  }

  /**
   * Select optimal cache level for entry
   */
  private selectOptimalLevel(entry: CacheEntry<T>): CacheLevel<T> | null {
    const levels = Array.from(this.cacheLevels.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    // Select based on priority and size
    for (const level of levels) {
      if (entry.size <= level.maxMemory && 
          level.entries.size < level.maxSize &&
          level.stats.memoryUsage + entry.size <= level.maxMemory) {
        return level;
      }
    }

    // Fallback to largest level
    return levels[levels.length - 1] || null;
  }

  /**
   * Ensure cache level has capacity for new entry
   */
  private async ensureCapacity(level: CacheLevel<T>, newEntry: CacheEntry<T>): Promise<void> {
    while (level.entries.size >= level.maxSize || 
           level.stats.memoryUsage + newEntry.size > level.maxMemory) {
      
      const evicted = await this.evictEntry(level);
      if (!evicted) {
        break; // No more entries to evict
      }
    }
  }

  /**
   * Evict entry based on policy
   */
  private async evictEntry(level: CacheLevel<T>): Promise<boolean> {
    if (level.entries.size === 0) {
      return false;
    }

    let entryToEvict: CacheEntry<T> | null = null;
    
    switch (level.evictionPolicy) {
      case EvictionPolicy.LRU:
        entryToEvict = this.findLRUEntry(level);
        break;
      case EvictionPolicy.LFU:
        entryToEvict = this.findLFUEntry(level);
        break;
      case EvictionPolicy.FIFO:
        entryToEvict = this.findFIFOEntry(level);
        break;
      case EvictionPolicy.SIZE_BASED:
        entryToEvict = this.findLargestEntry(level);
        break;
      case EvictionPolicy.ADAPTIVE:
        entryToEvict = this.findAdaptiveEntry(level);
        break;
    }

    if (entryToEvict) {
      level.entries.delete(entryToEvict.key);
      level.stats.evictions++;
      this.metrics.totalEvictions++;
      this.updateLevelStats(level);
      return true;
    }

    return false;
  }

  /**
   * Find LRU entry
   */
  private findLRUEntry(level: CacheLevel<T>): CacheEntry<T> | null {
    let lruEntry: CacheEntry<T> | null = null;
    let oldestAccess = Date.now();

    for (const entry of level.entries.values()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruEntry = entry;
      }
    }

    return lruEntry;
  }

  /**
   * Find LFU entry
   */
  private findLFUEntry(level: CacheLevel<T>): CacheEntry<T> | null {
    let lfuEntry: CacheEntry<T> | null = null;
    let lowestCount = Infinity;

    for (const entry of level.entries.values()) {
      if (entry.accessCount < lowestCount) {
        lowestCount = entry.accessCount;
        lfuEntry = entry;
      }
    }

    return lfuEntry;
  }

  /**
   * Find FIFO entry
   */
  private findFIFOEntry(level: CacheLevel<T>): CacheEntry<T> | null {
    let fifoEntry: CacheEntry<T> | null = null;
    let oldestCreation = Date.now();

    for (const entry of level.entries.values()) {
      if (entry.createdAt < oldestCreation) {
        oldestCreation = entry.createdAt;
        fifoEntry = entry;
      }
    }

    return fifoEntry;
  }

  /**
   * Find largest entry
   */
  private findLargestEntry(level: CacheLevel<T>): CacheEntry<T> | null {
    let largestEntry: CacheEntry<T> | null = null;
    let largestSize = 0;

    for (const entry of level.entries.values()) {
      if (entry.size > largestSize) {
        largestSize = entry.size;
        largestEntry = entry;
      }
    }

    return largestEntry;
  }

  /**
   * Find adaptive entry (combines multiple factors)
   */
  private findAdaptiveEntry(level: CacheLevel<T>): CacheEntry<T> | null {
    let bestEntry: CacheEntry<T> | null = null;
    let lowestScore = Infinity;

    const now = Date.now();

    for (const entry of level.entries.values()) {
      // Calculate adaptive score (lower is better for eviction)
      const ageScore = (now - entry.lastAccessed) / 1000; // Age in seconds
      const frequencyScore = 1 / (entry.accessCount + 1); // Inverse frequency
      const sizeScore = entry.size / 1024; // Size in KB
      const priorityScore = (5 - entry.priority) * 10; // Priority penalty
      
      const adaptiveScore = ageScore + frequencyScore + sizeScore + priorityScore;
      
      if (adaptiveScore < lowestScore) {
        lowestScore = adaptiveScore;
        bestEntry = entry;
      }
    }

    return bestEntry;
  }

  /**
   * Calculate entry size
   */
  private calculateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimation (UTF-16)
    } catch {
      return 1024; // Default size if serialization fails
    }
  }

  /**
   * Compress cache entry
   */
  private async compressEntry(entry: CacheEntry<T>): Promise<void> {
    try {
      const serialized = JSON.stringify(entry.value);
      const compressed = Buffer.from(serialized, 'utf8'); // Simplified compression

      this.compressionCache.set(entry.key, {
        compressed,
        originalSize: entry.size
      });

      entry.size = compressed.length;
    } catch (error) {
      this.logger.logWarn(`Failed to compress cache entry: ${entry.key}`, { error: error.message });
    }
  }

  /**
   * Decompress cache entry
   */
  private async decompressEntry(key: string): Promise<T> {
    const compressed = this.compressionCache.get(key);
    if (!compressed) {
      throw new Error(`Compressed data not found for key: ${key}`);
    }

    try {
      const decompressed = compressed.compressed.toString('utf8');
      return JSON.parse(decompressed);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'decompress',
        metadata: { key }
      });
      throw error;
    }
  }

  /**
   * Update cache level statistics
   */
  private updateLevelStats(level: CacheLevel<T>): void {
    level.stats.size = level.entries.size;
    level.stats.memoryUsage = Array.from(level.entries.values())
      .reduce((total, entry) => total + entry.size, 0);

    const totalRequests = level.stats.hits + level.stats.misses;
    level.stats.hitRate = totalRequests > 0 ? (level.stats.hits / totalRequests) * 100 : 0;
  }

  /**
   * Update global metrics
   */
  private updateGlobalMetrics(): void {
    const totalRequests = this.metrics.totalHits + this.metrics.totalMisses;
    this.metrics.hitRate = totalRequests > 0 ? (this.metrics.totalHits / totalRequests) * 100 : 0;

    this.metrics.memoryUsage = Array.from(this.cacheLevels.values())
      .reduce((total, level) => total + level.stats.memoryUsage, 0);

    // Calculate compression ratio
    const totalOriginalSize = Array.from(this.compressionCache.values())
      .reduce((total, item) => total + item.originalSize, 0);
    const totalCompressedSize = Array.from(this.compressionCache.values())
      .reduce((total, item) => total + item.compressed.length, 0);

    this.metrics.compressionRatio = totalOriginalSize > 0
      ? (totalCompressedSize / totalOriginalSize) * 100
      : 100;
  }

  /**
   * Record access pattern
   */
  private recordAccessPattern(key: string): void {
    const pattern = this.accessPatterns.get(key) || [];
    pattern.push(Date.now());

    // Keep only recent accesses
    const cutoff = Date.now() - 3600000; // 1 hour
    const recentAccesses = pattern.filter(time => time > cutoff);

    this.accessPatterns.set(key, recentAccesses);
  }

  /**
   * Record access time
   */
  private recordAccessTime(key: string, time: number): void {
    const times = this.accessTimes.get(key) || [];
    times.push(time);

    if (times.length > this.MAX_ACCESS_HISTORY) {
      times.shift();
    }

    this.accessTimes.set(key, times);

    // Update average retrieval time
    const allTimes = Array.from(this.accessTimes.values()).flat();
    this.metrics.averageRetrievalTime = allTimes.length > 0
      ? allTimes.reduce((sum, t) => sum + t, 0) / allTimes.length
      : 0;
  }

  /**
   * Trigger intelligent prefetch
   */
  private triggerPrefetch(key: string): void {
    if (!this.config.enableIntelligentPrefetch) {
      return;
    }

    for (const strategy of this.prefetchStrategies.values()) {
      try {
        const keysToPreload = strategy.predict(key);

        keysToPreload.slice(0, strategy.maxPrefetch).forEach(async (prefetchKey) => {
          // Check if already cached
          const cached = await this.get(prefetchKey);
          if (!cached) {
            // Would need data loader to actually prefetch
            this.logger.logDebug(`Prefetch suggested: ${prefetchKey}`, { strategy: strategy.name });
          }
        });
      } catch (error) {
        this.logger.logWarn(`Prefetch strategy failed: ${strategy.name}`, { error: error.message });
      }
    }
  }

  /**
   * Analyze access patterns
   */
  private async analyzeAccessPatterns(): Promise<void> {
    const patterns: Record<string, any> = {};

    for (const [key, accesses] of this.accessPatterns) {
      if (accesses.length > 1) {
        const intervals = [];
        for (let i = 1; i < accesses.length; i++) {
          intervals.push(accesses[i] - accesses[i - 1]);
        }

        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const frequency = accesses.length / (Date.now() - accesses[0]);

        patterns[key] = {
          frequency,
          avgInterval,
          totalAccesses: accesses.length,
          lastAccess: accesses[accesses.length - 1]
        };
      }
    }

    this.logger.logDebug('Access patterns analyzed', {
      totalKeys: Object.keys(patterns).length,
      highFrequencyKeys: Object.entries(patterns)
        .filter(([, pattern]: [string, any]) => pattern.frequency > 0.001)
        .length
    });
  }

  /**
   * Optimize eviction policies
   */
  private async optimizeEvictionPolicies(): Promise<void> {
    for (const level of this.cacheLevels.values()) {
      const hitRate = level.stats.hitRate;

      // Adjust eviction policy based on performance
      if (hitRate < 50) {
        // Poor hit rate, try adaptive eviction
        if (level.evictionPolicy !== EvictionPolicy.ADAPTIVE) {
          level.evictionPolicy = EvictionPolicy.ADAPTIVE;
          this.logger.logInfo(`Switched to adaptive eviction for level: ${level.name}`);
        }
      } else if (hitRate > 80) {
        // Good hit rate, can use simpler LRU
        if (level.evictionPolicy !== EvictionPolicy.LRU) {
          level.evictionPolicy = EvictionPolicy.LRU;
          this.logger.logInfo(`Switched to LRU eviction for level: ${level.name}`);
        }
      }
    }
  }

  /**
   * Rebalance cache levels
   */
  private async rebalanceCacheLevels(): Promise<void> {
    const levels = Array.from(this.cacheLevels.values());

    for (let i = 0; i < levels.length - 1; i++) {
      const currentLevel = levels[i];
      const nextLevel = levels[i + 1];

      // Move frequently accessed items up
      const entriesToPromote: CacheEntry<T>[] = [];

      for (const entry of nextLevel.entries.values()) {
        if (entry.accessCount > 10 && entry.priority >= CachePriority.HIGH) {
          entriesToPromote.push(entry);
        }
      }

      for (const entry of entriesToPromote) {
        if (currentLevel.entries.size < currentLevel.maxSize) {
          currentLevel.entries.set(entry.key, entry);
          nextLevel.entries.delete(entry.key);
        }
      }

      this.updateLevelStats(currentLevel);
      this.updateLevelStats(nextLevel);
    }
  }

  /**
   * Cleanup expired entries
   */
  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    let totalCleaned = 0;

    for (const level of this.cacheLevels.values()) {
      const expiredKeys: string[] = [];

      for (const [key, entry] of level.entries) {
        if (entry.ttl && now - entry.createdAt > entry.ttl) {
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach(key => {
        level.entries.delete(key);
        this.compressionCache.delete(key);
      });

      totalCleaned += expiredKeys.length;
      this.updateLevelStats(level);
    }

    if (totalCleaned > 0) {
      this.logger.logInfo(`Cleaned up ${totalCleaned} expired cache entries`);
    }
  }

  /**
   * Setup default cache levels
   */
  private setupDefaultCacheLevels(): void {
    // L1 Cache - Fast, small
    this.createCacheLevel('L1', 100, 10 * 1024 * 1024, 1800000, EvictionPolicy.LRU); // 30 min, 10MB

    // L2 Cache - Medium, balanced
    this.createCacheLevel('L2', 500, 50 * 1024 * 1024, 3600000, EvictionPolicy.ADAPTIVE); // 1 hour, 50MB

    // L3 Cache - Large, persistent
    this.createCacheLevel('L3', 2000, 200 * 1024 * 1024, 7200000, EvictionPolicy.LFU); // 2 hours, 200MB
  }

  /**
   * Setup default prefetch strategies
   */
  private setupDefaultPrefetchStrategies(): void {
    // Sequential prefetch strategy
    this.registerPrefetchStrategy({
      name: 'sequential',
      predict: (key: string) => {
        const match = key.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1]);
          return [`${key.replace(/\d+$/, '')}${num + 1}`, `${key.replace(/\d+$/, '')}${num + 2}`];
        }
        return [];
      },
      priority: CachePriority.LOW,
      maxPrefetch: 2
    });

    // Related items prefetch strategy
    this.registerPrefetchStrategy({
      name: 'related',
      predict: (key: string) => {
        // Predict related keys based on patterns
        const parts = key.split(':');
        if (parts.length > 1) {
          return [`${parts[0]}:related`, `${parts[0]}:metadata`];
        }
        return [];
      },
      priority: CachePriority.NORMAL,
      maxPrefetch: 3
    });
  }

  /**
   * Start optimization
   */
  private startOptimization(): void {
    this.optimizationTimer = setInterval(() => {
      this.optimizeCache();
    }, this.config.optimizationInterval);

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL);

    if (this.config.warmupOnStart) {
      this.warmupTimer = setTimeout(() => {
        // Would trigger warmup with common keys
        this.logger.logInfo('Cache warmup TODO: Would be triggered here');
      }, 5000);
    }
  }

  /**
   * Stop optimization
   */
  private stopOptimization(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = undefined;
    }
  }

  /**
   * Load configuration
   */
  private loadConfiguration(): void {
    try {
      const stored = this.context.globalState.get<Partial<CacheOptimizerConfig>>('cacheOptimizerConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'load-configuration'
      });
    }
  }

  /**
   * Save configuration
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('cacheOptimizerConfig', this.config);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'cache-optimizer',
        operation: 'save-configuration'
      });
    }
  }

  /**
   * Update configuration
   */
  public updateConfiguration(newConfig: Partial<CacheOptimizerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();

    // Restart optimization if interval changed
    if (newConfig.optimizationInterval) {
      this.stopOptimization();
      this.startOptimization();
    }
  }

  /**
   * Dispose cache optimizer
   */
  public dispose(): void {
    this.stopOptimization();
    this.clear(); // Clear all cache levels
    this.logger.logInfo('Cache optimizer disposed');
  }
}
