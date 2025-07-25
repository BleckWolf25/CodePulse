/**
 * WebSocket Server for Real-time Data Communication
 * 
 * Provides WebSocket server functionality for real-time communication
 * between the VS Code extension and webview dashboard.
 */

import * as vscode from 'vscode';
import * as http from 'http';
import { MetricsTracker } from '../metrics/tracker';

// Conditional import for WebSocket
let WebSocket: any = null;
try {
  WebSocket = require('ws');
} catch (error) {
  console.warn('WebSocket module not available, WebSocket functionality will be disabled');
}

export interface WebSocketMessage {
  type: string;
  command: string;
  data?: any;
  timestamp: number;
  id?: string;
}

export interface ClientConnection {
  id: string;
  socket: any; // WebSocket instance
  lastPing: number;
  subscriptions: Set<string>;
}

export class WebSocketServer {
  private server: any | null = null; // WebSocket.Server instance
  private httpServer: http.Server | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private port: number = 0;
  private metricsTracker: MetricsTracker | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.setupCleanup();
  }

  /**
   * Start the WebSocket server
   */
  public async start(metricsTracker?: MetricsTracker): Promise<number> {
    try {
      if (!WebSocket) {
        throw new Error('WebSocket module not available');
      }

      this.metricsTracker = metricsTracker || null;

      // Create HTTP server first
      this.httpServer = http.createServer();

      // Create WebSocket server
      this.server = new WebSocket.Server({
        server: this.httpServer,
        perMessageDeflate: false
      });

      // Find available port
      this.port = await this.findAvailablePort();
      
      // Setup server event handlers
      this.setupServerHandlers();
      
      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(this.port, 'localhost', () => {
          console.log(`WebSocket server started on port ${this.port}`);
          resolve();
        });
        
        this.httpServer!.on('error', reject);
      });

      // Start periodic updates
      this.startPeriodicUpdates();
      this.startPingInterval();

      return this.port;
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  public async stop(): Promise<void> {
    try {
      // Clear intervals
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Close all client connections
      for (const client of this.clients.values()) {
        if (client.socket.readyState === 1) { // WebSocket.OPEN
          client.socket.close(1000, 'Server shutting down');
        }
      }
      this.clients.clear();

      // Close WebSocket server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            console.log('WebSocket server closed');
            resolve();
          });
        });
        this.server = null;
      }

      // Close HTTP server
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer!.close(() => {
            console.log('HTTP server closed');
            resolve();
          });
        });
        this.httpServer = null;
      }

      this.port = 0;
    } catch (error) {
      console.error('Error stopping WebSocket server:', error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    for (const client of this.clients.values()) {
      if (client.socket.readyState === 1) { // WebSocket.OPEN
        try {
          client.socket.send(messageStr);
        } catch (error) {
          console.error('Error broadcasting to client:', error);
          this.removeClient(client.id);
        }
      }
    }
  }

  /**
   * Send message to specific client
   */
  public sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === 1) { // WebSocket.OPEN
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending to client:', error);
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Get server port
   */
  public getPort(): number {
    return this.port;
  }

  /**
   * Get connected clients count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.server !== null && this.httpServer !== null;
  }

  /**
   * Setup server event handlers
   */
  private setupServerHandlers(): void {
    if (!this.server) {return;}

    this.server.on('connection', (socket: any, _request: any) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        id: clientId,
        socket,
        lastPing: Date.now(),
        subscriptions: new Set()
      };

      this.clients.set(clientId, client);
      console.log(`Client connected: ${clientId} (${this.clients.size} total)`);

      // Setup client event handlers
      this.setupClientHandlers(client);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'system',
        command: 'connected',
        data: { clientId, serverTime: Date.now() },
        timestamp: Date.now()
      });
    });

    this.server.on('error', (error: any) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Setup client event handlers
   */
  private setupClientHandlers(client: ClientConnection): void {
    client.socket.on('message', (data: any) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        console.error('Error parsing client message:', error);
      }
    });

    client.socket.on('close', (code: any, reason: any) => {
      console.log(`Client disconnected: ${client.id} (${code}: ${reason})`);
      this.removeClient(client.id);
    });

    client.socket.on('error', (error: any) => {
      console.error(`Client error (${client.id}):`, error);
      this.removeClient(client.id);
    });

    client.socket.on('pong', () => {
      client.lastPing = Date.now();
    });
  }

  /**
   * Handle client messages
   */
  private handleClientMessage(client: ClientConnection, message: WebSocketMessage): void {
    switch (message.command) {
      case 'ping':
        this.sendToClient(client.id, {
          type: 'system',
          command: 'pong',
          timestamp: Date.now()
        });
        break;

      case 'subscribe':
        if (message.data?.channels) {
          message.data.channels.forEach((channel: string) => {
            client.subscriptions.add(channel);
          });
        }
        break;

      case 'unsubscribe':
        if (message.data?.channels) {
          message.data.channels.forEach((channel: string) => {
            client.subscriptions.delete(channel);
          });
        }
        break;

      case 'requestMetrics':
        this.sendMetricsUpdate(client.id);
        break;

      case 'requestInsights':
        this.sendInsightsUpdate(client.id);
        break;

      default:
        console.log(`Unknown command from client ${client.id}:`, message.command);
    }
  }

  /**
   * Send metrics update to client
   */
  private sendMetricsUpdate(clientId?: string): void {
    if (!this.metricsTracker) {return;}

    const insights = this.metricsTracker.getSessionInsights();
    const message: WebSocketMessage = {
      type: 'data',
      command: 'metricsUpdate',
      data: insights,
      timestamp: Date.now()
    };

    if (clientId) {
      this.sendToClient(clientId, message);
    } else {
      this.broadcast(message);
    }
  }

  /**
   * Send insights update to client
   */
  private sendInsightsUpdate(clientId?: string): void {
    if (!this.metricsTracker) {return;}

    const sessionInsights = this.metricsTracker.getSessionInsights();
    const storedMetrics = this.metricsTracker.getStoredMetrics();

    const message: WebSocketMessage = {
      type: 'data',
      command: 'insightsUpdate',
      data: { sessionInsights, storedMetrics },
      timestamp: Date.now()
    };

    if (clientId) {
      this.sendToClient(clientId, message);
    } else {
      this.broadcast(message);
    }
  }

  /**
   * Send trend analysis update
   */
  public sendTrendUpdate(trends: any): void {
    this.broadcast({
      type: 'trends',
      command: 'update',
      data: trends,
      timestamp: Date.now()
    });
  }

  /**
   * Send performance benchmark update
   */
  public sendPerformanceUpdate(performance: any): void {
    this.broadcast({
      type: 'performance',
      command: 'update',
      data: performance,
      timestamp: Date.now()
    });
  }

  /**
   * Send team collaboration metrics update
   */
  public sendTeamMetricsUpdate(teamMetrics: any): void {
    this.broadcast({
      type: 'team',
      command: 'update',
      data: teamMetrics,
      timestamp: Date.now()
    });
  }

  /**
   * Send code health update
   */
  public sendCodeHealthUpdate(codeHealth: any): void {
    this.broadcast({
      type: 'codeHealth',
      command: 'update',
      data: codeHealth,
      timestamp: Date.now()
    });
  }

  /**
   * Send advanced analytics report
   */
  public sendAdvancedAnalyticsReport(report: any): void {
    this.broadcast({
      type: 'advancedAnalytics',
      command: 'report',
      data: report,
      timestamp: Date.now()
    });
  }

  /**
   * Send advanced trend analysis update
   */
  public sendAdvancedTrendUpdate(trends: any): void {
    this.broadcast({
      type: 'advancedTrends',
      command: 'update',
      data: trends,
      timestamp: Date.now()
    });
  }

  /**
   * Send advanced performance analysis update
   */
  public sendAdvancedPerformanceUpdate(performance: any): void {
    this.broadcast({
      type: 'advancedPerformance',
      command: 'update',
      data: performance,
      timestamp: Date.now()
    });
  }

  /**
   * Send advanced team analysis update
   */
  public sendAdvancedTeamUpdate(teamMetrics: any): void {
    this.broadcast({
      type: 'advancedTeam',
      command: 'update',
      data: teamMetrics,
      timestamp: Date.now()
    });
  }

  /**
   * Send advanced code health analysis update
   */
  public sendAdvancedCodeHealthUpdate(codeHealth: any): void {
    this.broadcast({
      type: 'advancedCodeHealth',
      command: 'update',
      data: codeHealth,
      timestamp: Date.now()
    });
  }

  /**
   * Send analytics summary update
   */
  public sendAnalyticsSummaryUpdate(summary: any): void {
    this.broadcast({
      type: 'analyticsSummary',
      command: 'update',
      data: summary,
      timestamp: Date.now()
    });
  }

  /**
   * Start periodic updates
   */
  private startPeriodicUpdates(): void {
    this.updateInterval = setInterval(() => {
      if (this.clients.size > 0 && this.metricsTracker) {
        this.sendMetricsUpdate();
        
        // Send insights every 30 seconds
        if (Date.now() % 30000 < 1000) {
          this.sendInsightsUpdate();
        }
      }
    }, 1000); // Update every second for real-time feel
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      for (const client of this.clients.values()) {
        if (client.socket.readyState === 1) { // WebSocket.OPEN
          // Check if client is still responsive
          if (now - client.lastPing > 60000) { // 60 seconds timeout
            console.log(`Client ${client.id} timed out`);
            client.socket.terminate();
            this.removeClient(client.id);
          } else {
            // Send ping
            client.socket.ping();
          }
        }
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Remove client from connections
   */
  private removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`Client removed: ${clientId} (${this.clients.size} remaining)`);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Find available port
   */
  private async findAvailablePort(): Promise<number> {
    const net = require('net');
    
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const port = server.address()?.port;
        server.close(() => {
          if (port) {
            resolve(port);
          } else {
            reject(new Error('Could not determine port'));
          }
        });
      });
      
      server.on('error', reject);
    });
  }

  /**
   * Setup cleanup on extension deactivation
   */
  private setupCleanup(): void {
    this.context.subscriptions.push({
      dispose: () => {
        this.stop().catch(console.error);
      }
    });
  }
}
