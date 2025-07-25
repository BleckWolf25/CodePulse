
/**
 * @file WORKER-MANAGER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Worker thread pool implementation for delegating CPU-intensive tasks
 * to a managed pool of worker threads.
 * Manages a fixed-size pool of workers, queues incoming tasks,
 * and distributes them to available workers as they become free.
 */

// ------------ IMPORTS
import { Worker } from 'worker_threads';
import * as path from 'path';

// ------------ INTERFACES
// Task to be executed by a worker thread
export interface WorkerTask {
  type: 'compress' | 'decompress' | 'analyze';
  data: unknown;
  options?: Record<string, unknown>;
}

// ------------ MAIN
/**
 * Manages a pool of worker threads for parallel task execution
 */
export class WorkerThreadPool {

  /**
   * Executes a task using an available worker or queues it for later execution
   * 
   * @param task - The task to execute
   * @returns A promise that resolves with the task result or rejects with an error
   */
  publicExecuteTask(_arg0: { type: string; data: unknown; options?: Record<string, unknown> | undefined; }) {
      throw new Error('Method not implemented.');
  }

  // Create an instance of the worker thread pool
  private workerPool = new WorkerThreadPool(4, './cache-worker.ts');

  // Collection of worker threads in the pool
  private workers: Worker[] = [];
  
  // Queue of pending tasks waiting for an available worker
  private queue: Array<{
    task: WorkerTask;
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
  }> = [];
  
  // Tracks which workers are currently processing tasks
  private activeWorkers = new Map<Worker, boolean>();

  /**
   * Creates a new worker thread pool
   * 
   * @param size - Number of worker threads to create in the pool
   * @param workerScript - Path to the worker script file
   */
  constructor(size: number, workerScript: string) {
    // Initialize the specified number of workers
    for (let i = 0; i < size; i++) {
      const worker = new Worker(path.resolve(workerScript));
      this.setupWorker(worker);
      this.workers.push(worker);
      this.activeWorkers.set(worker, false);
    }
  }

  /**
   * Sets up event handlers for a worker thread
   * 
   * @param worker - The worker thread to configure
   */
  private setupWorker(worker: Worker): void {
    // When a worker completes a task
    worker.on('message', () => {
      // Mark the worker as available
      this.activeWorkers.set(worker, false);
      
      // Process the next task in the queue if one exists
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.executeTaskOnWorker(worker, next);
      }
    });

    // Handle worker errors
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.activeWorkers.set(worker, false);
    });
  }

  /**
   * Executes a task on a specific worker
   * 
   * @param worker - The worker thread to use
   * @param task - The task execution context including resolution handlers
   */
  private executeTaskOnWorker(
    worker: Worker, 
    task: { 
      task: WorkerTask; 
      resolve: (value: unknown) => void; 
      reject: (reason: Error) => void;
    }
  ): void {
    // Mark the worker as busy
    this.activeWorkers.set(worker, true);
    
    // Send the task to the worker
    worker.postMessage(task.task);
    
    // Set up one-time handlers for this specific task
    worker.once('message', (result) => {
      if (result.error) {
        task.reject(new Error(result.error));
      } else {
        task.resolve(result);
      }
    });

    worker.once('error', (error) => {
      task.reject(error);
    });
  }

  /**
   * Executes a task using an available worker or queues it for later execution
   * 
   * @param task - The task to execute
   * @returns A promise that resolves with the task result or rejects with an error
   */
  public async executeTask(task: WorkerTask): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Find an available worker
      const availableWorker = this.workers.find(w => !this.activeWorkers.get(w));
      
      if (availableWorker) {
        // Execute the task immediately if a worker is available
        this.executeTaskOnWorker(availableWorker, { task, resolve, reject });
      } else {
        // Queue the task for later execution
        this.queue.push({ task, resolve, reject });
      }
    });
  }

  /**
   * Terminates all workers and clears the task queue
   */
  public terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.queue = [];
  }

  /**
   * Gets the current size of the worker pool
   */
  public get poolSize(): number {
    return this.workers.length;
  }

  /**
   * Gets the current number of queued tasks
   */
  public get queueLength(): number {
    return this.queue.length;
  }
}