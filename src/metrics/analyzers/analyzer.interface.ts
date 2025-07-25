/**
 * @file ANALYZER-INTERFACE.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * Interface defining requirements for language-specific code analyzers
 */

// ------------ IMPORTS
import { ComplexityMetrics, LanguageConfig } from '../complexity';

// ------------ INTERFACE
export interface ILanguageAnalyzer {
  /**
   * Analyze source code and return complexity metrics
   * @param sourceCode - Source code to analyze
   * @param config - Configuration for complexity analysis
   * @returns Calculated complexity metrics
   */
  analyze(sourceCode: string, config: LanguageConfig): ComplexityMetrics;
  
  /**
   * Get the language name supported by this analyzer
   * @returns Name of the supported language
   */
  getLanguageName(): string;
  
  /**
   * Check if this analyzer supports a specific language
   * @param language - Language identifier to check
   * @returns Whether this analyzer supports the language
   */
  supportsLanguage(language: string): boolean;
}