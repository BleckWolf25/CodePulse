/**
 * @file COMPLEXITY.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Complexity Analysis System
 * Provides comprehensive code complexity analysis,
 * including AST-based analysis for TypeScript/JavaScript,
 * pattern-based analysis for Python, and general heuristic fallback for other languages.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { Worker } from 'worker_threads';
import { MetricsStorage } from './storage';
import { TypeScriptAnalyzer } from './analyzers/typescript-analyzer';
import { PythonAnalyzer } from './analyzers/python-analyzer';

// ------------ INTERFACES
// Cognitive Complexity Interface
export interface CognitiveComplexity {
  score: number;
  hotspots: Array<{
    line: number;
    score: number;
    reason: string;
  }>;
}

// Historical Trend Interface
export interface HistoricalTrend {
  date: string;
  complexity: number;
  churn: number;
  cognitive: number;
}

// Complexity Metrics Interface
export interface ComplexityMetrics {
  totalComplexity: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  halsteadMetrics: {
    difficulty: number;
    volume: number;
    effort: number;
  };
  performance?: PerformanceMetrics;
  cognitiveComplexity?: CognitiveComplexity;
  historicalTrend?: HistoricalTrend[];
}

// Performance Metrics Interface
interface PerformanceMetrics {
  analysisTime: number;
  memoryUsage: number;
  nodeCount: number;
}

export interface LanguageConfig {
  complexityWeights: {
    loops: number;
    conditionals: number;
    functions: number;
    classes: number;
  };
  thresholds: {
    cyclomatic: number;
    maintainability: number;
    halstead: number;
  };
}

// ------------ CLASS
/**
 * Central complexity analysis engine with language-specific handlers
 * @class
 */
export class CodeComplexityAnalyzer {
  private static cache: Map<string, {
    metrics: ComplexityMetrics;
    timestamp: number;
    hash: string;
    size: number;
  }> = new Map();

  private static readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private static currentCacheSize = 0;
  private static readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  private static workerPool: Worker[] = [];
  private static readonly MAX_WORKERS = Math.max(1, Math.floor(os.cpus().length / 2));
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private static languageConfigs: Record<string, LanguageConfig> = {
    typescript: {
      complexityWeights: {
        loops: 1.5,
        conditionals: 1.0,
        functions: 1.0,
        classes: 2.0
      },
      thresholds: {
        cyclomatic: 15,
        maintainability: 65,
        halstead: 25
      }
    },
    javascript: {
      complexityWeights: {
        loops: 1.5,
        conditionals: 1.0,
        functions: 1.0,
        classes: 1.5
      },
      thresholds: {
        cyclomatic: 12,
        maintainability: 70,
        halstead: 20
      }
    },
    python: {
      complexityWeights: {
        loops: 1.2,
        conditionals: 1.0,
        functions: 1.0,
        classes: 1.8
      },
      thresholds: {
        cyclomatic: 20,
        maintainability: 60,
        halstead: 30
      }
    }
  };

  private static typeScriptAnalyzer = new TypeScriptAnalyzer();
  private static pythonAnalyzer = new PythonAnalyzer();

  private static initializeWorkerPool(): void {
    if (this.workerPool.length > 0) {return;}
    
    for (let i = 0; i < this.MAX_WORKERS; i++) {
      const worker = new Worker(path.join(__dirname, '../workers/analyzer-worker.js'));
      worker.on('error', this.handleWorkerError);
      this.workerPool.push(worker);
    }
  }

  private static getWorker(): Worker {
    this.initializeWorkerPool();
    return this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
  }

  // ------------ PUBLIC METHODS

