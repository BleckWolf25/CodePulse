/**
 * @file DEBOUNCE-TRACKER.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Debounce Tracker for Code Pulse
 * Manages debounced file tracking to prevent excessive analysis during rapid editing sessions.
 * Implements per-file debouncing with automatic cleanup, batch processing, and configuration options.
 */

// ------------ INTERFACES
/**
 * Configuration options for the DebouncedFileTracker
 */
export interface DebouncedTrackerOptions {
  debounceTime?: number;
  maxQueueSize?: number;
  batchProcess?: boolean;
  leading?: boolean;
  batchCallback?: (filePaths: string[]) => void | Promise<void>;
}

/**
 * Represents a file queued for debounced processing
 */
export interface QueuedFile {
  filePath: string;
  callback: (path: string) => void | Promise<void>;
  queuedAt: number;
  timeout: NodeJS.Timeout;
}

// ------------ CLASS
/**
 * Manages debounced file tracking to prevent excessive analysis during rapid editing sessions
 */
export class DebouncedFileTracker {
  /**
   * Tracks active debounce timers and callbacks by file path
   */
  private trackingQueue: Map<string, QueuedFile> = new Map();

  /**
   * Configuration options
   */
  private debounceTime: number;
  private maxQueueSize: number;
  private batchProcess: boolean;
  private leading: boolean;
  private batchCallback?: (filePaths: string[]) => void | Promise<void>;

  /**
   * Statistical tracking metrics
   */
  private metrics = {
    totalTracked: 0,
    batchesProcessed: 0,
    filesSkipped: 0,
    individualProcessed: 0,
    averageBatchSize: 0,
  };

  /**
   * Creates a new DebouncedFileTracker with customizable options
   * @param options Configuration options for the tracker
   */
  constructor(options?: DebouncedTrackerOptions) {
    this.debounceTime = options?.debounceTime ?? 300;
    this.maxQueueSize = options?.maxQueueSize ?? Infinity;
    this.batchProcess = options?.batchProcess ?? false;
    this.leading = options?.leading ?? false;
    this.batchCallback = options?.batchCallback;
  }

  /**
   * Queues a file for analysis with debounce protection
   * @param filePath Full path to the file being tracked
   * @param trackingCallback Analysis callback to execute after debounce
   * @returns Function that can be called to cancel the tracking
   */
  public queueFileTracking(
    filePath: string,
    trackingCallback: (path: string) => void | Promise<void>
  ): () => void {
    this.metrics.totalTracked++;

    // Execute immediately for leading edge execution
    if (this.leading && !this.trackingQueue.has(filePath)) {
      trackingCallback(filePath);
    }

    // Cancel existing pending analysis for this file
    const existingQueuedFile = this.trackingQueue.get(filePath);
    if (existingQueuedFile) {
      clearTimeout(existingQueuedFile.timeout);
      this.metrics.filesSkipped++;
    }

    // Set new debounced analysis
    const newTimeout = setTimeout(async () => {
      const queuedFile = this.trackingQueue.get(filePath);
      if (queuedFile) {
        await queuedFile.callback(filePath);
        this.trackingQueue.delete(filePath); // Cleanup after execution
        this.metrics.individualProcessed++;
      }
    }, this.debounceTime);

    // Create the queued file object
    const queuedFile: QueuedFile = {
      filePath,
      callback: trackingCallback,
      queuedAt: Date.now(),
      timeout: newTimeout
    };

    this.trackingQueue.set(filePath, queuedFile);

    // Check if queue size limit has been reached
    if (this.trackingQueue.size >= this.maxQueueSize) {
      this.processBatch();
    }

    // Return a cancellation function
    return () => {
      const queuedFile = this.trackingQueue.get(filePath);
      if (queuedFile) {
        clearTimeout(queuedFile.timeout);
        this.trackingQueue.delete(filePath);
      }
    };
  }

