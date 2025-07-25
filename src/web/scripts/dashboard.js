/**
 * @file DASHBOARD.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Dashboard JavaScript
 * Main dashboard functionality including interactions, data updates,
 * and communication with the VS Code extension
 */

// ------------ MAIN
class Dashboard {
  constructor() {
    this.vscode = null;
    this.isLoading = false;
    this.lastUpdate = null;
    this.refreshInterval = null;
    this.notifications = [];
    
    this.init();
  }

  /**
   * Initialize dashboard
   */
  init() {
    this.setupVSCodeAPI();
    this.setupEventListeners();
    this.setupAutoRefresh();
    this.setupKeyboardShortcuts();
    this.initializeInteractiveFeatures();
    this.loadInitialData();
  }

  /**
   * Initialize interactive features
   */
  initializeInteractiveFeatures() {
    // Initialize managers
    if (typeof ChartManager !== 'undefined') {
      window.chartManager = new ChartManager();
    }

    if (typeof AdvancedFilterManager !== 'undefined') {
      window.filterManager = new AdvancedFilterManager();
    }

    if (typeof ExportManager !== 'undefined') {
      window.exportManager = new ExportManager();
    }

    if (typeof GoalManager !== 'undefined') {
      window.goalManager = new GoalManager();
    }

    // Setup drill-down capabilities for charts
    this.setupChartDrillDown();

    // Setup advanced search functionality
    this.setupAdvancedSearch();

    // Setup export functionality
    this.setupExportFeatures();

    // Setup goal tracking integration
    this.setupGoalTracking();
  }

  /**
   * Setup VS Code API communication
   */
  setupVSCodeAPI() {
    if (typeof acquireVsCodeApi !== 'undefined') {
      this.vscode = acquireVsCodeApi();
      
      // Listen for messages from extension
      window.addEventListener('message', (event) => {
        this.handleExtensionMessage(event.data);
      });
    }
  }