  /**
   * Lightweight complexity estimation for large files
   * @param sourceCode - Full text content of the file
   * @param _language - File language identifier
   * @returns Approximate complexity metrics
   * @remarks
   * - Uses line count heuristics for performance
   * - Caps complexity at 20 for processing safety
   * - Recommended for files >500 lines or during editing
   */
  public static quickAnalyze(sourceCode: string, _language: string): ComplexityMetrics {

    // Simple line-based complexity estimation
    const lines = sourceCode.split('\n');
    const lineCount = lines.length;

    // Heuristic: 1 complexity point per 50 lines (min 1, max 20)
    const cyclomaticComplexity = Math.min(
      20, // Performance cap for large files
      Math.max(
        1, // Minimum complexity baseline
        Math.floor(lineCount / 50)
      )
    );

    return {
      totalComplexity: cyclomaticComplexity,
      cyclomaticComplexity,
      maintainabilityIndex: Math.max(0, 100 - cyclomaticComplexity),
      halsteadMetrics: {
        difficulty: cyclomaticComplexity / 5,
        volume: lineCount,
        effort: cyclomaticComplexity * lineCount
      }
    };
  }

  /**
   * Main complexity analysis entry point
   * @param sourceCode - Full text content of the file
   * @param language - Programming language identifier
   * @returns Language-specific complexity metrics
   * @remarks
   * - Attempts AST analysis for supported languages
   * - Falls back to pattern matching for common languages
   * - Uses general heuristics as final fallback
   */
  public static async analyzeComplexity(sourceCode: string, language: string = 'typescript', _options?: Record<string, unknown> | undefined): Promise<ComplexityMetrics> {
    const startTime = performance.now();
    const codeSize = new TextEncoder().encode(sourceCode).length;

    try {
      // Use worker pool for large files
      if (codeSize > this.CHUNK_SIZE) {
        return await this.analyzeWithWorker(sourceCode, language);
      }

      // Check cache with memory pressure handling
      const cacheKey = this.getCacheKey(sourceCode);
      const cached = this.getCachedResult(cacheKey, codeSize);
      if (cached) {return cached;}

      const config = this.languageConfigs[language.toLowerCase()] || this.languageConfigs.typescript;
      let metrics: ComplexityMetrics;

      // Use appropriate language analyzer
      if (this.typeScriptAnalyzer.supportsLanguage(language)) {
        metrics = this.typeScriptAnalyzer.analyze(sourceCode, config);
      } else if (this.pythonAnalyzer.supportsLanguage(language)) {
        metrics = this.pythonAnalyzer.analyze(sourceCode, config);
      } else {
        metrics = this.fallbackComplexityAnalysis(sourceCode, config);
      }

      // Cognitive complexity
      metrics.cognitiveComplexity = this.analyzeCognitiveComplexity(sourceCode, language);

      // Historical trend analysis is disabled (TypeScript dependency removed)
      // This feature can be re-enabled when TypeScript is available

      // Performance metrics
      const endTime = performance.now();
      metrics.performance = {
        analysisTime: endTime - startTime,
        memoryUsage: process.memoryUsage().heapUsed,
        nodeCount: this.countNodes(sourceCode)
      };

      // Cache with size tracking
      this.cacheResult(cacheKey, metrics, codeSize);
      return metrics;

    } catch (error) {
      throw this.handleAnalysisError(error as Error, 'analyzeComplexity');
    }
  }

  private static async analyzeWithWorker(sourceCode: string, language: string): Promise<ComplexityMetrics> {
    try {
      const chunks = this.chunkCode(sourceCode);
      const results = await Promise.allSettled(
        chunks.map(chunk => this.processChunk(chunk, language))
      );
      
      const validResults = results
        .filter((r): r is PromiseFulfilledResult<ComplexityMetrics> => r.status === 'fulfilled')
        .map(r => r.value);
        
      if (validResults.length === 0) {
        throw new Error('All chunk analyses failed');
      }
      
      return this.mergeResults(validResults);
    } catch (error) {
      // Fallback to non-worker analysis
      return this.fallbackComplexityAnalysis(sourceCode, this.languageConfigs[language]);
    }
  }

