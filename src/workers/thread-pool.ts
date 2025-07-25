/**
 * @file THREAD-POOL.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Thread pool implementation for executing concurrent tasks
 * across multiple worker threads.
 * Promise-based tasks on a managed pool of worker threads for parallelism.
 */

// ------------ IMPORTS
import { Worker } from 'worker_threads';
import * as path from 'path';

// ------------ INTERFACES
// Worker thread with busy status
export interface ThreadWorker {
  worker: Worker;
  busy: boolean;
}

// ------------ MAIN
export class ThreadPool {
  // Collection of worker threads with their busy status
  private workers: ThreadWorker[] = [];
  
  // Queue of tasks waiting for an available worker
  private queue: Array<() => Promise<void>> = [];
  
  /**
   * Creates a new thread pool
   * 
   * @param size - Number of worker threads to create in the pool
   * @param workerScript - Path to the worker script file
   */
  constructor(size: number, workerScript: string) {
    // Initialize the specified number of workers
    for (let i = 0; i < size; i++) {
      const worker = new Worker(path.resolve(workerScript));
      this.workers.push({ worker, busy: false });
      this.setupWorker(worker);
    }
  }

  /**
   * Sets up event handlers for a worker thread
   * 
   * @param worker - The worker thread to configure
   */
  private setupWorker(worker: Worker): void {
    // Handle worker errors
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      
      // Mark worker as available again
      const threadWorker = this.workers.find(w => w.worker === worker);
      if (threadWorker) {
        threadWorker.busy = false;
      }
      
      // Process the next task in the queue
      this.processQueue();
    });

    // Clean up worker reference when worker exits
    worker.on('exit', () => {
      this.workers = this.workers.filter(w => w.worker !== worker);
    });
  }

  /**
   * Executes a task using an available worker or queues it for later execution
   * 
   * @param task - A function that returns a Promise representing the task to execute
   * @returns A promise that resolves with the task result or rejects with an error
   */
  public async execute<T>(task: () => Promise<T>): Promise<T> {
    // Find an available worker
    const availableWorker = this.workers.find(w => !w.busy);
    
    if (availableWorker) {
      // Execute the task immediately if a worker is available
      availableWorker.busy = true;
      return this.runTask(availableWorker.worker, task);
    }

    // Queue the task for later execution if no worker is available
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.execute(task);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Executes a task on a specific worker
   * 
   * @param worker - The worker thread to use
   * @param task - A function that returns a Promise representing the task to execute
   * @returns A promise that resolves with the task result or rejects with an error
   */
  private async runTask<T>(worker: Worker, task: () => Promise<T>): Promise<T> {
    try {
      // Execute the task
      const result = await task();
      
      // Mark the worker as available again
      const threadWorker = this.workers.find(w => w.worker === worker);
      if (threadWorker) {
        threadWorker.busy = false;
      }
      
      // Process the next task in the queue
      this.processQueue();
      
      return result;
    } catch (error) {
      // Re-throw the error to be handled by the caller
      throw error;
    }
  }

  /**
   * Processes the next task in the queue if one exists
   */
  private processQueue(): void {
    if (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        nextTask();
      }
    }
  }

  /**
   * Terminates all workers and clears the task queue
   */
  public terminate(): void {
    this.workers.forEach(({ worker }) => worker.terminate());
    this.workers = [];
    this.queue = [];
  }
}