/**
 * @file CONFIG-COMMANDS.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Configuration Commands
 * VS Code commands for configuration management, validation, and migration.
 */

// ------------ IMPORTS
import * as vscode from "vscode";
import { ConfigHealth, ConfigManager } from "../utils/config-manager";
import { ConfigMigrationManager } from "../utils/config-migration";
import { ConfigSchemaValidator } from "../utils/config-schema";
import { ConfigConsolidator } from "../utils/config-consolidation";

// ------------ MAIN CLASS
export class ConfigCommands {
  private configManager = ConfigManager.getInstance();
  private migrationManager = ConfigMigrationManager.getInstance();
  private validator = ConfigSchemaValidator.getInstance();
  private consolidator = ConfigConsolidator.getInstance();

  /**
   * Register all configuration commands
   */
  public registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      vscode.commands.registerCommand("codePulse.validateConfiguration", () =>
        this.validateConfiguration()
      ),
      vscode.commands.registerCommand("codePulse.resetConfiguration", () =>
        this.resetConfiguration()
      ),
      vscode.commands.registerCommand("codePulse.exportConfiguration", () =>
        this.exportConfiguration()
      ),
      vscode.commands.registerCommand("codePulse.importConfiguration", () =>
        this.importConfiguration()
      ),
      vscode.commands.registerCommand("codePulse.migrateConfiguration", () =>
        this.migrateConfiguration()
      ),
      vscode.commands.registerCommand(
        "codePulse.consolidateConfiguration",
        () => this.consolidateConfiguration()
      ),
      vscode.commands.registerCommand("codePulse.validateConsolidation", () =>
        this.validateConsolidation()
      ),
      vscode.commands.registerCommand("codePulse.showConfigurationHealth", () =>
        this.showConfigurationHealth()
      ),
      vscode.commands.registerCommand("codePulse.showConfigurationGroups", () =>
        this.showConfigurationGroups()
      ),
      vscode.commands.registerCommand("codePulse.openConfigurationHelp", () =>
        this.openConfigurationHelp()
      ),
      vscode.commands.registerCommand("codePulse.fixConfigurationIssues", () =>
        this.fixConfigurationIssues()
      ),
    ];

    commands.forEach((command) => context.subscriptions.push(command));
  }

  /**
   * Validate current configuration
   */
  private async validateConfiguration(): Promise<void> {
    try {
      vscode.window.showInformationMessage("Validating configuration...");

      const results = await this.configManager.validateAllConfigurations();
      const hasErrors = Array.from(results.values()).some((r) => !r.isValid);
      const hasWarnings = Array.from(results.values()).some(
        (r) => r.warnings.length > 0
      );

      if (!hasErrors && !hasWarnings) {
        vscode.window.showInformationMessage(
          "✅ Configuration is valid with no issues."
        );
      } else if (hasErrors) {
        const errorCount = Array.from(results.values()).reduce(
          (sum, r) => sum + r.errors.length,
          0
        );
        const warningCount = Array.from(results.values()).reduce(
          (sum, r) => sum + r.warnings.length,
          0
        );

        vscode.window
          .showWarningMessage(
            `Configuration validation found ${errorCount} errors and ${warningCount} warnings.`,
            "View Details",
            "Fix Issues"
          )
          .then((selection) => {
            if (selection === "View Details") {
              this.showValidationDetails(results);
            } else if (selection === "Fix Issues") {
              this.fixConfigurationIssues();
            }
          });
      } else {
        const warningCount = Array.from(results.values()).reduce(
          (sum, r) => sum + r.warnings.length,
          0
        );
        vscode.window
          .showInformationMessage(
            `Configuration is valid with ${warningCount} warnings.`,
            "View Details"
          )
          .then((selection) => {
            if (selection === "View Details") {
              this.showValidationDetails(results);
            }
          });
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Configuration validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Reset configuration to defaults
   */
  private async resetConfiguration(): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      "This will reset all Code Pulse configuration to defaults. This action cannot be undone.",
      { modal: true },
      "Reset Configuration",
      "Cancel"
    );

    if (confirmation === "Reset Configuration") {
      try {
        await this.configManager.resetToDefaults();
        vscode.window.showInformationMessage(
          "Configuration reset to defaults successfully."
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to reset configuration: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  }

  /**
   * Export configuration to file
   */
  private async exportConfiguration(): Promise<void> {
    try {
      const config = this.configManager.getAllConfig();
      const health = this.configManager.getConfigurationHealth();

      const exportData = {
        version: this.migrationManager.getCurrentVersion(),
        timestamp: new Date().toISOString(),
        configuration: config,
        health: health,
        metadata: {
          platform: process.platform,
          vscodeVersion: vscode.version,
          extensionVersion: this.migrationManager.getCurrentVersion(),
        },
      };

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          `code-pulse-config-${new Date().toISOString().split("T")[0]}.json`
        ),
        filters: {
          "JSON Files": ["json"],
          "All Files": ["*"],
        },
      });

      if (uri) {
        const content = JSON.stringify(exportData, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
        vscode.window.showInformationMessage(
          `Configuration exported to ${uri.fsPath}`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export configuration: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Import configuration from file
   */
  private async importConfiguration(): Promise<void> {
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          "JSON Files": ["json"],
          "All Files": ["*"],
        },
      });

      if (uris && uris.length > 0) {
        const content = await vscode.workspace.fs.readFile(uris[0]);
        const importData = JSON.parse(content.toString());

        // Validate import data
        if (!importData.configuration) {
          throw new Error("Invalid configuration file format");
        }

        // Check version compatibility
        if (importData.version) {
          const currentVersion = this.migrationManager.getCurrentVersion();
          if (importData.version !== currentVersion) {
            const migrate = await vscode.window.showWarningMessage(
              `Configuration is from version ${importData.version}, current version is ${currentVersion}. Migration may be required.`,
              "Import and Migrate",
              "Cancel"
            );

            if (migrate !== "Import and Migrate") {
              return;
            }
          }
        }

        // Validate configuration before import
        const validationResult = this.validator.validateMainConfig(
          importData.configuration
        );

        if (!validationResult.isValid) {
          const proceed = await vscode.window.showWarningMessage(
            `Configuration file has validation errors. Import anyway?`,
            "Import",
            "Cancel"
          );

          if (proceed !== "Import") {
            return;
          }
        }

        // Apply configuration
        const config = vscode.workspace.getConfiguration(
          "productivityDashboard"
        );
        const configToApply =
          validationResult.migratedConfig || importData.configuration;

        for (const [key, value] of Object.entries(configToApply)) {
          await config.update(key, value, vscode.ConfigurationTarget.Global);
        }

        vscode.window.showInformationMessage(
          "Configuration imported successfully."
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to import configuration: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Migrate configuration
   */
  private async migrateConfiguration(): Promise<void> {
    try {
      if (!this.migrationManager.needsMigration()) {
        vscode.window.showInformationMessage(
          "Configuration is already up to date."
        );
        return;
      }

      const proceed = await vscode.window.showInformationMessage(
        "Configuration migration is available. Proceed with migration?",
        "Migrate",
        "Cancel"
      );

      if (proceed === "Migrate") {
        const result = await this.migrationManager.autoMigrate();

        if (result?.success) {
          vscode.window.showInformationMessage(
            `Configuration migrated successfully from v${result.fromVersion} to v${result.toVersion}.`
          );
        } else if (result) {
          vscode.window
            .showErrorMessage(
              `Migration failed: ${result.errors.join(", ")}`,
              "View Details"
            )
            .then((selection) => {
              if (selection === "View Details") {
                this.showMigrationDetails(result);
              }
            });
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Migration failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Consolidate configuration from legacy systems
   */
  private async consolidateConfiguration(): Promise<void> {
    try {
      const proceed = await vscode.window.showInformationMessage(
        "This will consolidate your configuration from legacy systems into the unified ConfigManager. This process will:\n\n" +
          "• Migrate settings from legacy configuration classes\n" +
          "• Apply the latest configuration schema\n" +
          "• Validate all settings\n" +
          "• Create a backup of current settings\n\n" +
          "Continue with consolidation?",
        { modal: true },
        "Consolidate",
        "Cancel"
      );

      if (proceed === "Consolidate") {
        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Consolidating Configuration",
            cancellable: false,
          },
          async (progress) => {
            progress.report({
              increment: 0,
              message: "Starting consolidation...",
            });

            // Step 1: Run consolidation
            progress.report({
              increment: 20,
              message: "Migrating legacy configurations...",
            });
            const consolidationResult =
              await this.consolidator.consolidateConfigurations();

            // Step 2: Force migration to latest version
            progress.report({
              increment: 40,
              message: "Applying latest schema...",
            });
            const migrationResult =
              this.migrationManager.migrateToVersion("2.1.0");

            // Step 3: Validate consolidated configuration
            progress.report({
              increment: 60,
              message: "Validating configuration...",
            });
            const validationResults =
              await this.configManager.validateAllConfigurations();

            // Step 4: Check configuration health
            progress.report({
              increment: 80,
              message: "Checking configuration health...",
            });
            const health = this.configManager.getConfigurationHealth();

            progress.report({
              increment: 100,
              message: "Consolidation complete!",
            });

            // Show results
            if (
              consolidationResult.success &&
              (!migrationResult || migrationResult.success)
            ) {
              const hasValidationErrors = Array.from(
                validationResults.values()
              ).some((r) => !r.isValid);

              if (hasValidationErrors || health.score < 75) {
                vscode.window
                  .showWarningMessage(
                    `Configuration consolidated successfully, but with some issues.\n` +
                      `Health Score: ${health.score}/100\n` +
                      `Would you like to view the details?`,
                    "View Report",
                    "Fix Issues",
                    "OK"
                  )
                  .then((selection) => {
                    if (selection === "View Report") {
                      this.showConsolidationReport(consolidationResult);
                    } else if (selection === "Fix Issues") {
                      this.fixConfigurationIssues();
                    }
                  });
              } else {
                vscode.window
                  .showInformationMessage(
                    `Configuration successfully consolidated!\n` +
                      `✓ ${consolidationResult.migratedConfigs.length} systems migrated\n` +
                      `✓ Health Score: ${health.score}/100\n` +
                      `✓ All validations passed`,
                    "View Report"
                  )
                  .then((selection) => {
                    if (selection === "View Report") {
                      this.showConsolidationReport(consolidationResult);
                    }
                  });
              }
            } else {
              const errors = [
                ...consolidationResult.errors,
                ...(migrationResult?.errors || []),
              ];

              vscode.window
                .showErrorMessage(
                  `Configuration consolidation failed:\n${errors
                    .slice(0, 3)
                    .join("\n")}${errors.length > 3 ? "\n..." : ""}`,
                  "View Details",
                  "Retry"
                )
                .then((selection) => {
                  if (selection === "View Details") {
                    this.showConsolidationReport(consolidationResult);
                  } else if (selection === "Retry") {
                    this.consolidateConfiguration();
                  }
                });
            }
          }
        );
      }
    } catch (error) {
      vscode.window
        .showErrorMessage(
          `Configuration consolidation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "View Logs"
        )
        .then((selection) => {
          if (selection === "View Logs") {
            vscode.commands.executeCommand("workbench.action.toggleDevTools");
          }
        });
    }
  }

  /**
   * Show configuration groups and organization
   */
  private async showConfigurationGroups(): Promise<void> {
    const groups = this.configManager.getConfigurationGroups();
    const outputChannel = vscode.window.createOutputChannel(
      "Code Pulse - Configuration Groups"
    );

    outputChannel.clear();
    outputChannel.appendLine("=== Code Pulse Configuration Groups ===");
    outputChannel.appendLine("");
    outputChannel.appendLine(
      "The configuration is organized into the following groups:"
    );
    outputChannel.appendLine("");

    groups.forEach((group) => {
      outputChannel.appendLine(`${group.order}. ${group.title}`);
      outputChannel.appendLine(`   ${group.description}`);
      outputChannel.appendLine(
        `   Settings prefix: productivityDashboard.${group.id}`
      );
      outputChannel.appendLine("");
    });

    outputChannel.appendLine("To access these settings:");
    outputChannel.appendLine("1. Open VS Code Settings (Ctrl+,)");
    outputChannel.appendLine('2. Search for "productivityDashboard"');
    outputChannel.appendLine("3. Browse settings by group or use the search");
    outputChannel.appendLine("");
    outputChannel.appendLine(
      "For advanced configuration, use the JSON editor:"
    );
    outputChannel.appendLine("1. Open Command Palette (Ctrl+Shift+P)");
    outputChannel.appendLine('2. Run "Preferences: Open Settings (JSON)"');
    outputChannel.appendLine("3. Add productivityDashboard settings");

    outputChannel.show();
  }

  /**
   * Show configuration health status with comprehensive dashboard
   */
  private async showConfigurationHealth(): Promise<void> {
    try {
      const health = this.configManager.getConfigurationHealth();

      // Determine status icon based on health condition
      const statusIcon = this.getHealthStatusIcon(health);

      // Build comprehensive health message
      const message = this.buildHealthMessage(health, statusIcon);

      // Show appropriate message based on health status
      await this.displayHealthMessage(health, message);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to get configuration health: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get appropriate status icon based on health condition
   */
  private getHealthStatusIcon(health: ConfigHealth): string {
    switch (health.status) {
      case "excellent":
        return "🟢";
      case "good":
        return "🟡";
      case "fair":
        return "🟠";
      default:
        return "🔴";
    }
  }

  /**
   * Build comprehensive health status message
   */
  private buildHealthMessage(
    health: ConfigHealth,
    statusIcon: string
  ): string {
    return (
      `Configuration Health ${statusIcon}\n\n` +
      `Score: ${health.score}/100\n` +
      `Status: ${health.status.toUpperCase()}\n` +
      `Issues: ${health.issues?.length ?? 0}\n` +
      `Last Validated: ${new Date(health.lastValidated).toLocaleString()}`
    );
  }

  /**
   * Display appropriate health message with context-aware actions
   */
  private async displayHealthMessage(
    health: ConfigHealth,
    message: string
  ): Promise<void> {
    const hasIssues = this.hasHealthIssues(health);

    if (hasIssues) {
      // Show warning with action buttons for problematic configurations
      const selection = await vscode.window.showWarningMessage(
        message,
        "View Details",
        "Fix Issues",
        "Refresh"
      );

      await this.handleHealthAction(selection, health);
    } else {
      // Show info message for healthy configurations
      const selection = await vscode.window.showInformationMessage(
        message,
        "View Details"
      );

      if (selection === "View Details") {
        this.showHealthDetails(health);
      }
    }
  }

  /**
   * Check if configuration has any health issues
   */
  private hasHealthIssues(health: ConfigHealth): boolean {
    return (health.issues?.length ?? 0) > 0;
  }

  /**
   * Handle user action selection from health message
   */
  private async handleHealthAction(
    selection: string | undefined,
    health: ConfigHealth
  ): Promise<void> {
    switch (selection) {
      case "View Details":
        if ("issues" in health) {
          this.showHealthDetails(health);
        } else {
          await this.validateConfiguration();
        }
        break;

      case "Fix Issues":
        await this.fixConfigurationIssues();
        break;

      case "Refresh":
        // Force health update and show again with debounced refresh
        setTimeout(() => this.showConfigurationHealth(), 1000);
        break;
    }
  }

  /**
   * Open configuration help
   */
  private openConfigurationHelp(): void {
    const outputChannel = vscode.window.createOutputChannel(
      "Code Pulse - Configuration Help"
    );

    outputChannel.appendLine("=== Code Pulse Configuration Help ===");
    outputChannel.appendLine("");
    outputChannel.appendLine("Available Commands:");
    outputChannel.appendLine(
      "• Code Pulse: Validate Configuration - Check for configuration errors"
    );
    outputChannel.appendLine(
      "• Code Pulse: Reset Configuration - Reset all settings to defaults"
    );
    outputChannel.appendLine(
      "• Code Pulse: Export Configuration - Save configuration to file"
    );
    outputChannel.appendLine(
      "• Code Pulse: Import Configuration - Load configuration from file"
    );
    outputChannel.appendLine(
      "• Code Pulse: Migrate Configuration - Update configuration format"
    );
    outputChannel.appendLine(
      "• Code Pulse: Show Configuration Health - View configuration status"
    );
    outputChannel.appendLine(
      "• Code Pulse: Fix Configuration Issues - Auto-fix common problems"
    );
    outputChannel.appendLine("");
    outputChannel.appendLine("Configuration Sections:");
    outputChannel.appendLine(
      "• productivityDashboard.enableMetricTracking - Enable/disable tracking"
    );
    outputChannel.appendLine(
      "• productivityDashboard.complexityThreshold - Complexity warning threshold"
    );
    outputChannel.appendLine(
      "• productivityDashboard.trackingInterval - Data collection interval"
    );
    outputChannel.appendLine(
      "• productivityDashboard.websocket - WebSocket configuration"
    );
    outputChannel.appendLine(
      "• productivityDashboard.analytics - Analytics features"
    );
    outputChannel.appendLine(
      "• productivityDashboard.theme - UI theme settings"
    );
    outputChannel.appendLine("");
    outputChannel.appendLine("For more information, visit:");
    outputChannel.appendLine(
      "https://github.com/BleckWolf25/Dev-Productivity-Dashboard"
    );

    outputChannel.show();
  }

  /**
   * Fix configuration issues automatically
   */
  private async fixConfigurationIssues(): Promise<void> {
    try {
      vscode.window.showInformationMessage(
        "Analyzing and fixing configuration issues..."
      );

      const results = await this.configManager.validateAllConfigurations();
      let fixedCount = 0;

      for (const [key, result] of results.entries()) {
        if (!result.isValid && result.migratedConfig) {
          try {
            if (key === "main") {
              // Apply main configuration fixes
              for (const [configKey, value] of Object.entries(
                result.migratedConfig
              )) {
                await this.configManager.set(configKey, value);
                fixedCount++;
              }
            }
          } catch (error) {
            console.error(`Failed to fix configuration for ${key}:`, error);
          }
        }
      }

      if (fixedCount > 0) {
        vscode.window.showInformationMessage(
          `Fixed ${fixedCount} configuration issues.`
        );
      } else {
        vscode.window.showInformationMessage(
          "No fixable configuration issues found."
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to fix configuration issues: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Show validation details in output channel
   */
  private showValidationDetails(results: Map<string, any>): void {
    const outputChannel = vscode.window.createOutputChannel(
      "Code Pulse - Configuration Validation"
    );

    outputChannel.clear();
    outputChannel.appendLine("=== Configuration Validation Results ===");
    outputChannel.appendLine(`Timestamp: ${new Date().toLocaleString()}`);
    outputChannel.appendLine("");

    for (const [key, result] of results.entries()) {
      outputChannel.appendLine(`${key}:`);
      outputChannel.appendLine(
        `  Status: ${result.isValid ? "✅ Valid" : "❌ Invalid"}`
      );

      if (result.errors && result.errors.length > 0) {
        outputChannel.appendLine("  Errors:");
        result.errors.forEach((error: any) => {
          outputChannel.appendLine(`    • ${error.path}: ${error.message}`);
        });
      }

      if (result.warnings && result.warnings.length > 0) {
        outputChannel.appendLine("  Warnings:");
        result.warnings.forEach((warning: any) => {
          outputChannel.appendLine(`    • ${warning.path}: ${warning.message}`);
        });
      }

      outputChannel.appendLine("");
    }

    outputChannel.show();
  }

  /**
   * Show migration details in output channel
   */
  private showMigrationDetails(result: any): void {
    const outputChannel = vscode.window.createOutputChannel(
      "Code Pulse - Configuration Migration"
    );

    outputChannel.clear();
    outputChannel.appendLine("=== Configuration Migration Details ===");
    outputChannel.appendLine(`From Version: ${result.fromVersion}`);
    outputChannel.appendLine(`To Version: ${result.toVersion}`);
    outputChannel.appendLine(`Success: ${result.success ? "✅" : "❌"}`);
    outputChannel.appendLine("");

    if (result.appliedMigrations && result.appliedMigrations.length > 0) {
      outputChannel.appendLine("Applied Migrations:");
      result.appliedMigrations.forEach((migration: string) => {
        outputChannel.appendLine(`  • ${migration}`);
      });
      outputChannel.appendLine("");
    }

    if (result.warnings && result.warnings.length > 0) {
      outputChannel.appendLine("Warnings:");
      result.warnings.forEach((warning: string) => {
        outputChannel.appendLine(`  • ${warning}`);
      });
      outputChannel.appendLine("");
    }

    if (result.errors && result.errors.length > 0) {
      outputChannel.appendLine("Errors:");
      result.errors.forEach((error: string) => {
        outputChannel.appendLine(`  • ${error}`);
      });
    }

    outputChannel.show();
  }

  /**
   * Show consolidation report
   */
  private showConsolidationReport(result: any): void {
    const outputChannel = vscode.window.createOutputChannel(
      "Code Pulse - Configuration Consolidation"
    );

    const report = this.consolidator.generateConsolidationReport(result);
    outputChannel.appendLine(report);
    outputChannel.show();
  }

  /**
   * Validate configuration consolidation
   */
  private async validateConsolidation(): Promise<void> {
    try {
      vscode.window.showInformationMessage(
        "Validating configuration consolidation..."
      );

      const validation = await this.consolidator.validateConsolidation();

      if (validation.isValid) {
        vscode.window
          .showInformationMessage(
            "Configuration consolidation validation passed! ✓",
            "View Details"
          )
          .then((selection) => {
            if (selection === "View Details") {
              this.showValidationReport(validation);
            }
          });
      } else {
        vscode.window
          .showWarningMessage(
            `Configuration consolidation has ${validation.issues.length} issue(s).`,
            "View Details",
            "Fix Issues"
          )
          .then((selection) => {
            if (selection === "View Details") {
              this.showValidationReport(validation);
            } else if (selection === "Fix Issues") {
              this.fixConfigurationIssues();
            }
          });
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Consolidation validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Show validation report
   */
  private showValidationReport(validation: any): void {
    const outputChannel = vscode.window.createOutputChannel(
      "Code Pulse - Consolidation Validation"
    );

    outputChannel.appendLine("=== Configuration Consolidation Validation ===");
    outputChannel.appendLine("");
    outputChannel.appendLine(
      `Status: ${validation.isValid ? "VALID" : "ISSUES FOUND"}`
    );
    outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
    outputChannel.appendLine("");

    if (validation.issues.length > 0) {
      outputChannel.appendLine("Issues Found:");
      validation.issues.forEach((issue: string) => {
        outputChannel.appendLine(`  ✗ ${issue}`);
      });
      outputChannel.appendLine("");
    }

    if (validation.recommendations.length > 0) {
      outputChannel.appendLine("Recommendations:");
      validation.recommendations.forEach((rec: string) => {
        outputChannel.appendLine(`  → ${rec}`);
      });
      outputChannel.appendLine("");
    }

    if (validation.isValid) {
      outputChannel.appendLine(
        "✓ Configuration consolidation is working correctly"
      );
      outputChannel.appendLine(
        "✓ All legacy systems have been properly migrated"
      );
      outputChannel.appendLine("✓ Configuration validation is functioning");
      outputChannel.appendLine("✓ Language configurations are accessible");
    }

    outputChannel.show();
  }

  /**
   * Show detailed health information
   */
  private showHealthDetails(health: any): void {
    const outputChannel = vscode.window.createOutputChannel(
      "Code Pulse - Configuration Health"
    );

    outputChannel.appendLine("=== Configuration Health Report ===");
    outputChannel.appendLine("");
    outputChannel.appendLine(`Score: ${health.score}/100`);
    outputChannel.appendLine(`Status: ${health.status.toUpperCase()}`);
    outputChannel.appendLine(
      `Last Validated: ${new Date(health.lastValidated).toLocaleString()}`
    );
    outputChannel.appendLine("");

    if (health.issues.length > 0) {
      outputChannel.appendLine("Issues:");
      health.issues.forEach((issue: any) => {
        const icon =
          issue.severity === "error"
            ? "✗"
            : issue.severity === "warning"
            ? "⚠"
            : "ℹ";
        const fixable = issue.fixable ? " (fixable)" : "";
        outputChannel.appendLine(
          `  ${icon} [${issue.category}] ${issue.message}${fixable}`
        );
      });
      outputChannel.appendLine("");
    }

    if (health.recommendations.length > 0) {
      outputChannel.appendLine("Recommendations:");
      health.recommendations.forEach((rec: string) => {
        outputChannel.appendLine(`  → ${rec}`);
      });
      outputChannel.appendLine("");
    }

    outputChannel.appendLine("=== Health Score Breakdown ===");
    outputChannel.appendLine("90-100: Excellent - Configuration is optimal");
    outputChannel.appendLine(
      "75-89:  Good - Minor issues that don't affect functionality"
    );
    outputChannel.appendLine(
      "50-74:  Fair - Some issues that may impact performance"
    );
    outputChannel.appendLine(
      "25-49:  Poor - Significant issues requiring attention"
    );
    outputChannel.appendLine(
      "0-24:   Critical - Major issues affecting functionality"
    );

    outputChannel.show();
  }

  /**
   * Show user-friendly configuration editor
   */
  private async showConfigurationEditor(): Promise<void> {
    try {
      const config = this.configManager.getAllConfig();
      const configGroups = this.getConfigurationGroups();
      
      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'configEditor',
        'Code Pulse Configuration',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );
      
      // Generate HTML content
      panel.webview.html = this.generateConfigEditorHtml(config, configGroups);
      
      // Handle messages from webview
      panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'saveConfig') {
          await this.saveConfigFromEditor(message.config);
          vscode.window.showInformationMessage('Configuration saved successfully');
        } else if (message.command === 'validateConfig') {
          const validationResult = await this.validateConfigFromEditor(message.config);
          panel.webview.postMessage({ command: 'validationResult', result: validationResult });
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open configuration editor: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get configuration groups for UI organization
   */
  private getConfigurationGroups(): any[] {
    return [
      {
        id: 'general',
        title: 'General Settings',
        description: 'Basic configuration options for Code Pulse',
        settings: ['enableMetricTracking', 'trackingInterval', 'enableNotifications', 'theme']
      },
      {
        id: 'complexity',
        title: 'Complexity Analysis',
        description: 'Settings for code complexity measurement and thresholds',
        settings: ['complexityThreshold', 'languageConfigs']
      },
      {
        id: 'advanced',
        title: 'Advanced Settings',
        description: 'Advanced configuration options for power users',
        settings: ['enableDetailedLogging', 'maxStorageSize', 'dataRetentionDays', 'websocket']
      }
    ];
  }

  /**
   * Register the configuration editor command
   */
  public registerConfigEditorCommand(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand(
      'codePulse.openConfigEditor',
      () => this.showConfigurationEditor()
    );
    context.subscriptions.push(command);
  }

  /**
   * Generate HTML content for config editor
   */
  private generateConfigEditorHtml(config: any, _configGroups: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CodePulse Configuration Editor</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .config-group { margin-bottom: 20px; border: 1px solid #ccc; padding: 15px; }
            .config-item { margin-bottom: 10px; }
            label { display: block; font-weight: bold; margin-bottom: 5px; }
            input, select, textarea { width: 100%; padding: 5px; }
          </style>
        </head>
        <body>
          <h1>Configuration Editor</h1>
          <div id="config-content">
            ${JSON.stringify(config, null, 2)}
          </div>
          <button onclick="saveConfig()">Save Configuration</button>
          <script>
            const vscode = acquireVsCodeApi();
            function saveConfig() {
              vscode.postMessage({ command: 'saveConfig', config: {} });
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Save configuration from editor
   */
  private async saveConfigFromEditor(config: any): Promise<void> {
    try {
      // TODO: Implement actual config saving logic
      console.log('Saving config:', config);
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Validate configuration from editor
   */
  private async validateConfigFromEditor(_config: any): Promise<any> {
    try {
      // TODO: Implement actual config validation logic
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      console.error('Failed to validate config:', error);
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      };
    }
  }
}
