// src/utils/config-export.ts
import * as vscode from 'vscode';
import * as fs from 'fs';

export class ConfigExporter {
  public async exportConfiguration() {
    const saveUri = await vscode.window.showSaveDialog({
      saveLabel: 'Export Productivity Config',
      filters: { 'JSON': ['json'] }
    });

    if (saveUri) {
      const config = vscode.workspace.getConfiguration('productivityDashboard');
      const configToExport = {
        enableMetricTracking: config.get('enableMetricTracking'),
        complexityThreshold: config.get('complexityThreshold'),
      };

      fs.writeFileSync(saveUri.fsPath, JSON.stringify(configToExport, null, 2));
      vscode.window.showInformationMessage('Configuration exported successfully');
    }
  }
}