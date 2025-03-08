/**
 * src/utils/advanced-config.ts
 * 
 * Language-Specific Configuration Manager
 * 
 * Extends base configuration with per-language settings
 * Not persisted - meant for runtime customization
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';

// -------------------- EXPORTS -------------------- \\

/**
 * Language-specific complexity configuration
 * @interface LanguageComplexityConfig
 * @property {number} complexityThreshold - Language-specific alert threshold
 * @property {RegExp[]} [ignoredPatterns] - Patterns to exclude from analysis
 */
export interface LanguageComplexityConfig {
    [language: string]: {
        complexityThreshold: number;
        ignoredPatterns?: RegExp[];
    };
}

/**
 * Advanced configuration controller
 * @class
 * @remarks
 * - Extends base configuration with language-specific rules
 * - Maintains in-memory configuration only
 * - Used by complexity analysis system
 */
export class AdvancedConfigManager {

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

    // Default language thresholds
    private languageComplexityConfig: LanguageComplexityConfig = {
        typescript: { complexityThreshold: 10 },
        javascript: { complexityThreshold: 8 },
        python: { complexityThreshold: 12 }
    };

    /**
     * Update language-specific threshold
     * @param language - Target language ID
     * @param threshold - New complexity threshold
     * @remarks Preserves existing ignored patterns when updating
     */
    public setLanguageComplexityThreshold(language: string, threshold: number) {
        this.languageComplexityConfig[language] = {
            ...this.languageComplexityConfig[language], // Preserve existing settings
            complexityThreshold: threshold
        };
    }

    /**
     * Get threshold for specific language
     * @param language - Target language ID
     * @returns Configured threshold or fallback (10)
     */
    public getComplexityThreshold(language: string): number {
        const langKey = language.toLowerCase();
        return this.languageComplexityConfig[langKey]?.complexityThreshold ?? 10;
    }
}