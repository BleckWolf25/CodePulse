/**
 * Configuration Manager
 * 
 * Centralized configuration management with validation, migration,
 * and error handling for all extension settings.
 */

import * as vscode from 'vscode';
import {
  ConfigSchemaValidator,
  ValidationResult,
  MAIN_CONFIG_SCHEMA,
  LANGUAGE_CONFIG_SCHEMA,
  ConfigCategory,
  CONFIG_GROUPS
} from './config-schema';
import { ConfigMigrationManager, MigrationResult } from './config-migration';

// ------------ CONSOLIDATED INTERFACES

// Configuration group interface
export interface ConfigGroup {
  id: string;
  title: string;
  description: string;
  category: ConfigCategory;
  order: number;
}

// Legacy configuration interface for backward compatibility
export interface ProductivityConfig {
  enableMetricTracking: boolean;
  complexityThreshold: number;
  trackingInterval: number;
  excludedLanguages: string[];
  enableDetailedLogging: boolean;
}

// Comprehensive configuration interface
export interface ExtensionConfig {
  // Core settings
  enableMetricTracking: boolean;
  complexityThreshold: number;
  trackingInterval: number;
  excludedLanguages: string[];
  enableDetailedLogging: boolean;

  // Storage settings
  maxStorageSize: number;
  dataRetentionDays: number;

  // UI settings
  theme: 'light' | 'dark' | 'auto';
  enableNotifications: boolean;

  // WebSocket settings
  websocket: {
    enabled: boolean;
    fallbackToPolling: boolean;
    updateInterval: number;
    maxClients: number;
    pingInterval: number;
    connectionTimeout: number;
  };

  // Analytics settings
  analytics: {
    enableAdvancedAnalytics: boolean;
    enableTrendAnalysis: boolean;
    enablePerformanceBenchmarking: boolean;
    enableTeamMetrics: boolean;
    enableCodeHealthScoring: boolean;
    enableHistoricalAnalysis: boolean;
    enableRegressionDetection: boolean;
    enableProductivityPatterns: boolean;
    updateFrequency: number;
  };

  // Dashboard settings
  dashboard: {
    enableDrillDown: boolean;
    enableFiltering: boolean;
    enableExport: boolean;
    enableGoalTracking: boolean;
    refreshInterval: number;
  };

  // Reporting settings
  reporting: {
    enablePDFReports: boolean;
    enableScheduledReports: boolean;
    enableTeamReports: boolean;
    enableCIIntegration: boolean;
  };

  // Language-specific settings
  complexityThresholds: Record<string, number>;
  languageConfigs: Record<string, ComplexityConfig>;
}

// Configuration health information
export interface ConfigHealth {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  issues: {
    category: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    fixable: boolean;
    autoFixAvailable: boolean;
  }[];
  recommendations: string[];
  lastValidated: number;
}

// Configuration update handler
export type ConfigUpdateHandler = (key: string, oldValue: any, newValue: any) => void;

// Configuration registry for language-specific configs
export interface ConfigRegistryEntry {
  config: ComplexityConfig;
  validator?: (config: ComplexityConfig) => boolean;
  defaults?: Partial<ComplexityConfig>;
  inheritance?: string; // Parent language to inherit from
  updateHandlers: ConfigUpdateHandler[];
}

// Language-specific complexity configuration
export interface LanguageComplexityConfig {
  [language: string]: {
    complexityThreshold: number;
    ignoredPatterns?: RegExp[];
  };
}

// Complexity configuration interface
export interface ComplexityConfig {
  weights: {
    loops?: number;
    conditionals?: number;
    functions?: number;
    classes?: number;
    components?: number;
    cyclomatic?: number;
    cognitive?: number;
    nesting?: number;
    length?: number;
  };
  thresholds: {
    cyclomatic: number;
    maintainability?: number;
    halstead?: number;
    cognitive: number;
    nesting?: number;
    length?: number;
  };
  options?: {
    ignoreComments?: boolean;
    ignoreEmptyLines?: boolean;
    enableCaching?: boolean;
  };
}

export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  isValid: boolean;
  errors: string[];
}

export interface ConfigGroup {
  id: string;
  title: string;
  description: string;
  order: number;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private validator = ConfigSchemaValidator.getInstance();
  private migrationManager = ConfigMigrationManager.getInstance();
  private changeListeners: ((event: ConfigChangeEvent) => void)[] = [];
  private configCache = new Map<string, any>();
  private lastValidationResults = new Map<string, ValidationResult>();
  private languageConfigCache = new Map<string, ComplexityConfig>();
  private defaultLanguageConfigs = new Map<string, ComplexityConfig>();

  // ===== CONSOLIDATED FUNCTIONALITY

