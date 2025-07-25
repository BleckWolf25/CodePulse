/**
 * @file BASE-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * Base abstract class for language-specific code analyzers
 * Provides common functionality for complexity metric calculations
 */

// ------------ IMPORTS
import { LanguageConfig, ComplexityMetrics } from "../complexity";
import { ILanguageAnalyzer } from "./analyzer.interface";

// ------------ CLASS
export abstract class BaseAnalyzer implements ILanguageAnalyzer {
    /**
     * Abstract method to analyze source code and calculate complexity metrics
     * @param sourceCode - Source code to analyze
     * @param config - Configuration for complexity analysis
     */
    abstract analyze(sourceCode: string, config: LanguageConfig): ComplexityMetrics;

    /**
     * Returns the language name derived from class name
     * @returns Language name in lowercase
     */
    getLanguageName(): string {
        return this.constructor.name.replace('Analyzer', '').toLowerCase();
    }

    /**
     * Checks if this analyzer supports a specific language
     * @param language - Language identifier to check
     * @returns Whether this analyzer supports the language
     */
    supportsLanguage(language: string): boolean {
        return language.toLowerCase() === this.getLanguageName();
    }

    /**
     * Calculates standard complexity metrics from analysis state
     * @param state - Analysis state containing raw metrics
     * @param config - Language configuration with thresholds
     * @returns Calculated complexity metrics
     */
    protected calculateBaseMetrics(
        state: {
            cyclomaticComplexity: number;
            uniqueOperators: Set<string>;
            uniqueOperands: Set<string>;
            operatorCount: number;
            operandCount: number;
            lineCount: number;
        },
        config: LanguageConfig
    ): ComplexityMetrics {
        const cyclomaticComplexity = this.normalizeComplexity(
            state.cyclomaticComplexity,
            config.thresholds.cyclomatic
        );

        // Calculate Halstead metrics
        const n1 = state.uniqueOperators.size || 1; // Unique operators
        const n2 = state.uniqueOperands.size || 1;  // Unique operands
        const N1 = state.operatorCount || 1;        // Total operators
        const N2 = state.operandCount || 1;         // Total operands

        const halsteadVolume = (N1 + N2) * Math.log2(n1 + n2);
        const halsteadDifficulty = this.calculateDifficulty(n1, n2, N2);
        const halsteadEffort = this.calculateEffort(halsteadDifficulty, halsteadVolume);

        return {
            totalComplexity: cyclomaticComplexity,
            cyclomaticComplexity,
            maintainabilityIndex: this.calculateMaintainabilityIndex(
                cyclomaticComplexity, 
                halsteadVolume,
                state.lineCount
            ),
            halsteadMetrics: {
                difficulty: halsteadDifficulty,
                volume: halsteadVolume,
                effort: halsteadEffort
            }
        };
    }

    /**
     * Calculates maintainability index using standard formula
     * @param complexity - Cyclomatic complexity
     * @param volume - Halstead volume
     * @param lines - Source code line count
     * @returns Maintainability index (0-100)
     */
    protected calculateMaintainabilityIndex(
        complexity: number,
        volume: number,
        lines: number
    ): number {
        // Standard maintainability index calculation
        const baseIndex = Math.max(0, (171 -
            (5.2 * Math.log(volume)) -
            (0.23 * complexity) -
            (16.2 * Math.log(lines))
        ));

        // Normalize to 0-100 scale
        return Math.min(100, baseIndex);
    }

    /**
     * Normalizes complexity to be within threshold
     * @param rawComplexity - Raw complexity value
     * @param threshold - Maximum complexity value
     * @returns Normalized complexity
     */
    protected normalizeComplexity(rawComplexity: number, threshold: number): number {
        return Math.min(rawComplexity, threshold);
    }

    /**
     * Calculates Halstead effort metric
     * @param difficulty - Halstead difficulty
     * @param volume - Halstead volume
     * @returns Halstead effort
     */
    protected calculateEffort(difficulty: number, volume: number): number {
        return difficulty * volume;
    }

    /**
     * Calculates Halstead difficulty metric
     * @param uniqueOperators - Number of unique operators
     * @param uniqueOperands - Number of unique operands
     * @param totalOperands - Total operand count
     * @returns Halstead difficulty
     */
    protected calculateDifficulty(
        uniqueOperators: number,
        uniqueOperands: number,
        totalOperands: number
    ): number {
        return (uniqueOperators / 2) * (totalOperands / Math.max(1, uniqueOperands));
    }
}