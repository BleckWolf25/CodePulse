/**
 * @file CONFIG-REGISTRY.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Configuration Registry for Code Pulse
 * Registry for managing language-specific complexity configurations with validation, inheritance,
 * and change notifications. Provides centralized configuration management with event-driven updates.
 */

// ------------ IMPORTS
import { ComplexityConfig } from "./configuration-service";
import * as vscode from 'vscode';

// ------------ TYPES
/**
 * Type for validation functions that check config validity
 */
type ConfigValidator = (config: ComplexityConfig) => boolean;

/**
 * Type for update handlers that react to config changes
 */
type ConfigUpdateHandler = (config: ComplexityConfig) => void;

// ------------ CLASS
/**
 * Registry for managing language-specific complexity configurations with validation and inheritance
 */
export class ConfigRegistry {
    /**
     * Singleton instance of ConfigRegistry
     */
    private static instance: ConfigRegistry;

    /**
     * Core configuration storage
     */
    private readonly configs: Map<string, ComplexityConfig> = new Map();

    /**
     * Event emitter for configuration changes
     */
    private readonly configChangeEmitter = new vscode.EventEmitter<void>();

    /**
     * Configuration validators by language
     */
    private readonly validators: Map<string, ConfigValidator> = new Map();

    /**
     * Default configuration values by language
     */
    private readonly defaults: Map<string, Partial<ComplexityConfig>> = new Map();

    /**
     * Update handlers for configuration changes
     */
    private readonly configUpdateHandlers: Map<string, ConfigUpdateHandler[]> = new Map();

    /**
     * Language inheritance mapping
     */
    private readonly inheritanceMap: Map<string, string> = new Map();

    /**
     * Configuration context data
     */
    private configurationContext: Map<string, any> = new Map();

    /**
     * Event fired when any configuration changes
     */
    public readonly onConfigChange = this.configChangeEmitter.event;

    /**
     * Private constructor enforces singleton pattern
     */
    private constructor() {
        this.initWorkspaceConfigWatcher();
    }

