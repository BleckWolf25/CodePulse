// src/metrics/debounce-tracker.ts
export class DebouncedFileTracker {
    private trackingQueue: Map<string, NodeJS.Timeout> = new Map();
    private debounceTime = 300; // 300ms
  
    public queueFileTracking(filePath: string, trackingCallback: (path: string) => void) {
      // Clear existing timeout for this file
      const existingTimeout = this.trackingQueue.get(filePath);
      if (existingTimeout) {clearTimeout(existingTimeout);}
  
      // Set new debounced tracking
      const newTimeout = setTimeout(() => {
        trackingCallback(filePath);
        this.trackingQueue.delete(filePath);
      }, this.debounceTime);
  
      this.trackingQueue.set(filePath, newTimeout);
    }
  }