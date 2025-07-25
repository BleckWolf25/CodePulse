/**
 * @file ERROR-MONITORING.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Error Monitoring Dashboard
 * Frontend component for monitoring errors, performance issues,
 * memory leaks, and system health with real-time updates.
 */

// ------------ MAIN
class ErrorMonitoringDashboard {
  constructor() {
    this.errorHistory = [];
    this.performanceMetrics = [];
    this.memorySnapshots = [];
    this.detectedLeaks = [];
    this.systemHealth = null;
    
    this.init();
  }

  /**
   * Initialize error monitoring dashboard
   */
  init() {
    this.createMonitoringUI();
    this.setupEventListeners();
    this.loadInitialData();
    this.startRealTimeUpdates();
  }

  /**
   * Create monitoring dashboard UI
   */
  createMonitoringUI() {
    const monitoringContainer = document.createElement('div');
    monitoringContainer.className = 'error-monitoring-container';
    monitoringContainer.innerHTML = `
      <div class="monitoring-header">
        <h2>🔍 System Health & Error Monitoring</h2>
        <div class="monitoring-actions">
          <button id="refreshMonitoringBtn" class="btn btn-primary">
            <span class="btn-icon">🔄</span>
            Refresh
          </button>
          <button id="clearErrorsBtn" class="btn btn-secondary">
            <span class="btn-icon">🗑️</span>
            Clear Errors
          </button>
          <button id="exportLogsBtn" class="btn btn-outline">
            <span class="btn-icon">📥</span>
            Export Logs
          </button>
        </div>
      </div>

      <div class="system-health-overview" id="systemHealthOverview">
        <!-- System health cards will be populated here -->
      </div>

      <div class="monitoring-tabs">
        <button class="monitoring-tab active" data-tab="errors">Errors</button>
        <button class="monitoring-tab" data-tab="performance">Performance</button>
        <button class="monitoring-tab" data-tab="memory">Memory</button>
        <button class="monitoring-tab" data-tab="logs">Logs</button>
        <button class="monitoring-tab" data-tab="settings">Settings</button>
      </div>

      <div class="monitoring-content">
        <!-- Errors Tab -->
        <div class="monitoring-tab-content active" id="errorsTab">
          <div class="errors-dashboard">
            <div class="errors-summary" id="errorsSummary">
              <!-- Error summary cards -->
            </div>
            
            <div class="errors-filters">
              <select id="errorSeverityFilter" class="form-control">
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              <select id="errorCategoryFilter" class="form-control">
                <option value="all">All Categories</option>
                <option value="network">Network</option>
                <option value="file_system">File System</option>
                <option value="memory">Memory</option>
                <option value="performance">Performance</option>
                <option value="validation">Validation</option>
                <option value="ui">UI</option>
              </select>
              
              <input type="text" id="errorSearchInput" class="form-control" placeholder="Search errors...">
            </div>
            
            <div class="errors-list" id="errorsList">
              <!-- Error entries will be populated here -->
            </div>
          </div>
        </div>

        <!-- Performance Tab -->
        <div class="monitoring-tab-content" id="performanceTab">
          <div class="performance-dashboard">
            <div class="performance-charts" id="performanceCharts">
              <!-- Performance charts will be populated here -->
            </div>
            
            <div class="performance-issues" id="performanceIssues">
              <!-- Performance issues will be populated here -->
            </div>
            
            <div class="slow-operations" id="slowOperations">
              <!-- Slow operations will be populated here -->
            </div>
          </div>
        </div>

        <!-- Memory Tab -->
        <div class="monitoring-tab-content" id="memoryTab">
          <div class="memory-dashboard">
            <div class="memory-overview" id="memoryOverview">
              <!-- Memory usage overview -->
            </div>
            
            <div class="memory-leaks" id="memoryLeaks">
              <!-- Detected memory leaks -->
            </div>
            
            <div class="memory-snapshots" id="memorySnapshots">
              <!-- Memory snapshots timeline -->
            </div>
          </div>
        </div>

        <!-- Logs Tab -->
        <div class="monitoring-tab-content" id="logsTab">
          <div class="logs-dashboard">
            <div class="logs-filters">
              <select id="logLevelFilter" class="form-control">
                <option value="all">All Levels</option>
                <option value="trace">Trace</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
              
              <select id="logComponentFilter" class="form-control">
                <option value="all">All Components</option>
                <!-- Components will be populated dynamically -->
              </select>
              
              <input type="text" id="logSearchInput" class="form-control" placeholder="Search logs...">
              
              <button id="clearLogsBtn" class="btn btn-outline btn-sm">Clear Logs</button>
            </div>
            
            <div class="logs-viewer" id="logsViewer">
              <!-- Log entries will be populated here -->
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div class="monitoring-tab-content" id="settingsTab">
          <div class="monitoring-settings">
            <div class="settings-section">
              <h3>Error Handling Settings</h3>
              <div class="settings-grid">
                <div class="setting-item">
                  <label for="enableErrorRecovery">Enable Error Recovery</label>
                  <input type="checkbox" id="enableErrorRecovery" checked>
                </div>
                
                <div class="setting-item">
                  <label for="maxRetryAttempts">Max Retry Attempts</label>
                  <input type="number" id="maxRetryAttempts" value="3" min="1" max="10">
                </div>
                
                <div class="setting-item">
                  <label for="errorNotifications">Show Error Notifications</label>
                  <input type="checkbox" id="errorNotifications" checked>
                </div>
              </div>
            </div>
            
            <div class="settings-section">
              <h3>Performance Monitoring</h3>
              <div class="settings-grid">
                <div class="setting-item">
                  <label for="enablePerformanceMonitoring">Enable Performance Monitoring</label>
                  <input type="checkbox" id="enablePerformanceMonitoring" checked>
                </div>
                
                <div class="setting-item">
                  <label for="slowOperationThreshold">Slow Operation Threshold (ms)</label>
                  <input type="number" id="slowOperationThreshold" value="1000" min="100" max="10000">
                </div>
                
                <div class="setting-item">
                  <label for="memoryCheckInterval">Memory Check Interval (minutes)</label>
                  <input type="number" id="memoryCheckInterval" value="5" min="1" max="60">
                </div>
              </div>
            </div>
            
            <div class="settings-section">
              <h3>Logging Configuration</h3>
              <div class="settings-grid">
                <div class="setting-item">
                  <label for="logLevel">Log Level</label>
                  <select id="logLevel" class="form-control">
                    <option value="trace">Trace</option>
                    <option value="debug">Debug</option>
                    <option value="info" selected>Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                
                <div class="setting-item">
                  <label for="enableStackTraces">Enable Stack Traces</label>
                  <input type="checkbox" id="enableStackTraces" checked>
                </div>
                
                <div class="setting-item">
                  <label for="maxLogEntries">Max Log Entries</label>
                  <input type="number" id="maxLogEntries" value="1000" min="100" max="10000">
                </div>
              </div>
            </div>
            
            <div class="settings-actions">
              <button id="saveSettingsBtn" class="btn btn-primary">Save Settings</button>
              <button id="resetSettingsBtn" class="btn btn-outline">Reset to Defaults</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to dashboard
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
      dashboardContent.appendChild(monitoringContainer);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.addEventListener('click', (e) => {
      if (e.target.matches('.monitoring-tab')) {
        this.switchTab(e.target.dataset.tab);
      }
    });

    // Main actions
    document.getElementById('refreshMonitoringBtn')?.addEventListener('click', () => {
      this.refreshAllData();
    });

    document.getElementById('clearErrorsBtn')?.addEventListener('click', () => {
      this.clearErrors();
    });

    document.getElementById('exportLogsBtn')?.addEventListener('click', () => {
      this.exportLogs();
    });

    // Filters
    document.getElementById('errorSeverityFilter')?.addEventListener('change', () => {
      this.filterErrors();
    });

    document.getElementById('errorCategoryFilter')?.addEventListener('change', () => {
      this.filterErrors();
    });

    document.getElementById('errorSearchInput')?.addEventListener('input', () => {
      this.filterErrors();
    });

    document.getElementById('logLevelFilter')?.addEventListener('change', () => {
      this.filterLogs();
    });

    document.getElementById('logComponentFilter')?.addEventListener('change', () => {
      this.filterLogs();
    });

    document.getElementById('logSearchInput')?.addEventListener('input', () => {
      this.filterLogs();
    });

    // Settings
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('resetSettingsBtn')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // Clear actions
    document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
      this.clearLogs();
    });
  }

  /**
   * Load initial monitoring data
   */
  async loadInitialData() {
    try {
      await Promise.all([
        this.loadSystemHealth(),
        this.loadErrorHistory(),
        this.loadPerformanceMetrics(),
        this.loadMemoryData(),
        this.loadLogs()
      ]);
    } catch (error) {
      console.error('Failed to load initial monitoring data:', error);
      this.showError('Failed to load monitoring data');
    }
  }

  /**
   * Start real-time updates
   */
  startRealTimeUpdates() {
    // Update system health every 30 seconds
    setInterval(() => {
      this.loadSystemHealth();
    }, 30000);

    // Update performance metrics every minute
    setInterval(() => {
      this.loadPerformanceMetrics();
    }, 60000);

    // Update memory data every 2 minutes
    setInterval(() => {
      this.loadMemoryData();
    }, 120000);
  }

  /**
   * Load system health overview
   */
  async loadSystemHealth() {
    try {
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'getSystemHealth'
        });
      } else {
        // Mock data for development
        this.handleSystemHealth({
          overallStatus: 'healthy',
          errorRate: 2.1,
          performanceScore: 85,
          memoryUsage: 67,
          activeIssues: 3,
          uptime: 3600000
        });
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
    }
  }

  /**
   * Handle system health data
   */
  handleSystemHealth(health) {
    this.systemHealth = health;
    this.updateSystemHealthDisplay(health);
  }

  /**
   * Update system health display
   */
  updateSystemHealthDisplay(health) {
    const container = document.getElementById('systemHealthOverview');
    if (!container) return;

    const statusColor = this.getStatusColor(health.overallStatus);
    
    container.innerHTML = `
      <div class="health-cards-grid">
        <div class="health-card status-${health.overallStatus}">
          <div class="health-icon">${this.getStatusIcon(health.overallStatus)}</div>
          <div class="health-content">
            <div class="health-value">${health.overallStatus.toUpperCase()}</div>
            <div class="health-label">System Status</div>
          </div>
        </div>
        
        <div class="health-card">
          <div class="health-icon">⚠️</div>
          <div class="health-content">
            <div class="health-value">${health.errorRate.toFixed(1)}%</div>
            <div class="health-label">Error Rate</div>
          </div>
        </div>
        
        <div class="health-card">
          <div class="health-icon">⚡</div>
          <div class="health-content">
            <div class="health-value">${health.performanceScore}/100</div>
            <div class="health-label">Performance Score</div>
          </div>
        </div>
        
        <div class="health-card">
          <div class="health-icon">💾</div>
          <div class="health-content">
            <div class="health-value">${health.memoryUsage}%</div>
            <div class="health-label">Memory Usage</div>
          </div>
        </div>
        
        <div class="health-card">
          <div class="health-icon">🔍</div>
          <div class="health-content">
            <div class="health-value">${health.activeIssues}</div>
            <div class="health-label">Active Issues</div>
          </div>
        </div>
        
        <div class="health-card">
          <div class="health-icon">⏱️</div>
          <div class="health-content">
            <div class="health-value">${this.formatUptime(health.uptime)}</div>
            <div class="health-label">Uptime</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get status color
   */
  getStatusColor(status) {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  }

  /**
   * Format uptime
   */
  formatUptime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  /**
   * Switch monitoring tab
   */
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.monitoring-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.monitoring-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    // Load tab-specific data
    switch (tabName) {
      case 'errors':
        this.loadErrorHistory();
        break;
      case 'performance':
        this.loadPerformanceMetrics();
        break;
      case 'memory':
        this.loadMemoryData();
        break;
      case 'logs':
        this.loadLogs();
        break;
    }
  }

  // Placeholder methods for other functionality
  async loadErrorHistory() { /* Implementation */ }
  async loadPerformanceMetrics() { /* Implementation */ }
  async loadMemoryData() { /* Implementation */ }
  async loadLogs() { /* Implementation */ }
  filterErrors() { /* Implementation */ }
  filterLogs() { /* Implementation */ }
  refreshAllData() { /* Implementation */ }
  clearErrors() { /* Implementation */ }
  clearLogs() { /* Implementation */ }
  exportLogs() { /* Implementation */ }
  saveSettings() { /* Implementation */ }
  resetSettings() { /* Implementation */ }
  showError(message) { /* Implementation */ }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.errorMonitoringDashboard = new ErrorMonitoringDashboard();
});
