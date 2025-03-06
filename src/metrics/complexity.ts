// src/metrics/complexity.ts
import ts from 'typescript';

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

export class CodeComplexityAnalyzer {
  /**
   * Quick analysis for large files during editing
   * @param sourceCode Source code text
   * @param _language Language identifier
   */
  public static quickAnalyze(sourceCode: string, _language: string): ComplexityMetrics {
    // Simple line-based complexity estimation
    const lines = sourceCode.split('\n');
    const lineCount = lines.length;
    
    // Estimate complexity based on simple heuristics
    const cyclomaticComplexity = Math.min(
      20, // Cap complexity for performance reasons
      Math.max(
        1,
        Math.floor(lineCount / 50) // 1 complexity per 50 lines as a baseline
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
   * Calculates comprehensive code complexity metrics
   * @param sourceCode Full source code as a string
   * @param language Programming language (for language-specific analysis)
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
      console.error(`Error analyzing complexity: ${error}`);
      return this.fallbackComplexityAnalysis(sourceCode);
    }
  }

  /**
   * Advanced TypeScript/JavaScript complexity analysis using AST
   */
  private static analyzeTypeScriptComplexity(sourceCode: string): ComplexityMetrics {
    try {
      const sourceFile = ts.createSourceFile(
        'temp.ts', 
        sourceCode,
        ts.ScriptTarget.Latest, 
        true
      );
      
      let cyclomaticComplexity = 1; // Base complexity of 1
      let halsteadOperators = new Set<string>();
      let halsteadOperands = new Set<string>();
      let operatorCount = 0;
      let operandCount = 0;

      function traverse(node: ts.Node) {
        // Complexity increasing constructs
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
          case ts.SyntaxKind.ConditionalExpression: // Ternary
            cyclomaticComplexity++;
            break;
          
          case ts.SyntaxKind.BinaryExpression:
            const binaryExpr = node as ts.BinaryExpression;
            if ([
              ts.SyntaxKind.AmpersandAmpersandToken,
              ts.SyntaxKind.BarBarToken,
              ts.SyntaxKind.QuestionQuestionToken
            ].includes(binaryExpr.operatorToken.kind)) {
              cyclomaticComplexity++;
            }
            
            // Track operator for Halstead metrics
            const opText = binaryExpr.operatorToken.getText();
            halsteadOperators.add(opText);
            operatorCount++;
            break;
            
          case ts.SyntaxKind.Identifier:
            // Track identifiers for Halstead metrics
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

      // Cap complexity for extremely complex files to prevent performance issues
      cyclomaticComplexity = Math.min(cyclomaticComplexity, 100);
      
      // Halstead complexity calculations
      const n1 = halsteadOperators.size || 1;
      const n2 = halsteadOperands.size || 1;
      const N1 = operatorCount || 1;
      const N2 = operandCount || 1;
      
      const halsteadVolume = (N1 + N2) * Math.log2(n1 + n2);
      const halsteadDifficulty = (n1 / 2) * (N2 / n2);
      const halsteadEffort = halsteadDifficulty * halsteadVolume;

      // Maintainability Index calculation (using Microsoft's formula)
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
      console.error('Error in TypeScript complexity analysis, falling back to simple analysis', error);
      return this.fallbackComplexityAnalysis(sourceCode);
    }
  }
  
  /**
   * Python complexity analysis
   */
  private static analyzePythonComplexity(sourceCode: string): ComplexityMetrics {
    const lines = sourceCode.split('\n');
    
    let cyclomaticComplexity = 1; // Base complexity
    
    // Count Python control flow structures
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        continue;
      }
      
      // Check for control flow keywords
      if (/\s*def\s+/.test(trimmedLine)) {
        cyclomaticComplexity++; // Each function adds complexity
      }
      
      if (/\s*(if|elif|for|while|except)\s+/.test(trimmedLine) || 
          /\s*return\s+.*\s+if\s+.*\s+else\s+/.test(trimmedLine)) { // Ternary in Python
        cyclomaticComplexity++;
      }
      
      // Check for logical operators in conditions
      if (/\s+and\s+|\s+or\s+/.test(trimmedLine)) {
        // Count each logical operator
        const andMatches = trimmedLine.match(/\s+and\s+/g) || [];
        const orMatches = trimmedLine.match(/\s+or\s+/g) || [];
        cyclomaticComplexity += andMatches.length + orMatches.length;
      }
    }
    
    // Simple estimation of Halstead metrics for Python
    const halsteadVolume = lines.length * Math.log2(cyclomaticComplexity + 1);
    const halsteadDifficulty = cyclomaticComplexity / 2;
    
    // Estimate maintainability
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

  /**
   * Fallback complexity analysis for unsupported languages
   */
  private static fallbackComplexityAnalysis(sourceCode: string): ComplexityMetrics {
    const lines = sourceCode.split('\n');
    const lineCount = lines.length;
    
    // Simple complexity heuristics based on line count and control structures
    let cyclomaticComplexity = 1;
    
    // Count common control flow patterns across languages
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('//') || 
          trimmedLine.startsWith('#') || 
          trimmedLine.startsWith('/*') || 
          trimmedLine.startsWith('*') ||
          trimmedLine === '') {
        continue;
      }
      
      // Check for common control flow indicators in most languages
      if (/\b(if|else|switch|case|for|while|do|try|catch|except)\b/.test(trimmedLine)) {
        cyclomaticComplexity++;
      }
      
      // Check for logical operators
      if (/\&\&|\|\||\band\b|\bor\b/.test(trimmedLine)) {
        const matches = trimmedLine.match(/\&\&|\|\||\band\b|\bor\b/g) || [];
        cyclomaticComplexity += matches.length;
      }
    }
    
    // Cap at a reasonable maximum to prevent performance issues
    cyclomaticComplexity = Math.min(cyclomaticComplexity, 50);
    
    // Calculate maintainability inversely related to complexity and line count
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

  /**
   * Generates human-readable complexity recommendations
   */
  public static getComplexityRecommendations(metrics: ComplexityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.cyclomaticComplexity > 15) {
      recommendations.push(
        "High cyclomatic complexity. Consider refactoring into smaller functions with single responsibilities."
      );
    } else if (metrics.cyclomaticComplexity > 10) {
      recommendations.push(
        "Moderate cyclomatic complexity. Consider simplifying nested conditions with early returns or guard clauses."
      );
    }

    if (metrics.maintainabilityIndex < 40) {
      recommendations.push(
        "Low maintainability index. Code may be difficult to maintain. Consider restructuring into smaller modules."
      );
    } else if (metrics.maintainabilityIndex < 60) {
      recommendations.push(
        "Moderate maintainability. Consider adding more documentation and breaking complex logic into named helper functions."
      );
    }

    if (metrics.halsteadMetrics.difficulty > 30) {
      recommendations.push(
        "High cognitive complexity. Look for opportunities to simplify logical expressions or introduce intermediate variables."
      );
    }

    return recommendations.length ? recommendations : [
      "Code complexity is within acceptable ranges. Good job!"
    ];
  }
}