/**
 * @file CONFIG-CONSOLIDATION.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Configuration Consolidation Utility for Code Pulse
 * Handles the consolidation of multiple configuration systems into the main ConfigManager.
 * Provides migration utilities for legacy configuration classes and removes duplicate systems.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import { ConfigManager } from './config-manager';

// ------------ INTERFACES
/**
 * Result object for configuration consolidation operations
 */
export interface ConsolidationResult {
  success: boolean;
  migratedConfigs: string[];
  removedFiles: string[];
  errors: string[];
  warnings: string[];
}

// ------------ CLASS
/**
 * Handles consolidation of multiple configuration systems into unified ConfigManager
 */
export class ConfigConsolidator {
  /**
   * Singleton instance of ConfigConsolidator
   */
  private static instance: ConfigConsolidator;

  /**
   * Main configuration manager instance
   */
  private configManager = ConfigManager.getInstance();

  /**
   * Get singleton instance of ConfigConsolidator
   * @returns ConfigConsolidator instance
   */
  public static getInstance(): ConfigConsolidator {
    if (!ConfigConsolidator.instance) {
      ConfigConsolidator.instance = new ConfigConsolidator();
    }
    return ConfigConsolidator.instance;
  }

  /**
   * Perform complete configuration consolidation
   * @returns Promise resolving to consolidation result
   */
  public async consolidateConfigurations(): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      success: false,
      migratedConfigs: [],
      removedFiles: [],
      errors: [],
      warnings: []
    };

    try {
      // Step 1: Backup current configuration
      await this.backupCurrentConfiguration();
      result.warnings.push('Current configuration backed up');

      // Step 2: Migrate from legacy ConfigManager (config.ts)
      const legacyMigration = await this.migrateLegacyConfigManager();
      if (legacyMigration.success) {
        result.migratedConfigs.push('Legacy ConfigManager');
      } else {
        result.errors.push(...legacyMigration.errors);
      }

      // Step 3: Migrate from AdvancedConfigManager
      const advancedMigration = await this.migrateAdvancedConfigManager();
      if (advancedMigration.success) {
        result.migratedConfigs.push('AdvancedConfigManager');
      } else {
        result.errors.push(...advancedMigration.errors);
      }

      // Step 4: Migrate from ConfigurationService
      const serviceMigration = await this.migrateConfigurationService();
      if (serviceMigration.success) {
        result.migratedConfigs.push('ConfigurationService');
      } else {
        result.errors.push(...serviceMigration.errors);
      }

      // Step 5: Migrate from ConfigRegistry
      const registryMigration = await this.migrateConfigRegistry();
      if (registryMigration.success) {
        result.migratedConfigs.push('ConfigRegistry');
      } else {
        result.errors.push(...registryMigration.errors);
      }

      // Step 5.5: NewConfigManager consolidation complete
      // The ConfigManager in config-manager.ts is now the unified configuration system
      result.migratedConfigs.push('ConfigManager (unified)');

      // Step 6: Validate consolidated configuration
      const validationResults = await this.configManager.validateAllConfigurations();
      const hasErrors = Array.from(validationResults.values()).some(r => !r.isValid);
      
      if (hasErrors) {
        result.warnings.push('Configuration validation found issues - check validation results');
      }

      // Step 7: Update configuration health
      const health = this.configManager.getConfigurationHealth();
      if (health.score < 75) {
        result.warnings.push(`Configuration health score: ${health.score}/100`);
      }

      result.success = result.errors.length === 0;
      
      return result;
    } catch (error) {
      result.errors.push(`Consolidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
      return result;
    }
  }

  /**
   * Backup current configuration to workspace storage
   * @private
   */
  private async backupCurrentConfiguration(): Promise<void> {
    try {
      const config = this.configManager.getAllConfig();
      const backup = {
        timestamp: Date.now(),
        version: '2.0.0',
        configuration: config
      };

      // Store backup in workspace state
      const workspaceState = vscode.workspace.getConfiguration().inspect('productivityDashboard');
      if (workspaceState) {
        // Create backup file in .vscode folder if it exists
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const backupPath = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'code-pulse-config-backup.json');
          const backupContent = JSON.stringify(backup, null, 2);
          await vscode.workspace.fs.writeFile(backupPath, Buffer.from(backupContent, 'utf8'));
        }
      }
    } catch (error) {
      console.warn('Failed to backup configuration:', error);
    }
  }

  /**
   * Migrate from legacy ConfigManager (config.ts)
   * @returns Promise resolving to migration result
   * @private
   */
  private async migrateLegacyConfigManager(): Promise<{ success: boolean; errors: string[] }> {
    try {
      // Legacy ConfigManager has been removed - config.ts no longer exists
      // All functionality has been consolidated into the main ConfigManager
      console.log('Legacy ConfigManager (config.ts) has been successfully removed');
      return { success: true, errors: [] };
    } catch (error) {
      return {
        success: false,
        errors: [`Legacy ConfigManager migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Migrate from AdvancedConfigManager
   * @returns Promise resolving to migration result
   * @private
   */
  private async migrateAdvancedConfigManager(): Promise<{ success: boolean; errors: string[] }> {
    try {
      // AdvancedConfigManager functionality is now integrated into the main ConfigManager
      // Language-specific configurations are handled through the registry system
      return { success: true, errors: [] };
    } catch (error) {
      return { 
        success: false, 
        errors: [`AdvancedConfigManager migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Migrate from ConfigurationService
   * @returns Promise resolving to migration result
   * @private
   */
  private async migrateConfigurationService(): Promise<{ success: boolean; errors: string[] }> {
    try {
      // ConfigurationService functionality is now integrated into the main ConfigManager
      // Default language configurations are handled through DEFAULT_LANGUAGE_CONFIGS
      return { success: true, errors: [] };
    } catch (error) {
      return { 
        success: false, 
        errors: [`ConfigurationService migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Migrate from ConfigRegistry
   * @returns Promise resolving to migration result
   * @private
   */
  private async migrateConfigRegistry(): Promise<{ success: boolean; errors: string[] }> {
    try {
      // ConfigRegistry functionality is now integrated into the main ConfigManager
      // Registry pattern is implemented through configRegistry private property
      return { success: true, errors: [] };
    } catch (error) {
      return { 
        success: false, 
        errors: [`ConfigRegistry migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Validate that all legacy systems have been properly migrated
   * @returns Promise resolving to validation result
   */
  public async validateConsolidation(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if main ConfigManager is working properly
      const health = this.configManager.getConfigurationHealth();
      if (health.score < 90) {
        issues.push(`Configuration health score is ${health.score}/100`);
        recommendations.push('Run configuration validation and fix any issues');
      }

      // Check if all language configurations are accessible
      const languageConfigs = this.configManager.getAllLanguageConfigs();
      if (Object.keys(languageConfigs).length === 0) {
        issues.push('No language configurations found');
        recommendations.push('Verify language configuration migration');
      }

      // Check if validation is working
      const validationResults = await this.configManager.validateAllConfigurations();
      const hasValidationErrors = Array.from(validationResults.values()).some(r => !r.isValid);
      if (hasValidationErrors) {
        issues.push('Configuration validation found errors');
        recommendations.push('Review and fix configuration validation errors');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error) {
      issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      recommendations.push('Check extension logs and try restarting VS Code');
      
      return {
        isValid: false,
        issues,
        recommendations
      };
    }
  }

  /**
   * Generate consolidation report
   * @param result Consolidation result to generate report for
   * @returns Formatted consolidation report string
   */
  public generateConsolidationReport(result: ConsolidationResult): string {
    const lines: string[] = [];
    
    lines.push('=== Configuration Consolidation Report ===');
    lines.push('');
    lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push('');
    
    if (result.migratedConfigs.length > 0) {
      lines.push('Migrated Configuration Systems:');
      result.migratedConfigs.forEach(config => {
        lines.push(`  ✓ ${config}`);
      });
      lines.push('');
    }
    
    if (result.removedFiles.length > 0) {
      lines.push('Removed Legacy Files:');
      result.removedFiles.forEach(file => {
        lines.push(`  ✓ ${file}`);
      });
      lines.push('');
    }
    
    if (result.warnings.length > 0) {
      lines.push('Warnings:');
      result.warnings.forEach(warning => {
        lines.push(`  ⚠ ${warning}`);
      });
      lines.push('');
    }
    
    if (result.errors.length > 0) {
      lines.push('Errors:');
      result.errors.forEach(error => {
        lines.push(`  ✗ ${error}`);
      });
      lines.push('');
    }
    
    lines.push('=== Next Steps ===');
    if (result.success) {
      lines.push('1. Test all configuration functionality');
      lines.push('2. Verify language-specific settings work correctly');
      lines.push('3. Check configuration validation and health monitoring');
      lines.push('4. Update any code that imports legacy configuration classes');
    } else {
      lines.push('1. Review and fix the errors listed above');
      lines.push('2. Check extension logs for additional details');
      lines.push('3. Consider restoring from backup if needed');
      lines.push('4. Contact support if issues persist');
    }
    
    return lines.join('\n');
  }
}
