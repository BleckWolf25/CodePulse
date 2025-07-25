import { ErrorHandler } from './error-handler';

/**
 * Represents a cache entry with data and timestamp
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic cache implementation for metrics with automatic expiration
 * @template T The type of data to be cached
 */
export class MetricCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  
  // Cache configuration constants
  private static readonly CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  private readonly errorHandler = ErrorHandler.getInstance();
  private cleanupIntervalId?: NodeJS.Timeout;

  /**
   * Creates a new MetricCache instance and starts the cleanup timer
   */
  constructor() {
    this.cleanupIntervalId = setInterval(
      () => this.cleanupExpiredEntries(),
      MetricCache.CLEANUP_INTERVAL
    );
  }

  /**
   * Retrieves a value from the cache by key
   * @param key The cache key
   * @returns The cached value or undefined if not found or expired
   */
  public async get(key: string): Promise<T | undefined> {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        return undefined;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return undefined;
      }

      return entry.data;
    } catch (error) {
      this.errorHandler.handleCacheError(error as Error, 'cache.get');
      return undefined;
    }
  }

  /**
   * Stores a value in the cache with the current timestamp
   * @param key The cache key
   * @param value The value to store
   */
  public set(key: string, value: T): void {
    try {
      this.cache.set(key, {
        data: value,
        timestamp: Date.now()
      });
    } catch (error) {
      this.errorHandler.handleCacheError(error as Error, 'cache.set');
    }
  }

  /**
   * Checks if a cache entry has expired
   * @param entry The cache entry to check
   * @returns True if expired, false otherwise
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > MetricCache.CACHE_EXPIRY;
  }

  /**
   * Removes all expired entries from the cache
   */
  private cleanupExpiredEntries(): void {
    try {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > MetricCache.CACHE_EXPIRY) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      this.errorHandler.handleCacheError(error as Error, 'cache.cleanup');
    }
  }

  /**
   * Clears all entries from the cache
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Returns the current number of entries in the cache
   * @returns The cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Iterates over all non-expired cache entries
   * @param callback Function to call for each entry
   */
  public forEach(callback: (value: T, key: string) => void): void {
    try {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        // Skip expired entries
        if (now - entry.timestamp <= MetricCache.CACHE_EXPIRY) {
          callback(entry.data, key);
        }
      }
    } catch (error) {
      this.errorHandler.handleCacheError(error as Error, 'cache.forEach');
    }
  }

  /**
   * Returns the current number of non-expired entries in the cache
   * @returns The number of valid entries
   */
  public get size(): number {
    const now = Date.now();
    let count = 0;
    for (const [, entry] of this.cache) {
      if (now - entry.timestamp <= MetricCache.CACHE_EXPIRY) {
        count++;
      }
    }
    return count;
  }

  /**
   * Cleans up resources when the cache is no longer needed
   */
  public dispose(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
    this.clear();
  }
}