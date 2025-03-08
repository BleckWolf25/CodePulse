/**
 * src/metrics/complexity-alerts.ts
 * 
 * Complexity Alerts.ts
 * Handles complexity threshold detection and user notifications
 * Integrates with VSCode diagnostics system for inline feedback
 */

// -------------------- IMPORTS -------------------- \\

import path from 'node:path';
import * as vscode from 'vscode';

// -------------------- MAIN EXPORT -------------------- \\

export class ComplexityAlertService {

  // Language-specific complexity thresholds
  private static COMPLEXITY_THRESHOLDS: Record<string, number> = {
    typescript: 15,
    javascript: 12,
    python: 20
  };

  /**
   * Evaluates complexity against thresholds and triggers alerts
   * @param filePath - Absolute path to analyzed the file
   * @param complexity - Calculated cyclomatic complexity
   * @param language - Detected programming language
   */
  public static checkAndAlertComplexity(filePath: string, complexity: number, language: string) {

    // Use type assertion for valid language keys
    const threshold = this.COMPLEXITY_THRESHOLDS[language.toLowerCase()] || 10;

    if (complexity > threshold) {

      // Create diagnostic severity based on complexity level
      const severity = complexity > (threshold * 1.5)
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `High code complexity detected (${complexity}). Consider refactoring.`,
        severity
      );

      const collection = vscode.languages.createDiagnosticCollection('complexity');
      collection.set(vscode.Uri.file(filePath), [diagnostic]);

      // Show notification with file basename
      vscode.window.showWarningMessage(
        `High complexity in ${path.basename(filePath)}: ${complexity}`,
        'View Details'
      ).then(selection => {
        if (selection) {
          vscode.workspace.openTextDocument(filePath)
            .then(doc => vscode.window.showTextDocument(doc));
        }
      });
    }
  }
}