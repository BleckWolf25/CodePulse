/**
 * @file BACKGROUND-PROCESSOR.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @summary 
 * Advanced background processing system with worker threads,
 * task queuing, priority scheduling, and resource management.
 * 
 * @since 2.0.0
 * 
 * @requires vscode
 * @requires utils/logger
 * @requires utils/performance-monitor
 */

// ------------ IMPORTS

import * as vscode from 'vscode';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { PerformanceMonitor } from '../utils/performance-monitor';

// ------------ INTERFACES

export interface BackgroundTask<T = any, R = any> {
  id: string;
  type: string;
  priority: TaskPriority;
  data: T;
  timeout: number;
  retryAttempts: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: R;
  error?: Error;
  status: TaskStatus;
  dependencies?: string[];
  tags?: string[];
}

export interface TaskQueue {
  high: BackgroundTask[];
  normal: BackgroundTask[];
  low: BackgroundTask[];
  idle: BackgroundTask[];
}

export interface WorkerPool {
  workers: Map<string, WorkerInstance>;
  maxWorkers: number;
  activeWorkers: number;
  idleWorkers: string[];
  busyWorkers: Map<string, BackgroundTask>;
}

export interface WorkerInstance {
  id: string;
  worker: Worker;
  isIdle: boolean;
  currentTask?: BackgroundTask;
  tasksCompleted: number;
  tasksErrored: number;
  createdAt: number;
  lastUsed: number;
  memoryUsage: number;
}

export interface BackgroundProcessorConfig {
  maxWorkers: number;
  workerIdleTimeout: number;
  taskTimeout: number;
  maxRetries: number;
  enablePriorityScheduling: boolean;
  enableResourceMonitoring: boolean;
  enableTaskPersistence: boolean;
  workerScript?: string;
}

export interface ProcessorMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  queuedTasks: number;
  activeTasks: number;
  averageProcessingTime: number;
  workerUtilization: number;
  memoryUsage: number;
  throughput: number;
}

export enum TaskPriority {
  IDLE = 0,
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum TaskStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

// ------------ TASK PROCESSORS

export interface TaskProcessor<T = any, R = any> {
  type: string;
  process: (data: T) => Promise<R>;
  validate?: (data: T) => boolean;
  estimateTime?: (data: T) => number;
  estimateMemory?: (data: T) => number;
}

// ------------ MAIN CLASS

export class BackgroundProcessor {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private config: BackgroundProcessorConfig;
  private taskQueue: TaskQueue;
  private workerPool: WorkerPool;
  private taskProcessors = new Map<string, TaskProcessor>();
  private activeTasks = new Map<string, BackgroundTask>();
  private completedTasks = new Map<string, BackgroundTask>();
  private metrics: ProcessorMetrics;
  
  // Timers and intervals
  private processingTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  // Processing state
  private isProcessing = false;
  private shutdownRequested = false;
  
  private readonly PROCESSING_INTERVAL = 100; // 100ms
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly METRICS_INTERVAL = 60000; // 1 minute
  private readonly MAX_COMPLETED_TASKS = 1000;

  constructor(private context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance(context);
    this.performanceMonitor = PerformanceMonitor.getInstance(context);
    
    this.config = {
      maxWorkers: Math.max(2, Math.floor(require('os').cpus().length / 2)),
      workerIdleTimeout: 300000, // 5 minutes
      taskTimeout: 60000, // 1 minute
      maxRetries: 3,
      enablePriorityScheduling: true,
      enableResourceMonitoring: true,
      enableTaskPersistence: false
    };

    this.taskQueue = {
      high: [],
      normal: [],
      low: [],
      idle: []
    };

    this.workerPool = {
      workers: new Map(),
      maxWorkers: this.config.maxWorkers,
      activeWorkers: 0,
      idleWorkers: [],
      busyWorkers: new Map()
    };

    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      queuedTasks: 0,
      activeTasks: 0,
      averageProcessingTime: 0,
      workerUtilization: 0,
      memoryUsage: 0,
      throughput: 0
    };

