// src/utils/cache.ts
export class MetricCache<T> {

    public forEach(callback: (value: T, key: string) => void): void {
        this.cache.forEach((entry, key) => {
            callback(entry.data, key);
        });
    }

    private cache: Map<string, {
        data: T,
        timestamp: number
    }> = new Map();


    private MAX_CACHE_SIZE = 500;
    private CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

    public get size(): number {
        return this.cache.size;
    };

    public set(key: string, value: T) {
        // Implement LRU cache eviction
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.findOldestEntry();
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    public get(key: string): T | undefined {
        const entry = this.cache.get(key);

        // Check cache expiry
        if (entry && (Date.now() - entry.timestamp) < this.CACHE_EXPIRY) {
            return entry.data;
        }

        // Remove expired entry
        this.cache.delete(key);
        return undefined;
    }

    private findOldestEntry(): string {
        let oldestKey = '';
        let oldestTimestamp = Infinity;

        for (const [key, value] of this.cache.entries()) {
            if (value.timestamp < oldestTimestamp) {
                oldestKey = key;
                oldestTimestamp = value.timestamp;
            }
        }

        return oldestKey;
    }
}