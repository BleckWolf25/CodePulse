/**
 * src/metrics/complexity.ts
 * 
 * Implements multi-tier code complexity analysis:
 * 1. AST-based analysis for TypeScript/JavaScript
 * 2. Pattern-based analysis for Python
 * 3. General heuristic fallback for other languages
 * 
 * Core Metrics Calculated:
 * - Cyclomatic Complexity (control flow complexity)
 * - Halstead Metrics (code entropy measurements)
 * - Maintainability Index (code sustainability score)
 */

// -------------------- IMPORTS -------------------- \\

import ts from '../../node_modules/typescript';

// -------------------- EXPORTS -------------------- \\

export interface ComplexityMetrics {
  totalComplexity: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  halsteadMetrics: {
    difficulty: number;
    volume: number;
    effort: number;
  };
}

// -------------------- MAIN EXPORT -------------------- \\

/**
 * Central complexity analysis engine with language-specific handlers
 * @class
 */
export class CodeComplexityAnalyzer {

  // -------------------- PUBLIC METHODS -------------------- \\

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
  public static analyzeComplexity(sourceCode: string, language: string = 'typescript'): ComplexityMetrics {
    try {
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'ts':
        case 'javascript':
        case 'js':
        case 'jsx':
        case 'tsx':
          return this.analyzeTypeScriptComplexity(sourceCode);
        case 'python':
        case 'py':
          return this.analyzePythonComplexity(sourceCode);
        default:
          return this.fallbackComplexityAnalysis(sourceCode);
      }
    } catch (error) {
      console.error(`Complexity analysis failed: ${error}`);
      return this.fallbackComplexityAnalysis(sourceCode);
    }
  }

  // -------------------- LANGUAGE-SPECIFIC ANALYZERS -------------------- \\

  /**
   * AST-based analysis for TypeScript/JavaScript
   * @param sourceCode - TS/JS file content
   * @returns Precise metrics from AST traversal
   * @remarks
   * - Uses TypeScript compiler API
   * - Traverses AST to count complexity triggers
   * - Calculates Halstead metrics from operator/operand counts
   */
  private static analyzeTypeScriptComplexity(sourceCode: string): ComplexityMetrics {
    try {

      // Create in-memory AST representation
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      // Complexity tracking variables
      let cyclomaticComplexity = 1; // Base complexity
      const halsteadOperators = new Set<string>();
      const halsteadOperands = new Set<string>();
      let operatorCount = 0;
      let operandCount = 0;

      /**
       * AST traversal function
       * @param node - Current AST node being processed
       */
      function traverse(node: ts.Node) {

        // Count control flow structures
        switch (node.kind) {
          case ts.SyntaxKind.IfStatement:
          case ts.SyntaxKind.SwitchStatement:
          case ts.SyntaxKind.CaseClause:
          case ts.SyntaxKind.ForStatement:
          case ts.SyntaxKind.ForInStatement:
          case ts.SyntaxKind.ForOfStatement:
          case ts.SyntaxKind.WhileStatement:
          case ts.SyntaxKind.DoStatement:
          case ts.SyntaxKind.CatchClause:
          case ts.SyntaxKind.ConditionalExpression:
            cyclomaticComplexity++;
            break;

          case ts.SyntaxKind.BinaryExpression:
            const binaryExpr = node as ts.BinaryExpression;

            // Count logical operators that increase complexity
            if (
              [
                ts.SyntaxKind.AmpersandAmpersandToken,
                ts.SyntaxKind.BarBarToken,
                ts.SyntaxKind.QuestionQuestionToken
              ].includes(binaryExpr.operatorToken.kind)) {
              cyclomaticComplexity++;
            }

            // Track unique operators for Halstead metrics
            const opText = binaryExpr.operatorToken.getText();
            halsteadOperators.add(opText);
            operatorCount++;
            break;

          case ts.SyntaxKind.Identifier:
            // Track unique identifiers as operands
            halsteadOperands.add((node as ts.Identifier).text);
            operandCount++;
            break;

          case ts.SyntaxKind.StringLiteral:
          case ts.SyntaxKind.NumericLiteral:
          case ts.SyntaxKind.TrueKeyword:
          case ts.SyntaxKind.FalseKeyword:

            // Track literals as operands
            operandCount++;
            break;
        }

        ts.forEachChild(node, traverse);
      }

      traverse(sourceFile);

      // Safety cap for extremely complex files
      cyclomaticComplexity = Math.min(cyclomaticComplexity, 100);

      // Halstead calculations with fallback values
      const n1 = halsteadOperators.size || 1;
      const n2 = halsteadOperands.size || 1;
      const N1 = operatorCount || 1;
      const N2 = operandCount || 1;

      // Metric formulas
      const halsteadVolume = (N1 + N2) * Math.log2(n1 + n2);
      const halsteadDifficulty = (n1 / 2) * (N2 / n2);
      const halsteadEffort = halsteadDifficulty * halsteadVolume;

      // Microsoft's maintainability index formula
      const maintainabilityIndex = Math.max(0, Math.min(100,
        171 -
        (5.2 * Math.log(halsteadVolume)) -
        (0.23 * cyclomaticComplexity) -
        (16.2 * Math.log(sourceCode.split('\n').length))
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
    } catch (error) {
      console.error('AST analysis failed, using fallback', error);
      return this.fallbackComplexityAnalysis(sourceCode);
    }
  }

  /**
   * Pattern-based Python complexity analysis
   * @param sourceCode - Python file content
   * @returns Metrics from structural pattern matching
   * @remarks
   * - Uses regex patterns for control flow detection
   * - Estimates Halstead metrics from line counts
   * - Handles Python-specific syntax (list comps, ternaries)
   */
  private static analyzePythonComplexity(sourceCode: string): ComplexityMetrics {
    const lines = sourceCode.split('\n');
    let cyclomaticComplexity = 1; // Base complexity

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#') || trimmedLine === '') { continue; }

      // Function definition detection
      if (/\s*def\s+/.test(trimmedLine)) { cyclomaticComplexity++; }

      // Control flow keywords
      if (/\s*(if|elif|for|while|except)\s+/.test(trimmedLine)) { cyclomaticComplexity++; }

      // Ternary detection
      if (/\s*return\s+.*\s+if\s+.*\s+else\s+/.test(trimmedLine)) { cyclomaticComplexity++; }

      // Logical operators in conditions
      const operators = trimmedLine.match(/(\s+and\s+)|(\s+or\s+)/g) || [];
      cyclomaticComplexity += operators.length;
    }

    // Halstead estimations for Python
    const halsteadVolume = lines.length * Math.log2(cyclomaticComplexity + 1);
    const halsteadDifficulty = cyclomaticComplexity / 2;

    // Maintainability formula for Python
    const maintainabilityIndex = Math.max(0, Math.min(100,
      100 - (cyclomaticComplexity * 0.2) - (0.1 * lines.length)
    ));

    return {
      totalComplexity: cyclomaticComplexity,
      cyclomaticComplexity,
      maintainabilityIndex,
      halsteadMetrics: {
        difficulty: halsteadDifficulty,
        volume: halsteadVolume,
        effort: halsteadDifficulty * halsteadVolume
      }
    };
  }

  // -------------------- FALLBACK ANALYZERS -------------------- \\

  /**
   * General-purpose complexity heuristics
   * @param sourceCode - File content for analysis
   * @returns Conservative complexity estimates
   * @remarks
   * - Used for unsupported languages
   * - Combines line counts and basic pattern matching
   * - Caps complexity at 50 for safety
   */
  private static fallbackComplexityAnalysis(sourceCode: string): ComplexityMetrics {
    const lines = sourceCode.split('\n');
    const lineCount = lines.length;
    let cyclomaticComplexity = 1;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || trimmedLine === '') { continue; }

      // Common control flow patterns
      if (/\b(if|else|switch|case|for|while|do|try|catch|except)\b/.test(trimmedLine)) {
        cyclomaticComplexity++;
      }

      // Logical operator detection
      const operators = trimmedLine.match(/(\&\&)|(\|\|)|(\band\b)|(\bor\b)/g) || [];
      cyclomaticComplexity += operators.length;
    }

    // Conservative complexity cap
    cyclomaticComplexity = Math.min(cyclomaticComplexity, 50);

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

  // -------------------- RECOMMENDATION ENGINE -------------------- \\

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

    // Cyclomatic complexity thresholds
    if (metrics.cyclomaticComplexity > 15) {
      recommendations.push("High cyclomatic complexity. Refactor into smaller functions.");
    } else if (metrics.cyclomaticComplexity > 10) {
      recommendations.push("Moderate complexity. Simplify nested conditions.");
    }

    // Maintainability thresholds
    if (metrics.maintainabilityIndex < 40) {
      recommendations.push("Low maintainability. Break into smaller modules.");
    } else if (metrics.maintainabilityIndex < 60) {
      recommendations.push("Moderate maintainability. Improve documentation.");
    }

    // Cognitive complexity thresholds
    if (metrics.halsteadMetrics.difficulty > 30) {
      recommendations.push("High cognitive complexity. Simplify logic.");
    }

    return recommendations.length ? recommendations :
      ["Code quality metrics are within recommended ranges."];
  }
}