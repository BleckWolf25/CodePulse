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
import { WebSocketManager } from './services/websocket-manager';
import { AdvancedAnalyticsService } from './services/advanced-analytics-service';
import { ConfigManager } from './utils/config-manager';
import { ConfigCommands } from './commands/config-commands';
import { AnalyticsService } from './analytics/analytics-service';
import { HistoricalAnalyzer } from './analytics/historical-analyzer';
import { ProjectComparator } from './analytics/project-comparator';
import { RegressionDetector } from './analytics/regression-detector';
import { ReportingService } from './reporting/reporting-service';
import { AdvancedErrorHandler } from './utils/advanced-error-handler';
import { Logger } from './utils/logger';
import { PerformanceMonitor } from './utils/performance-monitor';
import { MemoryLeakDetector } from './utils/memory-leak-detector';
import { PerformanceOptimizationManager } from './performance/performance-optimization-manager';


// -------------------- GLOBAL STATE -------------------- \\

// Singleton instances
let metricsTracker: MetricsTracker | null = null;
let webSocketManager: WebSocketManager | null = null;
let advancedAnalyticsService: AdvancedAnalyticsService | null = null;
let configManager: ConfigManager | null = null;
let configCommands: ConfigCommands | null = null;
let analyticsService: AnalyticsService | null = null;
let historicalAnalyzer: HistoricalAnalyzer | null = null;
let projectComparator: ProjectComparator | null = null;
let regressionDetector: RegressionDetector | null = null;
let reportingService: ReportingService | null = null;
let errorHandler: AdvancedErrorHandler | null = null;
let logger: Logger | null = null;
let performanceMonitor: PerformanceMonitor | null = null;
let memoryLeakDetector: MemoryLeakDetector | null = null;
let performanceOptimizationManager: PerformanceOptimizationManager | null = null;

// -------------------- EXTENSION ACTIVATION -------------------- \\

