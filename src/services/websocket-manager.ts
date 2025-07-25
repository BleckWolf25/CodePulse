/**
 * WebSocket Manager
 * 
 * Manages WebSocket server lifecycle and coordinates real-time data flow
 * between the extension and webview dashboard.
 */

import * as vscode from 'vscode';
import { WebSocketServer, WebSocketMessage } from './websocket-server';
import { MetricsTracker } from '../metrics/tracker';

export interface WebSocketConfig {
  enabled: boolean;
  fallbackToPolling: boolean;
  updateInterval: number;
  maxClients: number;
  pingInterval: number;
  connectionTimeout: number;
}

export class WebSocketManager {
  private server: WebSocketServer | null = null;
  private config: WebSocketConfig;
  private isStarted: boolean = false;
  private metricsTracker: MetricsTracker | null = null;
  private statusBarItem: vscode.StatusBarItem | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.config = this.loadConfig();
    this.setupStatusBar();
    this.setupConfigWatcher();
  }

  /**
   * Initialize WebSocket manager with metrics tracker
   */
  public async initialize(metricsTracker: MetricsTracker): Promise<void> {
    this.metricsTracker = metricsTracker;
    
    if (this.config.enabled) {
      await this.start();
    }
  }

  /**
   * Start WebSocket server
   */
  public async start(): Promise<void> {
    if (this.isStarted || !this.config.enabled) {
      return;
    }

    try {
      this.server = new WebSocketServer(this.context);
      const port = await this.server.start(this.metricsTracker || undefined);
      
      this.isStarted = true;
      this.updateStatusBar(`WebSocket: ${port}`, 'Connected');
      
      console.log(`WebSocket server started on port ${port}`);
      
      // Store port for webview access
      await this.context.globalState.update('codePulse.websocketPort', port);
      
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('WebSocket module not available')) {
        console.log('WebSocket module not available, disabling WebSocket functionality');
        this.updateStatusBar('WebSocket: Disabled', 'WebSocket module not available');
        vscode.window.showWarningMessage(
          'Code Pulse: WebSocket functionality is not available. The extension will work without real-time updates.'
        );
      } else {
        this.updateStatusBar('WebSocket: Error', 'Failed to start WebSocket server');

        if (this.config.fallbackToPolling) {
          console.log('Falling back to polling mode');
          vscode.window.showWarningMessage(
            'Code Pulse: WebSocket server failed to start. Using polling mode.',
            'Retry'
          ).then(selection => {
            if (selection === 'Retry') {
              this.restart();
            }
          });
        }
      }
    }
  }

  /**
   * Stop WebSocket server
   */
  public async stop(): Promise<void> {
    if (!this.isStarted || !this.server) {
      return;
    }

    try {
      await this.server.stop();
      this.server = null;
      this.isStarted = false;
      
      this.updateStatusBar('WebSocket: Stopped', 'WebSocket server stopped');
      
      // Clear stored port
      await this.context.globalState.update('codePulse.websocketPort', undefined);
      
      console.log('WebSocket server stopped');
    } catch (error) {
      console.error('Error stopping WebSocket server:', error);
    }
  }

  /**
   * Restart WebSocket server
   */
  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: WebSocketMessage): void {
    if (this.server && this.isStarted) {
      this.server.broadcast(message);
    }
  }

  /**
   * Send metrics update
   */
  public sendMetricsUpdate(data: any): void {
    this.broadcast({
      type: 'data',
      command: 'metricsUpdate',
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Send insights update
   */
  public sendInsightsUpdate(data: any): void {
    this.broadcast({
      type: 'data',
      command: 'insightsUpdate',
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Send chart data update
   */
  public sendChartUpdate(data: any): void {
    this.broadcast({
      type: 'data',
      command: 'chartUpdate',
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Send filter applied notification
   */
  public sendFiltersApplied(filters: any): void {
    this.broadcast({
      type: 'event',
      command: 'filtersApplied',
      data: { filters },
      timestamp: Date.now()
    });
  }

  /**
   * Send time range update notification
   */
  public sendTimeRangeUpdate(timeRange: string): void {
    this.broadcast({
      type: 'event',
      command: 'timeRangeUpdate',
      data: { timeRange },
      timestamp: Date.now()
    });
  }

  /**
   * Send error notification
   */
  public sendError(error: string): void {
    this.broadcast({
      type: 'error',
      command: 'error',
      data: { error },
      timestamp: Date.now()
    });
  }

  /**
   * Get server status
   */
  public getStatus(): {
    isRunning: boolean;
    port: number;
    clientCount: number;
    config: WebSocketConfig;
  } {
    return {
      isRunning: this.isStarted,
      port: this.server?.getPort() || 0,
      clientCount: this.server?.getClientCount() || 0,
      config: this.config
    };
  }

  /**
   * Get WebSocket port for webview
   */
  public getPort(): number {
    return this.server?.getPort() || 0;
  }

  /**
   * Check if WebSocket is enabled and running
   */
  public isEnabled(): boolean {
    return this.config.enabled && this.isStarted;
  }

  /**
   * Get the WebSocket server instance
   */
  public getWebSocketServer(): WebSocketServer | null {
    return this.server;
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfig(): WebSocketConfig {
    const config = vscode.workspace.getConfiguration('productivityDashboard');
    
    return {
      enabled: config.get('websocket.enabled', true),
      fallbackToPolling: config.get('websocket.fallbackToPolling', true),
      updateInterval: config.get('websocket.updateInterval', 1000),
      maxClients: config.get('websocket.maxClients', 10),
      pingInterval: config.get('websocket.pingInterval', 30000),
      connectionTimeout: config.get('websocket.connectionTimeout', 60000)
    };
  }

  /**
   * Setup configuration watcher
   */
  private setupConfigWatcher(): void {
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('productivityDashboard.websocket')) {
        const newConfig = this.loadConfig();
        const wasEnabled = this.config.enabled;
        
        this.config = newConfig;
        
        if (wasEnabled !== newConfig.enabled) {
          if (newConfig.enabled) {
            await this.start();
          } else {
            await this.stop();
          }
        } else if (newConfig.enabled && this.isStarted) {
          // Restart if other settings changed
          await this.restart();
        }
      }
    });
  }

  /**
   * Setup status bar item
   */
  private setupStatusBar(): void {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      999
    );
    
    this.statusBarItem.command = 'productivityDashboard.toggleWebSocket';
    this.context.subscriptions.push(this.statusBarItem);
    
    // Register toggle command
    this.context.subscriptions.push(
      vscode.commands.registerCommand('productivityDashboard.toggleWebSocket', async () => {
        if (this.isStarted) {
          await this.stop();
          vscode.window.showInformationMessage('WebSocket server stopped');
        } else {
          await this.start();
          vscode.window.showInformationMessage('WebSocket server started');
        }
      })
    );
  }

  /**
   * Update status bar
   */
  private updateStatusBar(text: string, tooltip: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.text = `$(radio-tower) ${text}`;
      this.statusBarItem.tooltip = tooltip;
      this.statusBarItem.show();
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.stop().catch(console.error);
    
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }
  }
}
