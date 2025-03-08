/**
 * src/extension.ts
 * 
 * Extension Entry Point
 * 
 * Handles extension lifecycle management:
 * - Activation/Deactivation
 * - UI Integration (Status Bar)
 * - Core Component Initialization
 * - User Onboarding
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';
import { MetricsTracker } from './metrics/tracker';
import { ProductivityDashboard } from './views/dashboard';
import { ConfigExporter } from './utils/config-export';
import { MetricsStorage } from './metrics/storage';
import { ConfigManager } from './utils/config';


// -------------------- GLOBAL STATE -------------------- \\

// Singleton metrics tracker instance
let metricsTracker: MetricsTracker | null = null;

// -------------------- EXTENSION ACTIVATION -------------------- \\

/**
 * Extension activation hook
 * @param context - VSCode extension context for resource management
 * @remarks
 * - Initializes status bar UI
 * - Creates metrics tracking core
 * - Registers command handlers
 * - Shows first-run onboarding
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('🟢 Code Pulse ACTIVATED');

  // Initialize configuration manager
  const configManager = ConfigManager.getInstance();

  // Initialize metrics storage
  const metricsStorage = new MetricsStorage(context);

  // Initialize status bar component
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right, // Position in editor UI
    1000 // Priority level
  );
  statusBar.text = '$(pulse) Code Pulse';
  statusBar.tooltip = 'Show Developer Productivity Dashboard';
  statusBar.command = 'productivityDashboard.show';
  statusBar.show();

  // Initialize core analytics engine
  metricsTracker = new MetricsTracker(context);

  // Initialize dashboard
  const dashboard = new ProductivityDashboard(context);

  // Initialize config exporter
  const configExporter = new ConfigExporter();

  // Register dashboard command handler
  const commandHandlers = [
    // Show dashboard command
    vscode.commands.registerCommand('productivityDashboard.show', () => {
      dashboard.show();
    }),

    // Export metrics command
    vscode.commands.registerCommand('productivityDashboard.exportMetrics', () => {
      dashboard.exportMetrics();
    }),

    // Export configuration command
    vscode.commands.registerCommand('productivityDashboard.exportConfig', () => {
      configExporter.exportConfiguration();
    }),

    // Clear metrics command (additional useful command)
    vscode.commands.registerCommand('productivityDashboard.clearMetrics', () => {
      const config = configManager.getConfig();
      vscode.window.showWarningMessage(
        'Are you sure you want to clear all productivity metrics?',
        'Yes', 'No'
      ).then(selection => {
        if (selection === 'Yes') {
          metricsStorage.saveMetrics({
            dailyMetrics: [],
            fileMetrics: {},
            sessions: []
          });
          vscode.window.showInformationMessage('Productivity metrics cleared successfully');
        }
      });
    }),

    // Toggle tracking command (additional useful command)
    vscode.commands.registerCommand('productivityDashboard.toggleTracking', () => {
      const config = vscode.workspace.getConfiguration('productivityDashboard');
      const currentState = config.get<boolean>('enableMetricTracking');

      config.update('enableMetricTracking', !currentState, vscode.ConfigurationTarget.Global)
        .then(() => {
          vscode.window.showInformationMessage(
            `Productivity tracking ${!currentState ? 'enabled' : 'disabled'}`
          );
        });
    })
  ];

  // Manage extension resources
  context.subscriptions.push(
    statusBar,
    ...commandHandlers
  );

  // Register data retention job
  const retentionPeriod = vscode.workspace.getConfiguration('productivityDashboard')
    .get<number>('retentionPeriod', 90);

  setInterval(() => {
    metricsStorage.pruneOldMetrics(retentionPeriod);
  }, 24 * 60 * 60 * 1000); // Check once per day

  // First-run user onboarding
  const hasShownFirstRun = context.globalState.get('codePulse.hasShownFirstRun');
  if (!hasShownFirstRun) {
    vscode.window.showInformationMessage(
      'Code Pulse activated! Click the $(pulse) icon in the status bar to see your productivity metrics.',
      'Show Dashboard'
    ).then(selection => {
      if (selection === 'Show Dashboard') {
        vscode.commands.executeCommand('productivityDashboard.show');
      }
    });
    context.globalState.update('codePulse.hasShownFirstRun', true);
  }
}

// -------------------- EXTENSION DEACTIVATION -------------------- \\

/**
 * Extension cleanup handler
 * @remarks
 * - Flushes pending metrics to storage
 * - Releases system resources
 * - Nullifies tracker reference for GC
 */
export function deactivate(): void {
  console.log('🔴 Code Pulse DEACTIVATED');
  if (metricsTracker) {
    metricsTracker.persistMetrics(); // Ensure latest metrics are saved
    metricsTracker.dispose();        // Release resources
    metricsTracker = null;           // Enable garbage collection
  }
}