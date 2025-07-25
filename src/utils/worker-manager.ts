import { ErrorHandler } from './error-handler';

export class WorkerManager {
  private readonly timeoutMs = 30000; // 30 second timeout
  private errorHandler = ErrorHandler.getInstance();

  public async executeWithTimeout<T>(work: () => Promise<T>): Promise<T> {
    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Worker timeout')), this.timeoutMs);
      });

      return await Promise.race([work(), timeout]);
    } catch (error) {
      this.errorHandler.handleWorkerError(error as Error, 'worker.execute');
      throw error;
    }
  }

  public async executeWithRetry<T>(
    work: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithTimeout(work);
      } catch (error) {
        if (attempt === maxRetries) {throw error;}
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw new Error('Retry failed');
  }
}
