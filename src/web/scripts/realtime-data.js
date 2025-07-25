/**
 * @file REALTIME-DATA.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Real-time Data Handler
 * Manages real-time data updates from the VS Code extension
 * Handles metric updates, chart refreshes, and live insights
 */

// ------------ MAIN
class RealTimeDataHandler {
  constructor() {
    this.lastUpdateTime = Date.now();
    this.updateQueue = [];
    this.isProcessing = false;
    this.metrics = {};
    this.charts = {};
    this.useWebSocket = false;
    this.webSocketClient = null;

    this.init();
  }

  /**
   * Initialize real-time data handler
   */
  init() {
    this.setupMessageListener();
    this.setupWebSocketListener();
    this.setupPerformanceMonitoring();
    this.startUpdateProcessor();
  }

  /**
   * Setup message listener for VS Code extension (fallback)
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      const message = event.data;

      // Only handle if not using WebSocket
      if (!this.useWebSocket) {
        this.handleMessage(message);
      }
    });
  }

  /**
   * Setup WebSocket listener for real-time updates
   */
  setupWebSocketListener() {
    // Wait for WebSocket client to be available
    const checkWebSocket = () => {
      if (window.webSocketClient) {
        this.webSocketClient = window.webSocketClient;
        this.useWebSocket = true;

        // Setup WebSocket event handlers
        this.webSocketClient.on('metricsUpdate', (data) => {
          this.queueUpdate('metrics', data);
        });

        this.webSocketClient.on('insightsUpdate', (data) => {
          this.queueUpdate('insights', data);
        });

        this.webSocketClient.on('chartUpdate', (data) => {
          this.queueUpdate('charts', data);
        });

        this.webSocketClient.on('filtersApplied', (data) => {
          this.handleFiltersApplied(data);
        });

        this.webSocketClient.on('timeRangeUpdate', (data) => {
          this.handleTimeRangeUpdate(data);
        });

        // Advanced analytics event handlers
        this.webSocketClient.on('trends', (data) => {
          this.queueUpdate('trends', data);
        });

        this.webSocketClient.on('performance', (data) => {
          this.queueUpdate('performance', data);
        });

        this.webSocketClient.on('team', (data) => {
          this.queueUpdate('team', data);
        });

        this.webSocketClient.on('codeHealth', (data) => {
          this.queueUpdate('codeHealth', data);
        });

        this.webSocketClient.on('advancedAnalytics', (data) => {
          this.queueUpdate('advancedAnalytics', data);
        });

        this.webSocketClient.on('error', (data) => {
          console.error('WebSocket error:', data);
          this.fallbackToPolling();
        });

        this.webSocketClient.on('disconnected', () => {
          console.log('WebSocket disconnected, falling back to polling');
          this.fallbackToPolling();
        });

        this.webSocketClient.on('connected', () => {
          console.log('WebSocket connected, switching to real-time mode');
          this.useWebSocket = true;

          // Subscribe to data channels
          this.webSocketClient.subscribe(['metrics', 'insights', 'charts']);

          // Request initial data
          this.webSocketClient.requestMetrics();
          this.webSocketClient.requestInsights();
        });

        console.log('Real-time data handler connected to WebSocket');
      } else {
        // Retry after a short delay
        setTimeout(checkWebSocket, 100);
      }
    };

    checkWebSocket();
  }

  /**
   * Handle incoming messages from extension
   */
  handleMessage(message) {
    switch (message.command) {
      case 'updateMetrics':
        this.queueUpdate('metrics', message.data);
        break;
      case 'updateCharts':
        this.queueUpdate('charts', message.data);
        break;
      case 'updateInsights':
        this.queueUpdate('insights', message.data);
        break;
      case 'filtersApplied':
        this.handleFiltersApplied(message.data);
        break;
      case 'timeRangeUpdated':
        this.handleTimeRangeUpdate(message.data);
        break;
    }
  }

