// src/utils/advanced-config.ts
export interface LanguageComplexityConfig {
    [language: string]: {
        complexityThreshold: number;
        ignoredPatterns?: RegExp[];
    };
}

export class AdvancedConfigManager {
    private languageComplexityConfig: LanguageComplexityConfig = {
        typescript: { complexityThreshold: 10 },
        javascript: { complexityThreshold: 8 },
        python: { complexityThreshold: 12 }
    };

    public setLanguageComplexityThreshold(language: string, threshold: number) {
        this.languageComplexityConfig[language] = {
            ...this.languageComplexityConfig[language],
            complexityThreshold: threshold
        };
    }

    public getComplexityThreshold(language: string): number {
        return this.languageComplexityConfig[language]?.complexityThreshold || 10;
    }
}