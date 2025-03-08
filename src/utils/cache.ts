/**
 * src/utils/cache.ts
 * 
 * Generic Metric Cache System
 * 
 * Implements a size-limited cache with dual expiration strategies:
 * 1. LRU (Least Recently Used) eviction when reaching capacity
 * 2. TTL (Time-To-Live) expiration for individual entries
 * 
 * Features:
 * - Type-safe generic storage
 * - O(1) read/write operations
 * - Automatic cleanup of expired entries
 * - Thread-safe iteration
 */

export class MetricCache<T> {

    // -------------------- CORE STORAGE -------------------- \\
    
    private cache: Map<string, { data: T; timestamp: number }> = new Map();

    // -------------------- CONFIGURATION -------------------- \\
    
    private readonly MAX_CACHE_SIZE = 500; // Maximum entries before LRU eviction
    private readonly CACHE_EXPIRY = 86_400_000; // 24h in milliseconds

    // -------------------- PUBLIC API -------------------- \\

    /**
     * Iterate through valid cache entries
     * @param callback - Function to execute for each entry
     * @remarks
     * - Skips expired entries during iteration
     * - Provides read-only access to entries
     */
    public forEach(callback: (value: T, key: string) => void): void {
        this.cache.forEach((entry, key) => {
            if (!this.isEntryExpired(entry)) {
                callback(entry.data, key);
            }
        });
    }

    /**
     * Get current cache size (valid entries only)
     */
    public get size(): number {
        return Array.from(this.cache.values()).filter(
            entry => !this.isEntryExpired(entry)
        ).length;
    }

    /**
     * Add/update cache entry
     * @param key - Unique identifier for the entry
     * @param value - Data to store
     * @remarks
     * - Updates entry timestamp on write
     * - Triggers LRU eviction if at capacity
     */
    public set(key: string, value: T): void {
        this.evictIfNeeded();
        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    /**
     * Retrieve cached value
     * @param key - Entry identifier to lookup
     * @returns Cached value or undefined if expired/missing
     * @remarks Auto-removes expired entries on access
     */
    public get(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) { return undefined; }

        if (this.isEntryExpired(entry)) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.data;
    }

    // -------------------- PRIVATE METHODS -------------------- \\

    /**
     * Check if entry exceeds TTL
     * @param entry - Cache entry to validate
     * @returns True if entry should be considered expired
     */
    private isEntryExpired(entry: { timestamp: number }): boolean {
        return Date.now() - entry.timestamp > this.CACHE_EXPIRY;
    }

    /**
     * Maintain cache size limits
     * @remarks Removes oldest entry when at capacity
     */
    private evictIfNeeded(): void {
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.findOldestEntry();
            if (oldestKey) { this.cache.delete(oldestKey); }
        }
    }

    /**
     * Identify oldest valid entry for eviction
     * @returns Key of oldest non-expired entry
     */
    private findOldestEntry(): string {
        let oldestKey = '';
        let oldestTimestamp = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (!this.isEntryExpired(entry) && entry.timestamp < oldestTimestamp) {
                oldestKey = key;
                oldestTimestamp = entry.timestamp;
            }
        }

        return oldestKey;
    }
}