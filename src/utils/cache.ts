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
 * - Worker thread support for large operations
 * - IndexedDB support for larger datasets
 * - Cache compression
 * - Batch operations support
 */

import * as vscode from 'vscode';
import { deflate, inflate } from "zlib";
import { promisify } from 'util';
import * as path from "path";
import { BufferSource } from 'node:stream/web';
import { IndexInfo } from 'typescript';
import { CursorPos } from 'node:readline';
import { WorkerThreadPool } from '../workers/worker-manager';
import { cpus } from 'os';

interface IDBDatabase {
    createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
    transaction(storeNames: string | string[], mode?: IDBTransactionMode): IDBTransaction;
    objectStoreNames: DOMStringList;
}

// missing IndexedDB interfaces and types
interface IDBVersionChangeEvent extends Event {
    oldVersion: number;
    newVersion: number | null;
}

interface IDBObjectStoreParameters {
    keyPath?: string | string[];
    autoIncrement?: boolean;
}

interface IDBObjectStore {
    clear(): IDBRequest;
    delete(key: IDBValidKey): IDBRequest;
    name: string;
    keyPath: string | string[];
    indexNames: DOMStringList;
    transaction: IDBTransaction;
    autoIncrement: boolean;
    put(value: any, key?: IDBValidKey): IDBRequest;
    get(key: IDBValidKey): IDBRequest;
}

interface IDBTransaction {
    objectStore(name: string): IDBObjectStore;
    abort(): void;
    commit(): void;
    mode: IDBTransactionMode;
}

type IDBTransactionMode = 'readonly' | 'readwrite' | 'versionchange';

interface DOMStringList {
    length: number;
    contains(str: string): boolean;
    item(index: number): string | null;
}

type IDBValidKey = number | string | Date | BufferSource | IDBValidKey[];

// IDBRequest interface
interface IDBRequest<T = any> extends EventTarget {
    readonly error: DOMException | null;
    readonly result: T;
    readonly source: IDBObjectStore | IndexInfo | CursorPos;
    readonly transaction: IDBTransaction;
    readonly readyState: 'pending' | 'done';
    onsuccess: ((this: IDBRequest<T>, ev: Event) => any) | null;
    onerror: ((this: IDBRequest<T>, ev: Event) => any) | null;
}

// Worker response type
type WorkerResponse = {
    metrics?: unknown;
    compressed?: unknown;
    decompressed?: unknown;
};

// request promise wrapper helper
function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Promisify zlib functions
const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

// Worker processing function
async function processWithWorker<T>(workerPool: WorkerThreadPool, data: T): Promise<T> {
    try {
        const result = workerPool.publicExecuteTask({
            type: 'compress',
            data
        }) as unknown as WorkerResponse;
        
        if (result && typeof result === 'object') {
            if ('metrics' in result) {
                return result.metrics as T;
            }
            
            return 'compressed' in result ? result.compressed as T : data;
        }
        
        return data;
    } catch (error) {
        console.error('Worker processing failed:', error);
        return data;
    }
}

async function decompressWithWorker<T>(workerPool: WorkerThreadPool, data: T): Promise<T> {
    try {
        const result = workerPool.publicExecuteTask({
            type: 'decompress',
            data
        }) as unknown as WorkerResponse;
        
        if (result && typeof result === 'object') {
            if ('decompressed' in result) {
                return result.decompressed as T;
            }
        }
        
        return data;
    } catch (error) {
        console.error('Decompression failed:', error);
        return data;
    }
}

export class MetricCache<T> {

    // -------------------- CORE STORAGE -------------------- \\
    
    private cache: Map<string, { data: T; timestamp: number }> = new Map();

    // -------------------- CONFIGURATION -------------------- \\
    
    private readonly MAX_CACHE_SIZE = 500; // Maximum entries before LRU eviction
    private readonly CACHE_EXPIRY = 86_400_000; // 24h in milliseconds
    private readonly CACHE_COMPRESSION_THRESHOLD = 1000; // KB

    // -------------------- WORKER THREAD -------------------- \\

    private workerPool: WorkerThreadPool | null = null;
    private indexedDB: IDBDatabase | null = null;

    // -------------------- CACHE CONTROL -------------------- \\

    private analysisTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private workspaceVersion: number = 0;
    private readonly ANALYSIS_TIMEOUT = 30000; // 30 seconds

