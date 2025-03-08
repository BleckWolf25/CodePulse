/**
 * src/metrics/debounce-tracker.ts
 * 
 * Debounce Tracker.ts
 * Manages debounced file tracking to prevent excessive analysis 
 * during rapid editing sessions
 * 
 * Implements per-file debouncing with automatic cleanup
 */
export class DebouncedFileTracker {
  // Tracks active debounce timers by file path
  private trackingQueue: Map<string, NodeJS.Timeout> = new Map();

  // Debounce duration in milliseconds
  private debounceTime = 300;

  /**
   * Queues a file for analysis with debounce protection
   * @param filePath - Full path to the file being tracked
   * @param trackingCallback - Analysis callback to execute after debounce
   */
  public queueFileTracking(filePath: string, trackingCallback: (path: string) => void) {

    // Cancel existing pending analysis for this file
    const existingTimeout = this.trackingQueue.get(filePath);
    if (existingTimeout) { clearTimeout(existingTimeout); }

    // Set new debounced analysis
    const newTimeout = setTimeout(() => {
      trackingCallback(filePath);
      this.trackingQueue.delete(filePath); // Cleanup after execution
    }, this.debounceTime);

    this.trackingQueue.set(filePath, newTimeout);
  }
}