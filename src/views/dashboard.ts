/**
 * src/views/dashboard.ts
 * 
 * Dashboard View Controller
 * 
 * Handles webview panel management and user interactions for:
 * - Real-time metric visualization
 * - Dashboard refresh functionality
 * - Data export operations
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';
import { MetricsChartGenerator } from './charts';
import { MetricsTracker } from '../metrics/tracker';

// -------------------- MAIN EXPORT -------------------- \\

export class ProductivityDashboard {
  private context: vscode.ExtensionContext;
  private chartGenerator: MetricsChartGenerator;
  private metricsTracker: MetricsTracker;

  /**
   * Initialize dashboard components
   * @param context - Extension context for resource management
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.chartGenerator = new MetricsChartGenerator(context);
    this.metricsTracker = new MetricsTracker(context);
  }

  /**
   * Creates and displays the main dashboard interface
   * @remarks
   * - Uses Webview Panel for rich HTML content
   * - Maintains UI state when hidden (retainContextWhenHidden)
   * - Sets up bi-directional communication channel
   */
  public show() {

    // Configure webview panel
    const panel = vscode.window.createWebviewPanel(
      'productivityDashboard', // Unique view type ID
      'Developer Productivity Dashboard', // Panel title
      vscode.ViewColumn.One, // Editor column placement
      {
        enableScripts: true, // Enable JavaScript execution
        retainContextWhenHidden: true // Maintain UI state when hidden
      }
    );

    // Initial content rendering
    panel.webview.html = this.chartGenerator.generateDashboardHTML();

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'refreshMetrics':
            this.refreshDashboard(panel);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Updates dashboard with latest metrics
   * @param panel - Reference to active webview panel
   * @remarks
   * 1. Persists current metrics to storage
   * 2. Regenerates visualization content
   * 3. Displays summary notification
   */
  private refreshDashboard(panel: vscode.WebviewPanel) {

    // Check data persistence before refresh
    this.metricsTracker.persistMetrics();

    // Update visualization content
    panel.webview.html = this.chartGenerator.generateDashboardHTML();

    // Show session summary
    const insights = this.metricsTracker.getSessionInsights();
    vscode.window.showInformationMessage(
      `Session Insights: ${insights.duration.toFixed(2)} mins, ` +
      `${insights.filesTracked} files tracked`
    );
  }

  /**
   * Exports metrics data to JSON format
   * @remarks
   * - Uses native save dialog for file selection
   * - Saves data with pretty-printed JSON formatting
   * - Handles both workspace and local file paths
   */
  public exportMetrics() {
    const metrics = this.metricsTracker.getSessionInsights();

    vscode.window.showSaveDialog({
      saveLabel: 'Export Metrics',
      filters: { 'JSON Files': ['json'] }
    }).then(fileUri => {
      if (fileUri) {
        const content = JSON.stringify(metrics, null, 2); // 2-space indentation
        vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(content, 'utf8')
        );
      }
    });
  }
}