  /**
   * Force immediate processing of all queued files
   * @param batchMode Whether to combine all paths into a single callback
   */
  public async flushQueue(batchMode = this.batchProcess): Promise<void> {
    if (this.trackingQueue.size === 0) {return;}

    if (batchMode) {
      await this.processBatch();
    } else {
      // Process each file individually but immediately
      const promises: Promise<void>[] = [];
      for (const [filePath, queuedFile] of this.trackingQueue.entries()) {
        clearTimeout(queuedFile.timeout);
        promises.push(Promise.resolve(queuedFile.callback(filePath)));
        this.metrics.individualProcessed++;
      }
      await Promise.all(promises);
      this.trackingQueue.clear();
    }
  }

  /**
   * Processes all queued files as a single batch
   * @private
   */
  private async processBatch(): Promise<void> {
    if (this.trackingQueue.size === 0) {
      return;
    }

    // Clear all timeouts first
    for (const queuedFile of this.trackingQueue.values()) {
      clearTimeout(queuedFile.timeout);
    }

    // Collect all file paths for batch processing
    const filePaths = Array.from(this.trackingQueue.keys());
    const queuedFiles = Array.from(this.trackingQueue.values());

    // Update metrics
    this.metrics.batchesProcessed++;
    this.metrics.averageBatchSize =
      (this.metrics.averageBatchSize * (this.metrics.batchesProcessed - 1) + filePaths.length) /
      this.metrics.batchesProcessed;

    // Clear the queue before processing to prevent re-entry
    this.trackingQueue.clear();

    try {
      if (this.batchCallback) {
        // Use the provided batch callback if available
        await this.batchCallback(filePaths);
      } else {
        // Fall back to processing individual callbacks in parallel
        const promises = queuedFiles.map(queuedFile =>
          Promise.resolve(queuedFile.callback(queuedFile.filePath))
        );
        await Promise.all(promises);
        this.metrics.individualProcessed += queuedFiles.length;
      }
    } catch (error) {
      console.error('Error during batch processing:', error);
      // Re-queue failed files for individual processing
      for (const queuedFile of queuedFiles) {
        this.queueFileTracking(queuedFile.filePath, queuedFile.callback);
      }
    }
  }

  /**
   * Adjust the debounce time dynamically
   * @param newDebounceTime New debounce duration in milliseconds
   */
  public setDebounceTime(newDebounceTime: number): void {
    this.debounceTime = newDebounceTime;
  }

  /**
   * Returns performance metrics about the tracker
   */
  public getMetrics(): Readonly<typeof this.metrics> {
    return { ...this.metrics };
  }

  /**
   * Get the current queue size
   */
  public getQueueSize(): number {
    return this.trackingQueue.size;
  }

  /**
   * Get all currently queued file paths
   */
  public getQueuedFiles(): string[] {
    return Array.from(this.trackingQueue.keys());
  }

  /**
   * Check if a specific file is currently queued
   */
  public isFileQueued(filePath: string): boolean {
    return this.trackingQueue.has(filePath);
  }

  /**
   * Set a new batch callback function
   * @param callback Function to handle batch processing
   */
  public setBatchCallback(callback: (filePaths: string[]) => void | Promise<void>): void {
    this.batchCallback = callback;
  }

  /**
   * Update configuration options
   * @param options New configuration options
   */
  public updateOptions(options: Partial<DebouncedTrackerOptions>): void {
    if (options.debounceTime !== undefined) {
      this.debounceTime = options.debounceTime;
    }
    if (options.maxQueueSize !== undefined) {
      this.maxQueueSize = options.maxQueueSize;
    }
    if (options.batchProcess !== undefined) {
      this.batchProcess = options.batchProcess;
    }
    if (options.leading !== undefined) {
      this.leading = options.leading;
    }
    if (options.batchCallback !== undefined) {
      this.batchCallback = options.batchCallback;
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): DebouncedTrackerOptions {
    return {
      debounceTime: this.debounceTime,
      maxQueueSize: this.maxQueueSize,
      batchProcess: this.batchProcess,
      leading: this.leading,
      batchCallback: this.batchCallback
    };
  }

  /**
   * Clear all pending file tracking
   */
  public clear(): void {
    for (const queuedFile of this.trackingQueue.values()) {
      clearTimeout(queuedFile.timeout);
    }
    this.trackingQueue.clear();
  }

  /**
   * Dispose of the tracker and clean up all resources
   */
  public dispose(): void {
    this.clear();
    this.batchCallback = undefined;
  }
}