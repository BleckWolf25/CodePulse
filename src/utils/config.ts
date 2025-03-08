/**
 * src/utils/config.ts
 * 
 * Core Configuration Manager
 * 
 * Handles extension settings using VSCode's configuration API
 * Implements singleton pattern for consistent access
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';

// -------------------- EXPORTS -------------------- \\

/**
 * Extension configuration schema
 * @interface ProductivityConfig
 * @property {boolean} enableMetricTracking - Master toggle for data collection
 * @property {number} complexityThreshold - Global complexity alert threshold
 * @property {number} trackingInterval - Data collection frequency in minutes
 * @property {string[]} excludedLanguages - File types to ignore
 * @property {boolean} enableDetailedLogging - Debug logging toggle
 */
export interface ProductivityConfig {
  enableMetricTracking: boolean;
  complexityThreshold: number;
  trackingInterval: number;
  excludedLanguages: string[];
  enableDetailedLogging: boolean;
}

/**
 * Central configuration service
 * @class
 * @remarks
 * - Automatically reloads settings on configuration changes
 * - Provides type-safe access to settings
 * - Uses VSCode's workspace configuration as source of truth
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config!: ProductivityConfig;

  // Default configuration values
  private readonly DEFAULTS = {
    enableMetricTracking: true,
    complexityThreshold: 10,
    trackingInterval: 30,
    excludedLanguages: ['json', 'lock'],
    enableDetailedLogging: false
  };

  private constructor() {
    this.loadConfiguration();
    vscode.workspace.onDidChangeConfiguration(() => this.loadConfiguration());
  }

  /**
   * Singleton accessor
   * @returns Single instance of ConfigManager
   */
  public static getInstance(): ConfigManager {
    return this.instance || (this.instance = new ConfigManager());
  }

  /**
   * Load configuration from VSCode settings
   * @remarks
   * - Merges user settings with defaults
   * - Automatically called on configuration changes
   */
  private loadConfiguration() {
    const config = vscode.workspace.getConfiguration('productivityDashboard');

    this.config = {
      enableMetricTracking: config.get('enableMetricTracking', this.DEFAULTS.enableMetricTracking),
      complexityThreshold: config.get('complexityThreshold', this.DEFAULTS.complexityThreshold),
      trackingInterval: config.get('trackingInterval', this.DEFAULTS.trackingInterval),
      excludedLanguages: config.get('excludedLanguages', this.DEFAULTS.excludedLanguages),
      enableDetailedLogging: config.get('enableDetailedLogging', this.DEFAULTS.enableDetailedLogging)
    };
  }

  /**
   * Get current configuration snapshot
   * @returns Readonly configuration object
   */
  public getConfig(): ProductivityConfig {
    return { ...this.config }; // Return copy to prevent mutation
  }
}