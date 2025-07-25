/**
 * @file CONFIGURATION-SERVICE.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Configuration Service for Code Pulse
 * Manages complexity configurations for different programming languages with default thresholds
 * and weights that can be overridden by user settings. Implements singleton pattern for consistency.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';

// ------------ INTERFACES
/**
 * Interface representing complexity configuration parameters for a language
 */
export interface ComplexityConfig {
  /** Weight factors for different code constructs */
  weights: {
    components: any;
    /** Weight for loop constructs (for, while, do-while, etc.) */
    loops: number;
    /** Weight for conditional constructs (if, switch, ternary, etc.) */
    conditionals: number;
    /** Weight for function declarations and expressions */
    functions: number;
    /** Weight for class declarations */
    classes: number;
  };
  /** Threshold values for complexity metrics */
  thresholds: {
    /** Maximum acceptable cyclomatic complexity value */
    cyclomatic: number;
    /** Minimum acceptable maintainability index */
    maintainability: number;
    /** Maximum acceptable Halstead complexity measure */
    halstead: number;
    /** Maximum acceptable cognitive complexity */
    cognitive: number;
  };
}

// ------------ CLASS
/**
 * Service responsible for managing complexity configurations with singleton pattern
 */
export class ConfigurationService {
  /**
   * Singleton instance of the ConfigurationService
   */
  private static instance: ConfigurationService;
  
  /**
   * Default configurations for supported languages
   * These values can be partially overridden by user settings
   */
  private readonly defaultConfig: Record<string, ComplexityConfig> = {
    typescript: {
      weights: {
        loops: 1.5,
        conditionals: 1.0,
        functions: 1.0,
        classes: 2.0,
        components: undefined
      },
      thresholds: {
        cyclomatic: 15,
        maintainability: 65,
        halstead: 25,
        cognitive: 20
      }
    },
    javascript: {
      weights: {
        loops: 1.5,
        conditionals: 1.0,
        functions: 1.0,
        classes: 1.5,
        components: undefined
      },
      thresholds: {
        cyclomatic: 12,
        maintainability: 70,
        halstead: 20,
        cognitive: 15
      }
    },
    python: {
      weights: {
        loops: 1.2,
        conditionals: 1.0,
        functions: 1.0,
        classes: 1.8,
        components: undefined
      },
      thresholds: {
        cyclomatic: 20,
        maintainability: 60,
        halstead: 30,
        cognitive: 25
      }
    }
  };

  /**
   * Private constructor to prevent direct instantiation
   * Loads user configuration upon creation
   */
  private constructor() {
    this.loadUserConfig();
  }

  /**
   * Gets the singleton instance of ConfigurationService
   * Creates a new instance if one doesn't exist
   * @returns The singleton ConfigurationService instance
   */
  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  /**
   * Gets configuration for a specific programming language
   * @param language The programming language identifier
   * @returns The complexity configuration for the specified language, or TypeScript config as fallback
   */
  public getConfig(language: string): ComplexityConfig {
    const langKey = language.toLowerCase();
    return this.defaultConfig[langKey] || this.defaultConfig.typescript;
  }

  /**
   * Gets a specific threshold value for a given language
   * @param language The programming language identifier
   * @param metric The specific threshold metric to retrieve
   * @returns The threshold value for the specified metric and language
   */
  public getThreshold(language: string, metric: keyof ComplexityConfig['thresholds']): number {
    return this.getConfig(language).thresholds[metric];
  }

  /**
   * Loads and applies user-defined configuration from VSCode settings
   * Currently only supports overriding cyclomatic complexity thresholds
   * @private
   */
  private loadUserConfig(): void {
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    const userThresholds = config.get<Record<string, number>>('complexityThresholds', {});
    
    // Apply user-defined thresholds to existing language configurations
    Object.entries(userThresholds).forEach(([lang, threshold]) => {
      if (this.defaultConfig[lang]) {
        this.defaultConfig[lang].thresholds.cyclomatic = threshold;
      }
    });
  }
}