  private static chunkCode(sourceCode: string): string[] {
    const chunks: string[] = [];
    let position = 0;
    
    while (position < sourceCode.length) {
      // Find nearest statement boundary
      let end = position + this.CHUNK_SIZE;
      if (end < sourceCode.length) {
        end = sourceCode.lastIndexOf(';', end) + 1;
        if (end <= position) {end = position + this.CHUNK_SIZE;}
      }
      
      chunks.push(sourceCode.slice(position, end));
      position = end;
    }
    
    return chunks;
  }

  private static async processChunk(chunk: string, language: string): Promise<ComplexityMetrics> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      
      const timeout = setTimeout(() => {
        reject(new Error('Worker timeout'));
      }, 30000);

      worker.once('message', (result) => {
        clearTimeout(timeout);
        resolve(result.metrics);
      });

      worker.postMessage({ sourceCode: chunk, language });
    });
  }

  private static mergeResults(results: ComplexityMetrics[]): ComplexityMetrics {
    return results.reduce((merged, current) => ({
      totalComplexity: merged.totalComplexity + current.totalComplexity,
      cyclomaticComplexity: Math.max(merged.cyclomaticComplexity, current.cyclomaticComplexity),
      maintainabilityIndex: Math.min(merged.maintainabilityIndex, current.maintainabilityIndex),
      halsteadMetrics: {
        difficulty: Math.max(merged.halsteadMetrics.difficulty, current.halsteadMetrics.difficulty),
        volume: merged.halsteadMetrics.volume + current.halsteadMetrics.volume,
        effort: merged.halsteadMetrics.effort + current.halsteadMetrics.effort
      }
    }));
  }

  private static getCachedResult(key: string, _size: number): ComplexityMetrics | null {
    const cached = this.cache.get(key);
    if (!cached) {return null;}

    if (!this.isValidCache(cached) || Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      this.currentCacheSize -= cached.size;
      return null;
    }

    return cached.metrics;
  }

  private static isValidCache(entry: unknown): entry is { metrics: ComplexityMetrics; timestamp: number } {
    if (!entry || typeof entry !== 'object') {
        return false;
    }

    const typedEntry = entry as Record<string, unknown>;
    return 'metrics' in typedEntry && 
           'timestamp' in typedEntry &&
           typeof typedEntry.timestamp === 'number' &&
           this.isValidMetrics(typedEntry.metrics);
  }

  private static isValidMetrics(metrics: unknown): metrics is ComplexityMetrics {
    if (!metrics || typeof metrics !== 'object') {
        return false;
    }

    const requiredProps = [
        'totalComplexity',
        'cyclomaticComplexity',
        'maintainabilityIndex',
        'halsteadMetrics'
    ];

    return requiredProps.every(prop => prop in metrics);
  }

  private static cacheResult(key: string, metrics: ComplexityMetrics, size: number): void {
    // Implement LRU eviction under memory pressure
    while (this.currentCacheSize + size > this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      const evicted = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.currentCacheSize -= evicted.size;
    }

    this.cache.set(key, {
      metrics,
      timestamp: Date.now(),
      hash: key,
      size
    });
    this.currentCacheSize += size;
  }

  private static handleWorkerError(error: Error): void {
    console.error('Worker error:', error);
    // Restart worker if needed
    const index = this.workerPool.findIndex(w => w.listeners('error').includes(this.handleWorkerError));
    if (index !== -1) {
      this.workerPool[index].terminate();
      this.workerPool[index] = new Worker(path.join(__dirname, '../workers/analyzer-worker.js'));
      this.workerPool[index].on('error', this.handleWorkerError);
    }
  }

  private static initializeCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.CACHE_TTL) {
          this.cache.delete(key);
          this.currentCacheSize -= entry.size;
        }
      }
    }, this.CLEANUP_INTERVAL);
  }

  static {
    // Initialize cleanup on class load
    this.initializeCleanup();
  }

    // ------------ FALLBACK ANALYZERS

  /**
   * General-purpose complexity heuristics
   * @param sourceCode - File content for analysis
   * @param config - Language-specific configuration
   * @returns Conservative complexity estimates
   * @remarks
   * - Used for unsupported languages
   * - Combines line counts and basic pattern matching
   * - Caps complexity at 50 for safety
   */
  private static fallbackComplexityAnalysis(sourceCode: string, config: LanguageConfig): ComplexityMetrics {
    const lines = sourceCode.split('\n');
    const lineCount = lines.length;
    let cyclomaticComplexity = 1;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || trimmedLine === '') { continue; }

      // Common control flow patterns
      if (/\b(if|else|switch|case|for|while|do|try|catch|except)\b/.test(trimmedLine)) {
        cyclomaticComplexity += config.complexityWeights.conditionals;
      }

      // Logical operator detection
      const operators = trimmedLine.match(/(\&\&)|(\|\|)|(\band\b)|(\bor\b)/g) || [];
      cyclomaticComplexity += operators.length * config.complexityWeights.conditionals;
    }

    // Conservative complexity cap
    cyclomaticComplexity = Math.min(cyclomaticComplexity, config.thresholds.cyclomatic);

    // General maintainability formula
    const maintainabilityIndex = Math.max(0, 100 - (cyclomaticComplexity * 0.25) - (0.05 * lineCount));

    return {
      totalComplexity: cyclomaticComplexity,
      cyclomaticComplexity,
      maintainabilityIndex,
      halsteadMetrics: {
        difficulty: cyclomaticComplexity / 10,
        volume: lineCount,
        effort: cyclomaticComplexity * lineCount
      }
    };
  }

  // ------------ RECOMMENDATION ENGINE

  /**
   * Generates code quality recommendations
   * @param metrics - Complexity metrics to evaluate
   * @returns Prioritized improvement suggestions
   * @remarks
   * - Thresholds based on industry standards
   * - Prioritizes most critical issues first
   * - Returns positive feedback when metrics are good
   */
  public static getComplexityRecommendations(metrics: ComplexityMetrics): string[] {
    const recommendations: string[] = [];

    // Safely extract metrics with fallback values
    const cyclomaticComplexity = metrics?.cyclomaticComplexity ?? 1;
    const maintainabilityIndex = metrics?.maintainabilityIndex ?? 100;
    const halsteadDifficulty = metrics?.halsteadMetrics?.difficulty ?? 1;

    // Cyclomatic complexity thresholds
    if (cyclomaticComplexity > 15) {
      recommendations.push("High cyclomatic complexity. Refactor into smaller functions.");
    } else if (cyclomaticComplexity > 10) {
      recommendations.push("Moderate complexity. Simplify nested conditions.");
    }

    // Maintainability thresholds
    if (maintainabilityIndex < 40) {
      recommendations.push("Low maintainability. Break into smaller modules.");
    } else if (maintainabilityIndex < 60) {
      recommendations.push("Moderate maintainability. Improve documentation.");
    }

    // Cognitive complexity thresholds
    if (halsteadDifficulty > 30) {
      recommendations.push("High cognitive complexity. Simplify logic.");
    }

    return recommendations.length ? recommendations :
      ["Code quality metrics are within recommended ranges."];
  }

  // ------------ HELPER METHODS

  /**
   * Generates a cache key for the given source code
   * @param sourceCode - Source code to hash
   * @returns MD5 hash of the source code
   */
  private static getCacheKey(sourceCode: string): string {
    return crypto.createHash('md5').update(sourceCode).digest('hex');
  }

  /**
   * Counts the number of nodes in the AST
   * @param sourceCode - Source code to analyze
   * @returns Number of nodes in the AST
   */
  private static countNodes(sourceCode: string): number {
    // Simple heuristic-based node counting (TypeScript AST not available)
    const lines = sourceCode.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;

    // Estimate nodes based on code patterns
    let nodeCount = nonEmptyLines; // Base count

    for (const line of lines) {
      const trimmed = line.trim();
      // Count various code constructs that TODO: Would be AST nodes
      nodeCount += (trimmed.match(/[{}();,]/g) || []).length; // Structural tokens
      nodeCount += (trimmed.match(/\b(if|else|while|for|function|class|const|let|var)\b/g) || []).length; // Keywords
    }

    return Math.max(nodeCount, nonEmptyLines * 2); // Ensure minimum reasonable count
  }

  /**
   * Handles errors during complexity analysis
   * @param error - Error object
   * @param context - Context of the error
   * @throws Error with context
   */
  private static handleAnalysisError(error: Error, context: string): never {
    // Log error details
    console.error(`Analysis error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Rethrow with more context
    throw new Error(`Complexity analysis failed in ${context}: ${error.message}`);
  }

  /**
   * Analyzes cognitive complexity patterns
   * @param sourceCode - Source code to analyze
   * @param _language - Programming language
   */
  private static analyzeCognitiveComplexity(sourceCode: string, _language: string): CognitiveComplexity {
    const lines = sourceCode.split('\n');
    const hotspots: CognitiveComplexity['hotspots'] = [];
    let totalScore = 0;

    // Nesting level tracking
    let nestingLevel = 0;
    const nestingMultiplier = 1.5;

    lines.forEach((line, index) => {
      let lineScore = 0;
      const trimmedLine = line.trim();

      // Increment nesting level for block structures
      if (/[{([]/.test(trimmedLine)) {nestingLevel++;}

      // Check for complexity indicators
      if (/\b(if|while|for|foreach|catch)\b/.test(trimmedLine)) {
        lineScore += 1 * Math.pow(nestingMultiplier, nestingLevel);
      }
      if (/\b(else|elif)\b/.test(trimmedLine)) {lineScore += 1;}
      if (/\b(&&|\|\||and|or)\b/.test(trimmedLine)) {lineScore += 0.5;}
      if (/\?.*:/.test(trimmedLine)) {lineScore += 1;} // Ternary

      // Record hotspots
      if (lineScore > 0) {
        hotspots.push({
          line: index + 1,
          score: lineScore,
          reason: `Complexity score ${lineScore} at nesting level ${nestingLevel}`
        });
        totalScore += lineScore;
      }

      // Decrement nesting level for closing blocks
      if (/[}\])]/.test(trimmedLine)) {nestingLevel--;}
    });

    return {
      score: totalScore,
      hotspots: hotspots.sort((a, b) => b.score - a.score)
    };
  }

  /**
   * Analyzes historical trends and code churn
   * @param filePath - Path to the file
   * @param _metrics - Current complexity metrics
   */
  private static async analyzeHistoricalTrend(filePath: string, _metrics: ComplexityMetrics, context?: vscode.ExtensionContext): Promise<HistoricalTrend[]> {
    if (!context) {
      return [];
    }
    const storage = new MetricsStorage(context);
    const historicalData = storage.loadMetrics();
    const trends: HistoricalTrend[] = [];

    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    historicalData.dailyMetrics
      .filter(metric => new Date(metric.date) >= thirtyDaysAgo)
      .forEach(metric => {
        const fileMetric = historicalData.fileMetrics[filePath];
        if (fileMetric && fileMetric.complexity && typeof fileMetric.complexity.cyclomaticComplexity === 'number') {
          trends.push({
            date: metric.date,
            complexity: fileMetric.complexity.cyclomaticComplexity,
            churn: this.calculateChurn(fileMetric),
            cognitive: fileMetric.complexity.cognitiveComplexity?.score ?? 0
          });
        }
      });

    return trends;
  }

  /**
   * Calculates code churn based on file history
   * @param fileMetric - File metric data
   */
  private static calculateChurn(fileMetric: any): number {
    // Basic churn calculation
    const addedLines = fileMetric.lines ?? 0;
    const removedLines = fileMetric.previousLines ?? 0;
    return Math.abs(addedLines - removedLines);
  }
}

// TODO: Add support for:
// - Custom metric plugins