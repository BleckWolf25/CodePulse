/**
 * @file ANALYZER-WORKER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Worker thread for code complexity analysis
 * Offloads analysis tasks from the main thread to improve UI responsiveness
 * and utilizes multiple CPU cores for faster processing.
 */

// ------------ IMPORTS
import { parentPort } from 'worker_threads';
import { CodeComplexityAnalyzer } from '../metrics/complexity';

// ------------ INTERFACES
// Request message format
interface AnalyzerRequest {
  sourceCode: string;
  language: string;
  options?: Record<string, unknown>;
}

// Response message format
interface AnalyzerResponse {
  metrics: Record<string, number>;
  performance: {
    analysisTime: number;
    memoryUsage: number;
  };
}

// Error response message format
interface AnalyzerErrorResponse {
  error: string;
  details?: unknown;
}

// ------------ MAIN
// Ensure parent port exists
if (!parentPort) {
  throw new Error('This module must be run as a worker thread');
}

// Handle incoming analysis requests
parentPort.on('message', async (message: AnalyzerRequest) => {
  const { sourceCode, language, options } = message;
  
  if (!sourceCode || typeof sourceCode !== 'string') {
    sendError('Invalid source code: must be a non-empty string');
    return;
  }
  
  if (!language || typeof language !== 'string') {
    sendError('Invalid language: must be a non-empty string');
    return;
  }
  
  try {
    const startTime = performance.now();
    
    // Perform code complexity analysis
    const metrics = await CodeComplexityAnalyzer.analyzeComplexity(
      sourceCode,
      language,
      options
    );
    
    // Calculate performance metrics
    const analysisTime = performance.now() - startTime;
    const memoryUsage = process.memoryUsage().heapUsed;
    
    // Send success response
    parentPort?.postMessage({
        metrics,
        performance: {
            analysisTime,
            memoryUsage
        }
    } as unknown as AnalyzerResponse);
    
  } catch (error) {
    sendError(
      error instanceof Error ? error.message : 'Unknown analysis error',
      error
    );
  }
});

/**
 * Helper function to send error responses
 * @param message Error message
 * @param _details Optional error details
 */
function sendError(message: string, _details?: unknown): void {
  parentPort?.postMessage({
    error: message,
  } as AnalyzerErrorResponse);
}

// Log when worker is ready
console.log('Analyzer worker initialized and ready for messages');