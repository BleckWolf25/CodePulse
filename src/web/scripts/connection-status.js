/**
 * @file CONNECTION-STATUS.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Connection Status Component
 * Displays real-time connection status and provides user feedback
 * for WebSocket connectivity and data synchronization.
 */

// ------------ MAIN
class ConnectionStatus {
  constructor() {
    this.status = 'disconnected';
    this.lastUpdate = null;
    this.updateCount = 0;
    this.element = null;
    this.indicator = null;
    this.tooltip = null;
    this.reconnectButton = null;
    
    this.init();
  }

  /**
   * Initialize connection status component
   */
  init() {
    this.createElement();
    this.setupEventListeners();
    this.updateDisplay();
  }

  /**
   * Create status element
   */
  createElement() {
    // Create main container
    this.element = document.createElement('div');
    this.element.className = 'connection-status';
    this.element.innerHTML = `
      <div class="connection-indicator">
        <div class="status-dot"></div>
        <span class="status-text">Connecting...</span>
        <div class="status-details">
          <span class="last-update">Never</span>
          <span class="update-count">0 updates</span>
        </div>
      </div>
      <button class="reconnect-btn" style="display: none;">
        <i class="icon-refresh"></i>
        Reconnect
      </button>
      <div class="connection-tooltip">
        <div class="tooltip-content">
          <div class="tooltip-title">Connection Status</div>
          <div class="tooltip-body">
            <div class="status-row">
              <span class="label">Status:</span>
              <span class="value status-value">Connecting</span>
            </div>
            <div class="status-row">
              <span class="label">Last Update:</span>
              <span class="value last-update-value">Never</span>
            </div>
            <div class="status-row">
              <span class="label">Updates Received:</span>
              <span class="value update-count-value">0</span>
            </div>
            <div class="status-row">
              <span class="label">Connection Type:</span>
              <span class="value connection-type-value">WebSocket</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Get references to elements
    this.indicator = this.element.querySelector('.status-dot');
    this.statusText = this.element.querySelector('.status-text');
    this.lastUpdateElement = this.element.querySelector('.last-update');
    this.updateCountElement = this.element.querySelector('.update-count');
    this.reconnectButton = this.element.querySelector('.reconnect-btn');
    this.tooltip = this.element.querySelector('.connection-tooltip');

    // Add styles
    this.addStyles();

    // Insert into dashboard
    this.insertIntoDOM();
  }

  /**
   * Add CSS styles
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .connection-status {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bg-secondary, #2d2d2d);
        border: 1px solid var(--border-color, #404040);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        color: var(--text-primary, #ffffff);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
      }

      .connection-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #666;
        transition: all 0.3s ease;
      }

      .status-dot.connected {
        background: #4CAF50;
        box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
        animation: pulse 2s infinite;
      }

      .status-dot.connecting {
        background: #FF9800;
        animation: blink 1s infinite;
      }

      .status-dot.disconnected {
        background: #f44336;
      }

      .status-dot.error {
        background: #f44336;
        animation: shake 0.5s infinite;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 8px rgba(76, 175, 80, 0.5); }
        50% { box-shadow: 0 0 16px rgba(76, 175, 80, 0.8); }
        100% { box-shadow: 0 0 8px rgba(76, 175, 80, 0.5); }
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
      }

      .status-text {
        font-weight: 500;
        white-space: nowrap;
      }

      .status-details {
        display: flex;
        flex-direction: column;
        font-size: 10px;
        opacity: 0.7;
        line-height: 1.2;
      }

      .reconnect-btn {
        background: var(--accent-color, #007ACC);
        border: none;
        border-radius: 4px;
        color: white;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.2s ease;
      }

      .reconnect-btn:hover {
        background: var(--accent-hover, #005a9e);
      }

      .connection-tooltip {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        background: var(--bg-primary, #1e1e1e);
        border: 1px solid var(--border-color, #404040);
        border-radius: 6px;
        padding: 12px;
        min-width: 200px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all 0.2s ease;
        pointer-events: none;
      }

      .connection-status:hover .connection-tooltip {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .tooltip-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--text-primary, #ffffff);
      }

      .status-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 11px;
      }

      .status-row .label {
        opacity: 0.7;
      }

      .status-row .value {
        font-weight: 500;
      }

      .icon-refresh::before {
        content: "↻";
        font-weight: bold;
      }

      /* Dark theme adjustments */
      [data-theme="dark"] .connection-status {
        background: #2d2d2d;
        border-color: #404040;
        color: #ffffff;
      }

      /* Light theme adjustments */
      [data-theme="light"] .connection-status {
        background: #ffffff;
        border-color: #e0e0e0;
        color: #333333;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Insert element into DOM
   */
  insertIntoDOM() {
    // Try to insert into dashboard header
    const header = document.querySelector('.dashboard-header');
    if (header) {
      header.style.position = 'relative';
      header.appendChild(this.element);
    } else {
      // Fallback to body
      document.body.appendChild(this.element);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // WebSocket events
    if (window.webSocketClient) {
      window.webSocketClient.on('connected', () => {
        this.setStatus('connected');
      });

      window.webSocketClient.on('disconnected', () => {
        this.setStatus('disconnected');
      });

      window.webSocketClient.on('reconnecting', (data) => {
        this.setStatus('connecting', `Reconnecting (${data.attempt}/${window.webSocketClient.maxReconnectAttempts})`);
      });

      window.webSocketClient.on('error', (data) => {
        this.setStatus('error', data.message || 'Connection error');
      });

      window.webSocketClient.on('metricsUpdate', () => {
        this.recordUpdate();
      });

      window.webSocketClient.on('insightsUpdate', () => {
        this.recordUpdate();
      });

      window.webSocketClient.on('chartUpdate', () => {
        this.recordUpdate();
      });
    }

    // Reconnect button
    if (this.reconnectButton) {
      this.reconnectButton.addEventListener('click', () => {
        if (window.webSocketClient) {
          window.webSocketClient.close();
          setTimeout(() => {
            window.webSocketClient.init();
          }, 1000);
        }
      });
    }

    // Fallback to polling detection
    window.addEventListener('message', (event) => {
      if (event.data.command === 'updateMetrics' || 
          event.data.command === 'updateInsights' ||
          event.data.command === 'updateCharts') {
        this.recordUpdate();
        
        if (this.status === 'disconnected') {
          this.setStatus('polling', 'Using polling mode');
        }
      }
    });
  }

  /**
   * Set connection status
   */
  setStatus(status, message = null) {
    this.status = status;
    
    // Update indicator
    this.indicator.className = `status-dot ${status}`;
    
    // Update text
    let statusText = '';
    switch (status) {
      case 'connected':
        statusText = 'Real-time';
        break;
      case 'connecting':
        statusText = 'Connecting';
        break;
      case 'disconnected':
        statusText = 'Offline';
        break;
      case 'error':
        statusText = 'Error';
        break;
      case 'polling':
        statusText = 'Polling';
        break;
      default:
        statusText = 'Unknown';
    }
    
    if (message) {
      statusText = message;
    }
    
    this.statusText.textContent = statusText;
    
    // Show/hide reconnect button
    if (this.reconnectButton) {
      this.reconnectButton.style.display = 
        (status === 'disconnected' || status === 'error') ? 'flex' : 'none';
    }
    
    this.updateDisplay();
  }

  /**
   * Record data update
   */
  recordUpdate() {
    this.lastUpdate = new Date();
    this.updateCount++;
    this.updateDisplay();
  }

  /**
   * Update display elements
   */
  updateDisplay() {
    // Update last update time
    if (this.lastUpdate) {
      const timeStr = this.lastUpdate.toLocaleTimeString();
      this.lastUpdateElement.textContent = timeStr;
      
      if (this.tooltip) {
        const lastUpdateValue = this.tooltip.querySelector('.last-update-value');
        if (lastUpdateValue) {
          lastUpdateValue.textContent = timeStr;
        }
      }
    }
    
    // Update count
    this.updateCountElement.textContent = `${this.updateCount} updates`;
    
    if (this.tooltip) {
      const updateCountValue = this.tooltip.querySelector('.update-count-value');
      if (updateCountValue) {
        updateCountValue.textContent = this.updateCount.toString();
      }
      
      const statusValue = this.tooltip.querySelector('.status-value');
      if (statusValue) {
        statusValue.textContent = this.status.charAt(0).toUpperCase() + this.status.slice(1);
      }
      
      const connectionType = this.tooltip.querySelector('.connection-type-value');
      if (connectionType) {
        connectionType.textContent = this.status === 'polling' ? 'Polling' : 'WebSocket';
      }
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      status: this.status,
      lastUpdate: this.lastUpdate,
      updateCount: this.updateCount
    };
  }

  /**
   * Hide status component
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Show status component
   */
  show() {
    if (this.element) {
      this.element.style.display = 'flex';
    }
  }

  /**
   * Destroy component
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// Initialize connection status when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.connectionStatus = new ConnectionStatus();
  });
} else {
  window.connectionStatus = new ConnectionStatus();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConnectionStatus;
}
