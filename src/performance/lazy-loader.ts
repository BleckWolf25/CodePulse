/**
 * Lazy Loading System
 * 
 * Advanced lazy loading implementation for large datasets with
 * virtual scrolling, progressive loading, and intelligent prefetching.
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { PerformanceMonitor } from '../utils/performance-monitor';

// ------------ INTERFACES

export interface LazyLoadConfig<T> {
  pageSize: number;
  prefetchPages: number;
  maxCacheSize: number;
  loadTimeout: number;
  retryAttempts: number;
  enableVirtualization: boolean;
  enablePrefetch: boolean;
  sortField?: keyof T;
  sortDirection?: 'asc' | 'desc';
  filterFn?: (item: T) => boolean;
}

export interface LazyLoadPage<T> {
  pageIndex: number;
  items: T[];
  totalCount: number;
  loadedAt: number;
  isLoading: boolean;
  error?: Error;
}

export interface LazyLoadState<T> {
  totalItems: number;
  loadedPages: Map<number, LazyLoadPage<T>>;
  currentPage: number;
  isLoading: boolean;
  error?: Error;
  lastAccessed: number;
}

export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
  enableDynamicHeight: boolean;
}

export interface LazyLoadMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLoadTime: number;
  prefetchHits: number;
  memoryUsage: number;
  virtualizedItems: number;
}

// ------------ MAIN CLASS

export class LazyLoader<T> {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private state: LazyLoadState<T>;
  private config: LazyLoadConfig<T>;
  private loadingPromises = new Map<number, Promise<LazyLoadPage<T>>>();
  private prefetchQueue: number[] = [];
  private metrics: LazyLoadMetrics;
  private virtualScrollConfig?: VirtualScrollConfig;
  
  // Cache management
  private cacheCleanupTimer?: NodeJS.Timeout;
  private readonly CACHE_CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly MAX_CACHE_AGE = 600000; // 10 minutes

  constructor(
    private context: vscode.ExtensionContext,
    private dataLoader: (page: number, pageSize: number, filters?: any) => Promise<{ items: T[]; totalCount: number }>,
    config: Partial<LazyLoadConfig<T>> = {}
  ) {
    this.logger = Logger.getInstance(context);
    this.performanceMonitor = PerformanceMonitor.getInstance(context);
    
    this.config = {
      pageSize: 50,
      prefetchPages: 2,
      maxCacheSize: 100,
      loadTimeout: 10000,
      retryAttempts: 3,
      enableVirtualization: true,
      enablePrefetch: true,
      ...config
    };

    this.state = {
      totalItems: 0,
      loadedPages: new Map(),
      currentPage: 0,
      isLoading: false,
      lastAccessed: Date.now()
    };

    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLoadTime: 0,
      prefetchHits: 0,
      memoryUsage: 0,
      virtualizedItems: 0
    };

    this.startCacheCleanup();
  }

  /**
   * Load items for a specific page
   */
  public async loadPage(pageIndex: number, force: boolean = false): Promise<LazyLoadPage<T>> {
    const operationId = this.performanceMonitor.startOperation('lazy-load-page', 'lazy-loader');
    
    try {
      // Check cache first
      if (!force && this.state.loadedPages.has(pageIndex)) {
        const cachedPage = this.state.loadedPages.get(pageIndex)!;
        if (!this.isPageExpired(cachedPage)) {
          this.metrics.cacheHits++;
          this.performanceMonitor.endOperation(operationId, true);
          return cachedPage;
        }
      }

      this.metrics.cacheMisses++;
      this.metrics.totalRequests++;

      // Check if already loading
      if (this.loadingPromises.has(pageIndex)) {
        return this.loadingPromises.get(pageIndex)!;
      }

      // Start loading
      const loadPromise = this.performPageLoad(pageIndex);
      this.loadingPromises.set(pageIndex, loadPromise);

      try {
        const page = await loadPromise;
        this.state.loadedPages.set(pageIndex, page);
        this.state.lastAccessed = Date.now();
        
        // Trigger prefetch if enabled
        if (this.config.enablePrefetch) {
          this.schedulePrefetch(pageIndex);
        }

        // Cleanup cache if needed
        this.cleanupCache();

        this.performanceMonitor.endOperation(operationId, true);
        return page;
      } finally {
        this.loadingPromises.delete(pageIndex);
      }
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false);
      this.logger.logError(error as Error, {
        component: 'lazy-loader',
        operation: 'load-page',
        metadata: { pageIndex, force }
      });
      throw error;
    }
  }

  /**
   * Get items for virtual scrolling
   */
  public getVirtualItems(startIndex: number, endIndex: number): Promise<T[]> {
    if (!this.config.enableVirtualization) {
      throw new Error('Virtualization is not enabled');
    }

    const startPage = Math.floor(startIndex / this.config.pageSize);
    const endPage = Math.floor(endIndex / this.config.pageSize);
    
    const loadPromises: Promise<LazyLoadPage<T>>[] = [];
    
    for (let page = startPage; page <= endPage; page++) {
      loadPromises.push(this.loadPage(page));
    }

    return Promise.all(loadPromises).then(pages => {
      const items: T[] = [];
      
      for (let i = startIndex; i <= endIndex; i++) {
        const pageIndex = Math.floor(i / this.config.pageSize);
        const itemIndex = i % this.config.pageSize;
        const page = pages.find(p => p.pageIndex === pageIndex);
        
        if (page && page.items[itemIndex]) {
          items.push(page.items[itemIndex]);
        }
      }

      this.metrics.virtualizedItems = items.length;
      return items;
    });
  }

  /**
   * Search items with lazy loading
   */
  public async searchItems(
    query: string,
    searchFields: (keyof T)[],
    maxResults: number = 100
  ): Promise<T[]> {
    const operationId = this.performanceMonitor.startOperation('lazy-search', 'lazy-loader');
    
    try {
      const results: T[] = [];
      let pageIndex = 0;
      let foundCount = 0;

      while (foundCount < maxResults) {
        const page = await this.loadPage(pageIndex);
        
        if (page.items.length === 0) {
          break; // No more data
        }

        for (const item of page.items) {
          if (foundCount >= maxResults) {break;}

          const matches = searchFields.some(field => {
            const value = item[field];
            return typeof value === 'string' && 
                   value.toLowerCase().includes(query.toLowerCase());
          });

          if (matches) {
            results.push(item);
            foundCount++;
          }
        }

        pageIndex++;
      }

      this.performanceMonitor.endOperation(operationId, true);
      return results;
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, false);
      throw error;
    }
  }

  /**
   * Configure virtual scrolling
   */
  public configureVirtualScrolling(config: VirtualScrollConfig): void {
    this.virtualScrollConfig = config;
    this.config.enableVirtualization = true;
  }

  /**
   * Get visible range for virtual scrolling
   */
  public getVisibleRange(scrollTop: number): { start: number; end: number; total: number } {
    if (!this.virtualScrollConfig) {
      throw new Error('Virtual scrolling not configured');
    }

    const { itemHeight, containerHeight, overscan } = this.virtualScrollConfig;
    
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(this.state.totalItems - 1, start + visibleCount + overscan * 2);

    return { start, end, total: this.state.totalItems };
  }

  /**
   * Prefetch adjacent pages
   */
  public async prefetchPages(centerPage: number): Promise<void> {
    if (!this.config.enablePrefetch) {
      return;
    }

    const pagesToPrefetch: number[] = [];
    
    for (let i = 1; i <= this.config.prefetchPages; i++) {
      const prevPage = centerPage - i;
      const nextPage = centerPage + i;
      
      if (prevPage >= 0 && !this.state.loadedPages.has(prevPage)) {
        pagesToPrefetch.push(prevPage);
      }
      
      if (!this.state.loadedPages.has(nextPage)) {
        pagesToPrefetch.push(nextPage);
      }
    }

    // Load pages in background
    pagesToPrefetch.forEach(pageIndex => {
      this.loadPage(pageIndex).catch(error => {
        this.logger.logWarn(`Prefetch failed for page ${pageIndex}`, { error: error.message });
      });
    });
  }

  /**
   * Clear cache and reset state
   */
  public clearCache(): void {
    this.state.loadedPages.clear();
    this.loadingPromises.clear();
    this.prefetchQueue = [];
    this.state.currentPage = 0;
    this.state.totalItems = 0;
    this.state.lastAccessed = Date.now();
    
    this.logger.logInfo('Lazy loader cache cleared');
  }

  /**
   * Get current metrics
   */
  public getMetrics(): LazyLoadMetrics {
    this.metrics.memoryUsage = this.calculateMemoryUsage();
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<LazyLoadConfig<T>>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Clear cache if page size changed
    if (newConfig.pageSize && newConfig.pageSize !== this.config.pageSize) {
      this.clearCache();
    }
  }

  /**
   * Perform actual page load
   */
  private async performPageLoad(pageIndex: number): Promise<LazyLoadPage<T>> {
    const startTime = Date.now();
    
    const page: LazyLoadPage<T> = {
      pageIndex,
      items: [],
      totalCount: 0,
      loadedAt: startTime,
      isLoading: true
    };

    try {
      const result = await Promise.race([
        this.dataLoader(pageIndex, this.config.pageSize),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Load timeout')), this.config.loadTimeout)
        )
      ]);

      page.items = this.applyFiltersAndSort(result.items);
      page.totalCount = result.totalCount;
      page.isLoading = false;
      
      // Update total items if this is the first page or count changed
      if (pageIndex === 0 || this.state.totalItems !== result.totalCount) {
        this.state.totalItems = result.totalCount;
      }

      // Update metrics
      const loadTime = Date.now() - startTime;
      this.updateLoadTimeMetrics(loadTime);

      return page;
    } catch (error) {
      page.isLoading = false;
      page.error = error as Error;
      throw error;
    }
  }

  /**
   * Apply filters and sorting
   */
  private applyFiltersAndSort(items: T[]): T[] {
    let filteredItems = items;

    // Apply filter
    if (this.config.filterFn) {
      filteredItems = items.filter(this.config.filterFn);
    }

    // Apply sorting
    if (this.config.sortField) {
      filteredItems.sort((a, b) => {
        const aVal = a[this.config.sortField!];
        const bVal = b[this.config.sortField!];
        
        let comparison = 0;
        if (aVal < bVal) {comparison = -1;}
        else if (aVal > bVal) {comparison = 1;}
        
        return this.config.sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return filteredItems;
  }

  /**
   * Schedule prefetch for adjacent pages
   */
  private schedulePrefetch(centerPage: number): void {
    // Add to prefetch queue
    for (let i = 1; i <= this.config.prefetchPages; i++) {
      const prevPage = centerPage - i;
      const nextPage = centerPage + i;
      
      if (prevPage >= 0 && !this.state.loadedPages.has(prevPage)) {
        this.prefetchQueue.push(prevPage);
      }
      
      if (!this.state.loadedPages.has(nextPage)) {
        this.prefetchQueue.push(nextPage);
      }
    }

    // Process prefetch queue
    this.processPrefetchQueue();
  }

  /**
   * Process prefetch queue
   */
  private async processPrefetchQueue(): Promise<void> {
    if (this.prefetchQueue.length === 0) {
      return;
    }

    const pageIndex = this.prefetchQueue.shift()!;
    
    try {
      await this.loadPage(pageIndex);
      this.metrics.prefetchHits++;
    } catch (error) {
      this.logger.logWarn(`Prefetch failed for page ${pageIndex}`, { error: error.message });
    }

    // Continue processing queue
    if (this.prefetchQueue.length > 0) {
      setTimeout(() => this.processPrefetchQueue(), 100);
    }
  }

  /**
   * Check if page is expired
   */
  private isPageExpired(page: LazyLoadPage<T>): boolean {
    return Date.now() - page.loadedAt > this.MAX_CACHE_AGE;
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredPages: number[] = [];

    for (const [pageIndex, page] of this.state.loadedPages) {
      if (this.isPageExpired(page)) {
        expiredPages.push(pageIndex);
      }
    }

    // Remove expired pages
    expiredPages.forEach(pageIndex => {
      this.state.loadedPages.delete(pageIndex);
    });

    // Remove oldest pages if cache is too large
    if (this.state.loadedPages.size > this.config.maxCacheSize) {
      const sortedPages = Array.from(this.state.loadedPages.entries())
        .sort(([, a], [, b]) => a.loadedAt - b.loadedAt);
      
      const pagesToRemove = sortedPages.slice(0, sortedPages.length - this.config.maxCacheSize);
      pagesToRemove.forEach(([pageIndex]) => {
        this.state.loadedPages.delete(pageIndex);
      });
    }

    if (expiredPages.length > 0) {
      this.logger.logDebug(`Cleaned up ${expiredPages.length} expired cache entries`);
    }
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanup(): void {
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const page of this.state.loadedPages.values()) {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(page.items).length;
    }
    
    return totalSize;
  }

  /**
   * Update load time metrics
   */
  private updateLoadTimeMetrics(loadTime: number): void {
    const totalTime = this.metrics.averageLoadTime * (this.metrics.totalRequests - 1) + loadTime;
    this.metrics.averageLoadTime = totalTime / this.metrics.totalRequests;
  }

  /**
   * Dispose lazy loader
   */
  public dispose(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
    
    this.clearCache();
    this.logger.logInfo('Lazy loader disposed');
  }
}