/**
 * Extension activation hook
 * @param context - VSCode extension context for resource management
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('🔵 Code Pulse ACTIVATING');

  try {
    // Initialize error handling and monitoring systems first
    logger = Logger.getInstance(context);
    errorHandler = AdvancedErrorHandler.getInstance(context);
    performanceMonitor = new PerformanceMonitor(context);
    memoryLeakDetector = new MemoryLeakDetector(context);

    // Start monitoring systems
    performanceMonitor.start();
    memoryLeakDetector.start();

    // Record activation start
    const activationOperation = performanceMonitor.startOperation('extension-activation', 'extension');

    // Initialize configuration system first
    configManager = ConfigManager.getInstance();
    await configManager.initialize();

    // Initialize configuration commands
    configCommands = new ConfigCommands();
    configCommands.registerCommands(context);

    // Initialize analytics services
    analyticsService = new AnalyticsService(context);
    historicalAnalyzer = new HistoricalAnalyzer(context);
    projectComparator = new ProjectComparator(context);
    regressionDetector = new RegressionDetector(context);

    // Initialize reporting service
    reportingService = new ReportingService(context, analyticsService, regressionDetector);

    // Initialize performance optimization manager
    performanceOptimizationManager = new PerformanceOptimizationManager(context);

    // Make services globally available for dashboard
    (global as any).analyticsService = analyticsService;
    (global as any).historicalAnalyzer = historicalAnalyzer;
    (global as any).projectComparator = projectComparator;
    (global as any).regressionDetector = regressionDetector;
    (global as any).reportingService = reportingService;
    (global as any).errorHandler = errorHandler;
    (global as any).logger = logger;
    (global as any).performanceMonitor = performanceMonitor;
    (global as any).memoryLeakDetector = memoryLeakDetector;
    (global as any).performanceOptimizationManager = performanceOptimizationManager;

    // Initialize only critical components on startup - no blocking operations
    const statusBar = createStatusBar();

    // Lazy load other components
    let dashboard: ProductivityDashboard | null = null;

    // Helper function to get or create shared instances with error handling
    const getMetricsTracker = () => {
      try {
        if (!metricsTracker) {
          metricsTracker = new MetricsTracker(context);
        }
        return metricsTracker;
      } catch (error) {
        console.error('Failed to create MetricsTracker:', error);
        vscode.window.showErrorMessage('Code Pulse: Failed to initialize metrics tracker');
        return null;
      }
    };

    const getWebSocketManager = () => {
      try {
        if (!webSocketManager) {
          webSocketManager = new WebSocketManager(context);
        }
        return webSocketManager;
      } catch (error) {
        console.error('Failed to create WebSocketManager:', error);
        vscode.window.showErrorMessage('Code Pulse: Failed to initialize WebSocket manager');
        return null;
      }
    };

    const getAdvancedAnalyticsService = () => {
      try {
        if (!advancedAnalyticsService) {
          advancedAnalyticsService = new AdvancedAnalyticsService(context);
        }
        return advancedAnalyticsService;
      } catch (error) {
        console.error('Failed to create AdvancedAnalyticsService:', error);
        vscode.window.showErrorMessage('Code Pulse: Failed to initialize advanced analytics');
        return null;
      }
    };

    const getDashboard = () => {
      try {
        if (!dashboard) {
          const tracker = getMetricsTracker();
          const wsManager = getWebSocketManager();
          dashboard = new ProductivityDashboard(context, tracker || undefined, wsManager || undefined);
        }
        return dashboard;
      } catch (error) {
        console.error('Failed to create Dashboard:', error);
        vscode.window.showErrorMessage('Code Pulse: Failed to initialize dashboard');
        return null;
      }
    };

    // Performance monitoring
    const startupTime = performance.now();

    // Register command handlers with lazy loading and error handling
    const commandHandlers = [
      vscode.commands.registerCommand('productivityDashboard.show', async () => {
        const dashboard = getDashboard();
        if (dashboard) {
          dashboard.show();
        }
      }),

      vscode.commands.registerCommand('productivityDashboard.exportMetrics', async () => {
        const dashboard = getDashboard();
        if (dashboard) {
          dashboard.exportMetrics();
        }
      }),

      vscode.commands.registerCommand('productivityDashboard.exportConfig', async () => {
        const configExporter = new ConfigExporter();
        configExporter.exportConfiguration();
      }),

      vscode.commands.registerCommand('productivityDashboard.clearMetrics', async () => {
        vscode.window.showWarningMessage(
          'Are you sure you want to clear all productivity metrics?',
          'Yes', 'No'
        ).then(selection => {
          if (selection === 'Yes') {
            try {
              const metricsStorage = new MetricsStorage(context);
              metricsStorage.saveMetrics({
                dailyMetrics: [],
                fileMetrics: {},
                sessions: []
              });
              vscode.window.showInformationMessage('Productivity metrics cleared successfully');
            } catch (error) {
              console.error('Error clearing metrics:', error);
              vscode.window.showErrorMessage('Failed to clear metrics');
            }
          }
        });
      }),

      vscode.commands.registerCommand('productivityDashboard.toggleTracking', async () => {
        const config = vscode.workspace.getConfiguration('productivityDashboard');
        const currentState = config.get<boolean>('enableMetricTracking');

        config.update('enableMetricTracking', !currentState, vscode.ConfigurationTarget.Global)
          .then(() => {
            vscode.window.showInformationMessage(
              `Productivity tracking ${!currentState ? 'enabled' : 'disabled'}`
            );
          });
      }),

      vscode.commands.registerCommand('productivityDashboard.showAdvancedAnalytics', async () => {
        const dashboard = getDashboard();
        if (dashboard) {
          dashboard.showAdvancedAnalytics();
        }
      }),

      vscode.commands.registerCommand('productivityDashboard.generateAnalyticsReport', async () => {
        const analyticsService = getAdvancedAnalyticsService();
        if (analyticsService) {
          try {
            const report = await analyticsService.generateAdvancedReport();
            vscode.window.showInformationMessage('Advanced analytics report generated successfully');
          } catch (error) {
            vscode.window.showErrorMessage('Failed to generate analytics report');
          }
        }
      })
    ];

    // Manage extension resources
    context.subscriptions.push(
      statusBar,
      ...commandHandlers
    );

    // Schedule non-critical initialization for later
    setTimeout(async () => {
      try {
        // Initialize WebSocket manager with metrics tracker
        const tracker = getMetricsTracker();
        const wsManager = getWebSocketManager();
        const analyticsService = getAdvancedAnalyticsService();

        if (tracker && wsManager) {
          await wsManager.initialize(tracker);
        }

        // Initialize advanced analytics service
        if (analyticsService && wsManager) {
          const webSocketServer = wsManager.getWebSocketServer();
          await analyticsService.initialize(webSocketServer || undefined);
        }

        // Register data retention job
        const retentionPeriod = vscode.workspace.getConfiguration('productivityDashboard')
          .get<number>('retentionPeriod', 90);

        setInterval(() => {
          try {
            const metricsStorage = new MetricsStorage(context);
            metricsStorage.pruneOldMetrics(retentionPeriod);
          } catch (error) {
            console.error('Error in retention job:', error);
          }
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
      } catch (error) {
        console.error('Error in delayed initialization:', error);
      }
    }, 1000);

    // Log startup performance
    const loadTime = performance.now() - startupTime;
    console.log(`🟢 Code Pulse ACTIVATED in ${loadTime.toFixed(2)}ms`);
  } catch (error) {
    console.error('Code Pulse activation failed:', error);
    void vscode.window.showErrorMessage('Code Pulse failed to activate: ' + (error as Error).message);
    throw error;
  }
}

function createStatusBar(): vscode.StatusBarItem {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  statusBar.text = '$(pulse) Code Pulse';
  statusBar.tooltip = 'Show Developer Productivity Dashboard';
  statusBar.command = 'productivityDashboard.show';
  statusBar.show();
  return statusBar;
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

  // Clean up performance optimization manager
  if (performanceOptimizationManager) {
    performanceOptimizationManager.dispose();
    performanceOptimizationManager = null;
  }

  // Clean up error handling and monitoring systems
  if (performanceMonitor) {
    performanceMonitor.dispose();
    performanceMonitor = null;
  }

  if (memoryLeakDetector) {
    memoryLeakDetector.dispose();
    memoryLeakDetector = null;
  }

  if (logger) {
    logger.dispose();
    logger = null;
  }

  if (errorHandler) {
    errorHandler.dispose();
    errorHandler = null;
  }

  // Clean up metrics tracker
  if (metricsTracker) {
    metricsTracker.persistMetrics(); // Ensure latest metrics are saved
    metricsTracker.dispose();        // Release resources
    metricsTracker = null;           // Enable garbage collection
  }

  // Clean up WebSocket manager
  if (webSocketManager) {
    webSocketManager.dispose();
    webSocketManager = null;
  }

  // Clean up advanced analytics service
  if (advancedAnalyticsService) {
    advancedAnalyticsService.stop();
    advancedAnalyticsService = null;
  }
}