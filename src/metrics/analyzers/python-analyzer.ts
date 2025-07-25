/**
 * @file PYTHON-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Python Complexity Analyzer
 * Analyzes Python source code and calculates complexity metrics.
 */

// ------------ IMPORTS
import { ComplexityMetrics, LanguageConfig } from '../complexity';
import { ILanguageAnalyzer } from './analyzer.interface';
import { ErrorHandler } from '../../utils/error-handler';

// ------------ CLASS
export class PythonAnalyzer implements ILanguageAnalyzer {
  private readonly SUPPORTED_LANGUAGES = ['python', 'py'];
  private readonly ASYNC_PATTERNS = {
    asyncDef: /\basync\s+def\b/g,
    await: /\bawait\b/g,
    asyncWith: /\basync\s+with\b/g,
    asyncFor: /\basync\s+for\b/g
  };

  private readonly COMPREHENSION_PATTERNS = {
    listComp: /\[\s*[\w\s\(\)]+\s+for\s+/g,
    dictComp: /\{\s*[\w\s\(\)]+\s*:\s*[\w\s\(\)]+\s+for\s+/g,
    setComp: /\{\s*[\w\s\(\)]+\s+for\s+/g
  };

  private errorHandler = ErrorHandler.getInstance();

  public getLanguageName(): string {
    return 'python';
  }

  public supportsLanguage(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  public analyze(sourceCode: string, config: LanguageConfig): ComplexityMetrics {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;

    const state = {
      cyclomaticComplexity: 1,
      indentationLevel: 0,
      functionDepth: 0,
      decoratorCount: 0,
      comprehensionCount: 0,
      operatorCount: 0,
      operandCount: 0,
      uniqueOperators: new Set<string>(),
      uniqueOperands: new Set<string>(),
      asyncCount: 0,
      awaitPoints: 0,
      comprehensions: 0,
      coroutines: new Set<string>(),
      asyncContextDepth: 0
    };

    try {
      const lines = sourceCode.split('\n');
      this.analyzeCode(lines, state, config);

      // Analyze async patterns
      this.analyzeAsyncPatterns(sourceCode, state);

      // Analyze comprehensions
      this.analyzeComprehensions(sourceCode, state);

      const metrics = this.calculateMetrics(lines, state, config);

      metrics.performance = {
        analysisTime: performance.now() - startTime,
        memoryUsage: process.memoryUsage().heapUsed - initialMemory,
        nodeCount: lines.length // Simple approximation for Python
      };

      return metrics;

    } catch (error) {
      return this.errorHandler.handleAnalysisError(
        'Python',
        error as Error,
        'analyze'
      );
    }
  }

  private analyzeCode(lines: string[], state: any, config: LanguageConfig): void {
    let inMultilineString = false;
    let continuationLine = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {continue;}

      // Handle multiline strings
      if (trimmedLine.includes('"""') || trimmedLine.includes("'''")) {
        inMultilineString = !inMultilineString;
        continue;
      }
      if (inMultilineString) {continue;}

      // Handle line continuation
      if (trimmedLine.endsWith('\\')) {
        continuationLine = true;
        continue;
      }

      // Calculate indentation level
      const indent = this.getIndentationLevel(line);
      if (!continuationLine) {
        state.indentationLevel = indent;
      }
      continuationLine = false;

      this.analyzePythonLine(trimmedLine, state, config);
    }
  }

  private analyzePythonLine(line: string, state: any, config: LanguageConfig): void {
    // Function definitions
    if (this.isFunctionDefinition(line)) {
      state.functionDepth++;
      state.cyclomaticComplexity += config.complexityWeights.functions * 
        Math.pow(1.1, state.functionDepth);
      
      // Check for decorators
      if (state.decoratorCount > 0) {
        state.cyclomaticComplexity += 0.1 * state.decoratorCount;
        state.decoratorCount = 0;
      }
    }

    // Decorators
    if (line.startsWith('@')) {
      state.decoratorCount++;
      state.uniqueOperators.add('@decorator');
    }

    // Control flow statements
    if (this.isControlFlow(line)) {
      const weight = config.complexityWeights.conditionals * 
        Math.pow(1.1, state.indentationLevel);
      state.cyclomaticComplexity += weight;
    }

    // List/Dict/Set comprehensions
    if (this.isComprehension(line)) {
      state.comprehensionCount++;
      state.cyclomaticComplexity += config.complexityWeights.loops * 0.8;
    }

    // Lambda functions
    if (line.includes('lambda')) {
      state.cyclomaticComplexity += config.complexityWeights.functions * 0.5;
    }

    // Exception handling
    if (line.startsWith('except')) {
      state.cyclomaticComplexity += config.complexityWeights.conditionals;
    }

    // Type hints
    if (line.includes('->') || line.includes(': ')) {
      this.analyzeTypeHints(line, state);
    }

    // Async/await
    if (line.includes('async ') || line.includes('await ')) {
      state.cyclomaticComplexity += config.complexityWeights.functions * 0.5;
    }

    // Context managers
    if (line.includes('with ')) {
      state.cyclomaticComplexity += config.complexityWeights.functions * 0.3;
      this.analyzeContextManager(line, state);
    }

    // Collect Halstead metrics
    this.collectHalsteadMetrics(line, state);
  }

  private analyzeTypeHints(line: string, state: any): void {
    const typeHints = line.match(/\w+\s*:\s*\w+/g) || [];
    typeHints.forEach(() => {
      state.cyclomaticComplexity += 0.1;
    });
  }

  private analyzeContextManager(line: string, state: any): void {
    const contextCount = (line.match(/,/g) || []).length + 1;
    state.cyclomaticComplexity += 0.2 * contextCount;
  }

  private analyzeAsyncPatterns(sourceCode: string, state: any): void {
    // Track async function definitions
    const asyncDefs = sourceCode.match(this.ASYNC_PATTERNS.asyncDef) || [];
    state.asyncCount += asyncDefs.length;

    // Track await points
    const awaitPoints = sourceCode.match(this.ASYNC_PATTERNS.await) || [];
    state.awaitPoints += awaitPoints.length;

    // Track async context managers
    const asyncWiths = sourceCode.match(this.ASYNC_PATTERNS.asyncWith) || [];
    state.asyncContextDepth += asyncWiths.length;

    // Track async loops
    const asyncFors = sourceCode.match(this.ASYNC_PATTERNS.asyncFor) || [];
    state.asyncCount += asyncFors.length;
  }

  private analyzeComprehensions(sourceCode: string, state: any): void {
    // Count list comprehensions
    const listComps = sourceCode.match(this.COMPREHENSION_PATTERNS.listComp) || [];
    state.comprehensions += listComps.length;

    // Count dictionary comprehensions
    const dictComps = sourceCode.match(this.COMPREHENSION_PATTERNS.dictComp) || [];
    state.comprehensions += dictComps.length * 1.2; // Slightly higher weight

    // Count set comprehensions
    const setComps = sourceCode.match(this.COMPREHENSION_PATTERNS.setComp) || [];
    state.comprehensions += setComps.length;
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

    // Python-specific maintainability index
    const maintainabilityIndex = Math.max(0, Math.min(100,
      100 -
      (cyclomaticComplexity * 0.2) -
      (0.1 * lines.length) -
      (state.comprehensionCount * 0.3)
    ));

    // Async-specific complexity
    const asyncComplexity = this.calculateAsyncComplexity(state, config);

    return {
      totalComplexity: asyncComplexity,
      cyclomaticComplexity,
      maintainabilityIndex,
      halsteadMetrics: {
        difficulty: halsteadDifficulty,
        volume: halsteadVolume,
        effort: halsteadEffort
      }
    };
  }

  private calculateAsyncComplexity(state: any, config: LanguageConfig): number {
    return (
      (state.asyncCount * config.complexityWeights.functions) +
      (state.awaitPoints * config.complexityWeights.conditionals * 0.5) +
      (state.asyncContextDepth * config.complexityWeights.loops) +
      (state.comprehensions * config.complexityWeights.functions * 0.3)
    );
  }

  private getIndentationLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? Math.floor(match[1].length / 4) : 0;
  }

  private isFunctionDefinition(line: string): boolean {
    return /^\s*def\s+\w+\s*\(.*/i.test(line);
  }

  private isControlFlow(line: string): boolean {
    return /^\s*(if|elif|else|for|while|match|case)\b/.test(line);
  }

  private isComprehension(line: string): boolean {
    return (
      line.includes('for') && 
      (line.includes('[') || line.includes('{') || line.includes('(')) &&
      (line.includes(']') || line.includes('}') || line.includes(')'))
    );
  }

  private collectHalsteadMetrics(line: string, state: any): void {
    // Python operators
    const operators = line.match(/[+\-*/%=<>!&|^~@]+|and|or|not|in|is/g) || [];
    operators.forEach(op => {
      state.uniqueOperators.add(op);
      state.operatorCount++;
    });

    // Operands (variables, literals, etc.)
    const operands = line.match(/\b(?!\d)\w+\b|"[^"]*"|'[^']*'|\d+(?:\.\d+)?/g) || [];
    operands.forEach(operand => {
      state.uniqueOperands.add(operand);
      state.operandCount++;
    });
  }
}
