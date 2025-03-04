// src/views/dashboard.ts
import * as vscode from 'vscode';
import { MetricsChartGenerator } from './charts';
import { MetricsTracker } from '../metrics/tracker';

export class ProductivityDashboard {
  private context: vscode.ExtensionContext;
  private chartGenerator: MetricsChartGenerator;
  private metricsTracker: MetricsTracker;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.chartGenerator = new MetricsChartGenerator(context);
    this.metricsTracker = new MetricsTracker(context);
  }

  /**
   * Create and show the productivity dashboard webview
   */
  public show() {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'productivityDashboard',
      'Developer Productivity Dashboard',
      vscode.ViewColumn.One,
      { 
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Set webview content
    panel.webview.html = this.chartGenerator.generateDashboardHTML();

    // Handle webview messages (if needed)
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
   * Refresh dashboard with latest metrics
   */
  private refreshDashboard(panel: vscode.WebviewPanel) {
    // Persist current metrics
    this.metricsTracker.persistMetrics();

    // Update webview content
    panel.webview.html = this.chartGenerator.generateDashboardHTML();

    // Show summary notification
    const insights = this.metricsTracker.getSessionInsights();
    vscode.window.showInformationMessage(
      `Session Insights: ${insights.duration.toFixed(2)} mins, ` +
      `${insights.filesTracked} files tracked`
    );
  }

  /**
   * Export metrics to JSON
   */
  public exportMetrics() {
    const metrics = this.metricsTracker.getSessionInsights();
    
    vscode.window.showSaveDialog({
      saveLabel: 'Export Metrics',
      filters: { 'JSON Files': ['json'] }
    }).then(fileUri => {
      if (fileUri) {
        const content = JSON.stringify(metrics, null, 2);
        vscode.workspace.fs.writeFile(
          fileUri, 
          Buffer.from(content, 'utf8')
        );
      }
    });
  }
}