    this.loadConfiguration();
    this.setupDefaultProcessors();
    this.startProcessing();
  }

  /**
   * Register task processor
   */
  public registerProcessor<T, R>(processor: TaskProcessor<T, R>): void {
    this.taskProcessors.set(processor.type, processor);
    this.logger.logInfo(`Task processor registered: ${processor.type}`);
  }

  /**
   * Submit task for background processing
   */
  public async submitTask<T, R>(
    type: string,
    data: T,
    options: {
      priority?: TaskPriority;
      timeout?: number;
      maxRetries?: number;
      dependencies?: string[];
      tags?: string[];
    } = {}
  ): Promise<string> {
    const task: BackgroundTask<T, R> = {
      id: this.generateTaskId(),
      type,
      priority: options.priority || TaskPriority.NORMAL,
      data,
      timeout: options.timeout || this.config.taskTimeout,
      retryAttempts: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      createdAt: Date.now(),
      status: TaskStatus.QUEUED,
      dependencies: options.dependencies,
      tags: options.tags
    };

    // Validate task data if processor has validation
    const processor = this.taskProcessors.get(type);
    if (processor?.validate && !processor.validate(data)) {
      throw new Error(`Invalid task data for type: ${type}`);
    }

    // Add to appropriate queue based on priority
    this.addToQueue(task);
    this.metrics.totalTasks++;
    this.metrics.queuedTasks++;

    this.logger.logDebug(`Task submitted: ${task.id}`, {
      type: task.type,
      priority: TaskPriority[task.priority],
      queueSize: this.getQueueSize()
    });

    return task.id;
  }

  /**
   * Get task status
   */
  public getTaskStatus(taskId: string): BackgroundTask | null {
    return this.activeTasks.get(taskId) || 
           this.completedTasks.get(taskId) || 
           this.findTaskInQueue(taskId) || 
           null;
  }

  /**
   * Cancel task
   */
  public cancelTask(taskId: string): boolean {
    // Check if task is in queue
    const queueTask = this.findTaskInQueue(taskId);
    if (queueTask) {
      this.removeFromQueue(queueTask);
      queueTask.status = TaskStatus.CANCELLED;
      this.completedTasks.set(taskId, queueTask);
      this.metrics.queuedTasks--;
      return true;
    }

    // Check if task is active
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      activeTask.status = TaskStatus.CANCELLED;
      // Worker will handle the cancellation
      return true;
    }