  // Configuration registry for language-specific configs
  private configRegistry = new Map<string, ConfigRegistryEntry>();
  private configChangeEmitter = new vscode.EventEmitter<void>();
  private configurationContext = new Map<string, any>();
  private inheritanceMap = new Map<string, string>();
  private configUpdateHandlers = new Map<string, ConfigUpdateHandler[]>();

  // Configuration health tracking
  private configHealth: ConfigHealth | null = null;
  private healthUpdateInterval: NodeJS.Timeout | null = null;

  // Default language configurations (consolidated from ConfigurationService)
  private readonly DEFAULT_LANGUAGE_CONFIGS: Record<string, ComplexityConfig> = {
    typescript: {
      weights: {
        loops: 1.5,
        conditionals: 1.0,
        functions: 1.0,
        classes: 2.0,
        cyclomatic: 1.0,
        cognitive: 1.2,
        nesting: 1.1,
        length: 0.5
      },
      thresholds: {
        cyclomatic: 15,
        maintainability: 65,
        halstead: 25,
        cognitive: 20,
        nesting: 4,
        length: 500
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    },
    javascript: {
      weights: {
        loops: 1.5,
        conditionals: 1.0,
        functions: 1.0,
        classes: 1.5,
        cyclomatic: 1.0,
        cognitive: 1.1,
        nesting: 1.0,
        length: 0.4
      },
      thresholds: {
        cyclomatic: 12,
        maintainability: 70,
        halstead: 20,
        cognitive: 15,
        nesting: 4,
        length: 400
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    },
    python: {
      weights: {
        loops: 1.2,
        conditionals: 1.0,
        functions: 1.0,
        classes: 1.8,
        cyclomatic: 1.0,
        cognitive: 1.3,
        nesting: 1.2,
        length: 0.6
      },
      thresholds: {
        cyclomatic: 20,
        maintainability: 60,
        halstead: 30,
        cognitive: 25,
        nesting: 5,
        length: 600
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    },
    java: {
      weights: {
        loops: 1.4,
        conditionals: 1.0,
        functions: 1.2,
        classes: 2.2,
        cyclomatic: 1.0,
        cognitive: 1.1,
        nesting: 1.0,
        length: 0.7
      },
      thresholds: {
        cyclomatic: 15,
        maintainability: 65,
        halstead: 25,
        cognitive: 20,
        nesting: 4,
        length: 500
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    },
    csharp: {
      weights: {
        loops: 1.4,
        conditionals: 1.0,
        functions: 1.2,
        classes: 2.0,
        cyclomatic: 1.0,
        cognitive: 1.1,
        nesting: 1.0,
        length: 0.6
      },
      thresholds: {
        cyclomatic: 15,
        maintainability: 65,
        halstead: 25,
        cognitive: 20,
        nesting: 4,
        length: 500
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    }
  };

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  constructor() {
    this.initializeConfigWatcher();
    this.initializeDefaultLanguageConfigs();
    this.initializeConfigRegistry();
    this.initializeHealthMonitoring();
  }

  /**
   * Initialize the extension configuration
   */
  public async initialize(): Promise<void> {
    try {
      // Perform automatic migration if needed
      const migrationResult = await this.migrationManager.autoMigrate();
      
      if (migrationResult && !migrationResult.success) {
        vscode.window.showErrorMessage(
          'Configuration migration failed. Some features may not work correctly.',
          'View Details'
        ).then(selection => {
          if (selection === 'View Details') {
            this.showConfigurationHelp();
          }
        });
      }

      // Validate current configuration
      await this.validateAllConfigurations();

      // Cache initial configuration
      this.refreshConfigCache();

    } catch (error) {
      console.error('Configuration initialization failed:', error);
      vscode.window.showErrorMessage(
        'Failed to initialize configuration. Please check your settings.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'productivityDashboard');
        }
      });
    }
  }

  /**
   * Get configuration value with validation
   */
  public get<T>(key: string, defaultValue?: T): T {
    try {
      const config = vscode.workspace.getConfiguration('productivityDashboard');
      const value = config.get<T>(key, defaultValue as T);

      // Check cache for validation results
      const cacheKey = `productivityDashboard.${key}`;
      const cachedResult = this.lastValidationResults.get(cacheKey);
      
      if (cachedResult && !cachedResult.isValid) {
        console.warn(`Configuration key '${key}' has validation errors:`, cachedResult.errors);
        // Return migrated value if available, otherwise default
        return (cachedResult.migratedConfig?.[key] ?? defaultValue) as T;
      }

      return value;
    } catch (error) {
      console.error(`Failed to get configuration key '${key}':`, error);
      return defaultValue as T;
    }
  }

  /**
   * Set configuration value with validation
   */
  public async set<T>(
    key: string, 
    value: T, 
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<boolean> {
    try {
      // Validate the new value
      const validationResult = await this.validateConfigValue(key, value);
      
      if (!validationResult.isValid) {
        const errorMessage = `Invalid configuration value for '${key}': ${
          validationResult.errors.map(e => e.message).join(', ')
        }`;
        
        vscode.window.showErrorMessage(errorMessage, 'View Details').then(selection => {
          if (selection === 'View Details') {
            this.showValidationErrors(key, validationResult);
          }
        });
        
        return false;
      }

      // Apply the configuration
      const config = vscode.workspace.getConfiguration('productivityDashboard');
      await config.update(key, validationResult.migratedConfig ?? value, target);

      // Update cache
      this.configCache.set(key, validationResult.migratedConfig ?? value);
      this.lastValidationResults.set(`productivityDashboard.${key}`, validationResult);

      return true;
    } catch (error) {
      console.error(`Failed to set configuration key '${key}':`, error);
      vscode.window.showErrorMessage(`Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Get all configuration with validation
   */
  public getAllConfig(): any {
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    const allConfig: any = {};

    // Extract all configuration values
    const inspect = config.inspect('');
    if (inspect) {
      Object.assign(allConfig, inspect.defaultValue);
      Object.assign(allConfig, inspect.globalValue);
      Object.assign(allConfig, inspect.workspaceValue);
      Object.assign(allConfig, inspect.workspaceFolderValue);
    }

    return allConfig;
  }

  /**
   * Validate specific configuration value
   */
  public async validateConfigValue(key: string, value: any): Promise<ValidationResult> {
    try {
      // Create a temporary config object for validation
      const tempConfig = { [key]: value };
      
      // Validate against main schema
      const result = this.validator.validate(tempConfig, MAIN_CONFIG_SCHEMA, 'productivityDashboard');
      
      // Cache the result
      this.lastValidationResults.set(`productivityDashboard.${key}`, result);
      
      return result;
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          path: key,
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          value
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate all configurations
   */
  public async validateAllConfigurations(): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    
    try {
      // Validate main configuration
      const mainConfig = this.getAllConfig();
      const mainResult = this.validator.validateMainConfig(mainConfig);
      results.set('main', mainResult);
      this.lastValidationResults.set('productivityDashboard', mainResult);

      // Validate language-specific configurations
      const languageConfigs = this.get('languageConfigs', {});
      for (const [language, config] of Object.entries(languageConfigs)) {
        const langResult = this.validator.validateLanguageConfig(config, language);
        results.set(`language.${language}`, langResult);
        this.lastValidationResults.set(`productivityDashboard.languageConfigs.${language}`, langResult);
      }

      // Show validation summary if there are issues
      const hasErrors = Array.from(results.values()).some(r => !r.isValid);
      const hasWarnings = Array.from(results.values()).some(r => r.warnings.length > 0);

      if (hasErrors) {
        vscode.window.showWarningMessage(
          'Configuration validation found errors. Some features may not work correctly.',
          'View Details',
          'Fix Automatically'
        ).then(selection => {
          if (selection === 'View Details') {
            this.showAllValidationResults(results);
          } else if (selection === 'Fix Automatically') {
            this.autoFixConfiguration(results);
          }
        });
      } else if (hasWarnings) {
        vscode.window.showInformationMessage(
          'Configuration validation found warnings.',
          'View Details'
        ).then(selection => {
          if (selection === 'View Details') {
            this.showAllValidationResults(results);
          }
        });
      }

    } catch (error) {
      console.error('Configuration validation failed:', error);
      const errorResult: ValidationResult = {
        isValid: false,
        errors: [{
          path: 'global',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          value: null
        }],
        warnings: []
      };
      results.set('error', errorResult);
    }

    return results;
  }

  /**
   * Reset configuration to defaults
   */
  public async resetToDefaults(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('productivityDashboard');
      
      // Get default values from schema
      const defaults = this.extractDefaultValues(MAIN_CONFIG_SCHEMA);
      
      // Apply defaults
      for (const [key, value] of Object.entries(defaults)) {
        await config.update(key, value, vscode.ConfigurationTarget.Global);
      }

      // Clear cache
      this.configCache.clear();
      this.lastValidationResults.clear();

      // Refresh cache with new values
      this.refreshConfigCache();

      vscode.window.showInformationMessage('Configuration reset to defaults successfully.');
    } catch (error) {
      console.error('Failed to reset configuration:', error);
      vscode.window.showErrorMessage(`Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add configuration change listener
   */
  public onConfigurationChange(listener: (event: ConfigChangeEvent) => void): vscode.Disposable {
    this.changeListeners.push(listener);
    
    return new vscode.Disposable(() => {
      const index = this.changeListeners.indexOf(listener);
      if (index >= 0) {
        this.changeListeners.splice(index, 1);
      }
    });
  }



  // ------------ LEGACY CONFIGURATION SUPPORT =====

  /**
   * Get legacy configuration interface for backward compatibility
   */
  public getConfig(): ProductivityConfig {
    return {
      enableMetricTracking: this.get('enableMetricTracking', true),
      complexityThreshold: this.get('complexityThreshold', 10),
      trackingInterval: this.get('trackingInterval', 30),
      excludedLanguages: this.get('excludedLanguages', ['json', 'lock']),
      enableDetailedLogging: this.get('enableDetailedLogging', false)
    };
  }

  // ------------ LANGUAGE-SPECIFIC CONFIGURATION =====



  /**
   * Set language-specific configuration
   */
  public async setLanguageConfig(language: string, config: Partial<ComplexityConfig>): Promise<boolean> {
    const langKey = language.toLowerCase();

    try {
      // Validate the configuration
      const validationResult = this.validator.validateLanguageConfig(config, langKey);

      if (!validationResult.isValid) {
        const errorMessage = `Invalid language configuration for '${language}': ${
          validationResult.errors.map(e => e.message).join(', ')
        }`;

        vscode.window.showErrorMessage(errorMessage);
        return false;
      }

      // Get current language configs
      const languageConfigs = this.get('languageConfigs', {} as Record<string, ComplexityConfig>);

      // Merge with defaults to ensure complete config
      const defaultConfig = this.getDefaultLanguageConfig(language);
      const completeConfig = { ...defaultConfig, ...config };

      // Update the specific language config
      languageConfigs[langKey] = completeConfig;

      // Save to VS Code settings
      const success = await this.set('languageConfigs', languageConfigs);

      if (success) {
        // Clear cache to force reload
        this.languageConfigCache.delete(langKey);
      }

      return success;
    } catch (error) {
      console.error(`Failed to set language configuration for ${language}:`, error);
      return false;
    }
  }

  /**
   * Get complexity threshold for a specific language
   */
  public getComplexityThreshold(language: string): number {
    const langKey = language.toLowerCase();

    // Check language-specific thresholds first
    const complexityThresholds = this.get('complexityThresholds', {} as Record<string, number>);
    if (complexityThresholds[langKey] !== undefined) {
      return complexityThresholds[langKey];
    }

    // Check language config
    const langConfig = this.getLanguageConfig(langKey);
    if (langConfig.thresholds.cyclomatic !== undefined) {
      return langConfig.thresholds.cyclomatic;
    }

    // Fall back to global threshold
    return this.get('complexityThreshold', 10);
  }

  /**
   * Set complexity threshold for a specific language
   */
  public async setLanguageComplexityThreshold(language: string, threshold: number): Promise<boolean> {
    const langKey = language.toLowerCase();

    try {
      // Get current complexity thresholds
      const complexityThresholds = this.get('complexityThresholds', {} as Record<string, number>);

      // Update the specific language threshold
      complexityThresholds[langKey] = threshold;

      // Save to VS Code settings
      return await this.set('complexityThresholds', complexityThresholds);
    } catch (error) {
      console.error(`Failed to set complexity threshold for ${language}:`, error);
      return false;
    }
  }

  /**
   * Get configuration groups for UI organization
   */
  public getConfigurationGroups(): ConfigGroup[] {
    return [
      {
        id: 'core',
        title: 'Core Settings',
        description: 'Essential configuration options for the extension',
        category: 'general' as ConfigCategory,
        order: 1
      },
      {
        id: 'languages',
        title: 'Language Settings',
        description: 'Language-specific configuration options',
        category: 'general' as ConfigCategory,
        order: 2
      },
      {
        id: 'websocket',
        title: 'WebSocket Settings',
        description: 'Real-time communication configuration',
        category: 'general' as ConfigCategory,
        order: 3
      },
      {
        id: 'analytics',
        title: 'Analytics Settings',
        description: 'Advanced analytics and reporting options',
        category: 'general' as ConfigCategory,
        order: 4
      },
      {
        id: 'dashboard',
        title: 'Dashboard Settings',
        description: 'Dashboard appearance and behavior options',
        category: 'general' as ConfigCategory,
        order: 5
      },
      {
        id: 'reporting',
        title: 'Reporting Settings',
        description: 'Report generation and export options',
        category: 'general' as ConfigCategory,
        order: 6
      },
      {
        id: 'storage',
        title: 'Storage Settings',
        description: 'Data storage and retention options',
        category: 'general' as ConfigCategory,
        order: 7
      },
      {
        id: 'ui',
        title: 'UI Settings',
        description: 'User interface preferences',
        category: 'general' as ConfigCategory,
        order: 8
      }
    ];
  }

  /**
   * Initialize default language configurations
   */
  private initializeDefaultLanguageConfigs(): void {
    // TypeScript/JavaScript
    this.defaultLanguageConfigs.set('typescript', {
      weights: {
        cyclomatic: 1.5,
        cognitive: 1.0,
        nesting: 1.0,
        length: 0.5
      },
      thresholds: {
        cyclomatic: 15,
        cognitive: 20,
        nesting: 4,
        length: 500
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    });

    this.defaultLanguageConfigs.set('javascript', {
      weights: {
        cyclomatic: 1.5,
        cognitive: 1.0,
        nesting: 1.0,
        length: 0.5
      },
      thresholds: {
        cyclomatic: 12,
        cognitive: 15,
        nesting: 4,
        length: 400
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    });

    // Python
    this.defaultLanguageConfigs.set('python', {
      weights: {
        cyclomatic: 1.2,
        cognitive: 1.0,
        nesting: 1.0,
        length: 0.3
      },
      thresholds: {
        cyclomatic: 20,
        cognitive: 25,
        nesting: 5,
        length: 600
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    });

    // Java
    this.defaultLanguageConfigs.set('java', {
      weights: {
        cyclomatic: 1.3,
        cognitive: 1.0,
        nesting: 1.2,
        length: 0.4
      },
      thresholds: {
        cyclomatic: 15,
        cognitive: 20,
        nesting: 4,
        length: 500
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    });

    // C#
    this.defaultLanguageConfigs.set('csharp', {
      weights: {
        cyclomatic: 1.3,
        cognitive: 1.0,
        nesting: 1.2,
        length: 0.4
      },
      thresholds: {
        cyclomatic: 15,
        cognitive: 20,
        nesting: 4,
        length: 500
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    });

    // Add more languages as needed...
  }

  /**
   * Get default configuration for a language
   */
  private getDefaultLanguageConfig(_language: string): ComplexityConfig {
    // Return TypeScript config as fallback
    return this.defaultLanguageConfigs.get('typescript') || {
      weights: {
        cyclomatic: 1.0,
        cognitive: 1.0,
        nesting: 1.0,
        length: 0.5
      },
      thresholds: {
        cyclomatic: 10,
        cognitive: 15,
        nesting: 4,
        length: 500
      },
      options: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    };
  }

  /**
   * Merge language configurations
   */
  private mergeLanguageConfigs(defaultConfig: ComplexityConfig, userConfig?: Partial<ComplexityConfig>): ComplexityConfig {
    if (!userConfig) {
      return defaultConfig;
    }

    return {
      weights: {
        ...defaultConfig.weights,
        ...userConfig.weights
      },
      thresholds: {
        ...defaultConfig.thresholds,
        ...userConfig.thresholds
      },
      options: {
        ...defaultConfig.options,
        ...userConfig.options
      }
    };
  }

  /**
   * Initialize configuration change watcher
   */
  private initializeConfigWatcher(): void {
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('productivityDashboard')) {
        // Get the changed configuration
        const config = vscode.workspace.getConfiguration('productivityDashboard');
        
        // Find what changed
        for (const [key, oldValue] of this.configCache.entries()) {
          const newValue = config.get(key);
          
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            // Validate the new value
            const validationResult = await this.validateConfigValue(key, newValue);
            
            // Create change event
            const changeEvent: ConfigChangeEvent = {
              key,
              oldValue,
              newValue,
              isValid: validationResult.isValid,
              errors: validationResult.errors.map(e => e.message)
            };

            // Update cache
            this.configCache.set(key, newValue);

            // Notify listeners
            this.changeListeners.forEach(listener => {
              try {
                listener(changeEvent);
              } catch (error) {
                console.error('Configuration change listener error:', error);
              }
            });
          }
        }

        // Refresh cache
        this.refreshConfigCache();
      }
    });
  }

  /**
   * Refresh configuration cache
   */
  private refreshConfigCache(): void {
    const config = this.getAllConfig();
    this.configCache.clear();
    
    for (const [key, value] of Object.entries(config)) {
      this.configCache.set(key, value);
    }
  }

  /**
   * Extract default values from schema
   */
  private extractDefaultValues(schema: any, prefix: string = ''): any {
    const defaults: any = {};
    
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const prop = propSchema as any;
        
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        } else if (prop.type === 'object' && prop.properties) {
          defaults[key] = this.extractDefaultValues(prop, fullKey);
        }
      }
    }
    
    return defaults;
  }

  /**
   * Show validation errors in output channel
   */
  private showValidationErrors(key: string, result: ValidationResult): void {
    const outputChannel = vscode.window.createOutputChannel('Code Pulse - Configuration Validation');
    
    outputChannel.appendLine(`=== Configuration Validation Errors for '${key}' ===`);
    
    if (result.errors.length > 0) {
      outputChannel.appendLine('Errors:');
      result.errors.forEach(error => {
        outputChannel.appendLine(`  - ${error.path}: ${error.message}`);
      });
    }
    
    if (result.warnings.length > 0) {
      outputChannel.appendLine('Warnings:');
      result.warnings.forEach(warning => {
        outputChannel.appendLine(`  - ${warning.path}: ${warning.message}`);
      });
    }
    
    outputChannel.show();
  }

  /**
   * Show all validation results
   */
  private showAllValidationResults(results: Map<string, ValidationResult>): void {
    const outputChannel = vscode.window.createOutputChannel('Code Pulse - Configuration Validation');
    
    outputChannel.appendLine('=== Configuration Validation Results ===');
    
    for (const [key, result] of results.entries()) {
      outputChannel.appendLine(`\n${key}:`);
      outputChannel.appendLine(`  Valid: ${result.isValid}`);
      
      if (result.errors.length > 0) {
        outputChannel.appendLine('  Errors:');
        result.errors.forEach(error => {
          outputChannel.appendLine(`    - ${error.path}: ${error.message}`);
        });
      }
      
      if (result.warnings.length > 0) {
        outputChannel.appendLine('  Warnings:');
        result.warnings.forEach(warning => {
          outputChannel.appendLine(`    - ${warning.path}: ${warning.message}`);
        });
      }
    }
    
    outputChannel.show();
  }

  /**
   * Auto-fix configuration issues
   */
  private async autoFixConfiguration(results: Map<string, ValidationResult>): Promise<void> {
    let fixedCount = 0;
    
    for (const [key, result] of results.entries()) {
      if (!result.isValid && result.migratedConfig) {
        try {
          if (key === 'main') {
            // Apply main configuration fixes
            for (const [configKey, value] of Object.entries(result.migratedConfig)) {
              await this.set(configKey, value);
              fixedCount++;
            }
          } else if (key.startsWith('language.')) {
            // Apply language-specific fixes
            const language = key.replace('language.', '');
            const languageConfigs = this.get('languageConfigs', {} as Record<string, ComplexityConfig>);
            languageConfigs[language] = result.migratedConfig;
            await this.set('languageConfigs', languageConfigs);
            fixedCount++;
          }
        } catch (error) {
          console.error(`Failed to auto-fix configuration for ${key}:`, error);
        }
      }
    }
    
    if (fixedCount > 0) {
      vscode.window.showInformationMessage(`Auto-fixed ${fixedCount} configuration issues.`);
      await this.validateAllConfigurations();
    } else {
      vscode.window.showWarningMessage('No configuration issues could be automatically fixed.');
    }
  }

  /**
   * Show configuration help
   */
  private showConfigurationHelp(): void {
    const outputChannel = vscode.window.createOutputChannel('Code Pulse - Configuration Help');
    
    outputChannel.appendLine('=== Code Pulse Configuration Help ===');
    outputChannel.appendLine('');
    outputChannel.appendLine('If you are experiencing configuration issues, try the following:');
    outputChannel.appendLine('');
    outputChannel.appendLine('1. Reset to defaults:');
    outputChannel.appendLine('   - Open Command Palette (Ctrl+Shift+P)');
    outputChannel.appendLine('   - Run "Code Pulse: Reset Configuration"');
    outputChannel.appendLine('');
    outputChannel.appendLine('2. Manual configuration:');
    outputChannel.appendLine('   - Open Settings (Ctrl+,)');
    outputChannel.appendLine('   - Search for "productivityDashboard"');
    outputChannel.appendLine('   - Adjust settings as needed');
    outputChannel.appendLine('');
    outputChannel.appendLine('3. Check for extension updates:');
    outputChannel.appendLine('   - Go to Extensions view');
    outputChannel.appendLine('   - Check for Code Pulse updates');
    outputChannel.appendLine('');
    outputChannel.appendLine('For more help, visit: https://github.com/BleckWolf25/Dev-Productivity-Dashboard');
    
    outputChannel.show();
  }

  // ===== CONSOLIDATED CONFIGURATION REGISTRY METHODS ===== //

  /**
   * Initialize the configuration registry with default language configs
   */
  private initializeConfigRegistry(): void {
    // Register default language configurations
    Object.entries(this.DEFAULT_LANGUAGE_CONFIGS).forEach(([language, config]) => {
      this.registerLanguageConfig(language, config);
    });

    // Set up inheritance relationships
    this.setLanguageInheritance('tsx', 'typescript');
    this.setLanguageInheritance('jsx', 'javascript');
    this.setLanguageInheritance('vue', 'javascript');
    this.setLanguageInheritance('svelte', 'javascript');
  }

  /**
   * Register a language-specific configuration
   */
  public registerLanguageConfig(
    language: string,
    config: ComplexityConfig,
    validator?: (config: ComplexityConfig) => boolean
  ): void {
    const normalizedLang = language.toLowerCase();

    // Validate the configuration
    this.validateLanguageConfig(config);

    // Merge with defaults if inheritance is set
    const finalConfig = this.mergeWithInheritance(normalizedLang, config);

    // Store in registry
    this.configRegistry.set(normalizedLang, {
      config: finalConfig,
      validator,
      defaults: this.DEFAULT_LANGUAGE_CONFIGS[normalizedLang],
      inheritance: this.inheritanceMap.get(normalizedLang),
      updateHandlers: []
    });

    // Update cache
    this.languageConfigCache.set(normalizedLang, finalConfig);

    // Notify change
    this.configChangeEmitter.fire();
  }

  /**
   * Get language-specific configuration with fallback
   */
  public getLanguageConfig(language: string): ComplexityConfig {
    const normalizedLang = language.toLowerCase();

    // Check cache first
    if (this.languageConfigCache.has(normalizedLang)) {
      return this.languageConfigCache.get(normalizedLang)!;
    }

    // Check registry
    const registryEntry = this.configRegistry.get(normalizedLang);
    if (registryEntry) {
      this.languageConfigCache.set(normalizedLang, registryEntry.config);
      return registryEntry.config;
    }

    // Check user configuration
    const userConfigs = this.get('languageConfigs', {} as Record<string, ComplexityConfig>);
    if (userConfigs[normalizedLang]) {
      const userConfig = this.mergeLanguageConfigs(
        this.DEFAULT_LANGUAGE_CONFIGS.typescript, // Default fallback
        userConfigs[normalizedLang]
      );
      this.languageConfigCache.set(normalizedLang, userConfig);
      return userConfig;
    }

    // Check inheritance
    const parentLang = this.inheritanceMap.get(normalizedLang);
    if (parentLang) {
      return this.getLanguageConfig(parentLang);
    }

    // Final fallback to TypeScript defaults
    const fallbackConfig = this.DEFAULT_LANGUAGE_CONFIGS.typescript;
    this.languageConfigCache.set(normalizedLang, fallbackConfig);
    return fallbackConfig;
  }

  /**
   * Set inheritance relationship between languages
   */
  public setLanguageInheritance(childLanguage: string, parentLanguage: string): void {
    this.inheritanceMap.set(childLanguage.toLowerCase(), parentLanguage.toLowerCase());

    // Update existing config if present
    const childEntry = this.configRegistry.get(childLanguage.toLowerCase());
    if (childEntry) {
      const parentConfig = this.getLanguageConfig(parentLanguage);
      const mergedConfig = this.mergeLanguageConfigs(parentConfig, childEntry.config);
      childEntry.config = mergedConfig;
      this.languageConfigCache.set(childLanguage.toLowerCase(), mergedConfig);
    }
  }

  /**
   * Get all registered language configurations
   */
  public getAllLanguageConfigs(): Record<string, ComplexityConfig> {
    const configs: Record<string, ComplexityConfig> = {};

    // Get from registry
    this.configRegistry.forEach((entry, language) => {
      configs[language] = entry.config;
    });

    // Get from user configuration
    const userConfigs = this.get('languageConfigs', {});
    Object.entries(userConfigs).forEach(([language, config]) => {
      if (!configs[language.toLowerCase()]) {
        configs[language.toLowerCase()] = this.mergeLanguageConfigs(
          this.DEFAULT_LANGUAGE_CONFIGS.typescript,
          config as Partial<ComplexityConfig>
        );
      }
    });

    return configs;
  }

  /**
   * Update language-specific configuration
   */
  public async updateLanguageConfig(
    language: string,
    updates: Partial<ComplexityConfig>
  ): Promise<boolean> {
    try {
      const normalizedLang = language.toLowerCase();
      const currentConfig = this.getLanguageConfig(normalizedLang);
      const newConfig = this.mergeLanguageConfigs(currentConfig, updates);

      // Validate the new configuration
      this.validateLanguageConfig(newConfig);

      // Update user configuration
      const userConfigs = this.get('languageConfigs', {} as Record<string, ComplexityConfig>);
      userConfigs[normalizedLang] = newConfig;

      const success = await this.set('languageConfigs', userConfigs);

      if (success) {
        // Update cache and registry
        this.languageConfigCache.set(normalizedLang, newConfig);
        const registryEntry = this.configRegistry.get(normalizedLang);
        if (registryEntry) {
          registryEntry.config = newConfig;
        }

        // Notify handlers
        this.notifyConfigUpdateHandlers(normalizedLang, newConfig);
      }

      return success;
    } catch (error) {
      console.error(`Failed to update language config for ${language}:`, error);
      return false;
    }
  }

  /**
   * Register update handler for language configuration changes
   */
  public onLanguageConfigChange(
    language: string,
    handler: ConfigUpdateHandler
  ): vscode.Disposable {
    const normalizedLang = language.toLowerCase();

    if (!this.configUpdateHandlers.has(normalizedLang)) {
      this.configUpdateHandlers.set(normalizedLang, []);
    }

    this.configUpdateHandlers.get(normalizedLang)!.push(handler);

    return new vscode.Disposable(() => {
      const handlers = this.configUpdateHandlers.get(normalizedLang);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      }
    });
  }

  // ===== CONFIGURATION HEALTH MONITORING ===== //

  /**
   * Initialize configuration health monitoring
   */
  private initializeHealthMonitoring(): void {
    // Initial health check
    this.updateConfigurationHealth();

    // Set up periodic health checks
    this.healthUpdateInterval = setInterval(() => {
      this.updateConfigurationHealth();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get current configuration health
   */
  public getConfigurationHealth(): ConfigHealth {
    if (!this.configHealth) {
      this.updateConfigurationHealth();
    }
    return this.configHealth!;
  }

  /**
   * Update configuration health assessment
   */
  private async updateConfigurationHealth(): Promise<void> {
    try {
      const validationResults = await this.validateAllConfigurations();
      const issues: ConfigHealth['issues'] = [];
      let totalScore = 100;

      // Analyze validation results
      for (const [key, result] of validationResults.entries()) {
        if (!result.isValid) {
          result.errors.forEach(error => {
            const severity = error.severity || 'error';
            const scoreDeduction = severity === 'error' ? 20 : severity === 'warning' ? 10 : 5;
            totalScore -= scoreDeduction;

            issues.push({
              category: key,
              severity,
              message: error.message,
              fixable: error.fixable || false,
              autoFixAvailable: !!error.autoFix
            });
          });
        }
      }

      // Determine status
      let status: ConfigHealth['status'];
      if (totalScore >= 90) {status = 'excellent';}
      else if (totalScore >= 75) {status = 'good';}
      else if (totalScore >= 50) {status = 'fair';}
      else if (totalScore >= 25) {status = 'poor';}
      else {status = 'critical';}

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(issues);

      this.configHealth = {
        score: Math.max(0, totalScore),
        status,
        issues,
        recommendations,
        lastValidated: Date.now()
      };
    } catch (error) {
      console.error('Failed to update configuration health:', error);
      this.configHealth = {
        score: 0,
        status: 'critical',
        issues: [{
          category: 'system',
          severity: 'error',
          message: 'Failed to assess configuration health',
          fixable: false,
          autoFixAvailable: false
        }],
        recommendations: ['Check extension logs for errors', 'Try resetting configuration'],
        lastValidated: Date.now()
      };
    }
  }

  /**
   * Generate health recommendations based on issues
   */
  private generateHealthRecommendations(issues: ConfigHealth['issues']): string[] {
    const recommendations: string[] = [];

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const fixableCount = issues.filter(i => i.fixable).length;

    if (errorCount > 0) {
      recommendations.push(`Fix ${errorCount} configuration error${errorCount > 1 ? 's' : ''}`);
    }

    if (warningCount > 0) {
      recommendations.push(`Review ${warningCount} configuration warning${warningCount > 1 ? 's' : ''}`);
    }

    if (fixableCount > 0) {
      recommendations.push(`${fixableCount} issue${fixableCount > 1 ? 's' : ''} can be automatically fixed`);
    }

    if (issues.length === 0) {
      recommendations.push('Configuration is healthy - consider enabling advanced features');
    }

    return recommendations;
  }

  // ===== HELPER METHODS ===== //

  /**
   * Merge configuration with inheritance
   */
  private mergeWithInheritance(language: string, config: ComplexityConfig): ComplexityConfig {
    const parentLang = this.inheritanceMap.get(language);
    if (parentLang) {
      const parentConfig = this.getLanguageConfig(parentLang);
      return this.mergeLanguageConfigs(parentConfig, config);
    }
    return config;
  }

  /**
   * Validate language configuration
   */
  private validateLanguageConfig(config: ComplexityConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration: must be a non-null object');
    }

    if (!config.weights || !config.thresholds) {
      throw new Error('Invalid configuration: missing required fields (weights, thresholds)');
    }

    // Validate weights
    Object.entries(config.weights).forEach(([key, value]) => {
      if (typeof value !== 'number' || value < 0 || !isFinite(value)) {
        throw new Error(`Invalid weight for "${key}": must be a positive finite number`);
      }
    });

    // Validate thresholds
    Object.entries(config.thresholds).forEach(([key, value]) => {
      if (typeof value !== 'number' || value < 0 || !isFinite(value)) {
        throw new Error(`Invalid threshold for "${key}": must be a positive finite number`);
      }
    });
  }

  /**
   * Notify configuration update handlers
   */
  private notifyConfigUpdateHandlers(language: string, config: ComplexityConfig): void {
    const handlers = this.configUpdateHandlers.get(language);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(language, null, config);
        } catch (error) {
          console.error(`Configuration update handler error for ${language}:`, error);
        }
      });
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.healthUpdateInterval) {
      clearInterval(this.healthUpdateInterval);
      this.healthUpdateInterval = null;
    }

    this.configChangeEmitter.dispose();
    this.changeListeners.length = 0;
    this.configCache.clear();
    this.languageConfigCache.clear();
    this.configRegistry.clear();
    this.configUpdateHandlers.clear();
  }
}