    constructor() {
        // Initialize worker pool if enabled
        if (vscode.workspace.getConfiguration('productivityDashboard').get('workerThreads')) {
            this.workerPool = new WorkerThreadPool(
                cpus().length || 4,  // Use available CPU cores or fallback to 4
                path.join(__dirname, '../workers/cache-worker.js')
            );
        }

        // Listen for workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.workspaceVersion++;
            this.invalidateCache();
        });

        // Listen for file deletions
        vscode.workspace.onDidDeleteFiles(event => {
            event.files.forEach(uri => this.invalidateEntry(uri.fsPath));
        });
    }


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
     * cache entry
     * @param key - Unique identifier for the entry
     * @param value - Data to store
     * @remarks
     * - Updates entry timestamp on write
     * - Triggers LRU eviction if at capacity
     */
    public async set(key: string, value: T): Promise<void> {
        this.evictIfNeeded();
        
        const compressed = await this.compressEntry(value);
        this.cache.set(key, {
            data: compressed,
            timestamp: Date.now()
        });

        // Store in IndexedDB if available
        if (this.indexedDB) {
            const transaction = this.indexedDB.transaction(['metrics'], 'readwrite');
            const store = transaction.objectStore('metrics');
            await wrapRequest(store.put({ 
                key, 
                data: compressed, 
                timestamp: Date.now() 
            }));
        }
    }

    /**
     * multiple cache entries in batch
     * @param entries - Array of key-value pairs to store
     * @remarks
     * - Compresses entries before storing
     */
    public async setBatch(entries: Array<[string, T]>): Promise<void> {
        await Promise.all(
            entries.map(async ([key, value]) => {
                const compressed = await this.compressEntry(value);
                this.set(key, compressed);
            })
        );
    }

    /**
     * Retrieve cached value
     * @param key - Entry identifier to lookup
     * @returns Cached value or undefined if expired/missing
     * @remarks Auto-removes expired entries on access
     */
    public async get(key: string): Promise<T | undefined> {
        const entry = this.cache.get(key);
        
        if (!entry) {
            // Try to fetch from IndexedDB
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['metrics'], 'readonly');
                const store = transaction.objectStore('metrics');
                const stored = await wrapRequest(store.get(key));
                
                if (stored && !this.isEntryExpired(stored)) {
                    const decompressed = await this.decompressEntry(stored.data);
                    this.cache.set(key, {
                        data: stored.data,
                        timestamp: stored.timestamp
                    });
                    return decompressed;
                }
            }
            return undefined;
        }

        if (this.isEntryExpired(entry)) {
            this.cache.delete(key);
            return undefined;
        }

        return this.decompressEntry(entry.data as string);
    }

    /**
     * Invalidates entire cache on workspace changes
     */
    private invalidateCache(): void {
        this.cache.clear();
        if (this.indexedDB) {
            const transaction = this.indexedDB.transaction(['metrics'], 'readwrite');
            const store = transaction.objectStore('metrics');
            store.clear();
        }
    }

    /**
     * Invalidates single cache entry
     */
    private invalidateEntry(key: string): void {
        this.cache.delete(key);
        if (this.indexedDB) {
            const transaction = this.indexedDB.transaction(['metrics'], 'readwrite');
            const store = transaction.objectStore('metrics');
            store.delete(key);
        }
    }

    /**
     * Initiates analysis with timeout
     */
    public async analyzeWithTimeout<R>(
        key: string,
        analysis: () => Promise<R>,
        timeoutMs: number = this.ANALYSIS_TIMEOUT
    ): Promise<R> {
        // Cancel existing analysis
        this.cancelAnalysis(key);

        return new Promise<R>((resolve, reject) => {
            // Set timeout
            const timeout = setTimeout(() => {
                this.analysisTimeouts.delete(key);
                reject(new Error(`Analysis timeout for ${key}`));
            }, timeoutMs);

            this.analysisTimeouts.set(key, timeout);

            // Run analysis
            analysis()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    clearTimeout(timeout);
                    this.analysisTimeouts.delete(key);
                });
        });
    }

    /**
     * Cancels ongoing analysis
     */
    public cancelAnalysis(key: string): void {
        const timeout = this.analysisTimeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.analysisTimeouts.delete(key);
        }
    }

    public dispose(): void {
        this.workerPool?.terminate();
        this.workerPool = null;
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

    /**
     * Compress cache entry if needed
     * @param data - Data to compress
     * @returns Compressed data or original data if compression not needed
     */
    private async compressEntry(data: T): Promise<T> {
        if (!this.shouldCompress(data)) {
            return data;
        }

        if (this.workerPool) {
            return processWithWorker(this.workerPool, data);
        }

        // Fallback compression
        const stringData = JSON.stringify(data);
        const compressed = await deflateAsync(Buffer.from(stringData));
        return compressed.toString('base64') as unknown as T;
    }

    /**
     * Decompress cache entry
     * @param data - Data to decompress
     * @returns Decompressed data
     */
    private async decompressEntry(data: string | T): Promise<T> {
        if (this.workerPool && typeof data === 'string') {
            return decompressWithWorker(this.workerPool, data) as Promise<T>;
        }

        // Fallback decompression
        const buffer = Buffer.from(data as string, 'base64');
        const decompressed = await inflateAsync(buffer);
        return JSON.parse(decompressed.toString());
    }

    /**
     * Determine if data should be compressed
     * @param data - Data to evaluate
     * @returns True if data exceeds compression threshold
     */
    private shouldCompress(data: T): boolean {
        return JSON.stringify(data).length > this.CACHE_COMPRESSION_THRESHOLD;
    }
}