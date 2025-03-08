/**
 * src/utils/config-export.ts
 * 
 * Configuration Export Service
 * 
 * Handles exporting core settings to external JSON files
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

// -------------------- MAIN EXPORT -------------------- \\

export class ConfigExporter {
  /**
   * Export current configuration to JSON file
   * @remarks
   * - Uses native save dialog for file selection
   * - Only exports user-modifiable settings
   * - Maintains data types through JSON serialization
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
}