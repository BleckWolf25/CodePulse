/**
 * @file HISTORICAL-ANALYTICS.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Historical Analytics Dashboard
 * Frontend component for displaying comprehensive historical data analysis,
 * trends, patterns, regressions, and forecasting.
 */

// ------------ MAIN
class HistoricalAnalytics {
  constructor() {
    this.currentReport = null;
    this.selectedTimeRange = '90d';
    this.selectedMetric = 'all';
    this.charts = new Map();
    
    this.init();
  }

  /**
   * Initialize historical analytics dashboard
   */
  init() {
    this.createAnalyticsUI();
    this.setupEventListeners();
    this.loadInitialData();
  }

  /**
   * Create analytics dashboard UI
   */
  createAnalyticsUI() {
    const analyticsContainer = document.createElement('div');
    analyticsContainer.className = 'historical-analytics-container';
    analyticsContainer.innerHTML = `
      <div class="analytics-header">
        <h2>Historical Analytics</h2>
        <div class="analytics-controls">
          <select id="timeRangeSelect" class="analytics-select">
            <option value="30d">Last 30 Days</option>
            <option value="90d" selected>Last 90 Days</option>
            <option value="180d">Last 6 Months</option>
            <option value="365d">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
          
          <select id="metricSelect" class="analytics-select">
            <option value="all">All Metrics</option>
            <option value="productivity">Productivity</option>
            <option value="quality">Code Quality</option>
            <option value="velocity">Velocity</option>
            <option value="complexity">Complexity</option>
          </select>
          
          <button id="generateReportBtn" class="btn btn-primary">
            Generate Report
          </button>
          
          <button id="exportAnalyticsBtn" class="btn btn-secondary">
            Export Analytics
          </button>
        </div>
      </div>

      <div class="analytics-summary" id="analyticsSummary">
        <!-- Summary cards will be populated here -->
      </div>

      <div class="analytics-tabs">
        <button class="analytics-tab active" data-tab="overview">Overview</button>
        <button class="analytics-tab" data-tab="trends">Trends</button>
        <button class="analytics-tab" data-tab="patterns">Patterns</button>
        <button class="analytics-tab" data-tab="regressions">Regressions</button>
        <button class="analytics-tab" data-tab="forecasting">Forecasting</button>
        <button class="analytics-tab" data-tab="insights">Insights</button>
      </div>

      <div class="analytics-content">
        <div class="analytics-tab-content active" id="overviewTab">
          <div class="overview-grid">
            <div class="overview-section">
              <h3>Health Score</h3>
              <div class="health-score-container">
                <canvas id="healthScoreChart" width="200" height="200"></canvas>
                <div class="health-score-details" id="healthScoreDetails"></div>
              </div>
            </div>
            
            <div class="overview-section">
              <h3>Key Metrics Trends</h3>
              <div class="key-metrics-grid" id="keyMetricsGrid">
                <!-- Key metrics will be populated here -->
              </div>
            </div>
            
            <div class="overview-section">
              <h3>Recent Alerts</h3>
              <div class="alerts-list" id="recentAlerts">
                <!-- Alerts will be populated here -->
              </div>
            </div>
          </div>
        </div>

        <div class="analytics-tab-content" id="trendsTab">
          <div class="trends-container">
            <div class="trends-filters">
              <label>
                <input type="checkbox" id="showConfidenceInterval" checked>
                Show Confidence Intervals
              </label>
              <label>
                <input type="checkbox" id="showMovingAverage" checked>
                Show Moving Average
              </label>
              <label>
                <input type="checkbox" id="showAnomalies" checked>
                Highlight Anomalies
              </label>
            </div>
            <div class="trends-charts" id="trendsCharts">
              <!-- Trend charts will be populated here -->
            </div>
          </div>
        </div>

        <div class="analytics-tab-content" id="patternsTab">
          <div class="patterns-container">
            <div class="patterns-grid" id="patternsGrid">
              <!-- Pattern analysis will be populated here -->
            </div>
          </div>
        </div>

        <div class="analytics-tab-content" id="regressionsTab">
          <div class="regressions-container">
            <div class="regressions-filters">
              <select id="severityFilter">
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="warning">Warning</option>
              </select>
            </div>
            <div class="regressions-list" id="regressionsList">
              <!-- Regression alerts will be populated here -->
            </div>
          </div>
        </div>

        <div class="analytics-tab-content" id="forecastingTab">
          <div class="forecasting-container">
            <div class="forecasting-controls">
              <label>
                Forecast Period:
                <select id="forecastPeriod">
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30" selected>30 Days</option>
                  <option value="60">60 Days</option>
                </select>
              </label>
              <button id="generateForecastBtn" class="btn btn-primary">
                Generate Forecast
              </button>
            </div>
            <div class="forecast-charts" id="forecastCharts">
              <!-- Forecast charts will be populated here -->
            </div>
            <div class="forecast-factors" id="forecastFactors">
              <!-- Forecast factors will be populated here -->
            </div>
          </div>
        </div>

        <div class="analytics-tab-content" id="insightsTab">
          <div class="insights-container">
            <div class="insights-filters">
              <select id="insightCategory">
                <option value="all">All Categories</option>
                <option value="trend">Trends</option>
                <option value="pattern">Patterns</option>
                <option value="regression">Regressions</option>
                <option value="comparison">Comparisons</option>
                <option value="prediction">Predictions</option>
              </select>
              <select id="insightImpact">
                <option value="all">All Impact Levels</option>
                <option value="high">High Impact</option>
                <option value="medium">Medium Impact</option>
                <option value="low">Low Impact</option>
              </select>
            </div>
            <div class="insights-list" id="insightsList">
              <!-- Insights will be populated here -->
            </div>
            <div class="recommendations-list" id="recommendationsList">
              <!-- Recommendations will be populated here -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to dashboard
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
      dashboardContent.appendChild(analyticsContainer);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.addEventListener('click', (e) => {
      if (e.target.matches('.analytics-tab')) {
        this.switchTab(e.target.dataset.tab);
      }
    });

    // Controls
    document.getElementById('generateReportBtn')?.addEventListener('click', () => {
      this.generateReport();
    });

    document.getElementById('exportAnalyticsBtn')?.addEventListener('click', () => {
      this.exportAnalytics();
    });

    document.getElementById('generateForecastBtn')?.addEventListener('click', () => {
      this.generateForecast();
    });

    // Filters
    document.getElementById('timeRangeSelect')?.addEventListener('change', (e) => {
      this.selectedTimeRange = e.target.value;
      this.loadAnalyticsData();
    });

    document.getElementById('metricSelect')?.addEventListener('change', (e) => {
      this.selectedMetric = e.target.value;
      this.updateDisplayedData();
    });

    document.getElementById('severityFilter')?.addEventListener('change', (e) => {
      this.filterRegressions(e.target.value);
    });

    document.getElementById('insightCategory')?.addEventListener('change', (e) => {
      this.filterInsights();
    });

    document.getElementById('insightImpact')?.addEventListener('change', (e) => {
      this.filterInsights();
    });

    // Chart options
    document.getElementById('showConfidenceInterval')?.addEventListener('change', () => {
      this.updateTrendCharts();
    });

    document.getElementById('showMovingAverage')?.addEventListener('change', () => {
      this.updateTrendCharts();
    });

    document.getElementById('showAnomalies')?.addEventListener('change', () => {
      this.updateTrendCharts();
    });
  }

  /**
   * Load initial analytics data
   */
  async loadInitialData() {
    try {
      await this.loadAnalyticsData();
    } catch (error) {
      console.error('Failed to load initial analytics data:', error);
      this.showError('Failed to load analytics data');
    }
  }

  /**
   * Load analytics data from backend
   */
  async loadAnalyticsData() {
    try {
      this.showLoading(true);

      // Request analytics data from VS Code extension
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'getHistoricalAnalytics',
          timeRange: this.selectedTimeRange,
          metric: this.selectedMetric
        });
      } else {
        // Fallback to mock data for development
        this.handleAnalyticsData(this.generateMockAnalyticsData());
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      this.showError('Failed to load analytics data');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Handle analytics data received from backend
   */
  handleAnalyticsData(data) {
    this.currentReport = data;
    this.updateAnalyticsSummary(data.summary);
    this.updateOverviewTab(data);
    this.updateTrendsTab(data.trends);
    this.updatePatternsTab(data.patterns);
    this.updateRegressionsTab(data.regressions);
    this.updateInsightsTab(data.insights, data.recommendations);
  }

  /**
   * Update analytics summary cards
   */
  updateAnalyticsSummary(summary) {
    const summaryContainer = document.getElementById('analyticsSummary');
    if (!summaryContainer) return;

    summaryContainer.innerHTML = `
      <div class="summary-card">
        <div class="summary-icon">📈</div>
        <div class="summary-content">
          <h3>Overall Trend</h3>
          <p class="summary-value ${summary.overallTrend}">${summary.overallTrend}</p>
        </div>
      </div>
      
      <div class="summary-card">
        <div class="summary-icon">💯</div>
        <div class="summary-content">
          <h3>Health Score</h3>
          <p class="summary-value">${summary.healthScore}/100</p>
        </div>
      </div>
      
      <div class="summary-card">
        <div class="summary-icon">⚠️</div>
        <div class="summary-content">
          <h3>Risk Level</h3>
          <p class="summary-value ${summary.riskLevel}">${summary.riskLevel}</p>
        </div>
      </div>
      
      <div class="summary-card">
        <div class="summary-icon">🚨</div>
        <div class="summary-content">
          <h3>Active Alerts</h3>
          <p class="summary-value">${summary.alertCount.critical + summary.alertCount.major}</p>
        </div>
      </div>
    `;
  }

  /**
   * Update overview tab
   */
  updateOverviewTab(data) {
    this.updateHealthScoreChart(data.summary.healthScore);
    this.updateKeyMetricsGrid(data.summary.keyMetrics);
    this.updateRecentAlerts(data.regressions.slice(0, 5));
  }

  /**
   * Update health score chart
   */
  updateHealthScoreChart(healthScore) {
    const canvas = document.getElementById('healthScoreChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Draw health score arc
    const angle = (healthScore / 100) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + angle);
    ctx.strokeStyle = this.getHealthScoreColor(healthScore);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw score text
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(healthScore.toString(), centerX, centerY + 8);

    // Update details
    const detailsContainer = document.getElementById('healthScoreDetails');
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div class="health-detail">
          <span class="health-label">Status:</span>
          <span class="health-value ${this.getHealthScoreStatus(healthScore)}">${this.getHealthScoreStatus(healthScore)}</span>
        </div>
        <div class="health-detail">
          <span class="health-label">Last Updated:</span>
          <span class="health-value">${new Date().toLocaleString()}</span>
        </div>
      `;
    }
  }

  /**
   * Get health score color
   */
  getHealthScoreColor(score) {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    if (score >= 40) return '#f97316'; // Orange
    return '#ef4444'; // Red
  }

  /**
   * Get health score status
   */
  getHealthScoreStatus(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  /**
   * Update key metrics grid
   */
  updateKeyMetricsGrid(keyMetrics) {
    const gridContainer = document.getElementById('keyMetricsGrid');
    if (!gridContainer) return;

    const metrics = Object.entries(keyMetrics);
    gridContainer.innerHTML = metrics.map(([metric, data]) => `
      <div class="key-metric-card">
        <h4>${metric.charAt(0).toUpperCase() + metric.slice(1)}</h4>
        <div class="metric-value">${data.current.toFixed(1)}</div>
        <div class="metric-change ${data.change >= 0 ? 'positive' : 'negative'}">
          ${data.change >= 0 ? '↗' : '↘'} ${Math.abs(data.change).toFixed(1)}%
        </div>
        <div class="metric-trend">${data.trend}</div>
      </div>
    `).join('');
  }

  /**
   * Update recent alerts
   */
  updateRecentAlerts(alerts) {
    const alertsContainer = document.getElementById('recentAlerts');
    if (!alertsContainer) return;

    if (alerts.length === 0) {
      alertsContainer.innerHTML = '<div class="no-alerts">No recent alerts</div>';
      return;
    }

    alertsContainer.innerHTML = alerts.map(alert => `
      <div class="alert-item ${alert.severity}">
        <div class="alert-icon">${this.getAlertIcon(alert.severity)}</div>
        <div class="alert-content">
          <div class="alert-title">${alert.metric} ${alert.severity} alert</div>
          <div class="alert-description">${alert.description}</div>
          <div class="alert-time">${new Date(alert.detectedAt).toLocaleString()}</div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Get alert icon
   */
  getAlertIcon(severity) {
    const icons = {
      critical: '🔴',
      major: '🟠',
      minor: '🟡',
      warning: '🔵'
    };
    return icons[severity] || '⚪';
  }

  /**
   * Switch analytics tab
   */
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.analytics-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.analytics-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    // Load tab-specific data if needed
    if (tabName === 'forecasting' && !this.forecastData) {
      this.generateForecast();
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport() {
    try {
      this.showLoading(true);
      
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'generateAnalyticsReport',
          timeRange: this.selectedTimeRange,
          metric: this.selectedMetric
        });
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      this.showError('Failed to generate report');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Export analytics data
   */
  exportAnalytics() {
    if (!this.currentReport) {
      this.showError('No analytics data to export');
      return;
    }

    if (window.exportManager) {
      window.exportManager.showExportModal();
    } else {
      // Fallback export
      const dataStr = JSON.stringify(this.currentReport, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Show loading state
   */
  showLoading(loading) {
    const loadingIndicator = document.querySelector('.analytics-loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = loading ? 'block' : 'none';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (window.dashboardManager) {
      window.dashboardManager.showNotification(message, 'error');
    } else {
      console.error(message);
    }
  }

  /**
   * Generate mock analytics data for development
   */
  generateMockAnalyticsData() {
    return {
      summary: {
        overallTrend: 'improving',
        healthScore: 78,
        riskLevel: 'medium',
        alertCount: { critical: 0, major: 1, minor: 2, warning: 3 },
        keyMetrics: {
          productivity: { current: 6.5, change: 12.3, trend: 'improving' },
          quality: { current: 82.1, change: -2.1, trend: 'stable' },
          velocity: { current: 15.2, change: 8.7, trend: 'improving' },
          complexity: { current: 8.3, change: -5.2, trend: 'improving' }
        }
      },
      trends: [],
      patterns: [],
      regressions: [],
      insights: [],
      recommendations: []
    };
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.historicalAnalytics = new HistoricalAnalytics();
});
