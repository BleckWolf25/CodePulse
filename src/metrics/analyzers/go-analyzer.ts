/**
 * @file GO-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Go Complexity Analyzer
 * Analyzes Go source code and calculates complexity metrics.
 */

// ------------ IMPORTS
import { ILanguageAnalyzer } from './analyzer.interface';
import { ComplexityMetrics, LanguageConfig } from '../complexity';
import { ConfigurationService } from '../../utils/configuration-service';
import { ErrorHandler } from '../../utils/error-handler';

// ------------ CLASS
export class GoAnalyzer implements ILanguageAnalyzer {
  private readonly SUPPORTED_LANGUAGES = ['go', 'golang'];
  private errorHandler = ErrorHandler.getInstance();

  public getLanguageName(): string {
    return 'go';
  }

  public supportsLanguage(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  public analyze(sourceCode: string, config: LanguageConfig): ComplexityMetrics {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;

    try {
      const state = {
        cyclomaticComplexity: 1,
        functions: 0,
        interfaces: 0,
        structs: 0,
        goRoutines: 0,
        errorHandling: 0,
        operatorCount: 0,
        operandCount: 0,
        uniqueOperators: new Set<string>(),
        uniqueOperands: new Set<string>()
      };

      const lines = sourceCode.split('\n');
      this.analyzeGoCode(lines, state, config);

      const metrics = this.calculateMetrics(lines, state, config);
      
      metrics.performance = {
        analysisTime: performance.now() - startTime,
        memoryUsage: process.memoryUsage().heapUsed - initialMemory,
        nodeCount: lines.length
      };

      return metrics;

    } catch (error) {
      return this.errorHandler.handleAnalysisError(
        'Go',
        error as Error,
        'analyze'
      );
    }
  }

  private analyzeGoCode(lines: string[], state: any, config: LanguageConfig): void {
    let inFunction = false;
    let braceDepth = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//')) {
        continue;
      }

      // Track function definitions
      if (this.isFunctionDefinition(trimmedLine)) {
        state.functions++;
        state.cyclomaticComplexity += config.complexityWeights.functions;
        inFunction = true;
      }

      // Track control structures
      if (this.isControlStructure(trimmedLine)) {
        state.cyclomaticComplexity += config.complexityWeights.conditionals;
      }

      // Track error handling
      if (this.isErrorHandling(trimmedLine)) {
        state.errorHandling++;
        state.cyclomaticComplexity += config.complexityWeights.conditionals * 0.5;
      }

      // Track goroutines
      if (trimmedLine.includes('go ')) {
        state.goRoutines++;
        state.cyclomaticComplexity += config.complexityWeights.functions * 0.5;
      }

      // Track structs and interfaces
      if (trimmedLine.startsWith('type ')) {
        if (trimmedLine.includes(' struct ')) {
          state.structs++;
        } else if (trimmedLine.includes(' interface ')) {
          state.interfaces++;
        }
      }

      // Track operators and operands
      this.collectMetrics(trimmedLine, state);

      // Track brace depth
      braceDepth += (trimmedLine.match(/{/g) || []).length;
      braceDepth -= (trimmedLine.match(/}/g) || []).length;
      
      if (braceDepth === 0) {
        inFunction = false;
      }
    }
  }

  private calculateMetrics(lines: string[], state: any, config: LanguageConfig): ComplexityMetrics {
    // Cap cyclomatic complexity
    const cyclomaticComplexity = Math.min(
      state.cyclomaticComplexity,
      config.thresholds.cyclomatic
    );

    // Calculate Halstead metrics
    const n1 = state.uniqueOperators.size || 1;
    const n2 = state.uniqueOperands.size || 1;
    const N1 = state.operatorCount || 1;
    const N2 = state.operandCount || 1;

    const halsteadVolume = (N1 + N2) * Math.log2(n1 + n2);
    const halsteadDifficulty = (n1 / 2) * (N2 / n2);
    const halsteadEffort = halsteadDifficulty * halsteadVolume;

    // Go-specific maintainability index
    const maintainabilityIndex = Math.max(0, Math.min(100,
      171 -
      (5.2 * Math.log(halsteadVolume)) -
      (0.23 * cyclomaticComplexity) -
      (16.2 * Math.log(lines.length)) +
      (state.errorHandling * 0.5) // Bonus for error handling
    ));

    return {
      totalComplexity: cyclomaticComplexity,
      cyclomaticComplexity,
      maintainabilityIndex,
      halsteadMetrics: {
        difficulty: halsteadDifficulty,
        volume: halsteadVolume,
        effort: halsteadEffort
      }
    };
  }

  private isFunctionDefinition(line: string): boolean {
    return /^func\s+(\(.*\)\s+)?[\w]+\(.*\)/.test(line);
  }

  private isControlStructure(line: string): boolean {
    return /^\s*(if|else|for|switch|select)\b/.test(line);
  }

  private isErrorHandling(line: string): boolean {
    return /\berr\s*!=\s*nil\b/.test(line) || /\breturn\s+.*\berror\b/.test(line);
  }

  private collectMetrics(line: string, state: any): void {
    // Operators
    const operators = line.match(/[+\-*/%=!<>]+|:=|\|\||&&/g) || [];
    operators.forEach(op => {
      state.uniqueOperators.add(op);
      state.operatorCount++;
    });

    // Operands (identifiers and literals)
    const operands = line.match(/\b[a-zA-Z_]\w*\b|"[^"]*"|'[^']*'|\d+(?:\.\d+)?/g) || [];
    operands.forEach(operand => {
      state.uniqueOperands.add(operand);
      state.operandCount++;
    });
  }
}
