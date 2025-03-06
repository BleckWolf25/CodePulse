import path from 'node:path';
import * as vscode from 'vscode';

export class ComplexityAlertService {
  private static COMPLEXITY_THRESHOLDS: Record<string, number> = {
    typescript: 15,
    javascript: 12,
    python: 20
  };

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