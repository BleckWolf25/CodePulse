/**
 * Memory Leak Detector
 * 
 * Advanced memory leak detection system with heap analysis,
 * object tracking, reference counting, and automated cleanup.
 */

import * as vscode from 'vscode';
import { Logger } from './logger';

// ------------ INTERFACES

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  objectCounts: Record<string, number>;
  largestObjects: ObjectInfo[];
  gcStats?: GCStats;
}

export interface ObjectInfo {
  type: string;
  size: number;
  count: number;
  retainedSize: number;
  references: number;
}

export interface GCStats {
  collections: number;
  timeSpent: number;
  freedMemory: number;
  lastCollection: number;
}

export interface MemoryLeak {
  id: string;
  type: 'heap_growth' | 'object_accumulation' | 'event_listener_leak' | 'closure_leak' | 'dom_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: number;
  component?: string;
  evidence: LeakEvidence;
  suggestions: string[];
  impact: string;
  trend: MemoryTrend;
}

export interface LeakEvidence {
  memoryGrowthMB: number;
  objectGrowth: Record<string, number>;
  suspiciousObjects: ObjectInfo[];
  retainedReferences: number;
  gcEfficiency: number;
  timespan: number;
}

export interface MemoryTrend {
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number; // MB per minute
  confidence: number; // 0-1
  duration: number; // milliseconds
}

export interface ObjectTracker {
  type: string;
  instances: WeakSet<object>;
  creationCount: number;
  destructionCount: number;
  maxInstances: number;
  lastCreated: number;
  lastDestroyed: number;
}

export interface ReferenceTracker {
  object: WeakRef<object>;
  type: string;
  createdAt: number;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface MemoryLeakConfig {
  enabled: boolean;
  checkInterval: number;
  snapshotInterval: number;
  maxSnapshots: number;
  heapGrowthThresholdMB: number;
  objectGrowthThreshold: number;
  gcEfficiencyThreshold: number;
  trackObjects: string[];
  enableStackTraces: boolean;
  enableGCStats: boolean;
}

// ------------ MAIN CLASS

export class MemoryLeakDetector {
  private logger: Logger;
  private snapshots: MemorySnapshot[] = [];
  private detectedLeaks: MemoryLeak[] = [];
  private objectTrackers = new Map<string, ObjectTracker>();
  private referenceTrackers: ReferenceTracker[] = [];
  private eventListenerCount = 0;
  private intervalHandles = new Set<NodeJS.Timeout>();
  
  private config: MemoryLeakConfig = {
    enabled: true,
    checkInterval: 300000, // 5 minutes
    snapshotInterval: 60000, // 1 minute
    maxSnapshots: 100,
    heapGrowthThresholdMB: 50,
    objectGrowthThreshold: 1000,
    gcEfficiencyThreshold: 0.7,
    trackObjects: ['EventEmitter', 'WebviewPanel', 'Disposable', 'FileSystemWatcher'],
    enableStackTraces: true,
    enableGCStats: true
  };

  private checkTimer?: NodeJS.Timeout;
  private snapshotTimer?: NodeJS.Timeout;
  private isMonitoring = false;
  private lastGCStats?: GCStats;

  constructor(private context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance(context);
    this.loadConfiguration();
    this.setupObjectTracking();
  }

  /**
   * Start memory leak detection
   */
  public start(): void {
    if (!this.config.enabled || this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Start periodic checks
    this.checkTimer = setInterval(() => {
      this.checkForLeaks();
    }, this.config.checkInterval);

    // Start periodic snapshots
    this.snapshotTimer = setInterval(() => {
      this.takeMemorySnapshot();
    }, this.config.snapshotInterval);

    // Take initial snapshot
    this.takeMemorySnapshot();

    this.logger.logInfo('Memory leak detection started');
  }

  /**
   * Stop memory leak detection
   */
  public stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }

    this.isMonitoring = false;
    this.logger.logInfo('Memory leak detection stopped');
  }

  /**
   * Take memory snapshot
   */
  public takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const timestamp = Date.now();

    const snapshot: MemorySnapshot = {
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      objectCounts: this.getObjectCounts(),
      largestObjects: this.getLargestObjects(),
      gcStats: this.getGCStats()
    };

    this.snapshots.push(snapshot);

