import { window } from 'vscode';
import { ErrorHandler } from './error-handler';

/**
 * A wrapper class for IndexedDB operations with TypeScript type safety
 * Provides a simplified API for common IndexedDB operations
 */
export class IndexedDB {
    private db: IDBDatabase | null = null;
    private errorHandler = ErrorHandler.getInstance();

    /**
     * Creates a new IndexedDB instance
     * @param dbName The name of the database
     * @param version The version of the database schema
     */
    constructor(
        private dbName: string,
        private version: number
    ) {}

    /**
     * Opens the database connection
     * @returns A promise that resolves when the database is opened
     */
    public async open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const request = globalThis.indexedDB.open(this.dbName, this.version);
            request.onerror = (_event: any) => {
                this.errorHandler.handleError(request.error || new Error('Failed to open database'));
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                this.db = (event.target as IDBOpenDBRequest).result;
            };
        });
    }

    /**
     * Creates an object store in the database
     * @param storeName The name of the object store
     * @param options Configuration options for the object store
     * @returns A promise that resolves when the store is created
     */
    public async createStore(storeName: string, options?: IDBObjectStoreParameters): Promise<void> {
        if (!this.db) {
            await this.open();
        }
        
        if (!this.db) {
            throw new Error('Database could not be opened');
        }
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            this.db.createObjectStore(storeName, options);
        }
    }

    /**
     * Creates an index on an object store
     * @param storeName The name of the object store
     * @param indexName The name of the index
     * @param keyPath The path to the property to index
     * @param options Configuration options for the index
     * @returns A promise that resolves when the index is created
     */
    public async createIndex(
        storeName: string,
        indexName: string,
        keyPath: string | string[],
        options?: IDBIndexParameters
    ): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, keyPath, options);
        }
        
        return new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                this.errorHandler.handleError(transaction.error || new Error('Failed to create index'));
                reject(transaction.error);
            };
        });
    }

    /**
     * Creates a transaction on the database
     * @param storeNames The name or names of the object stores to include in the transaction
     * @param mode The mode of the transaction (readonly or readwrite)
     * @returns The transaction object
     */
    public transaction(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): IDBTransaction {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db.transaction(storeNames, mode);
    }

    /**
     * Clears all data from all object stores in the database
     * @returns A promise that resolves when all stores are cleared
     */
    public async clear(): Promise<void> {
        if (!this.db) {
            return;
        }
        
        const storeNames = Array.from(this.db.objectStoreNames);
        if (storeNames.length === 0) {
            return;
        }
        
        const transaction = this.db.transaction(storeNames, 'readwrite');
        
        const clearPromises = storeNames.map(storeName => 
            this.clearStore(transaction.objectStore(storeName))
        );
        
        // Wait for all stores to be cleared
        await Promise.all(clearPromises);
    }

    /**
     * Clears all data from a specific object store
     * @param store The object store to clear
     * @returns A promise that resolves when the store is cleared
     */
    private clearStore(store: IDBObjectStore): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const request = store.clear();
            
            request.onerror = () => {
                this.errorHandler.handleError(request.error || new Error(`Failed to clear store: ${store.name}`));
                reject(request.error);
            };
            
            request.onsuccess = () => resolve();
        });
    }
    
    /**
     * Adds data to an object store
     * @param storeName The name of the object store
     * @param data The data to add
     * @param key Optional key to use for the data
     * @returns A promise that resolves with the key of the added data
     */
    public async add<T>(storeName: string, data: T, key?: IDBValidKey): Promise<IDBValidKey> {
        return new Promise<IDBValidKey>((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = key !== undefined ? store.add(data, key) : store.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                this.errorHandler.handleError(request.error || new Error('Failed to add data'));
                reject(request.error);
            };
        });
    }
    
    /**
     * Retrieves data from an object store by key
     * @param storeName The name of the object store
     * @param key The key of the data to retrieve
     * @returns A promise that resolves with the retrieved data
     */
    public async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
        return new Promise<T | undefined>((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result as T);
            request.onerror = () => {
                this.errorHandler.handleError(request.error || new Error('Failed to get data'));
                reject(request.error);
            };
        });
    }
    
    /**
     * Closes the database connection
     */
    public close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}