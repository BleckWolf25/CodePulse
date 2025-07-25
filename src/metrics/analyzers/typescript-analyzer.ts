/**
 * @file TYPESCRIPT-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * TypeScript Complexity Analyzer
 * Analyzes TypeScript source code and calculates complexity metrics.
 */

// ------------ IMPORTS
import { ComplexityMetrics, LanguageConfig } from '../complexity';
import { ILanguageAnalyzer } from './analyzer.interface';

// ------------ CLASS
export class TypeScriptAnalyzer implements ILanguageAnalyzer {
  private readonly SUPPORTED_LANGUAGES = ['typescript', 'javascript'];

  public getLanguageName(): string {
    return 'typescript';
  }


  public supportsLanguage(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  public analyze(sourceCode: string, _config: LanguageConfig): ComplexityMetrics {
    // Basic complexity analysis without TypeScript AST
    return this.getFallbackMetrics(sourceCode);
  }

  private getFallbackMetrics(sourceCode: string): ComplexityMetrics {
    // Basic complexity analysis using simple heuristics
    const lines = sourceCode.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;

    // Count basic complexity indicators
    let complexity = 1; // Base complexity

    for (const line of lines) {
      const trimmed = line.trim();

      // Count control flow statements
      if (trimmed.match(/\b(if|else|while|for|switch|case|catch|try)\b/)) {
        complexity++;
      }

      // Count logical operators
      const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
      complexity += logicalOps;

      // Count function declarations
      if (trimmed.match(/\b(function|=>|\bclass\b)/)) {
        complexity++;
      }
    }

    const maintainabilityIndex = Math.max(0, Math.min(100, 171 - (5.2 * Math.log(nonEmptyLines)) - (0.23 * complexity)));

    return {
      totalComplexity: complexity,
      cyclomaticComplexity: complexity,
      maintainabilityIndex,
      halsteadMetrics: {
        difficulty: Math.max(1, complexity / 2),
        volume: nonEmptyLines * 4.7, // Rough estimate
        effort: complexity * nonEmptyLines
      }
    };
  }
}