  /**
   * Queue updates for batch processing
   */
  queueUpdate(type, data) {
    this.updateQueue.push({
      type,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Start update processor
   */
  startUpdateProcessor() {
    setInterval(() => {
      this.processUpdateQueue();
    }, 100); // Process updates every 100ms
  }

  /**
   * Process queued updates
   */
  processUpdateQueue() {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Group updates by type
    const groupedUpdates = this.groupUpdatesByType();
    
    // Process each type
    Object.entries(groupedUpdates).forEach(([type, updates]) => {
      const latestUpdate = updates[updates.length - 1]; // Get most recent
      this.processUpdate(type, latestUpdate.data);
    });

    // Clear queue
    this.updateQueue = [];
    this.isProcessing = false;
  }

  /**
   * Group updates by type
   */
  groupUpdatesByType() {
    const grouped = {};
    this.updateQueue.forEach(update => {
      if (!grouped[update.type]) {
        grouped[update.type] = [];
      }
      grouped[update.type].push(update);
    });
    return grouped;
  }

  /**
   * Process individual update
   */
  processUpdate(type, data) {
    switch (type) {
      case 'metrics':
        this.updateMetrics(data);
        break;
      case 'charts':
        this.updateCharts(data);
        break;
      case 'insights':
        this.updateInsights(data);
        break;
      case 'trends':
        this.updateTrends(data);
        break;
      case 'performance':
        this.updatePerformance(data);
        break;
      case 'team':
        this.updateTeamMetrics(data);
        break;
      case 'codeHealth':
        this.updateCodeHealth(data);
        break;
      case 'advancedAnalytics':
        this.updateAdvancedAnalytics(data);
        break;
    }
  }

  /**
   * Update metrics display
   */
  updateMetrics(data) {
    this.metrics = { ...this.metrics, ...data };
    
    // Update metric cards with animation
    document.querySelectorAll('[data-metric]').forEach(element => {
      const metric = element.dataset.metric;
      let value = this.getMetricValue(metric, data);
      
      if (value !== null && element.textContent !== value.toString()) {
        this.animateMetricChange(element, value);
      }
    });

    // Update last update time
    this.updateLastUpdateTime();
    
    // Show notification for significant changes
    this.checkForSignificantChanges(data);
  }

  /**
   * Get metric value from data
   */
  getMetricValue(metric, data) {
    switch (metric) {
      case 'linesOfCode':
        return data.fileChanges || 0;
      case 'filesModified':
        return data.filesTracked || 0;
      case 'activeTime':
        return (data.activeTime || 0).toFixed(1);
      case 'complexity':
        return (data.averageComplexity || 0).toFixed(1);
      case 'sessionDuration':
        return (data.duration || 0).toFixed(1);
      case 'sessionFiles':
        return data.filesTracked || 0;
      case 'sessionActive':
        return (data.activeTime || 0).toFixed(1);
      default:
        return null;
    }
  }

  /**
   * Animate metric change
   */
  animateMetricChange(element, newValue) {
    const oldValue = parseFloat(element.textContent) || 0;
    const numericNewValue = parseFloat(newValue) || 0;
    
    if (window.animateNumber) {
      window.animateNumber(element, oldValue, numericNewValue);
    } else {
      // Fallback animation
      element.style.transform = 'scale(1.1)';
      element.style.transition = 'transform 0.2s ease-in-out';
      
      setTimeout(() => {
        element.textContent = newValue;
        element.style.transform = 'scale(1)';
      }, 100);
    }

    // Add visual feedback for changes
    if (numericNewValue > oldValue) {
      this.addChangeIndicator(element, 'increase');
    } else if (numericNewValue < oldValue) {
      this.addChangeIndicator(element, 'decrease');
    }
  }

  /**
   * Add change indicator
   */
  addChangeIndicator(element, type) {
    const indicator = document.createElement('span');
    indicator.className = `change-indicator ${type}`;
    indicator.textContent = type === 'increase' ? '↗' : '↘';
    
    const parent = element.closest('.metric-card');
    if (parent) {
      parent.appendChild(indicator);
      
      setTimeout(() => {
        indicator.remove();
      }, 2000);
    }
  }

  /**
   * Update charts
   */
  updateCharts(data) {
    if (!window.chartManager) {
      return;
    }

    Object.entries(data).forEach(([chartType, chartData]) => {
      const chartId = this.getChartId(chartType);
      if (chartId) {
        window.chartManager.updateChartData(chartId, chartData);
      }
    });
  }

  /**
   * Get chart ID from chart type
   */
  getChartId(chartType) {
    const mapping = {
      languageData: 'languageChart',
      activityData: 'activityChart',
      complexityData: 'complexityChart',
      productivityData: 'productivityChart'
    };
    return mapping[chartType];
  }

  /**
   * Update insights panel
   */
  updateInsights(insights) {
    if (window.dashboard && window.dashboard.updateInsightsPanel) {
      window.dashboard.updateInsightsPanel(insights);
    } else {
      // Fallback update
      this.updateInsightsPanelFallback(insights);
    }
  }

  /**
   * Fallback insights panel update
   */
  updateInsightsPanelFallback(insights) {
    const container = document.querySelector('.insights-list');
    if (!container) return;

    // Clear existing insights
    container.innerHTML = '';
    
    // Add new insights
    insights.forEach(insight => {
      const element = this.createInsightElement(insight);
      container.appendChild(element);
    });
  }

  /**
   * Create insight element
   */
  createInsightElement(insight) {
    const div = document.createElement('div');
    div.className = 'insight-item';
    
    const iconMap = {
      suggestion: '💡',
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️'
    };
    
    div.innerHTML = `
      <div class="insight-icon ${insight.type}">${iconMap[insight.type] || 'ℹ️'}</div>
      <div class="insight-content">
        <h4 class="insight-title">${insight.title}</h4>
        <p class="insight-description">${insight.description}</p>
        ${insight.actionable ? this.createInsightAction(insight) : ''}
      </div>
    `;
    
    return div;
  }

  /**
   * Create insight action button
   */
  createInsightAction(insight) {
    return `
      <button class="btn btn-sm btn-primary" 
              data-insight-action="${insight.actionType || 'view'}"
              data-metadata='${JSON.stringify(insight.metadata || {})}'>
        Take Action
      </button>
    `;
  }

  /**
   * Handle filters applied
   */
  handleFiltersApplied(data) {
    if (window.dashboard && window.dashboard.showNotification) {
      window.dashboard.showNotification('Filters applied successfully', 'success');
    }
  }

  /**
   * Handle time range update
   */
  handleTimeRangeUpdate(data) {
    if (window.dashboard && window.dashboard.showNotification) {
      window.dashboard.showNotification(`Time range updated to ${data.timeRange}`, 'info');
    }
  }

  /**
   * Update last update time
   */
  updateLastUpdateTime() {
    const element = document.getElementById('lastUpdate');
    if (element) {
      element.textContent = new Date().toLocaleString();
    }
  }

  /**
   * Check for significant changes
   */
  checkForSignificantChanges(newData) {
    const oldMetrics = this.metrics;
    
    // Check for significant increases
    if (newData.filesTracked > (oldMetrics.filesTracked || 0) + 5) {
      if (window.dashboard && window.dashboard.showNotification) {
        window.dashboard.showNotification('Great progress! You\'ve modified many files.', 'success');
      }
    }
    
    if (newData.activeTime > (oldMetrics.activeTime || 0) + 30) {
      if (window.dashboard && window.dashboard.showNotification) {
        window.dashboard.showNotification('Excellent focus! 30+ minutes of active coding.', 'success');
      }
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor update performance
    this.performanceMetrics = {
      updateCount: 0,
      averageUpdateTime: 0,
      lastUpdateDuration: 0
    };
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    return this.metrics;
  }

  /**
   * Force refresh all data
   */
  forceRefresh() {
    if (this.useWebSocket && this.webSocketClient) {
      // Use WebSocket for real-time refresh
      this.webSocketClient.requestMetrics();
      this.webSocketClient.requestInsights();
    } else if (typeof acquireVsCodeApi !== 'undefined') {
      // Fallback to VS Code messaging
      const vscode = acquireVsCodeApi();
      vscode.postMessage({ command: 'refreshMetrics' });
    }
  }

  /**
   * Fallback to polling mode when WebSocket fails
   */
  fallbackToPolling() {
    this.useWebSocket = false;
    console.log('Switched to polling mode');

    // Notify connection status
    if (window.connectionStatus) {
      window.connectionStatus.setStatus('polling', 'Using polling mode');
    }
  }

  /**
   * Check if using WebSocket
   */
  isUsingWebSocket() {
    return this.useWebSocket;
  }

  /**
   * Get connection type
   */
  getConnectionType() {
    return this.useWebSocket ? 'websocket' : 'polling';
  }

  /**
   * Send message through appropriate channel
   */
  sendMessage(command, data = null) {
    if (this.useWebSocket && this.webSocketClient) {
      this.webSocketClient.send({
        command,
        data
      });
    } else if (typeof acquireVsCodeApi !== 'undefined') {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({
        command,
        data
      });
    }
  }

  /**
   * Update trends display
   */
  updateTrends(data) {
    if (window.dashboard && window.dashboard.updateTrendsPanel) {
      window.dashboard.updateTrendsPanel(data);
    } else {
      this.updateTrendsPanelFallback(data);
    }
  }

  /**
   * Update performance metrics display
   */
  updatePerformance(data) {
    if (window.dashboard && window.dashboard.updatePerformancePanel) {
      window.dashboard.updatePerformancePanel(data);
    } else {
      this.updatePerformancePanelFallback(data);
    }
  }

  /**
   * Update team metrics display
   */
  updateTeamMetrics(data) {
    if (window.dashboard && window.dashboard.updateTeamPanel) {
      window.dashboard.updateTeamPanel(data);
    } else {
      this.updateTeamPanelFallback(data);
    }
  }

  /**
   * Update code health display
   */
  updateCodeHealth(data) {
    if (window.dashboard && window.dashboard.updateCodeHealthPanel) {
      window.dashboard.updateCodeHealthPanel(data);
    } else {
      this.updateCodeHealthPanelFallback(data);
    }
  }

  /**
   * Update advanced analytics display
   */
  updateAdvancedAnalytics(data) {
    if (window.dashboard && window.dashboard.updateAdvancedAnalyticsPanel) {
      window.dashboard.updateAdvancedAnalyticsPanel(data);
    } else {
      this.updateAdvancedAnalyticsPanelFallback(data);
    }
  }

  /**
   * Fallback trends panel update
   */
  updateTrendsPanelFallback(data) {
    const container = document.querySelector('.trends-panel');
    if (!container) return;

    // Update velocity prediction
    const velocityElement = container.querySelector('[data-metric="velocity-prediction"]');
    if (velocityElement && data.velocityPrediction) {
      velocityElement.textContent = `${data.velocityPrediction.nextWeek.toFixed(1)} hrs/week`;
    }

    // Update trend direction
    const trendElement = container.querySelector('[data-metric="trend-direction"]');
    if (trendElement && data.seasonalPatterns) {
      const direction = this.calculateTrendDirection(data.seasonalPatterns);
      trendElement.textContent = direction;
      trendElement.className = `trend-indicator ${direction}`;
    }
  }

  /**
   * Fallback performance panel update
   */
  updatePerformancePanelFallback(data) {
    const container = document.querySelector('.performance-panel');
    if (!container) return;

    // Update hotspots count
    const hotspotsElement = container.querySelector('[data-metric="hotspots-count"]');
    if (hotspotsElement && data.executionHotspots) {
      hotspotsElement.textContent = data.executionHotspots.length;
    }

    // Update memory usage
    const memoryElement = container.querySelector('[data-metric="memory-usage"]');
    if (memoryElement && data.memoryProfile) {
      memoryElement.textContent = `${(data.memoryProfile.allocation / 1024 / 1024).toFixed(1)} MB`;
    }
  }

  /**
   * Fallback team panel update
   */
  updateTeamPanelFallback(data) {
    const container = document.querySelector('.team-panel');
    if (!container) return;

    // Update contributor count
    const contributorsElement = container.querySelector('[data-metric="contributors"]');
    if (contributorsElement) {
      contributorsElement.textContent = data.contributorCount || 0;
    }

    // Update collaboration score
    const collaborationElement = container.querySelector('[data-metric="collaboration-score"]');
    if (collaborationElement) {
      collaborationElement.textContent = `${(data.collaborationScore || 0).toFixed(1)}%`;
    }
  }

  /**
   * Fallback code health panel update
   */
  updateCodeHealthPanelFallback(data) {
    const container = document.querySelector('.code-health-panel');
    if (!container) return;

    // Update duplication percentage
    const duplicationElement = container.querySelector('[data-metric="duplication"]');
    if (duplicationElement && data.duplicationType) {
      duplicationElement.textContent = `${data.duplicationType.percentage.toFixed(1)}%`;
    }

    // Update test coverage
    const coverageElement = container.querySelector('[data-metric="test-coverage"]');
    if (coverageElement && data.testCoverage) {
      coverageElement.textContent = `${data.testCoverage.percentage.toFixed(1)}%`;
    }
  }

  /**
   * Fallback advanced analytics panel update
   */
  updateAdvancedAnalyticsPanelFallback(data) {
    const container = document.querySelector('.advanced-analytics-panel');
    if (!container) return;

    // Update overall health score
    const healthElement = container.querySelector('[data-metric="health-score"]');
    if (healthElement) {
      const healthScore = this.calculateOverallHealthScore(data);
      healthElement.textContent = `${healthScore.toFixed(1)}%`;
    }

    // Update recommendations count
    const recommendationsElement = container.querySelector('[data-metric="recommendations"]');
    if (recommendationsElement && data.recommendations) {
      recommendationsElement.textContent = data.recommendations.length;
    }
  }

  /**
   * Calculate trend direction from seasonal patterns
   */
  calculateTrendDirection(patterns) {
    if (!patterns.monthlyTrends || patterns.monthlyTrends.length < 2) {
      return 'stable';
    }

    const recent = patterns.monthlyTrends.slice(-2);
    const change = recent[1].value - recent[0].value;

    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Calculate overall health score
   */
  calculateOverallHealthScore(data) {
    let score = 100;

    // Deduct for code health issues
    if (data.codeQuality) {
      score -= data.codeQuality.duplicationType.percentage * 0.5;
      score -= (100 - data.codeQuality.testCoverage.percentage) * 0.3;
      score -= (100 - data.codeQuality.documentation.coverage) * 0.2;
    }

    // Deduct for performance issues
    if (data.performance) {
      score -= data.performance.executionHotspots.length * 2;
      score -= data.performance.memoryProfile.leaks.length * 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// Initialize real-time data handler when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.realTimeData = new RealTimeDataHandler();
  });
} else {
  window.realTimeData = new RealTimeDataHandler();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealTimeDataHandler;
}