    /**
     * Initialize workspace configuration watcher with debouncing
     * @private
     */
    private initWorkspaceConfigWatcher(): void {
        let timeout: NodeJS.Timeout;
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('productivityDashboard')) {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.loadFromWorkspace(), 500);
            }
        });
    }

    /**
     * Gets or creates the singleton instance
     * @returns ConfigRegistry singleton instance
     */
    public static getInstance(): ConfigRegistry {
        if (!ConfigRegistry.instance) {
            ConfigRegistry.instance = new ConfigRegistry();
        }
        return ConfigRegistry.instance;
    }

    /**
     * Registers a configuration for a language
     * @param language Language identifier
     * @param config Configuration to register
     */
    public register(language: string, config: ComplexityConfig): void {
        const normalizedLang = language.toLowerCase();
        
        this.validateConfig(config);
        this.configs.set(normalizedLang, this.mergeWithDefaults(normalizedLang, config));
        this.updateInheritedConfigs(normalizedLang);
        this.notifyUpdateHandlers(normalizedLang, this.getConfig(normalizedLang));
        this.configChangeEmitter.fire();
    }

    /**
     * Gets configuration for a language
     * @param language Language identifier
     * @returns Configuration for the language, or default if not found
     */
    public getConfig(language: string): ComplexityConfig {
        return this.configs.get(language.toLowerCase()) || this.getDefaultConfig();
    }

    /**
     * Gets default configuration
     * @returns Default configuration
     * @throws Error if no default configuration exists
     */
    getDefaultConfig(): ComplexityConfig {
        throw new Error("Method not implemented.");
    }

    /**
     * Sets default values for a language configuration
     * @param language - Language identifier
     * @param defaults - Default configuration values
     */
    public setDefaultValues(language: string, defaults: Partial<ComplexityConfig>): void {
        const normalizedLang = language.toLowerCase();
        this.defaults.set(normalizedLang, defaults);
        
        // Re-merge any existing config with new defaults
        const existing = this.configs.get(normalizedLang);
        if (existing) {
            this.configs.set(normalizedLang, this.mergeWithDefaults(normalizedLang, existing));
        }
    }

    /**
     * Registers a validator for a language configuration
     * @param language - Language identifier
     * @param validator - Validation function
     */
    public registerValidator(language: string, validator: ConfigValidator): void {
        this.validators.set(language.toLowerCase(), validator);
    }

    /**
     * Sets inheritance relationship between languages
     * @param language - Child language identifier
     * @param inheritsFrom - Parent language identifier
     */
    public setInheritance(language: string, inheritsFrom: string): void {
        this.inheritanceMap.set(language.toLowerCase(), inheritsFrom.toLowerCase());
        this.updateInheritedConfigs(language);
    }

    /**
     * Registers a handler for configuration updates
     * @param language - Language identifier
     * @param handler - Handler function called when config changes
     */
    public registerUpdateHandler(language: string, handler: ConfigUpdateHandler): void {
        const normalizedLang = language.toLowerCase();
        const handlers = this.configUpdateHandlers.get(normalizedLang) || [];
        handlers.push(handler);
        this.configUpdateHandlers.set(normalizedLang, handlers);
    }

    /**
     * Sets context data for configuration validation
     * @param language - Language identifier
     * @param context - Context data
     */
    public setConfigurationContext(language: string, context: any): void {
        this.configurationContext.set(language.toLowerCase(), context);
        this.validateConfigWithContext(language);
    }

    /**
     * Validates configuration with context-specific rules
     * @param language - Language identifier
     */
    private validateConfigWithContext(language: string): void {
        const normalizedLang = language.toLowerCase();
        const config = this.configs.get(normalizedLang);
        const context = this.configurationContext.get(normalizedLang);
        
        if (!config || !context) {
            return;
        }

        this.validateContextSpecificRules(config, context);
    }

    /**
     * Validates configuration against context-specific rules
     * @param config - Configuration to validate
     * @param context - Context data
     * @throws Error if validation fails
     */
    private validateContextSpecificRules(config: ComplexityConfig, context: any): void {
        // Project-specific validations
        if (context.isLargeProject && config.thresholds.cyclomatic < 20) {
            throw new Error('Large projects require higher cyclomatic complexity thresholds');
        }

        // Framework-specific validations
        if (context.framework === 'react' && !config.weights.components) {
            config.weights.components = config.weights.classes;
        }

        // Team-size specific validations
        if (context.teamSize > 10 && config.thresholds.maintainability < 70) {
            throw new Error('Large teams require higher maintainability thresholds');
        }
    }

    /**
     * Updates configurations that inherit from a parent
     * @param language - Language identifier
     */
    private updateInheritedConfigs(language: string): void {
        const normalizedLang = language.toLowerCase();
        const parent = this.inheritanceMap.get(normalizedLang);
        if (!parent) {
            return;
        }

        const parentConfig = this.configs.get(parent);
        const currentConfig = this.configs.get(normalizedLang);

        if (parentConfig && currentConfig) {
            const mergedConfig = this.mergeConfigs(parentConfig, currentConfig);
            this.configs.set(normalizedLang, mergedConfig);
            this.notifyUpdateHandlers(normalizedLang, mergedConfig);
        }
    }

    /**
     * Merges parent and child configurations
     * @param parent - Parent configuration
     * @param child - Child configuration
     * @returns Merged configuration
     */
    private mergeConfigs(parent: ComplexityConfig, child: ComplexityConfig): ComplexityConfig {
        return {
            weights: { ...parent.weights, ...child.weights },
            thresholds: { ...parent.thresholds, ...child.thresholds }
        };
    }

    /**
     * Notifies update handlers about configuration changes
     * @param language - Language identifier
     * @param config - Updated configuration
     */
    private notifyUpdateHandlers(language: string, config: ComplexityConfig): void {
        const handlers = this.configUpdateHandlers.get(language.toLowerCase()) || [];
        handlers.forEach(handler => handler(config));
    }

    /**
     * Validates configuration structure and rules
     * @param config - Configuration to validate
     * @throws Error if validation fails
     */
    private validateConfig(config: ComplexityConfig): void {
        // Basic validation
        if (!config.weights || !config.thresholds) {
            throw new Error('Invalid configuration: missing required fields');
        }

        this.validateWeights(config.weights);
        this.validateThresholds(config.thresholds);
        
        // Additional validation rules
        this.validateRelationships(config);
        this.validateMetricRatios(config);
        this.validateLanguageSpecificRules(config);
        this.validateConfigurationCoherence(config);
    }

    /**
     * Validates weight values
     * @param weights - Weight configuration
     * @throws Error if validation fails
     */
    private validateWeights(weights: Record<string, number>): void {
        const requiredWeights = ['loops', 'conditionals', 'functions', 'classes'];
        for (const weight of requiredWeights) {
            if (typeof weights[weight] !== 'number' || weights[weight] < 0) {
                throw new Error(`Invalid weight for ${weight}: must be a positive number`);
            }
        }
    }

    /**
     * Validates threshold values
     * @param thresholds - Threshold configuration
     * @throws Error if validation fails
     */
    private validateThresholds(thresholds: Record<string, number>): void {
        const validations = {
            cyclomatic: { min: 1, max: 100 },
            maintainability: { min: 0, max: 100 },
            halstead: { min: 1, max: 100 }
        };

        Object.entries(validations).forEach(([metric, range]) => {
            const value = thresholds[metric];
            if (typeof value !== 'number' || value < range.min || value > range.max) {
                throw new Error(
                    `Threshold '${metric}' must be between ${range.min} and ${range.max}`
                );
            }
        });
    }

    /**
     * Validates relationships between configuration values
     * @param config - Configuration to validate
     * @throws Error if validation fails
     */
    private validateRelationships(config: ComplexityConfig): void {
        // Validate logical relationships between settings
        if (config.weights.loops > config.weights.conditionals * 2) {
            throw new Error('Loop weight should not be more than double conditional weight');
        }

        if (config.thresholds.maintainability < config.thresholds.cyclomatic) {
            throw new Error('Maintainability threshold should be higher than cyclomatic threshold');
        }
    }

    /**
     * Validates ratios between metrics
     * @param config - Configuration to validate
     * @throws Error if validation fails
     */
    private validateMetricRatios(config: ComplexityConfig): void {
        // Validate relationships between different metrics
        if (config.thresholds.halstead > config.thresholds.cyclomatic * 2) {
            throw new Error('Halstead threshold should not exceed twice the cyclomatic threshold');
        }

        if (config.weights.functions > config.weights.classes && 
            config.thresholds.cognitive < config.thresholds.cyclomatic) {
            throw new Error('Invalid metric ratio: function weight vs cognitive threshold');
        }
    }

    /**
     * Validates language-specific rules
     * @param config - Configuration to validate
     * @throws Error if validation fails
     */
    private validateLanguageSpecificRules(config: ComplexityConfig): void {
        // Ensure thresholds are appropriate for language paradigms
        if (config.thresholds.cognitive > config.thresholds.cyclomatic * 1.5) {
            throw new Error('Cognitive complexity should not greatly exceed cyclomatic complexity');
        }

        // Validate weight distributions
        const totalWeight = Object.values(config.weights).reduce((sum, w) => sum + w, 0);
        if (totalWeight > 10) {
            throw new Error('Total weights should not exceed 10');
        }
    }

    /**
     * Validates configuration coherence
     * @param config - Configuration to validate
     * @throws Error if validation fails
     */
    private validateConfigurationCoherence(config: ComplexityConfig): void {
        // Ensure configuration is internally consistent
        const thresholdKeys = ['cyclomatic', 'maintainability', 'halstead', 'cognitive'];
        const weightKeys = ['loops', 'conditionals', 'functions', 'classes'];

        if (!thresholdKeys.every(key => key in config.thresholds)) {
            throw new Error('Missing required threshold metrics');
        }

        if (!weightKeys.every(key => key in config.weights)) {
            throw new Error('Missing required weight factors');
        }
    }

    /**
     * Merges configuration with defaults
     * @param language - Language identifier
     * @param config - Configuration to merge
     * @returns Merged configuration
     */
    private mergeWithDefaults(language: string, config: ComplexityConfig): ComplexityConfig {
        const defaults = this.defaults.get(language.toLowerCase());
        if (!defaults) {
            return config;
        }

        return {
            weights: { ...defaults.weights, ...config.weights },
            thresholds: { ...defaults.thresholds, ...config.thresholds }
        };
    }

    /**
     * Loads configurations from workspace settings
     */
    private loadFromWorkspace(): void {
        const config = vscode.workspace.getConfiguration('productivityDashboard');
        const customConfigs = config.get<Record<string, ComplexityConfig>>('languageConfigs', {});

        Object.entries(customConfigs).forEach(([language, conf]) => {
            try {
                const normalizedLang = language.toLowerCase();
                const validator = this.validators.get(normalizedLang);
                
                if (validator && !validator(conf)) {
                    throw new Error(`Invalid configuration for ${language}`);
                }
                
                this.register(language, conf);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load config for ${language}: ${error}`);
            }
        });
    }
}