  /**
   * Handle messages from VS Code extension
   */
  handleExtensionMessage(message) {
    switch (message.command) {
      case 'updateMetrics':
        this.updateMetricsDisplay(message.data);
        break;
      case 'updateInsights':
        this.updateInsightsPanel(message.data);
        break;
      case 'filtersApplied':
        this.handleFiltersApplied(message.data);
        break;
      case 'exportComplete':
        this.showNotification('Export completed successfully', 'success');
        break;
      case 'error':
        this.showNotification(message.error, 'error');
        break;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Refresh button
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="refresh"]')) {
        e.preventDefault();
        this.refreshDashboard();
      }
    });

    // Export button
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="export"]')) {
        e.preventDefault();
        this.exportMetrics();
      }
    });

    // Theme toggle button
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="toggleTheme"]') || e.target.closest('[data-action="toggleTheme"]')) {
        e.preventDefault();
        this.toggleTheme();
      }
    });

    // Filter changes
    document.addEventListener('change', (e) => {
      if (e.target.matches('.filter-select')) {
        this.applyFilters();
      }
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.handleSearch(e.target.value);
        }, 300);
      });
    }

    // Insight actions
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-insight-action]')) {
        e.preventDefault();
        const action = e.target.dataset.insightAction;
        const metadata = JSON.parse(e.target.dataset.metadata || '{}');
        this.executeInsightAction(action, metadata);
      }
    });

    // Chart interactions
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-chart-action]')) {
        e.preventDefault();
        const action = e.target.dataset.chartAction;
        const chartId = e.target.dataset.chartId;
        this.handleChartAction(action, chartId);
      }
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not in input fields
      if (e.target.matches('input, textarea, select')) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            this.refreshDashboard();
            break;
          case 'e':
            e.preventDefault();
            this.exportMetrics();
            break;
          case 'f':
            e.preventDefault();
            this.focusSearch();
            break;
        }
      }

      // Escape key to clear search
      if (e.key === 'Escape') {
        this.clearSearch();
      }
    });
  }

  /**
   * Setup auto-refresh functionality
   */
  setupAutoRefresh() {
    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshDashboard(true); // Silent refresh
    }, 30000);

    // Clear interval when page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(this.refreshInterval);
      } else {
        this.setupAutoRefresh();
      }
    });
  }

  /**
   * Load initial data
   */
  loadInitialData() {
    this.requestLatestMetrics();
    this.requestInsights();
  }

  /**
   * Refresh dashboard data
   */
  refreshDashboard(silent = false) {
    if (this.isLoading) return;

    this.setLoadingState(true);
    
    if (!silent) {
      this.showNotification('Refreshing dashboard...', 'info');
    }

    if (this.vscode) {
      this.vscode.postMessage({ command: 'refreshMetrics' });
    }

    // Update timestamp
    this.updateLastRefreshTime();
  }

  /**
   * Request latest metrics from extension
   */
  requestLatestMetrics() {
    if (this.vscode) {
      this.vscode.postMessage({ command: 'getLatestMetrics' });
    }
  }

  /**
   * Request insights from extension
   */
  requestInsights() {
    if (this.vscode) {
      this.vscode.postMessage({ command: 'getInsights' });
    }
  }

  /**
   * Export metrics
   */
  exportMetrics() {
    if (this.vscode) {
      this.vscode.postMessage({ command: 'exportMetrics' });
      this.showNotification('Starting export...', 'info');
    }
  }

  /**
   * Apply filters
   */
  applyFilters() {
    const filters = this.collectFilters();
    
    if (this.vscode) {
      this.vscode.postMessage({
        command: 'applyFilters',
        filters: filters
      });
    }
  }

  /**
   * Collect current filter values
   */
  collectFilters() {
    const filters = {};
    
    document.querySelectorAll('.filter-select').forEach(select => {
      filters[select.name] = select.value;
    });

    return filters;
  }

  /**
   * Handle search functionality
   */
  handleSearch(query) {
    if (query.length === 0) {
      this.clearSearchResults();
      return;
    }

    if (query.length > 2) {
      this.showNotification(`Searching for: ${query}`, 'info');
      this.performSearch(query);
    }
  }

  /**
   * Perform search across dashboard elements
   */
  performSearch(query) {
    const searchableElements = [
      { selector: '.metric-card', textSelector: '.metric-label', type: 'metric' },
      { selector: '.insight-item', textSelector: '.insight-title, .insight-description', type: 'insight' },
      { selector: '.chart-container', textSelector: '.chart-title', type: 'chart' }
    ];

    let foundResults = false;

    searchableElements.forEach(({ selector, textSelector, type }) => {
      const elements = document.querySelectorAll(selector);

      elements.forEach(element => {
        const textElements = element.querySelectorAll(textSelector);
        const text = Array.from(textElements).map(el => el.textContent.toLowerCase()).join(' ');

        if (text.includes(query.toLowerCase())) {
          this.highlightSearchResult(element, type);
          foundResults = true;
        } else {
          this.removeSearchHighlight(element);
        }
      });
    });

    if (!foundResults) {
      this.showNotification('No results found', 'warning');
    }
  }

  /**
   * Highlight search result
   */
  highlightSearchResult(element, type) {
    element.classList.add('search-result');
    element.style.transform = 'scale(1.02)';
    element.style.boxShadow = 'var(--shadow-lg)';
    element.style.borderColor = 'var(--color-primary)';
    element.style.transition = 'all var(--transition-base)';
  }

  /**
   * Remove search highlight
   */
  removeSearchHighlight(element) {
    element.classList.remove('search-result');
    element.style.transform = '';
    element.style.boxShadow = '';
    element.style.borderColor = '';
  }

  /**
   * Clear search results
   */
  clearSearchResults() {
    document.querySelectorAll('.search-result').forEach(element => {
      this.removeSearchHighlight(element);
    });
  }

  /**
   * Focus search input
   */
  focusSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  /**
   * Clear search
   */
  clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
      searchInput.blur();
      this.clearSearchResults();
    }
  }

  /**
   * Execute insight action
   */
  executeInsightAction(actionType, metadata) {
    if (this.vscode) {
      this.vscode.postMessage({
        command: 'executeAction',
        actionType: actionType,
        metadata: metadata
      });
    }
  }

  /**
   * Handle chart actions
   */
  handleChartAction(action, chartId) {
    switch (action) {
      case 'fullscreen':
        this.toggleChartFullscreen(chartId);
        break;
      case 'download':
        this.downloadChart(chartId);
        break;
      case 'refresh':
        this.refreshChart(chartId);
        break;
    }
  }

  /**
   * Toggle chart fullscreen mode
   */
  toggleChartFullscreen(chartId) {
    const chartContainer = document.querySelector(`#${chartId}`).closest('.chart-container');
    if (chartContainer) {
      if (chartContainer.classList.contains('fullscreen')) {
        chartContainer.classList.remove('fullscreen');
        document.body.style.overflow = '';
        this.showNotification('Exited fullscreen mode', 'info');
      } else {
        chartContainer.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
        this.showNotification('Entered fullscreen mode', 'info');
      }

      // Resize chart after fullscreen toggle
      setTimeout(() => {
        if (window.chartManager) {
          window.chartManager.resizeCharts();
        }
      }, 300);
    }
  }

  /**
   * Download chart as image
   */
  downloadChart(chartId) {
    if (window.chartManager) {
      const filename = `${chartId}-${new Date().toISOString().split('T')[0]}.png`;
      window.chartManager.exportChart(chartId, filename);
      this.showNotification('Chart downloaded', 'success');
    }
  }

  /**
   * Refresh specific chart
   */
  refreshChart(chartId) {
    this.showNotification(`Refreshing ${chartId}...`, 'info');

    // Simulate chart refresh
    setTimeout(() => {
      this.showNotification('Chart refreshed', 'success');
    }, 1000);
  }

  /**
   * Update metrics display
   */
  updateMetricsDisplay(data) {
    this.setLoadingState(false);
    
    // Update metric cards
    Object.entries(data).forEach(([key, value]) => {
      const element = document.querySelector(`[data-metric="${key}"]`);
      if (element) {
        this.animateValueChange(element, value);
      }
    });

    this.lastUpdate = new Date();
    this.updateLastRefreshTime();
  }

  /**
   * Update insights panel
   */
  updateInsightsPanel(insights) {
    const container = document.querySelector('.insights-list');
    if (!container) return;

    container.innerHTML = '';
    
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
    
    div.innerHTML = `
      <div class="insight-icon ${insight.type}">
        ${this.getInsightIcon(insight.type)}
      </div>
      <div class="insight-content">
        <h4 class="insight-title">${insight.title}</h4>
        <p class="insight-description">${insight.description}</p>
        ${insight.actionable ? this.createInsightAction(insight) : ''}
      </div>
    `;
    
    return div;
  }

  /**
   * Get insight icon
   */
  getInsightIcon(type) {
    const icons = {
      suggestion: '💡',
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
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
   * Animate value changes
   */
  animateValueChange(element, newValue) {
    const currentValue = element.textContent;
    
    if (currentValue !== newValue.toString()) {
      element.style.transform = 'scale(1.1)';
      element.style.transition = 'transform 0.2s ease-in-out';
      
      setTimeout(() => {
        element.textContent = newValue;
        element.style.transform = 'scale(1)';
      }, 100);
    }
  }

  /**
   * Set loading state
   */
  setLoadingState(loading) {
    this.isLoading = loading;
    
    const loadingElements = document.querySelectorAll('.loading-overlay');
    loadingElements.forEach(el => {
      el.style.display = loading ? 'flex' : 'none';
    });

    const refreshButtons = document.querySelectorAll('[data-action="refresh"]');
    refreshButtons.forEach(btn => {
      btn.disabled = loading;
      if (loading) {
        btn.innerHTML = '<span class="spinner"></span> Refreshing...';
      } else {
        btn.innerHTML = '🔄 Refresh';
      }
    });
  }

  /**
   * Update last refresh time
   */
  updateLastRefreshTime() {
    const element = document.getElementById('lastUpdate');
    if (element) {
      element.textContent = new Date().toLocaleString();
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info', duration = 3000) {
    const container = document.querySelector('.notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(notification);

    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, duration);

    // Store in notifications array
    this.notifications.push({
      message,
      type,
      timestamp: new Date()
    });

    // Keep only last 10 notifications
    if (this.notifications.length > 10) {
      this.notifications = this.notifications.slice(-10);
    }
  }

  /**
   * Get notification icon
   */
  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  /**
   * Setup chart drill-down capabilities
   */
  setupChartDrillDown() {
    if (!window.chartManager) return;

    // Add drill-down to complexity chart
    window.chartManager.addDrillDown('complexityChart', {
      onDrillDown: (data) => {
        this.handleComplexityDrillDown(data);
      },
      drillDownData: {
        // This TODO: Would be populated with actual drill-down data
      }
    });

    // Add drill-down to language distribution chart
    window.chartManager.addDrillDown('languageChart', {
      onDrillDown: (data) => {
        this.handleLanguageDrillDown(data);
      }
    });
  }

  /**
   * Handle complexity drill-down
   */
  handleComplexityDrillDown(data) {
    if (this.vscode) {
      this.vscode.postMessage({
        command: 'getComplexityDetails',
        category: data.label,
        value: data.value
      });
    }
  }

  /**
   * Handle language drill-down
   */
  handleLanguageDrillDown(data) {
    if (this.vscode) {
      this.vscode.postMessage({
        command: 'getLanguageDetails',
        language: data.label,
        value: data.value
      });
    }
  }

  /**
   * Setup advanced search functionality
   */
  setupAdvancedSearch() {
    // Add search button to header
    const headerControls = document.querySelector('.header-controls');
    if (headerControls && !document.getElementById('searchButton')) {
      const searchButton = document.createElement('button');
      searchButton.id = 'searchButton';
      searchButton.className = 'btn btn-secondary';
      searchButton.innerHTML = '<span aria-hidden="true">🔍</span> Search';
      searchButton.title = 'Advanced Search (Ctrl+F)';
      searchButton.addEventListener('click', () => {
        if (window.filterManager) {
          window.filterManager.focusSearch();
        }
      });
      headerControls.insertBefore(searchButton, headerControls.firstChild);
    }

    // Add filter button
    if (headerControls && !document.getElementById('filterButton')) {
      const filterButton = document.createElement('button');
      filterButton.id = 'filterButton';
      filterButton.className = 'btn btn-secondary';
      filterButton.innerHTML = '<span aria-hidden="true">🔧</span> Filters';
      filterButton.title = 'Advanced Filters (Ctrl+K)';
      filterButton.addEventListener('click', () => {
        if (window.filterManager) {
          window.filterManager.showFilterPanel();
        }
      });
      headerControls.insertBefore(filterButton, headerControls.firstChild);
    }
  }

  /**
   * Setup export functionality
   */
  setupExportFeatures() {
    // Add export button to header
    const headerControls = document.querySelector('.header-controls');
    if (headerControls && !document.getElementById('exportButton')) {
      const exportButton = document.createElement('button');
      exportButton.id = 'exportButton';
      exportButton.className = 'btn btn-primary';
      exportButton.innerHTML = '<span aria-hidden="true">📤</span> Export';
      exportButton.title = 'Export Dashboard (Ctrl+E)';
      exportButton.addEventListener('click', () => {
        if (window.exportManager) {
          window.exportManager.showExportModal();
        }
      });
      headerControls.appendChild(exportButton);
    }
  }

  /**
   * Setup goal tracking integration
   */
  setupGoalTracking() {
    // Update goals when metrics change
    this.onMetricsUpdate = (metrics) => {
      if (window.goalManager) {
        window.goalManager.updateGoalsFromMetrics(metrics);
      }
    };

    // Add goal button to header
    const headerControls = document.querySelector('.header-controls');
    if (headerControls && !document.getElementById('goalButton')) {
      const goalButton = document.createElement('button');
      goalButton.id = 'goalButton';
      goalButton.className = 'btn btn-secondary';
      goalButton.innerHTML = '<span aria-hidden="true">🎯</span> Goals';
      goalButton.title = 'Goals & Achievements';
      goalButton.addEventListener('click', () => {
        if (window.goalManager) {
          window.goalManager.toggleGoalPanel();
        }
      });
      headerControls.appendChild(goalButton);
    }
  }

  /**
   * Export data in specified format
   */
  exportData(format, data) {
    if (window.exportManager) {
      return window.exportManager.exportData(format, data);
    }

    // Fallback to basic export
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Apply advanced filters
   */
  applyAdvancedFilters(filters) {
    if (this.vscode) {
      this.vscode.postMessage({
        command: 'applyAdvancedFilters',
        filters: filters
      });
    }
  }

  /**
   * Handle filter results
   */
  handleFiltersApplied(data) {
    this.updateMetricsDisplay(data.metrics);

    if (data.insights) {
      this.updateInsightsPanel(data.insights);
    }

    this.showNotification(`Filters applied - ${data.resultCount} items found`, 'success');
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    if (this.vscode) {
      this.vscode.postMessage({
        command: 'toggleTheme'
      });
    }
  }
}

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
  });
} else {
  window.dashboard = new Dashboard();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dashboard;
}
