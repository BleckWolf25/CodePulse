/**
 * Configuration Migration System
 * 
 * Handles migration of configuration settings between different versions
 * of the extension, ensuring backward compatibility and smooth upgrades.
 */

import * as vscode from 'vscode';
import { ConfigSchemaValidator, ValidationResult } from './config-schema';

export interface MigrationRule {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate: (config: any) => any;
  validate?: (config: any) => boolean;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migratedConfig?: any;
  errors: string[];
  warnings: string[];
  appliedMigrations: string[];
}

export class ConfigMigrationManager {
  migrateToVersion(version: string): MigrationResult {
    // TODO: Implement actual migration logic
    return {
      success: true,
      errors: [],
      warnings: [],
      appliedMigrations: [],
      fromVersion: '2.0.0',
      toVersion: version
    };
  }
  private static instance: ConfigMigrationManager;
  private migrations: MigrationRule[] = [];
  private validator = ConfigSchemaValidator.getInstance();

  public static getInstance(): ConfigMigrationManager {
    if (!ConfigMigrationManager.instance) {
      ConfigMigrationManager.instance = new ConfigMigrationManager();
    }
    return ConfigMigrationManager.instance;
  }

  constructor() {
    this.registerDefaultMigrations();
  }

  /**
   * Register a migration rule
   */
  public registerMigration(migration: MigrationRule): void {
    this.migrations.push(migration);
    // Sort by version to ensure proper order
    this.migrations.sort((a, b) => this.compareVersions(a.fromVersion, b.fromVersion));
  }

  /**
   * Migrate configuration from one version to another
   */
  public async migrateConfig(
    config: any,
    fromVersion: string,
    targetVersion: string
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      fromVersion,
      toVersion: targetVersion,
      errors: [],
      warnings: [],
      appliedMigrations: []
    };

