/**
 * @file WEBSOCKET-CLIENT.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * WebSocket Client for Real-time Dashboard Updates
 * Handles WebSocket connection to the extension's WebSocket server
 * for real-time data synchronization and updates.
 */

// ------------ MAIN
class WebSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.port = null;
    this.subscriptions = new Set();
    this.messageQueue = [];
    this.heartbeatInterval = null;
    this.connectionTimeout = null;
    
    this.eventHandlers = {
      'metricsUpdate': [],
      'insightsUpdate': [],
      'chartUpdate': [],
      'filtersApplied': [],
      'timeRangeUpdate': [],
      'error': [],
      'connected': [],
      'disconnected': [],
      'reconnecting': []
    };
    
    this.init();
  }

  /**
   * Initialize WebSocket client
   */
  init() {
    this.getWebSocketPort().then(port => {
      if (port) {
        this.port = port;
        this.connect();
      } else {
        console.log('WebSocket not available, using fallback communication');
        this.triggerEvent('error', { message: 'WebSocket port not available' });
      }
    });
  }

  /**
   * Get WebSocket port from VS Code extension
   */
  async getWebSocketPort() {
    return new Promise((resolve) => {
      if (typeof acquireVsCodeApi !== 'undefined') {
        const vscode = acquireVsCodeApi();
        
        // Request WebSocket port from extension
        vscode.postMessage({
          command: 'getWebSocketPort'
        });
        
        // Listen for response
        const messageHandler = (event) => {
          if (event.data.command === 'webSocketPort') {
            window.removeEventListener('message', messageHandler);
            resolve(event.data.port);
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          resolve(null);
        }, 5000);
      } else {
        // Demo mode - use default port
        resolve(8080);
      }
    });
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const url = `ws://localhost:${this.port}`;
      console.log(`Connecting to WebSocket server: ${url}`);
      
      this.socket = new WebSocket(url);
      this.setupSocketHandlers();
      
      // Connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout');
          this.socket.close();
          this.handleReconnect();
        }
      }, 10000);
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      // Process queued messages
      this.processMessageQueue();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Subscribe to channels
      this.resubscribe();
      
      this.triggerEvent('connected', { timestamp: Date.now() });
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`WebSocket disconnected: ${event.code} - ${event.reason}`);
      this.isConnected = false;
      
      this.stopHeartbeat();
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      this.triggerEvent('disconnected', { 
        code: event.code, 
        reason: event.reason,
        timestamp: Date.now()
      });
      
      // Attempt reconnection if not intentionally closed
      if (event.code !== 1000) {
        this.handleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.triggerEvent('error', { error: error.message || 'WebSocket error' });
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'system':
        this.handleSystemMessage(message);
        break;
      case 'data':
        this.handleDataMessage(message);
        break;
      case 'event':
        this.handleEventMessage(message);
        break;
      case 'error':
        this.handleErrorMessage(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Handle system messages
   */
  handleSystemMessage(message) {
    switch (message.command) {
      case 'connected':
        console.log('Server confirmed connection:', message.data);
        break;
      case 'pong':
        // Heartbeat response
        break;
      default:
        console.log('Unknown system command:', message.command);
    }
  }

  /**
   * Handle data messages
   */
  handleDataMessage(message) {
    this.triggerEvent(message.command, message.data);
  }

  /**
   * Handle event messages
   */
  handleEventMessage(message) {
    this.triggerEvent(message.command, message.data);
  }

  /**
   * Handle error messages
   */
  handleErrorMessage(message) {
    this.triggerEvent('error', message.data);
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({
          ...message,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.queueMessage(message);
      }
    } else {
      this.queueMessage(message);
    }
  }

  /**
   * Queue message for later sending
   */
  queueMessage(message) {
    this.messageQueue.push(message);
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Subscribe to data channels
   */
  subscribe(channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }
    
    channels.forEach(channel => this.subscriptions.add(channel));
    
    this.send({
      command: 'subscribe',
      data: { channels }
    });
  }

  /**
   * Unsubscribe from data channels
   */
  unsubscribe(channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }
    
    channels.forEach(channel => this.subscriptions.delete(channel));
    
    this.send({
      command: 'unsubscribe',
      data: { channels }
    });
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  resubscribe() {
    if (this.subscriptions.size > 0) {
      this.send({
        command: 'subscribe',
        data: { channels: Array.from(this.subscriptions) }
      });
    }
  }

  /**
   * Request metrics update
   */
  requestMetrics() {
    this.send({
      command: 'requestMetrics'
    });
  }

  /**
   * Request insights update
   */
  requestInsights() {
    this.send({
      command: 'requestInsights'
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({
          command: 'ping'
        });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle reconnection logic
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.triggerEvent('error', { 
        message: 'Failed to reconnect to WebSocket server' 
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.triggerEvent('reconnecting', { 
      attempt: this.reconnectAttempts, 
      delay 
    });
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Add event listener
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  /**
   * Trigger event handlers
   */
  triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      port: this.port,
      subscriptions: Array.from(this.subscriptions)
    };
  }

  /**
   * Close WebSocket connection
   */
  close() {
    this.stopHeartbeat();
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close(1000, 'Client closing');
      this.socket = null;
    }
    
    this.isConnected = false;
  }
}

// Initialize WebSocket client when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.webSocketClient = new WebSocketClient();
  });
} else {
  window.webSocketClient = new WebSocketClient();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketClient;
}