    return false;
  }

  /**
   * Wait for task completion
   */
  public async waitForTask<R>(taskId: string, timeout: number = 30000): Promise<R> {
    return new Promise((resolve, reject) => {
      const checkTask = () => {
        const task = this.getTaskStatus(taskId);
        if (!task) {
          reject(new Error(`Task not found: ${taskId}`));
          return;
        }

        switch (task.status) {
          case TaskStatus.COMPLETED:
            resolve(task.result);
            return;
          case TaskStatus.FAILED:
            reject(task.error || new Error('Task failed'));
            return;
          case TaskStatus.CANCELLED:
            reject(new Error('Task was cancelled'));
            return;
          case TaskStatus.TIMEOUT:
            reject(new Error('Task timed out'));
            return;
        }

        // Task still running, check again
        setTimeout(checkTask, 100);
      };

      // Start checking
      checkTask();

      // Set timeout
      setTimeout(() => {
        reject(new Error('Wait timeout exceeded'));
      }, timeout);
    });
  }

  /**
   * Get processor metrics
   */
  public getMetrics(): ProcessorMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): {
    high: number;
    normal: number;
    low: number;
    idle: number;
    total: number;
  } {
    return {
      high: this.taskQueue.high.length,
      normal: this.taskQueue.normal.length,
      low: this.taskQueue.low.length,
      idle: this.taskQueue.idle.length,
      total: this.getQueueSize()
    };
  }

  /**
   * Get worker status
   */
  public getWorkerStatus(): {
    total: number;
    active: number;
    idle: number;
    workers: Array<{
      id: string;
      isIdle: boolean;
      tasksCompleted: number;
      tasksErrored: number;
      memoryUsage: number;
      uptime: number;
    }>;
  } {
    const workers = Array.from(this.workerPool.workers.values()).map(worker => ({
      id: worker.id,
      isIdle: worker.isIdle,
      tasksCompleted: worker.tasksCompleted,
      tasksErrored: worker.tasksErrored,
      memoryUsage: worker.memoryUsage,
      uptime: Date.now() - worker.createdAt
    }));

    return {
      total: this.workerPool.workers.size,
      active: this.workerPool.activeWorkers,
      idle: this.workerPool.idleWorkers.length,
      workers
    };
  }

  /**
   * Process task queue
   */
  private async processQueue(): Promise<void> {
    if (this.shutdownRequested || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get next task based on priority and dependencies
      const task = this.getNextTask();
      if (!task) {
        this.isProcessing = false;
        return;
      }

      // Get or create worker
      const worker = await this.getAvailableWorker();
      if (!worker) {
        this.isProcessing = false;
        return; // No workers available
      }

      // Start task processing
      await this.processTask(task, worker);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'background-processor',
        operation: 'process-queue'
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get next task from queue
   */
  private getNextTask(): BackgroundTask | null {
    const queues = this.config.enablePriorityScheduling 
      ? [this.taskQueue.high, this.taskQueue.normal, this.taskQueue.low, this.taskQueue.idle]
      : [this.taskQueue.normal, this.taskQueue.high, this.taskQueue.low, this.taskQueue.idle];

    for (const queue of queues) {
      for (let i = 0; i < queue.length; i++) {
        const task = queue[i];
        
        // Check dependencies
        if (this.areDependenciesMet(task)) {
          queue.splice(i, 1);
          this.metrics.queuedTasks--;
          return task;
        }
      }
    }

    return null;
  }

  /**
   * Check if task dependencies are met
   */
  private areDependenciesMet(task: BackgroundTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const depTask = this.completedTasks.get(depId);
      return depTask && depTask.status === TaskStatus.COMPLETED;
    });
  }

  /**
   * Get available worker
   */
  private async getAvailableWorker(): Promise<WorkerInstance | null> {
    // Try to get idle worker
    if (this.workerPool.idleWorkers.length > 0) {
      const workerId = this.workerPool.idleWorkers.pop()!;
      const worker = this.workerPool.workers.get(workerId);
      if (worker) {
        worker.isIdle = false;
        this.workerPool.activeWorkers++;
        return worker;
      }
    }

    // Create new worker if under limit
    if (this.workerPool.workers.size < this.workerPool.maxWorkers) {
      return this.createWorker();
    }

    return null;
  }

  /**
   * Create new worker
   */
  private async createWorker(): Promise<WorkerInstance> {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workerScript = this.config.workerScript || path.join(__dirname, 'worker.js');
    const worker = new Worker(workerScript, {
      workerData: { workerId }
    });

    const workerInstance: WorkerInstance = {
      id: workerId,
      worker,
      isIdle: false,
      tasksCompleted: 0,
      tasksErrored: 0,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      memoryUsage: 0
    };

    // Setup worker message handling
    worker.on('message', (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(workerId, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(workerId, code);
    });

    this.workerPool.workers.set(workerId, workerInstance);
    this.workerPool.activeWorkers++;

    this.logger.logInfo(`Worker created: ${workerId}`);
    return workerInstance;
  }

  /**
   * Process task with worker
   */
  private async processTask(task: BackgroundTask, worker: WorkerInstance): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.startedAt = Date.now();
    
    this.activeTasks.set(task.id, task);
    this.workerPool.busyWorkers.set(worker.id, task);
    worker.currentTask = task;
    worker.lastUsed = Date.now();
    this.metrics.activeTasks++;

    // Send task to worker
    worker.worker.postMessage({
      type: 'process-task',
      task: {
        id: task.id,
        type: task.type,
        data: task.data,
        timeout: task.timeout
      }
    });

    this.logger.logDebug(`Task started: ${task.id}`, {
      workerId: worker.id,
      type: task.type
    });
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerId: string, message: any): void {
    const worker = this.workerPool.workers.get(workerId);
    if (!worker) {return;}

    switch (message.type) {
      case 'task-completed':
        this.handleTaskCompleted(workerId, message.taskId, message.result);
        break;
      case 'task-failed':
        this.handleTaskFailed(workerId, message.taskId, message.error);
        break;
      case 'memory-usage':
        worker.memoryUsage = message.usage;
        break;
    }
  }

  /**
   * Handle task completion
   */
  private handleTaskCompleted(workerId: string, taskId: string, result: any): void {
    const task = this.activeTasks.get(taskId);
    const worker = this.workerPool.workers.get(workerId);
    
    if (task && worker) {
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.completedAt = Date.now();
      
      this.activeTasks.delete(taskId);
      this.completedTasks.set(taskId, task);
      this.workerPool.busyWorkers.delete(workerId);
      
      worker.currentTask = undefined;
      worker.tasksCompleted++;
      worker.isIdle = true;
      worker.lastUsed = Date.now();
      
      this.workerPool.idleWorkers.push(workerId);
      this.workerPool.activeWorkers--;
      this.metrics.activeTasks--;
      this.metrics.completedTasks++;

      // Update processing time metrics
      if (task.startedAt) {
        const processingTime = task.completedAt - task.startedAt;
        this.updateProcessingTimeMetrics(processingTime);
      }

      this.logger.logDebug(`Task completed: ${taskId}`, {
        workerId,
        processingTime: task.completedAt - (task.startedAt || task.completedAt)
      });
    }
  }

  /**
   * Handle task failure
   */
  private handleTaskFailed(workerId: string, taskId: string, error: any): void {
    const task = this.activeTasks.get(taskId);
    const worker = this.workerPool.workers.get(workerId);
    
    if (task && worker) {
      task.error = new Error(error.message || 'Task failed');
      task.retryAttempts++;
      
      // Retry if attempts remaining
      if (task.retryAttempts < task.maxRetries) {
        task.status = TaskStatus.QUEUED;
        this.addToQueue(task);
        this.metrics.queuedTasks++;
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = Date.now();
        this.completedTasks.set(taskId, task);
        this.metrics.failedTasks++;
      }
      
      this.activeTasks.delete(taskId);
      this.workerPool.busyWorkers.delete(workerId);
      
      worker.currentTask = undefined;
      worker.tasksErrored++;
      worker.isIdle = true;
      worker.lastUsed = Date.now();
      
      this.workerPool.idleWorkers.push(workerId);
      this.workerPool.activeWorkers--;
      this.metrics.activeTasks--;

      this.logger.logWarn(`Task failed: ${taskId}`, {
        workerId,
        error: error.message,
        retryAttempts: task.retryAttempts,
        maxRetries: task.maxRetries
      });
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, error: Error): void {
    this.logger.logError(error, {
      component: 'background-processor',
      operation: 'worker-error',
      metadata: { workerId }
    });
    
    // Remove worker and restart if needed
    this.removeWorker(workerId);
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string, code: number): void {
    this.logger.logInfo(`Worker exited: ${workerId}`, { exitCode: code });
    this.removeWorker(workerId);
  }

  /**
   * Remove worker
   */
  private removeWorker(workerId: string): void {
    const worker = this.workerPool.workers.get(workerId);
    if (!worker) {return;}

    // Handle current task if any
    if (worker.currentTask) {
      const task = worker.currentTask;
      task.status = TaskStatus.QUEUED;
      this.addToQueue(task);
      this.activeTasks.delete(task.id);
      this.metrics.queuedTasks++;
      this.metrics.activeTasks--;
    }

    // Cleanup worker references
    this.workerPool.workers.delete(workerId);
    this.workerPool.busyWorkers.delete(workerId);
    
    const idleIndex = this.workerPool.idleWorkers.indexOf(workerId);
    if (idleIndex !== -1) {
      this.workerPool.idleWorkers.splice(idleIndex, 1);
    } else {
      this.workerPool.activeWorkers--;
    }

    // Terminate worker
    try {
      worker.worker.terminate();
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'background-processor',
        operation: 'terminate-worker'
      });
    }
  }

  /**
   * Add task to appropriate queue
   */
  private addToQueue(task: BackgroundTask): void {
    switch (task.priority) {
      case TaskPriority.CRITICAL:
      case TaskPriority.HIGH:
        this.taskQueue.high.push(task);
        break;
      case TaskPriority.NORMAL:
        this.taskQueue.normal.push(task);
        break;
      case TaskPriority.LOW:
        this.taskQueue.low.push(task);
        break;
      case TaskPriority.IDLE:
        this.taskQueue.idle.push(task);
        break;
    }
  }

  /**
   * Remove task from queue
   */
  private removeFromQueue(task: BackgroundTask): void {
    const queues = [this.taskQueue.high, this.taskQueue.normal, this.taskQueue.low, this.taskQueue.idle];

    for (const queue of queues) {
      const index = queue.findIndex(t => t.id === task.id);
      if (index !== -1) {
        queue.splice(index, 1);
        break;
      }
    }
  }

  /**
   * Find task in queue
   */
  private findTaskInQueue(taskId: string): BackgroundTask | null {
    const queues = [this.taskQueue.high, this.taskQueue.normal, this.taskQueue.low, this.taskQueue.idle];

    for (const queue of queues) {
      const task = queue.find(t => t.id === taskId);
      if (task) {return task;}
    }

    return null;
  }

  /**
   * Get total queue size
   */
  private getQueueSize(): number {
    return this.taskQueue.high.length +
           this.taskQueue.normal.length +
           this.taskQueue.low.length +
           this.taskQueue.idle.length;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.queuedTasks = this.getQueueSize();
    this.metrics.activeTasks = this.activeTasks.size;
    this.metrics.workerUtilization = this.workerPool.workers.size > 0
      ? (this.workerPool.activeWorkers / this.workerPool.workers.size) * 100
      : 0;

    // Calculate throughput (tasks per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentTasks = Array.from(this.completedTasks.values())
      .filter(task => task.completedAt && task.completedAt > oneMinuteAgo);
    this.metrics.throughput = recentTasks.length;
  }

  /**
   * Update processing time metrics
   */
  private updateProcessingTimeMetrics(processingTime: number): void {
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.completedTasks - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.completedTasks;
  }

  /**
   * Setup default task processors
   */
  private setupDefaultProcessors(): void {
    // Data analysis processor
    this.registerProcessor({
      type: 'data-analysis',
      process: async (data: any) => {
        // TODO: Data analysis
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        return { analyzed: true, result: data };
      },
      validate: (data: any) => data && typeof data === 'object',
      estimateTime: (data: any) => Object.keys(data).length * 10,
      estimateMemory: (data: any) => JSON.stringify(data).length
    });

    // File processing processor
    this.registerProcessor({
      type: 'file-processing',
      process: async (data: { filePath: string; operation: string }) => {
        // TODO: Real file processing 
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
        return { processed: true, filePath: data.filePath };
      },
      validate: (data: any) => data && data.filePath && data.operation,
      estimateTime: () => 1500,
      estimateMemory: () => 1024 * 1024 // 1MB
    });

    // Report generation processor
    this.registerProcessor({
      type: 'report-generation',
      process: async (data: any) => {
        // Simulate report generation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));
        return { report: 'generated', data };
      },
      validate: (data: any) => data && data.type,
      estimateTime: (data: any) => data.complexity * 1000,
      estimateMemory: (data: any) => data.size * 1024
    });
  }

  /**
   * Start processing
   */
  private startProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, this.PROCESSING_INTERVAL);

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.METRICS_INTERVAL);

    this.logger.logInfo('Background processor started', {
      maxWorkers: this.config.maxWorkers,
      processingInterval: this.PROCESSING_INTERVAL
    });
  }

  /**
   * Stop processing
   */
  private stopProcessing(): void {
    this.shutdownRequested = true;

    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
  }

  /**
   * Perform cleanup
   */
  private performCleanup(): void {
    const now = Date.now();

    // Cleanup completed tasks
    if (this.completedTasks.size > this.MAX_COMPLETED_TASKS) {
      const sortedTasks = Array.from(this.completedTasks.entries())
        .sort(([, a], [, b]) => (a.completedAt || 0) - (b.completedAt || 0));

      const tasksToRemove = sortedTasks.slice(0, sortedTasks.length - this.MAX_COMPLETED_TASKS);
      tasksToRemove.forEach(([taskId]) => {
        this.completedTasks.delete(taskId);
      });
    }

    // Cleanup idle workers
    const idleWorkersToRemove: string[] = [];
    for (const workerId of this.workerPool.idleWorkers) {
      const worker = this.workerPool.workers.get(workerId);
      if (worker && now - worker.lastUsed > this.config.workerIdleTimeout) {
        idleWorkersToRemove.push(workerId);
      }
    }

    idleWorkersToRemove.forEach(workerId => {
      this.removeWorker(workerId);
    });

    if (idleWorkersToRemove.length > 0) {
      this.logger.logInfo(`Cleaned up ${idleWorkersToRemove.length} idle workers`);
    }
  }

  /**
   * Load configuration
   */
  private loadConfiguration(): void {
    try {
      const stored = this.context.globalState.get<Partial<BackgroundProcessorConfig>>('backgroundProcessorConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'background-processor',
        operation: 'load-configuration'
      });
    }
  }

  /**
   * Save configuration
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('backgroundProcessorConfig', this.config);
    } catch (error) {
      this.logger.logError(error as Error, {
        component: 'background-processor',
        operation: 'save-configuration'
      });
    }
  }

  /**
   * Update configuration
   */
  public updateConfiguration(newConfig: Partial<BackgroundProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();

    // Update worker pool size if changed
    if (newConfig.maxWorkers && newConfig.maxWorkers !== this.workerPool.maxWorkers) {
      this.workerPool.maxWorkers = newConfig.maxWorkers;

      // Remove excess workers if needed
      if (this.workerPool.workers.size > newConfig.maxWorkers) {
        const workersToRemove = Array.from(this.workerPool.workers.keys())
          .slice(newConfig.maxWorkers);

        workersToRemove.forEach(workerId => {
          const worker = this.workerPool.workers.get(workerId);
          if (worker && worker.isIdle) {
            this.removeWorker(workerId);
          }
        });
      }
    }
  }

  /**
   * Shutdown processor
   */
  public async shutdown(timeout: number = 30000): Promise<void> {
    this.logger.logInfo('Background processor shutdown initiated');
    this.stopProcessing();

    // Wait for active tasks to complete or timeout
    const startTime = Date.now();
    while (this.activeTasks.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force terminate remaining workers
    const workerIds = Array.from(this.workerPool.workers.keys());
    await Promise.all(workerIds.map(async workerId => {
      try {
        const worker = this.workerPool.workers.get(workerId);
        if (worker) {
          await worker.worker.terminate();
        }
      } catch (error) {
        this.logger.logError(error as Error, {
          component: 'background-processor',
          operation: 'shutdown-worker'
        });
      }
    }));

    this.workerPool.workers.clear();
    this.activeTasks.clear();
    this.taskQueue = { high: [], normal: [], low: [], idle: [] };

    this.logger.logInfo('Background processor shutdown completed');
  }

  /**
   * Dispose processor
   */
  public dispose(): void {
    this.shutdown().catch(error => {
      this.logger.logError(error as Error, {
        component: 'background-processor',
        operation: 'dispose'
      });
    });
  }
}