    try {
      let currentConfig = { ...config };
      let currentVersion = fromVersion;

      // Find applicable migrations
      const applicableMigrations = this.findMigrationPath(fromVersion, targetVersion);

      if (applicableMigrations.length === 0) {
        if (fromVersion === targetVersion) {
          result.success = true;
          result.migratedConfig = currentConfig;
          return result;
        } else {
          result.errors.push(`No migration path found from ${fromVersion} to ${targetVersion}`);
          return result;
        }
      }

      // Apply migrations in sequence
      for (const migration of applicableMigrations) {
        try {
          // Validate before migration if validator is provided
          if (migration.validate && !migration.validate(currentConfig)) {
            result.warnings.push(`Pre-migration validation failed for ${migration.description}`);
          }

          // Apply migration
          const migratedConfig = migration.migrate(currentConfig);
          
          // Validate migrated config
          const validation = this.validator.validateMainConfig(migratedConfig);
          if (!validation.isValid) {
            result.warnings.push(`Post-migration validation warnings for ${migration.description}`);
            validation.errors.forEach(error => {
              result.warnings.push(`  ${error.path}: ${error.message}`);
            });
          }

          currentConfig = validation.migratedConfig || migratedConfig;
          currentVersion = migration.toVersion;
          result.appliedMigrations.push(migration.description);

        } catch (error) {
          result.errors.push(
            `Migration failed (${migration.description}): ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
          return result;
        }
      }

      result.success = true;
      result.toVersion = currentVersion;
      result.migratedConfig = currentConfig;

    } catch (error) {
      result.errors.push(
        `Migration process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Get current extension version
   */
  public getCurrentVersion(): string {
    const extension = vscode.extensions.getExtension('BleckWolf25.code-pulse');
    return extension?.packageJSON?.version || '2.0.0';
  }

  /**
   * Get stored configuration version
   */
  public getStoredConfigVersion(): string {
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    return config.get('configVersion', '1.0.0');
  }

  /**
   * Update stored configuration version
   */
  public async updateConfigVersion(version: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    await config.update('configVersion', version, vscode.ConfigurationTarget.Global);
  }

  /**
   * Check if migration is needed
   */
  public needsMigration(): boolean {
    const currentVersion = this.getCurrentVersion();
    const storedVersion = this.getStoredConfigVersion();
    return this.compareVersions(storedVersion, currentVersion) < 0;
  }

  /**
   * Perform automatic migration if needed
   */
  public async autoMigrate(): Promise<MigrationResult | null> {
    if (!this.needsMigration()) {
      return null;
    }

    const currentVersion = this.getCurrentVersion();
    const storedVersion = this.getStoredConfigVersion();
    
    // Get current configuration
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    const currentConfig = this.extractConfigObject(config);

    // Perform migration
    const result = await this.migrateConfig(currentConfig, storedVersion, currentVersion);

    if (result.success && result.migratedConfig) {
      // Apply migrated configuration
      await this.applyMigratedConfig(result.migratedConfig);
      await this.updateConfigVersion(currentVersion);

      // Show migration notification
      const message = `Configuration migrated from v${storedVersion} to v${currentVersion}`;
      if (result.warnings.length > 0) {
        vscode.window.showWarningMessage(`${message}. Some warnings occurred.`, 'View Details')
          .then(selection => {
            if (selection === 'View Details') {
              this.showMigrationDetails(result);
            }
          });
      } else {
        vscode.window.showInformationMessage(message);
      }
    } else {
      // Show migration error
      vscode.window.showErrorMessage(
        `Configuration migration failed: ${result.errors.join(', ')}`,
        'View Details'
      ).then(selection => {
        if (selection === 'View Details') {
          this.showMigrationDetails(result);
        }
      });
    }

    return result;
  }

  /**
   * Register default migration rules
   */
  private registerDefaultMigrations(): void {
    // Migration from 1.x to 2.0.0
    this.registerMigration({
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      description: 'Add WebSocket and analytics configuration',
      migrate: (config: any) => {
        const migrated = { ...config };
        
        // Add new WebSocket configuration
        if (!migrated.websocket) {
          migrated.websocket = {
            enabled: true,
            fallbackToPolling: true,
            updateInterval: 1000,
            maxClients: 10,
            pingInterval: 30000,
            connectionTimeout: 60000
          };
        }

        // Add new analytics configuration
        if (!migrated.analytics) {
          migrated.analytics = {
            enableAdvancedAnalytics: true,
            enableTrendAnalysis: true,
            enablePerformanceBenchmarking: true,
            enableTeamMetrics: true,
            enableCodeHealthScoring: true,
            updateFrequency: 300
          };
        }

        // Add new theme configuration
        if (!migrated.theme) {
          migrated.theme = 'auto';
        }

        // Add new storage and retention settings
        if (!migrated.maxStorageSize) {
          migrated.maxStorageSize = 100;
        }
        if (!migrated.dataRetentionDays) {
          migrated.dataRetentionDays = 90;
        }

        // Add notifications setting
        if (!migrated.enableNotifications) {
          migrated.enableNotifications = true;
        }

        return migrated;
      },
      validate: (config: any) => {
        return config && typeof config === 'object';
      }
    });

    // Migration from 1.1.0 to 2.0.0 (if there was a 1.1.0)
    this.registerMigration({
      fromVersion: '1.1.0',
      toVersion: '2.0.0',
      description: 'Update analytics configuration structure',
      migrate: (config: any) => {
        const migrated = { ...config };

        // Migrate old analytics settings if they exist
        if (migrated.enableAnalytics !== undefined) {
          if (!migrated.analytics) {
            migrated.analytics = {};
          }
          migrated.analytics.enableAdvancedAnalytics = migrated.enableAnalytics;
          delete migrated.enableAnalytics;
        }

        return migrated;
      }
    });

    // Migration for configuration consolidation
    this.registerMigration({
      fromVersion: '2.0.0',
      toVersion: '2.1.0',
      description: 'Consolidate configuration systems and add new features',
      migrate: (config: any) => {
        const migrated = { ...config };

        // Migrate retentionPeriod to dataRetentionDays
        if (migrated.retentionPeriod !== undefined) {
          migrated.dataRetentionDays = migrated.retentionPeriod;
          delete migrated.retentionPeriod;
        }

        // Add default values for new configuration options
        if (!migrated.maxStorageSize) {
          migrated.maxStorageSize = 100;
        }

        if (!migrated.theme) {
          migrated.theme = 'auto';
        }

        if (migrated.enableNotifications === undefined) {
          migrated.enableNotifications = true;
        }

        // Consolidate language configurations from legacy systems
        if (!migrated.languageConfigs) {
          migrated.languageConfigs = {};
        }

        // Migrate from old complexityThresholds format
        if (migrated.complexityThresholds && typeof migrated.complexityThresholds === 'object') {
          Object.entries(migrated.complexityThresholds).forEach(([lang, threshold]) => {
            if (typeof threshold === 'number' && !migrated.languageConfigs[lang]) {
              migrated.languageConfigs[lang] = {
                weights: {
                  cyclomatic: 1.0,
                  cognitive: 1.2,
                  nesting: 1.1,
                  length: 0.5
                },
                thresholds: {
                  cyclomatic: threshold,
                  cognitive: Math.round(threshold * 1.5),
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
          });
        }

        // Ensure WebSocket configuration structure
        if (!migrated.websocket || typeof migrated.websocket !== 'object') {
          migrated.websocket = {
            enabled: true,
            fallbackToPolling: true,
            updateInterval: 1000,
            maxClients: 10,
            pingInterval: 30000,
            connectionTimeout: 60000
          };
        }

        // Ensure analytics configuration structure
        if (!migrated.analytics || typeof migrated.analytics !== 'object') {
          migrated.analytics = {
            enableAdvancedAnalytics: true,
            enableTrendAnalysis: true,
            enablePerformanceBenchmarking: true,
            enableTeamMetrics: false,
            enableCodeHealthScoring: true,
            enableHistoricalAnalysis: true,
            enableRegressionDetection: true,
            enableProductivityPatterns: true,
            updateFrequency: 300
          };
        }

        // Ensure dashboard configuration structure
        if (!migrated.dashboard || typeof migrated.dashboard !== 'object') {
          migrated.dashboard = {
            enableDrillDown: true,
            enableFiltering: true,
            enableExport: true,
            enableGoalTracking: true,
            refreshInterval: 5000
          };
        }

        // Ensure reporting configuration structure
        if (!migrated.reporting || typeof migrated.reporting !== 'object') {
          migrated.reporting = {
            enablePDFReports: true,
            enableScheduledReports: false,
            enableTeamReports: false,
            enableCIIntegration: false
          };
        }

        // Ensure analytics object exists with all new properties
        if (!migrated.analytics) {
          migrated.analytics = {};
        }

        const analyticsDefaults = {
          enableAdvancedAnalytics: true,
          enableTrendAnalysis: true,
          enablePerformanceBenchmarking: true,
          enableTeamMetrics: false,
          enableCodeHealthScoring: true,
          enableHistoricalAnalysis: true,
          enableRegressionDetection: true,
          enableProductivityPatterns: true
        };

        Object.entries(analyticsDefaults).forEach(([key, defaultValue]) => {
          if (migrated.analytics[key] === undefined) {
            migrated.analytics[key] = defaultValue;
          }
        });

        // Ensure dashboard object exists with all new properties
        if (!migrated.dashboard) {
          migrated.dashboard = {};
        }

        const dashboardDefaults = {
          enableDrillDown: true,
          enableFiltering: true,
          enableExport: true,
          enableGoalTracking: true,
          refreshInterval: 5000
        };

        Object.entries(dashboardDefaults).forEach(([key, defaultValue]) => {
          if (migrated.dashboard[key] === undefined) {
            migrated.dashboard[key] = defaultValue;
          }
        });

        // Ensure reporting object exists with all new properties
        if (!migrated.reporting) {
          migrated.reporting = {};
        }

        const reportingDefaults = {
          enablePDFReports: true,
          enableScheduledReports: false,
          enableTeamReports: false,
          enableCIIntegration: false
        };

        Object.entries(reportingDefaults).forEach(([key, defaultValue]) => {
          if (migrated.reporting[key] === undefined) {
            migrated.reporting[key] = defaultValue;
          }
        });

        // Ensure complexityThresholds object exists with expanded language support
        if (!migrated.complexityThresholds) {
          migrated.complexityThresholds = {};
        }

        const languageThresholdDefaults = {
          typescript: 15,
          javascript: 12,
          python: 20,
          java: 15,
          csharp: 15,
          cpp: 20,
          go: 15,
          rust: 15,
          php: 12,
          ruby: 12
        };

        Object.entries(languageThresholdDefaults).forEach(([lang, threshold]) => {
          if (migrated.complexityThresholds[lang] === undefined) {
            migrated.complexityThresholds[lang] = threshold;
          }
        });

        // Initialize languageConfigs if it doesn't exist
        if (!migrated.languageConfigs) {
          migrated.languageConfigs = {};
        }

        return migrated;
      },
      validate: (config: any) => {
        // Validate that required properties exist
        return config.enableMetricTracking !== undefined &&
               config.complexityThreshold !== undefined &&
               config.trackingInterval !== undefined;
      }
    });

    // Future migration example (2.0.0 to 2.1.0)
    this.registerMigration({
      fromVersion: '2.0.0',
      toVersion: '2.1.0',
      description: 'Add AI-powered insights configuration',
      migrate: (config: any) => {
        const migrated = { ...config };
        
        // Add AI configuration when implemented
        if (!migrated.ai) {
          migrated.ai = {
            enableAIInsights: false,
            aiProvider: 'openai',
            maxTokens: 1000
          };
        }

        return migrated;
      }
    });
  }

  /**
   * Find migration path between versions
   */
  private findMigrationPath(fromVersion: string, toVersion: string): MigrationRule[] {
    const path: MigrationRule[] = [];
    let currentVersion = fromVersion;

    while (this.compareVersions(currentVersion, toVersion) < 0) {
      const nextMigration = this.migrations.find(m => m.fromVersion === currentVersion);
      if (!nextMigration) {
        break;
      }
      path.push(nextMigration);
      currentVersion = nextMigration.toVersion;
    }

    return path;
  }

  /**
   * Compare version strings
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) {return -1;}
      if (v1Part > v2Part) {return 1;}
    }
    
    return 0;
  }

  /**
   * Extract configuration object from VS Code configuration
   */
  private extractConfigObject(config: vscode.WorkspaceConfiguration): any {
    const configObj: any = {};
    
    // Get all configuration keys
    const inspect = config.inspect('');
    if (inspect) {
      // Merge default, global, workspace, and folder settings
      Object.assign(configObj, inspect.defaultValue);
      Object.assign(configObj, inspect.globalValue);
      Object.assign(configObj, inspect.workspaceValue);
      Object.assign(configObj, inspect.workspaceFolderValue);
    }

    return configObj;
  }

  /**
   * Apply migrated configuration
   */
  private async applyMigratedConfig(config: any): Promise<void> {
    const vsConfig = vscode.workspace.getConfiguration('productivityDashboard');
    
    for (const [key, value] of Object.entries(config)) {
      try {
        await vsConfig.update(key, value, vscode.ConfigurationTarget.Global);
      } catch (error) {
        console.warn(`Failed to update configuration key ${key}:`, error);
      }
    }
  }

  /**
   * Show migration details in output channel
   */
  private showMigrationDetails(result: MigrationResult): void {
    const outputChannel = vscode.window.createOutputChannel('Code Pulse - Configuration Migration');
    
    outputChannel.appendLine('=== Configuration Migration Details ===');
    outputChannel.appendLine(`From Version: ${result.fromVersion}`);
    outputChannel.appendLine(`To Version: ${result.toVersion}`);
    outputChannel.appendLine(`Success: ${result.success}`);
    outputChannel.appendLine('');
    
    if (result.appliedMigrations.length > 0) {
      outputChannel.appendLine('Applied Migrations:');
      result.appliedMigrations.forEach(migration => {
        outputChannel.appendLine(`  - ${migration}`);
      });
      outputChannel.appendLine('');
    }
    
    if (result.warnings.length > 0) {
      outputChannel.appendLine('Warnings:');
      result.warnings.forEach(warning => {
        outputChannel.appendLine(`  - ${warning}`);
      });
      outputChannel.appendLine('');
    }
    
    if (result.errors.length > 0) {
      outputChannel.appendLine('Errors:');
      result.errors.forEach(error => {
        outputChannel.appendLine(`  - ${error}`);
      });
    }
    
    outputChannel.show();
  }

  /**
   * Perform safe migration with backup and rollback capability
   */
  public async safeMigrate(fromVersion: string, toVersion: string): Promise<MigrationResult> {
    // Create backup before migration
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    const currentConfig = this.extractConfigObject(config);
    const backupPath = await this.createBackup(currentConfig, fromVersion);
    
    // Attempt migration
    const result = await this.migrateConfig(currentConfig, fromVersion, toVersion);
    
    if (result.success && result.migratedConfig) {
      // Apply migrated configuration
      await this.applyMigratedConfig(result.migratedConfig);
      await this.updateConfigVersion(toVersion);
      result.warnings.push(`Backup created at ${backupPath}`);
    } else {
      result.warnings.push(`Migration failed, but backup was created at ${backupPath}`);
      result.warnings.push('Use "Restore Configuration Backup" command if needed');
    }
    
    return result;
  }

  /**
   * Create a backup of the current configuration
   */
  private async createBackup(config: any, version: string): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = vscode.Uri.joinPath(
      workspaceFolder.uri, 
      '.vscode', 
      `code-pulse-config-backup-v${version}-${timestamp}.json`
    );
    
    const backupContent = JSON.stringify({
      version,
      timestamp: new Date().toISOString(),
      config
    }, null, 2);
    
    await vscode.workspace.fs.writeFile(backupPath, Buffer.from(backupContent, 'utf8'));
    return backupPath.fsPath;
  }

  /**
   * Restore configuration from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      const content = await vscode.workspace.fs.readFile(vscode.Uri.file(backupPath));
      const backup = JSON.parse(content.toString());
      
      if (!backup.config || !backup.version) {
        throw new Error('Invalid backup format');
      }
      
      // Apply backup configuration
      await this.applyMigratedConfig(backup.config);
      await this.updateConfigVersion(backup.version);
      
      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }
}
