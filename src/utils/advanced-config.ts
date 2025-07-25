/**
 * @file ADVANCED-CONFIG.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Advanced Configuration Manager for Code Pulse
 * Extends base configuration with language-specific settings for complexity thresholds and analysis patterns.
 * Provides runtime customization without persistence for dynamic configuration management.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';

// ------------ INTERFACES
/**
 * Language-specific complexity configuration mapping
 */
export interface LanguageComplexityConfig {
    [language: string]: {
        complexityThreshold: number;
        ignoredPatterns?: RegExp[];
    };
}

// ------------ CLASS
/**
 * Advanced configuration manager for language-specific complexity settings
 */
export class AdvancedConfigManager {
    /**
     * Default language complexity configurations
     */
    private languageComplexityConfig: LanguageComplexityConfig = {
        typescript: { complexityThreshold: 10 },
        javascript: { complexityThreshold: 8 },
        python: { complexityThreshold: 12 }
    };

    /**
     * Creates a new AdvancedConfigManager instance and loads VS Code configuration
     */
    constructor() {
        const config = vscode.workspace.getConfiguration('productivityDashboard');
        const complexityThresholds = config.get<Record<string, number>>('complexityThresholds', {});
        
        // Merge with defaults
        Object.entries(complexityThresholds).forEach(([lang, threshold]) => {
          this.languageComplexityConfig[lang] = {
            ...this.languageComplexityConfig[lang],
            complexityThreshold: threshold
          };
        });
      }

    /**
     * Update language-specific threshold
     * @param language Target language ID
     * @param threshold New complexity threshold
     */
    public setLanguageComplexityThreshold(language: string, threshold: number) {
        this.languageComplexityConfig[language] = {
            ...this.languageComplexityConfig[language], // Preserve existing settings
            complexityThreshold: threshold
        };
    }

    /**
     * Get threshold for specific language
     * @param language Target language ID
     * @returns Configured threshold or fallback (10)
     */
    public getComplexityThreshold(language: string): number {
        const langKey = language.toLowerCase();
        return this.languageComplexityConfig[langKey]?.complexityThreshold ?? 10;
    }
}