    // Maintain snapshot limit
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.config.maxSnapshots);
    }

    this.logger.logDebug('Memory snapshot taken', {
      heapUsedMB: Math.round(snapshot.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(snapshot.heapTotal / 1024 / 1024),
      objectCounts: snapshot.objectCounts
    });

    return snapshot;
  }

  /**
   * Check for memory leaks
   */
  public async checkForLeaks(): Promise<MemoryLeak[]> {
    if (this.snapshots.length < 5) {
      return []; // Need enough data points
    }

    const newLeaks: MemoryLeak[] = [];

    // Check for heap growth leaks
    const heapLeaks = this.detectHeapGrowthLeaks();
    newLeaks.push(...heapLeaks);

    // Check for object accumulation leaks
    const objectLeaks = this.detectObjectAccumulationLeaks();
    newLeaks.push(...objectLeaks);

    // Check for event listener leaks
    const listenerLeaks = this.detectEventListenerLeaks();
    newLeaks.push(...listenerLeaks);

    // Check for closure leaks
    const closureLeaks = this.detectClosureLeaks();
    newLeaks.push(...closureLeaks);

    // Add new leaks to collection
    newLeaks.forEach(leak => {
      this.detectedLeaks.push(leak);
      this.logger.logWarn(`Memory leak detected: ${leak.title}`, leak);
    });

    // Maintain leak collection size
    if (this.detectedLeaks.length > 50) {
      this.detectedLeaks = this.detectedLeaks.slice(-50);
    }

    return newLeaks;
  }

  /**
   * Track object creation
   */
  public trackObjectCreation(obj: object, type: string, metadata?: Record<string, any>): void {
    if (!this.config.trackObjects.includes(type)) {
      return;
    }

    let tracker = this.objectTrackers.get(type);
    if (!tracker) {
      tracker = {
        type,
        instances: new WeakSet(),
        creationCount: 0,
        destructionCount: 0,
        maxInstances: 0,
        lastCreated: 0,
        lastDestroyed: 0
      };
      this.objectTrackers.set(type, tracker);
    }

    tracker.instances.add(obj);
    tracker.creationCount++;
    tracker.lastCreated = Date.now();

    // Track reference if stack traces enabled
    if (this.config.enableStackTraces) {
      this.referenceTrackers.push({
        object: new WeakRef(obj),
        type,
        createdAt: Date.now(),
        stackTrace: new Error().stack,
        metadata
      });

      // Cleanup dead references periodically
      if (this.referenceTrackers.length % 100 === 0) {
        this.cleanupDeadReferences();
      }
    }
  }

  /**
   * Track object destruction
   */
  public trackObjectDestruction(type: string): void {
    const tracker = this.objectTrackers.get(type);
    if (tracker) {
      tracker.destructionCount++;
      tracker.lastDestroyed = Date.now();
    }
  }

  /**
   * Track event listener addition
   */
  public trackEventListenerAdded(): void {
    this.eventListenerCount++;
  }

  /**
   * Track event listener removal
   */
  public trackEventListenerRemoved(): void {
    this.eventListenerCount = Math.max(0, this.eventListenerCount - 1);
  }

  /**
   * Force garbage collection (if available)
   */
  public forceGarbageCollection(): boolean {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      
      const freedMemory = before.heapUsed - after.heapUsed;
      this.logger.logInfo('Forced garbage collection', {
        freedMemoryMB: Math.round(freedMemory / 1024 / 1024),
        heapBeforeMB: Math.round(before.heapUsed / 1024 / 1024),
        heapAfterMB: Math.round(after.heapUsed / 1024 / 1024)
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Get detected leaks
   */
  public getDetectedLeaks(): MemoryLeak[] {
    return [...this.detectedLeaks];
  }

  /**
   * Get memory snapshots
   */
  public getMemorySnapshots(limit: number = 50): MemorySnapshot[] {
    return this.snapshots.slice(-limit);
  }

  /**
   * Get object tracking statistics
   */
  public getObjectTrackingStats(): Map<string, ObjectTracker> {
    return new Map(this.objectTrackers);
  }

  /**
   * Get memory usage summary
   */
  public getMemoryUsageSummary(): {
    currentHeapMB: number;
    heapGrowthMB: number;
    leakCount: number;
    trackedObjects: number;
    eventListeners: number;
    gcEfficiency: number;
  } {
    const current = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[Math.max(0, this.snapshots.length - 10)];
    
    const heapGrowthMB = current && previous 
      ? (current.heapUsed - previous.heapUsed) / 1024 / 1024
      : 0;

    const trackedObjects = Array.from(this.objectTrackers.values())
      .reduce((sum, tracker) => sum + tracker.creationCount, 0);

    return {
      currentHeapMB: current ? Math.round(current.heapUsed / 1024 / 1024) : 0,
      heapGrowthMB: Math.round(heapGrowthMB),
      leakCount: this.detectedLeaks.length,
      trackedObjects,
      eventListeners: this.eventListenerCount,
      gcEfficiency: this.calculateGCEfficiency()
    };
  }

  /**
   * Clear leak detection data
   */
  public clearLeakData(): void {
    this.snapshots = [];
    this.detectedLeaks = [];
    this.referenceTrackers = [];
    this.objectTrackers.clear();
    this.eventListenerCount = 0;
    
    this.logger.logInfo('Memory leak detection data cleared');
  }

  /**
   * Detect heap growth leaks
   */
  private detectHeapGrowthLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    if (this.snapshots.length < 10) {
      return leaks;
    }

    const trend = this.analyzeMemoryTrend();
    
    if (trend.direction === 'increasing' && trend.rate > this.config.heapGrowthThresholdMB) {
      const latest = this.snapshots[this.snapshots.length - 1];
      const oldest = this.snapshots[this.snapshots.length - 10];
      const growthMB = (latest.heapUsed - oldest.heapUsed) / 1024 / 1024;

      leaks.push({
        id: `heap_growth_${Date.now()}`,
        type: 'heap_growth',
        severity: growthMB > 100 ? 'critical' : growthMB > 50 ? 'high' : 'medium',
        title: 'Heap Memory Growth Detected',
        description: `Heap memory has grown by ${growthMB.toFixed(1)}MB over the last 10 snapshots`,
        detectedAt: Date.now(),
        evidence: {
          memoryGrowthMB: growthMB,
          objectGrowth: this.calculateObjectGrowth(),
          suspiciousObjects: this.findSuspiciousObjects(),
          retainedReferences: this.countRetainedReferences(),
          gcEfficiency: this.calculateGCEfficiency(),
          timespan: latest.timestamp - oldest.timestamp
        },
        suggestions: [
          'Review recent code changes for object lifecycle issues',
          'Check for unclosed resources (files, streams, connections)',
          'Verify proper cleanup in dispose methods',
          'Consider using WeakMap/WeakSet for caches'
        ],
        impact: 'Progressive memory consumption may lead to performance degradation',
        trend
      });
    }

    return leaks;
  }

  /**
   * Detect object accumulation leaks
   */
  private detectObjectAccumulationLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    for (const [type, tracker] of this.objectTrackers) {
      const netGrowth = tracker.creationCount - tracker.destructionCount;
      
      if (netGrowth > this.config.objectGrowthThreshold) {
        leaks.push({
          id: `object_accumulation_${type}_${Date.now()}`,
          type: 'object_accumulation',
          severity: netGrowth > 5000 ? 'critical' : netGrowth > 2000 ? 'high' : 'medium',
          title: `${type} Object Accumulation Detected`,
          description: `${netGrowth} ${type} objects created but not properly disposed`,
          detectedAt: Date.now(),
          component: type,
          evidence: {
            memoryGrowthMB: 0,
            objectGrowth: { [type]: netGrowth },
            suspiciousObjects: [{ type, size: 0, count: netGrowth, retainedSize: 0, references: 0 }],
            retainedReferences: netGrowth,
            gcEfficiency: this.calculateGCEfficiency(),
            timespan: tracker.lastCreated - (tracker.lastDestroyed || tracker.lastCreated)
          },
          suggestions: [
            `Ensure proper disposal of ${type} objects`,
            'Check for missing dispose() calls',
            'Review object lifecycle management',
            'Consider using try-finally blocks for cleanup'
          ],
          impact: `Accumulation of ${type} objects may cause memory leaks`,
          trend: { direction: 'increasing', rate: 0, confidence: 0.8, duration: 0 }
        });
      }
    }

    return leaks;
  }

  /**
   * Detect event listener leaks
   */
  private detectEventListenerLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    if (this.eventListenerCount > 1000) {
      leaks.push({
        id: `event_listener_leak_${Date.now()}`,
        type: 'event_listener_leak',
        severity: this.eventListenerCount > 5000 ? 'critical' : 'high',
        title: 'Event Listener Leak Detected',
        description: `${this.eventListenerCount} event listeners registered`,
        detectedAt: Date.now(),
        evidence: {
          memoryGrowthMB: 0,
          objectGrowth: { 'EventListener': this.eventListenerCount },
          suspiciousObjects: [],
          retainedReferences: this.eventListenerCount,
          gcEfficiency: this.calculateGCEfficiency(),
          timespan: 0
        },
        suggestions: [
          'Review event listener registration and removal',
          'Ensure removeEventListener is called for each addEventListener',
          'Use AbortController for easier cleanup',
          'Consider using once: true for one-time listeners'
        ],
        impact: 'Event listeners prevent garbage collection of referenced objects',
        trend: { direction: 'increasing', rate: 0, confidence: 0.9, duration: 0 }
      });
    }

    return leaks;
  }

  /**
   * Detect closure leaks
   */
  private detectClosureLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    // Check for excessive closure creation (simplified detection)
    const suspiciousClosures = this.referenceTrackers.filter(ref => 
      ref.type === 'Function' && ref.createdAt > Date.now() - 300000 // Last 5 minutes
    );

    if (suspiciousClosures.length > 500) {
      leaks.push({
        id: `closure_leak_${Date.now()}`,
        type: 'closure_leak',
        severity: 'medium',
        title: 'Potential Closure Leak Detected',
        description: `${suspiciousClosures.length} function closures created recently`,
        detectedAt: Date.now(),
        evidence: {
          memoryGrowthMB: 0,
          objectGrowth: { 'Function': suspiciousClosures.length },
          suspiciousObjects: [],
          retainedReferences: suspiciousClosures.length,
          gcEfficiency: this.calculateGCEfficiency(),
          timespan: 300000
        },
        suggestions: [
          'Review function creation patterns',
          'Avoid creating functions in loops',
          'Consider function reuse and memoization',
          'Check for circular references in closures'
        ],
        impact: 'Closures may retain references to large objects',
        trend: { direction: 'increasing', rate: 0, confidence: 0.6, duration: 0 }
      });
    }

    return leaks;
  }

  /**
   * Analyze memory trend
   */
  private analyzeMemoryTrend(): MemoryTrend {
    if (this.snapshots.length < 5) {
      return { direction: 'stable', rate: 0, confidence: 0, duration: 0 };
    }

    const recent = this.snapshots.slice(-10);
    const memoryValues = recent.map(s => s.heapUsed / 1024 / 1024); // Convert to MB

    // Simple linear regression
    const n = memoryValues.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = memoryValues.reduce((sum, val) => sum + val, 0);
    const sumXY = memoryValues.reduce((sum, val, index) => sum + (index * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const ratePerMinute = (slope * 60000) / (timeSpan / recent.length); // MB per minute

    // Calculate confidence based on R-squared
    const meanY = sumY / n;
    const ssRes = memoryValues.reduce((sum, val, index) => {
      const predicted = slope * index + (sumY - slope * sumX) / n;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const ssTot = memoryValues.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    return {
      direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
      rate: Math.abs(ratePerMinute),
      confidence: Math.max(0, Math.min(1, rSquared)),
      duration: timeSpan
    };
  }

  /**
   * Calculate object growth
   */
  private calculateObjectGrowth(): Record<string, number> {
    const growth: Record<string, number> = {};

    if (this.snapshots.length < 2) {
      return growth;
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];

    for (const [type, latestCount] of Object.entries(latest.objectCounts)) {
      const previousCount = previous.objectCounts[type] || 0;
      const delta = latestCount - previousCount;
      if (delta > 0) {
        growth[type] = delta;
      }
    }

    return growth;
  }

  /**
   * Find suspicious objects
   */
  private findSuspiciousObjects(): ObjectInfo[] {
    const suspicious: ObjectInfo[] = [];

    for (const [type, tracker] of this.objectTrackers) {
      const netGrowth = tracker.creationCount - tracker.destructionCount;
      if (netGrowth > 100) {
        suspicious.push({
          type,
          size: 0, // Would need heap profiling for actual size
          count: netGrowth,
          retainedSize: 0,
          references: netGrowth
        });
      }
    }

    return suspicious.sort((a, b) => b.count - a.count).slice(0, 10);
  }

  /**
   * Count retained references
   */
  private countRetainedReferences(): number {
    return this.referenceTrackers.filter(ref => ref.object.deref() !== undefined).length;
  }

  /**
   * Calculate GC efficiency
   */
  private calculateGCEfficiency(): number {
    if (!this.lastGCStats || this.snapshots.length < 2) {
      return 1.0; // Assume good efficiency if no data
    }

    const latest = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];

    const memoryGrowth = latest.heapUsed - previous.heapUsed;
    const timeDiff = latest.timestamp - previous.timestamp;

    // Simple efficiency calculation based on memory growth rate
    const growthRate = memoryGrowth / timeDiff;
    return Math.max(0, Math.min(1, 1 - (growthRate / 1000))); // Normalize
  }

  /**
   * Get object counts
   */
  private getObjectCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const [type, tracker] of this.objectTrackers) {
      counts[type] = tracker.creationCount - tracker.destructionCount;
    }

    return counts;
  }

  /**
   * Get largest objects (simplified)
   */
  private getLargestObjects(): ObjectInfo[] {
    const objects: ObjectInfo[] = [];

    for (const [type, tracker] of this.objectTrackers) {
      const count = tracker.creationCount - tracker.destructionCount;
      if (count > 0) {
        objects.push({
          type,
          size: count * 1024, // Estimated size
          count,
          retainedSize: count * 1024,
          references: count
        });
      }
    }

    return objects.sort((a, b) => b.size - a.size).slice(0, 10);
  }

  /**
   * Get GC statistics
   */
  private getGCStats(): GCStats | undefined {
    if (!this.config.enableGCStats) {
      return undefined;
    }

    // This would require native bindings or performance hooks
    // TODO: For now, return mock data
    return {
      collections: 0,
      timeSpent: 0,
      freedMemory: 0,
      lastCollection: Date.now()
    };
  }

  /**
   * Setup object tracking
   */
  private setupObjectTracking(): void {
    // Initialize trackers for configured object types
    for (const type of this.config.trackObjects) {
      this.objectTrackers.set(type, {
        type,
        instances: new WeakSet(),
        creationCount: 0,
        destructionCount: 0,
        maxInstances: 0,
        lastCreated: 0,
        lastDestroyed: 0
      });
    }
  }

  /**
   * Cleanup dead references
   */
  private cleanupDeadReferences(): void {
    const before = this.referenceTrackers.length;
    this.referenceTrackers = this.referenceTrackers.filter(ref => ref.object.deref() !== undefined);
    const cleaned = before - this.referenceTrackers.length;

    if (cleaned > 0) {
      this.logger.logDebug(`Cleaned up ${cleaned} dead references`);
    }
  }

  /**
   * Load configuration from storage
   */
  private loadConfiguration(): void {
    try {
      const stored = this.context.globalState.get<Partial<MemoryLeakConfig>>('memoryLeakConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'memory-leak-detector',
        operation: 'load-configuration'
      });
    }
  }

  /**
   * Save configuration to storage
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('memoryLeakConfig', this.config);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'memory-leak-detector',
        operation: 'save-configuration'
      });
    }
  }

  /**
   * Update configuration
   */
  public updateConfiguration(newConfig: Partial<MemoryLeakConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();

    // Restart monitoring if enabled state changed
    if ('enabled' in newConfig) {
      if (newConfig.enabled) {
        this.start();
      } else {
        this.stop();
      }
    }

    this.logger.logInfo('Memory leak detector configuration updated', newConfig);
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): MemoryLeakConfig {
    return { ...this.config };
  }

  /**
   * Dispose memory leak detector and cleanup resources
   */
  public dispose(): void {
    this.stop();
    this.clearLeakData();

    // Clear all intervals
    for (const handle of this.intervalHandles) {
      clearInterval(handle);
    }
    this.intervalHandles.clear();

    this.logger.logInfo('Memory leak detector disposed');
  }
}
