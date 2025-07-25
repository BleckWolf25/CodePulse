/**
 * @file NORMALIZER.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Metric Normalizer for Code Pulse
 * Provides standardized scoring across different programming languages by adjusting raw complexity
 * metrics based on language characteristics and calculating confidence levels for normalized results.
 */

// ------------ IMPORTS
import { ComplexityMetrics } from './complexity';
import { ConfigurationService } from '../utils/configuration-service';

// ------------ INTERFACES
/**
 * Extended metrics with normalization and confidence data
 */
export interface NormalizedMetrics extends ComplexityMetrics {
    /** Normalized score on a scale from 0-100 (lower is better) */
    normalizedScore: number;
    /** Confidence level of the normalization (0.0-1.0) */
    confidence: number;
    /** Language-specific adjustment factor applied */
    languageAdjustment: number;
}

// ------------ CLASS
/**
 * Normalizes raw complexity metrics across different programming languages to provide consistent and comparable scoring
 */
export class MetricNormalizer {
    /**
     * Configuration service instance for threshold retrieval
     */
    private config = ConfigurationService.getInstance();

    /**
     * Language-specific weights for normalization
     * Higher values indicate languages where complexity is more impactful;
     * lower values indicate languages where some complexity is more acceptable
     */
    private readonly LANGUAGE_WEIGHTS: Record<string, number> = {
        typescript: 1.0, // Baseline
        javascript: 1.1, // Slightly higher weight (complexity more problematic)
        python: 1.2,     // Higher weight (readability particularly important)
        java: 1.3,       // Higher weight (very structured language)
        csharp: 1.25,    // Higher weight (structured language)
        ruby: 0.9,       // Lower weight (some complexity accepted for expressiveness)
        go: 0.95         // Slightly lower weight (prioritizes simplicity already)
    };

    /**
     * Normalizes raw complexity metrics into a standardized score
     * @param metrics Raw complexity metrics from code analysis
     * @param language Programming language of the analyzed code
     * @returns Extended metrics with normalization factors applied
     */
    public normalize(metrics: ComplexityMetrics, language: string): NormalizedMetrics {
        // Get language-specific weight (default to 1.0 if language unknown)
        const langWeight = this.LANGUAGE_WEIGHTS[language.toLowerCase()] || 1.0;

        // Get language-specific complexity threshold from configuration
        const threshold = this.config.getThreshold(language, 'cyclomatic');

        // Safely extract metrics with fallback values
        const cyclomaticComplexity = metrics?.cyclomaticComplexity ?? 1;
        const maintainabilityIndex = metrics?.maintainabilityIndex ?? 100;
        const halsteadDifficulty = metrics?.halsteadMetrics?.difficulty ?? 1;

        // Calculate normalized score on a scale of 0-100
        // - Higher cyclomatic complexity increases score (weighted by language threshold)
        // - Higher maintainability index decreases score (maintainability is 0-100, higher is better)
        // - Higher Halstead difficulty increases score
        const normalizedScore = Math.min(100, Math.max(0,
            (cyclomaticComplexity / threshold) * 50 +
            (maintainabilityIndex / 100) * 30 +
            (halsteadDifficulty / 30) * 20
        ));

        // Calculate confidence based on metric quality and completeness
        const confidence = this.calculateConfidence(metrics);

        // Return normalized metrics with added normalization data
        return {
            ...metrics,
            normalizedScore,
            confidence,
            languageAdjustment: langWeight
        };
    }

    /**
     * Calculates confidence level for normalized metrics
     * Confidence decreases when metrics are missing or extreme values are encountered,
     * which may indicate analysis limitations or edge cases
     * @param metrics Raw complexity metrics from code analysis
     * @returns Confidence value between 0.3 and 1.0
     * @private
     */
    private calculateConfidence(metrics: ComplexityMetrics): number {
        // Start with perfect confidence
        let confidence = 1.0;

        // Reduce confidence for missing or problematic metrics
        if (!metrics?.maintainabilityIndex) {
            confidence *= 0.8; // Missing maintainability index
        }

        if (!metrics?.halsteadMetrics) {
            confidence *= 0.7; // Missing Halstead metrics
        }

        if ((metrics?.cyclomaticComplexity ?? 0) > 100) {
            confidence *= 0.6; // Extremely high complexity may indicate parsing issues
        }

        if (metrics?.performance?.analysisTime && metrics.performance.analysisTime > 5000) {
            confidence *= 0.9; // Long analysis time may indicate processing issues
        }

        // Ensure confidence never drops below minimum threshold
        return Math.max(0.3, confidence);
    }
}