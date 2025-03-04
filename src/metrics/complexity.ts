// src/metrics/complexity.ts
import * as ts from 'typescript';

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
   * Calculates comprehensive code complexity metrics
   * @param sourceCode Full source code as a string
   * @param language Programming language (for language-specific analysis)
   */
  public static analyzeComplexity(sourceCode: string, language: string = 'typescript'): ComplexityMetrics {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return this.analyzeTypeScriptComplexity(sourceCode);
      default:
        return this.fallbackComplexityAnalysis(sourceCode);
    }
  }

  /**
   * Advanced TypeScript/JavaScript complexity analysis using AST
   */
  private static analyzeTypeScriptComplexity(sourceCode: string): ComplexityMetrics {
    const sourceFile = ts.createSourceFile('temp.ts', sourceCode, ts.ScriptTarget.Latest, true);
    
    let cyclomaticComplexity = 0;
    let halsteadOperators = 0;
    let halsteadOperands = 0;

    function traverse(node: ts.Node) {
      // Complexity increasing constructs
      switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.SwitchStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CatchClause:
          cyclomaticComplexity++;
          break;
        
        case ts.SyntaxKind.BinaryExpression:
          // Additional complexity for logical operators
          const binaryExpr = node as ts.BinaryExpression;
          if ([
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken
          ].includes(binaryExpr.operatorToken.kind)) {
            cyclomaticComplexity++;
          }
          break;
      }

      // Halstead metrics counting
      if (ts.isIdentifier(node) || ts.isLiteralExpression(node)) {
        halsteadOperands++;
      }

      ts.forEachChild(node, traverse);
    }

    traverse(sourceFile);

    // Halstead complexity calculations
    const uniqueOperators = new Set([
      '+', '-', '*', '/', '%', 
      '==', '===', '!=', '!==', 
      '&&', '||', '!', 
      '>', '<', '>=', '<='
    ]);

    const halsteadDifficulty = 
      (uniqueOperators.size / 2) * (halsteadOperands / uniqueOperators.size);
    
    const halsteadVolume = halsteadOperands * Math.log2(uniqueOperators.size + halsteadOperands);
    const halsteadEffort = halsteadDifficulty * halsteadVolume;

    // Maintainability Index calculation
    const maintainabilityIndex = Math.max(0, 
      171 - 
      (3.42 * Math.log(halsteadVolume)) - 
      (0.23 * cyclomaticComplexity) - 
      (16.2 * Math.log(sourceCode.split('\n').length))
    );

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

  /**
   * Fallback complexity analysis for unsupported languages
   */
  private static fallbackComplexityAnalysis(sourceCode: string): ComplexityMetrics {
    const lines = sourceCode.split('\n');
    
    // Simple complexity heuristics
    const cyclomaticComplexity = lines.reduce((complexity, line) => {
      const complexityIndicators = [
        /\b(if|else|switch|case|for|while|do)\b/,
        /\&\&|\|\|/,
        /\?:/  // Ternary operators
      ];

      return complexity + complexityIndicators.reduce((acc, regex) => 
        acc + (regex.test(line) ? 1 : 0), 0);
    }, 1);  // Start at 1 for basic path

    return {
      totalComplexity: cyclomaticComplexity,
      cyclomaticComplexity,
      maintainabilityIndex: Math.max(0, 100 - cyclomaticComplexity),
      halsteadMetrics: {
        difficulty: cyclomaticComplexity / 10,
        volume: lines.length,
        effort: cyclomaticComplexity * lines.length
      }
    };
  }

  /**
   * Generates human-readable complexity recommendations
   */
  public static getComplexityRecommendations(metrics: ComplexityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.cyclomaticComplexity > 10) {
      recommendations.push(
        "High cyclomatic complexity detected. Consider refactoring to reduce nested conditions."
      );
    }

    if (metrics.maintainabilityIndex < 50) {
      recommendations.push(
        "Low maintainability index. The code might benefit from breaking into smaller functions."
      );
    }

    if (metrics.halsteadMetrics.difficulty > 20) {
      recommendations.push(
        "High computational complexity. Look for opportunities to simplify logical expressions."
      );
    }

    return recommendations.length ? recommendations : [
      "Code looks good! Maintained complexity within acceptable ranges."
    ];
  }
}