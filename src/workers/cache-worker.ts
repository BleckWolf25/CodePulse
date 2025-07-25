/**
 * @file CACHE-WORKER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Worker thread for managing the cache
 * Handles cache operations like get, set, and analysis
 * Utilizes compression for efficient storage
 * Implements LRU eviction and TTL expiration
 */

// ------------ IMPORTS
import { parentPort } from 'worker_threads';
import { deflate, inflate } from 'zlib';
import { promisify } from 'util';

// ------------ POMISIFY
const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

// ------------ INTERFACES
// Worker message format
interface WorkerMessage {
    type: 'get' | 'set' | 'analyze' | 'cleanup';
    key?: string;
    data?: unknown;
    timestamp?: number;
}

// ------------ MAIN
class CacheWorker {
    private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
    private readonly CLEANUP_INTERVAL = 1000 * 60 * 30; // 30 minutes
    private readonly CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour
    private readonly MAX_CACHE_SIZE = 1000;

    constructor() {
        this.initializeCleanupInterval();
        this.handleMessages();
    }

    private initializeCleanupInterval(): void {
        setInterval(() => this.performCleanup(), this.CLEANUP_INTERVAL);
    }

    private async performCleanup(): Promise<void> {
        try {
            const initialSize = this.cache.size;
            const now = Date.now();

            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > this.CACHE_EXPIRY) {
                    this.cache.delete(key);
                }
            }

            this.sendResponse({
                type: 'cleanup',
                data: { expiredEntries: initialSize - this.cache.size }
            });
        } catch (error) {
            this.handleError('cleanup', error);
        }
    }

    private handleMessages(): void {
        if (!parentPort) {
            throw new Error('Cache worker must be run as a worker thread');
        }

        parentPort.on('message', async (message: WorkerMessage) => {
            try {
                switch (message.type) {
                    case 'get':
                        await this.handleGet(message);
                        break;
                    case 'set':
                        await this.handleSet(message);
                        break;
                    case 'analyze':
                        await this.handleAnalyze();
                        break;
                    case 'cleanup':
                        await this.performCleanup();
                        break;
                    default:
                        throw new Error(`Unknown message type: ${(message as any).type}`);
                }
            } catch (error) {
                this.handleError(message.type, error);
            }
        });
    }

    private async handleGet(message: WorkerMessage): Promise<void> {
        if (!message.key) {
            throw new Error('Key is required for get operation');
        }

        const entry = this.cache.get(message.key);
        if (!entry || Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
            this.cache.delete(message.key);
            this.sendResponse({ type: 'get', key: message.key, data: null });
            return;
        }

        const decompressed = await inflateAsync(Buffer.from(entry.data as string, 'base64'));
        this.sendResponse({
            type: 'get',
            key: message.key,
            data: JSON.parse(decompressed.toString())
        });
    }

    private async handleSet(message: WorkerMessage): Promise<void> {
        if (!message.key || !message.data) {
            throw new Error('Key and data are required for set operation');
        }

        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.evictOldest();
        }

        const compressed = await deflateAsync(Buffer.from(JSON.stringify(message.data)));
        this.cache.set(message.key, {
            data: compressed.toString('base64'),
            timestamp: Date.now()
        });

        this.sendResponse({
            type: 'set',
            key: message.key,
            success: true
        });
    }

    private async handleAnalyze(): Promise<void> {
        const analysis = {
            cacheSize: this.cache.size,
            oldestEntry: this.getOldestEntry(),
            memoryUsage: process.memoryUsage().heapUsed
        };

        this.sendResponse({
            type: 'analyze',
            data: analysis
        });
    }

    private getOldestEntry(): { key: string; age: number } | null {
        if (this.cache.size === 0) {return null;}

        let oldestKey = '';
        let oldestTimestamp = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }

        return {
            key: oldestKey,
            age: Date.now() - oldestTimestamp
        };
    }

    private evictOldest(): void {
        const oldest = this.getOldestEntry();
        if (oldest) {
            this.cache.delete(oldest.key);
        }
    }

    private handleError(operation: string, error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.sendResponse({
            type: 'error',
            operation,
            error: errorMessage
        });
    }

    private sendResponse(response: unknown): void {
        parentPort?.postMessage(response);
    }
}

// Start the cache worker
new CacheWorker();