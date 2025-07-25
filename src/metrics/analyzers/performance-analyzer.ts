/**
 * @file PERFORMANCE-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Performance Benchmark Analyzer
 * Analyzes code execution performance, memory usage patterns,
 * and provides performance optimization insights.
 */

// ------------ IMPORTS
import { StoredMetrics, CodeMetrics } from '../storage';
import { PerformanceMetrics } from '../types';
import { ErrorHandler } from '../../utils/error-handler';
import * as fs from 'fs';

// ------------ CLASS
export class PerformanceBenchmarkAnalyzer {
  private errorHandler = ErrorHandler.getInstance();
  
  /**
   * Analyze execution hotspots in the codebase
   */
  public async analyzeExecutionHotspots(data: StoredMetrics): Promise<PerformanceMetrics['executionHotspots']> {
    try {
      const hotspots: PerformanceMetrics['executionHotspots'] = [];
      
      // Analyze complexity metrics to identify potential hotspots
      for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
        const complexityHotspots = await this.analyzeFileComplexityHotspots(filePath, metrics);
        hotspots.push(...complexityHotspots);
      }
      
      // Sort by execution time (estimated from complexity)
      hotspots.sort((a, b) => b.executionTime - a.executionTime);
      
      // Return top 20 hotspots
      return hotspots.slice(0, 20);
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return [];
    }
  }

  /**
   * Analyze memory profile patterns
   */
  public async analyzeMemoryProfile(data: StoredMetrics): Promise<PerformanceMetrics['memoryProfile']> {
    try {
      let totalAllocation = 0;
      const potentialLeaks: string[] = [];
      let garbageCollectionPressure = 0;
      
      // Analyze file sizes and complexity for memory estimation
      for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
        const fileSize = await this.getFileSize(filePath);
        const memoryEstimate = this.estimateMemoryUsage(metrics, fileSize);
        
        totalAllocation += memoryEstimate;
        
        // Detect potential memory leaks based on complexity patterns
        if (await this.detectPotentialMemoryLeak(filePath, metrics)) {
          potentialLeaks.push(filePath);
        }
        
        // Calculate GC pressure based on object creation patterns
        garbageCollectionPressure += this.estimateGCPressure(metrics);
      }
      
      return {
        allocation: totalAllocation,
        leaks: potentialLeaks,
        garbageCollection: garbageCollectionPressure
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        allocation: 0,
        leaks: [],
        garbageCollection: 0
      };
    }
  }

  /**
   * Analyze async operations performance
   */
  public async analyzeAsyncOperations(data: StoredMetrics): Promise<PerformanceMetrics['asyncOperations']> {
    try {
      let pendingOperations = 0;
      let totalResolutionTime = 0;
      let operationCount = 0;
      
      // Analyze files for async patterns
      for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
        const asyncAnalysis = await this.analyzeFileAsyncPatterns(filePath, metrics);
        
        pendingOperations += asyncAnalysis.pending;
        totalResolutionTime += asyncAnalysis.totalTime;
        operationCount += asyncAnalysis.count;
      }
      
      const avgResolutionTime = operationCount > 0 ? totalResolutionTime / operationCount : 0;
      
      return {
        pending: pendingOperations,
        avgResolutionTime
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        pending: 0,
        avgResolutionTime: 0
      };
    }
  }

  /**
   * Analyze complexity hotspots in a specific file
   */
  private async analyzeFileComplexityHotspots(filePath: string, metrics: CodeMetrics): Promise<PerformanceMetrics['executionHotspots']> {
    const hotspots: PerformanceMetrics['executionHotspots'] = [];
    
    try {
      // Read file content to analyze specific functions/methods
      const content = await this.readFileContent(filePath);
      if (!content) {return hotspots;}
      
      const functions = this.extractFunctions(content, metrics.language);
      
      functions.forEach((func, _index) => {
        const complexity = this.calculateFunctionComplexity(func.content);
        
        if (complexity > 10) { // High complexity threshold
          hotspots.push({
            location: {
              filePath,
              startLine: func.startLine,
              endLine: func.endLine,
              startColumn: 0,
              endColumn: 0
            },
            executionTime: this.estimateExecutionTime(complexity),
            callFrequency: this.estimateCallFrequency(func.name, content)
          });
        }
      });
      
      return hotspots;
    } catch (error) {
      return hotspots;
    }
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Estimate memory usage based on metrics and file size
   */
  private estimateMemoryUsage(metrics: CodeMetrics, fileSize: number): number {
    // Base memory usage on file size and complexity
    const baseMemory = fileSize * 0.1; // 10% of file size as base
    const complexityMultiplier = 1 + (metrics.complexity.totalComplexity / 100);
    
    return baseMemory * complexityMultiplier;
  }

  /**
   * Detect potential memory leaks based on patterns
   */
  private async detectPotentialMemoryLeak(filePath: string, metrics: CodeMetrics): Promise<boolean> {
    try {
      const content = await this.readFileContent(filePath);
      if (!content) {return false;}
      
      // Look for common memory leak patterns
      const leakPatterns = [
        /setInterval\s*\(/g,
        /addEventListener\s*\(/g,
        /new\s+Array\s*\(/g,
        /\.push\s*\(/g,
        /global\./g
      ];
      
      let leakScore = 0;
      leakPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          leakScore += matches.length;
        }
      });
      
      // High complexity + potential leak patterns = likely memory leak
      return metrics.complexity.totalComplexity > 20 && leakScore > 5;
    } catch (error) {
      return false;
    }
  }

  /**
   * Estimate garbage collection pressure
   */
  private estimateGCPressure(metrics: CodeMetrics): number {
    // Base GC pressure on object creation and complexity
    const objectCreationFactor = metrics.complexity.totalComplexity * 0.1;
    const sizeFactor = metrics.lines * 0.01;
    
    return objectCreationFactor + sizeFactor;
  }

  /**
   * Analyze async patterns in a file
   */
  private async analyzeFileAsyncPatterns(filePath: string, metrics: CodeMetrics): Promise<{
    pending: number;
    totalTime: number;
    count: number;
  }> {
    try {
      const content = await this.readFileContent(filePath);
      if (!content) {return { pending: 0, totalTime: 0, count: 0 };}
      
      // Count async patterns
      const asyncPatterns = [
        /async\s+function/g,
        /await\s+/g,
        /\.then\s*\(/g,
        /Promise\./g,
        /setTimeout\s*\(/g,
        /setInterval\s*\(/g
      ];
      
      let asyncCount = 0;
      asyncPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          asyncCount += matches.length;
        }
      });
      
      // Estimate pending operations and resolution time
      const pending = Math.floor(asyncCount * 0.3); // 30% might be pending
      const avgTime = 100 + (metrics.complexity.totalComplexity * 10); // Base 100ms + complexity
      
      return {
        pending,
        totalTime: asyncCount * avgTime,
        count: asyncCount
      };
    } catch (error) {
      return { pending: 0, totalTime: 0, count: 0 };
    }
  }

  /**
   * Read file content safely
   */
  private async readFileContent(filePath: string): Promise<string | null> {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract functions from file content
   */
  private extractFunctions(content: string, language: string): Array<{
    name: string;
    content: string;
    startLine: number;
    endLine: number;
  }> {
    const functions: Array<{
      name: string;
      content: string;
      startLine: number;
      endLine: number;
    }> = [];
    
    // Simple function extraction based on language
    const lines = content.split('\n');
    let currentFunction: any = null;
    let braceCount = 0;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Detect function start (simplified)
      if (this.isFunctionStart(trimmedLine, language)) {
        if (currentFunction) {
          // Close previous function
          currentFunction.endLine = index - 1;
          functions.push(currentFunction);
        }
        
        currentFunction = {
          name: this.extractFunctionName(trimmedLine, language),
          content: line,
          startLine: index + 1,
          endLine: index + 1
        };
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (currentFunction) {
        currentFunction.content += '\n' + line;
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        
        if (braceCount <= 0) {
          currentFunction.endLine = index + 1;
          functions.push(currentFunction);
          currentFunction = null;
          braceCount = 0;
        }
      }
    });
    
    return functions;
  }

  /**
   * Check if line starts a function
   */
  private isFunctionStart(line: string, language: string): boolean {
    const patterns = {
      typescript: /^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?(async\s+)?\w+\s*\(/,
      javascript: /^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?(async\s+)?\w+\s*\(/,
      python: /^def\s+\w+\s*\(/,
      java: /^(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/,
      csharp: /^(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/
    };
    
    const pattern = patterns[language as keyof typeof patterns];
    return pattern ? pattern.test(line) : false;
  }

  /**
   * Extract function name from line
   */
  private extractFunctionName(line: string, _language: string): string {
    const match = line.match(/function\s+(\w+)|(\w+)\s*\(/);
    return match ? (match[1] || match[2] || 'anonymous') : 'anonymous';
  }

  /**
   * Calculate function complexity (simplified)
   */
  private calculateFunctionComplexity(content: string): number {
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s*if\s*\(/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /&&|\|\|/g
    ];
    
    let complexity = 1; // Base complexity
    
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  /**
   * Estimate execution time based on complexity
   */
  private estimateExecutionTime(complexity: number): number {
    // Base execution time + complexity factor
    return 10 + (complexity * 5); // milliseconds
  }

  /**
   * Estimate call frequency
   */
  private estimateCallFrequency(functionName: string, content: string): number {
    const regex = new RegExp(`\\b${functionName}\\s*\\(`, 'g');
    const matches = content.match(regex);
    return matches ? matches.length - 1 : 0; // Subtract 1 for the definition
  }

  /**
   * Analyze performance regression patterns
   */
  public async analyzePerformanceRegression(data: StoredMetrics): Promise<{
    hasRegression: boolean;
    regressionScore: number;
    affectedFiles: string[];
    performanceTrend: 'improving' | 'degrading' | 'stable';
    recommendations: string[];
  }> {
    try {
      const currentMetrics = Object.entries(data.fileMetrics);
      const affectedFiles: string[] = [];
      const recommendations: string[] = [];
      let totalRegressionScore = 0;

      // Analyze each file for performance issues
      for (const [filePath, metrics] of currentMetrics) {
        const fileRegressionScore = await this.calculateFileRegressionScore(filePath, metrics);

        if (fileRegressionScore > 0.3) { // Threshold for regression
          affectedFiles.push(filePath);
          totalRegressionScore += fileRegressionScore;
        }
      }

      const averageRegressionScore = currentMetrics.length > 0 ?
        totalRegressionScore / currentMetrics.length : 0;

      const hasRegression = averageRegressionScore > 0.2;
      const performanceTrend = this.calculatePerformanceTrend(averageRegressionScore);

      // Generate recommendations
      if (hasRegression) {
        recommendations.push('Consider refactoring high-complexity functions');
        recommendations.push('Review memory allocation patterns');
        recommendations.push('Optimize async operation handling');

        if (affectedFiles.length > 5) {
          recommendations.push('Implement performance monitoring for critical files');
        }
      }

      return {
        hasRegression,
        regressionScore: averageRegressionScore,
        affectedFiles,
        performanceTrend,
        recommendations
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        hasRegression: false,
        regressionScore: 0,
        affectedFiles: [],
        performanceTrend: 'stable',
        recommendations: []
      };
    }
  }

  /**
   * Calculate file-specific regression score
   */
  private async calculateFileRegressionScore(filePath: string, metrics: CodeMetrics): Promise<number> {
    let score = 0;

    // High complexity penalty
    if (metrics.complexity.totalComplexity > 50) {
      score += 0.3;
    } else if (metrics.complexity.totalComplexity > 25) {
      score += 0.2;
    }

    // Large file penalty
    if (metrics.lines > 1000) {
      score += 0.2;
    } else if (metrics.lines > 500) {
      score += 0.1;
    }

    // Check for performance anti-patterns
    const content = await this.readFileContent(filePath);
    if (content) {
      const antiPatternScore = this.detectPerformanceAntiPatterns(content);
      score += antiPatternScore;
    }

    return Math.min(1, score); // Cap at 1.0
  }

  /**
   * Detect performance anti-patterns in code
   */
  private detectPerformanceAntiPatterns(content: string): number {
    let score = 0;

    // Nested loops
    const nestedLoopPattern = /for\s*\([^}]*for\s*\(/g;
    const nestedLoops = content.match(nestedLoopPattern);
    if (nestedLoops) {
      score += nestedLoops.length * 0.1;
    }

    // Synchronous file operations
    const syncFileOps = /fs\.readFileSync|fs\.writeFileSync/g;
    const syncOps = content.match(syncFileOps);
    if (syncOps) {
      score += syncOps.length * 0.05;
    }

    // Inefficient array operations
    const inefficientArrayOps = /\.forEach\s*\([^}]*\.push\s*\(|\.map\s*\([^}]*\.filter\s*\(/g;
    const inefficientOps = content.match(inefficientArrayOps);
    if (inefficientOps) {
      score += inefficientOps.length * 0.05;
    }

    // Memory leaks patterns
    const memoryLeakPatterns = /setInterval\s*\([^}]*(?!clearInterval)|addEventListener\s*\([^}]*(?!removeEventListener)/g;
    const leakPatterns = content.match(memoryLeakPatterns);
    if (leakPatterns) {
      score += leakPatterns.length * 0.1;
    }

    return Math.min(0.5, score); // Cap at 0.5
  }

  /**
   * Calculate performance trend
   */
  private calculatePerformanceTrend(regressionScore: number): 'improving' | 'degrading' | 'stable' {
    if (regressionScore > 0.4) {return 'degrading';}
    if (regressionScore < 0.1) {return 'improving';}
    return 'stable';
  }

  /**
   * Analyze performance benchmarks against industry standards
   */
  public async analyzePerformanceBenchmarks(data: StoredMetrics): Promise<{
    overallScore: number;
    benchmarkComparison: {
      complexity: 'excellent' | 'good' | 'average' | 'poor';
      fileSize: 'excellent' | 'good' | 'average' | 'poor';
      memoryEfficiency: 'excellent' | 'good' | 'average' | 'poor';
    };
    industryPercentile: number;
    improvementAreas: string[];
  }> {
    try {
      const fileMetrics = Object.values(data.fileMetrics);

      if (fileMetrics.length === 0) {
        return {
          overallScore: 0,
          benchmarkComparison: {
            complexity: 'poor',
            fileSize: 'poor',
            memoryEfficiency: 'poor'
          },
          industryPercentile: 0,
          improvementAreas: []
        };
      }

      // Calculate average metrics
      const avgComplexity = fileMetrics.reduce((sum, m) => sum + m.complexity.totalComplexity, 0) / fileMetrics.length;
      const avgFileSize = fileMetrics.reduce((sum, m) => sum + m.lines, 0) / fileMetrics.length;

      // Estimate memory efficiency
      const memoryEfficiency = await this.calculateMemoryEfficiencyScore(data);

      // Benchmark against industry standards
      const complexityRating = this.rateComplexity(avgComplexity);
      const fileSizeRating = this.rateFileSize(avgFileSize);
      const memoryRating = this.rateMemoryEfficiency(memoryEfficiency);

      // Calculate overall score
      const scores = {
        excellent: 4,
        good: 3,
        average: 2,
        poor: 1
      };

      const overallScore = (
        scores[complexityRating] +
        scores[fileSizeRating] +
        scores[memoryRating]
      ) / 3;

      // Calculate industry percentile (simplified)
      const industryPercentile = Math.min(95, (overallScore / 4) * 100);

      // Identify improvement areas
      const improvementAreas: string[] = [];
      if (complexityRating === 'poor' || complexityRating === 'average') {
        improvementAreas.push('Reduce code complexity through refactoring');
      }
      if (fileSizeRating === 'poor' || fileSizeRating === 'average') {
        improvementAreas.push('Break down large files into smaller modules');
      }
      if (memoryRating === 'poor' || memoryRating === 'average') {
        improvementAreas.push('Optimize memory usage and prevent leaks');
      }

      return {
        overallScore: (overallScore / 4) * 100, // Convert to percentage
        benchmarkComparison: {
          complexity: complexityRating,
          fileSize: fileSizeRating,
          memoryEfficiency: memoryRating
        },
        industryPercentile,
        improvementAreas
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        overallScore: 0,
        benchmarkComparison: {
          complexity: 'poor',
          fileSize: 'poor',
          memoryEfficiency: 'poor'
        },
        industryPercentile: 0,
        improvementAreas: []
      };
    }
  }

  /**
   * Rate complexity against industry standards
   */
  private rateComplexity(avgComplexity: number): 'excellent' | 'good' | 'average' | 'poor' {
    if (avgComplexity <= 5) {return 'excellent';}
    if (avgComplexity <= 10) {return 'good';}
    if (avgComplexity <= 20) {return 'average';}
    return 'poor';
  }

  /**
   * Rate file size against industry standards
   */
  private rateFileSize(avgFileSize: number): 'excellent' | 'good' | 'average' | 'poor' {
    if (avgFileSize <= 100) {return 'excellent';}
    if (avgFileSize <= 300) {return 'good';}
    if (avgFileSize <= 500) {return 'average';}
    return 'poor';
  }

  /**
   * Rate memory efficiency
   */
  private rateMemoryEfficiency(efficiency: number): 'excellent' | 'good' | 'average' | 'poor' {
    if (efficiency >= 0.9) {return 'excellent';}
    if (efficiency >= 0.7) {return 'good';}
    if (efficiency >= 0.5) {return 'average';}
    return 'poor';
  }

  /**
   * Calculate memory efficiency score
   */
  private async calculateMemoryEfficiencyScore(data: StoredMetrics): Promise<number> {
    let totalScore = 0;
    let fileCount = 0;

    for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
      const content = await this.readFileContent(filePath);
      if (content) {
        const leakScore = await this.detectPotentialMemoryLeak(filePath, metrics) ? 0.3 : 0.9;
        const gcPressure = this.estimateGCPressure(metrics);
        const efficiencyScore = Math.max(0, 1 - (gcPressure / 100) - (1 - leakScore));

        totalScore += efficiencyScore;
        fileCount++;
      }
    }

    return fileCount > 0 ? totalScore / fileCount : 0;
  }
}
