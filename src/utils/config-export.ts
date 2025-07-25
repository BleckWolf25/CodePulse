/**
 * @file CONFIG-EXPORT.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Configuration Export Service for Code Pulse
 * Handles exporting core settings to external JSON files with user-friendly save dialogs
 * and maintains data type integrity through JSON serialization.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

// ------------ CLASS
/**
 * Handles exporting configuration settings to external JSON files
 */
export class ConfigExporter {
  /**
   * Export current configuration to JSON file
   * Uses native save dialog for file selection and only exports user-modifiable settings
   */
  public async exportConfiguration() {
    const saveUri = await vscode.window.showSaveDialog({
      saveLabel: 'Export Productivity Config',
      filters: { 'JSON': ['json'] }
    });

    if (saveUri && saveUri.fsPath) {
      const config = vscode.workspace.getConfiguration('productivityDashboard');

      // Select export-safe configuration properties
      const configToExport = {
        enableMetricTracking: config.get('enableMetricTracking'),
        complexityThreshold: config.get('complexityThreshold'),
      };

      // Write with pretty-printing and UTF-8 encoding
      fs.writeFileSync(saveUri.fsPath,
        JSON.stringify(configToExport, null, 2),
        'utf8'
      );

      vscode.window.showInformationMessage(
        'Configuration exported successfully to: ' +
        path.basename(saveUri.fsPath)
      );
    }
  }

  /**
   * Import configuration from JSON file
   * Uses native open dialog for file selection, validates imported data structure,
   * and merges with existing configuration
   */
  public async importConfiguration() {
    const openUri = await vscode.window.showOpenDialog({
      openLabel: 'Import Productivity Config',
      filters: { 'JSON': ['json'] },
      canSelectMany: false
    });

    if (openUri && openUri[0]) {
      try {
        const configData = JSON.parse(fs.readFileSync(openUri[0].fsPath, 'utf8'));
        const config = vscode.workspace.getConfiguration('productivityDashboard');

        // Validate and apply imported settings
        if (configData.enableMetricTracking !== undefined) {
          await config.update('enableMetricTracking', configData.enableMetricTracking);
        }
        if (configData.complexityThreshold !== undefined) {
          await config.update('complexityThreshold', configData.complexityThreshold);
        }

        vscode.window.showInformationMessage(
          'Configuration imported successfully from: ' +
          path.basename(openUri[0].fsPath)
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to import configuration: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  }
}