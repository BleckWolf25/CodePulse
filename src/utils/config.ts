// src/utils/config.ts
import * as vscode from 'vscode';

export interface ProductivityConfig {
  enableMetricTracking: boolean;
  complexityThreshold: number;
  trackingInterval: number; // in minutes
  excludedLanguages: string[];
  enableDetailedLogging: boolean;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ProductivityConfig = {
    enableMetricTracking: true,
    complexityThreshold: 10,
    trackingInterval: 30,
    excludedLanguages: ['json', 'lock'],
    enableDetailedLogging: false
  };

  private constructor() {
    this.loadConfiguration();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(this.loadConfiguration.bind(this));
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfiguration() {
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    
    this.config = {
      enableMetricTracking: config.get('enableMetricTracking', true),
      complexityThreshold: config.get('complexityThreshold', 10),
      trackingInterval: config.get('trackingInterval', 30),
      excludedLanguages: config.get('excludedLanguages', ['json', 'lock']),
      enableDetailedLogging: config.get('enableDetailedLogging', false)
    };
  }

  public getConfig(): ProductivityConfig {
    return this.config;
  }
}