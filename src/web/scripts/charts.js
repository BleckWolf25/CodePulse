/**
 * @file CHARTS.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Charts Configuration and Management
 * Handles Chart.js configuration, theming, and responsive behavior
 * Provides luxury styling and smooth animations for data visualization
 */

// ------------ MAIN
class ChartManager {
  constructor() {
    this.charts = new Map();
    this.defaultOptions = {};
    this.themeColors = {};
    
    this.init();
  }

  /**
   * Initialize chart manager
   */
  init() {
    this.setupDefaultOptions();
    this.setupThemeColors();
    this.setupThemeListener();
    this.registerChartDefaults();
  }

  /**
   * Setup default chart options
   */
  setupDefaultOptions() {
    this.defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: {
              family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              size: 12,
              weight: '500'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: {
            family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            size: 13,
            weight: '600'
          },
          bodyFont: {
            family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            size: 12,
            weight: '400'
          },
          displayColors: true,
          boxPadding: 4
        }
      },
      animation: {
        duration: 800,
        easing: 'easeInOutQuart'
      },
      elements: {
        point: {
          radius: 4,
          hoverRadius: 6,
          borderWidth: 2
        },
        line: {
          borderWidth: 3,
          tension: 0.4
        },
        bar: {
          borderRadius: 4,
          borderSkipped: false
        }
      }
    };
  }

  /**
   * Setup theme-specific colors
   */
  setupThemeColors() {
    this.themeColors = {
      light: {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        text: '#0f172a',
        textSecondary: '#475569',
        background: '#ffffff',
        border: '#e2e8f0',
        grid: '#f1f5f9'
      },
      dark: {
        primary: '#3b82f6',
        secondary: '#94a3b8',
        accent: '#a855f7',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#f87171',
        text: '#f8fafc',
        textSecondary: '#cbd5e1',
        background: '#1e293b',
        border: '#334155',
        grid: '#475569'
      }
    };
  }

  /**
   * Setup theme change listener
   */
  setupThemeListener() {
    window.addEventListener('themechange', (e) => {
      this.updateChartsTheme(e.detail.theme);
    });
  }

  /**
   * Register Chart.js defaults
   */
  registerChartDefaults() {
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      Chart.defaults.color = this.getCurrentThemeColors().text;
      Chart.defaults.borderColor = this.getCurrentThemeColors().border;
      Chart.defaults.backgroundColor = this.getCurrentThemeColors().background;
    }
  }

  /**
   * Get current theme colors
   */
  getCurrentThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return this.themeColors[isDark ? 'dark' : 'light'];
  }

  /**
   * Create a new chart
   */
  createChart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas with id "${canvasId}" not found`);
      return null;
    }

    // Merge options with defaults
    const mergedOptions = this.mergeOptions(this.defaultOptions, options);
    
    // Apply theme colors to data
    const themedData = this.applyThemeToData(data, type);

    // Create chart
    const chart = new Chart(canvas, {
      type: type,
      data: themedData,
      options: mergedOptions
    });

    // Store chart reference
    this.charts.set(canvasId, chart);

    return chart;
  }

  /**
   * Apply theme colors to chart data
   */
  applyThemeToData(data, type) {
    const colors = this.getCurrentThemeColors();
    const themedData = JSON.parse(JSON.stringify(data)); // Deep clone

    if (themedData.datasets) {
      themedData.datasets.forEach((dataset, index) => {
        switch (type) {
          case 'doughnut':
          case 'pie':
            dataset.backgroundColor = this.generateColorPalette(dataset.data.length);
            dataset.borderColor = colors.background;
            dataset.borderWidth = 2;
            break;
          
          case 'line':
            dataset.borderColor = this.getDatasetColor(index);
            dataset.backgroundColor = this.getDatasetColor(index, 0.1);
            dataset.pointBackgroundColor = this.getDatasetColor(index);
            dataset.pointBorderColor = colors.background;
            break;
          
          case 'bar':
            dataset.backgroundColor = this.getDatasetColor(index, 0.8);
            dataset.borderColor = this.getDatasetColor(index);
            dataset.borderWidth = 1;
            break;
          
          default:
            dataset.backgroundColor = this.getDatasetColor(index, 0.8);
            dataset.borderColor = this.getDatasetColor(index);
        }
      });
    }

    return themedData;
  }

  /**
   * Generate color palette
   */
  generateColorPalette(count) {
    const colors = this.getCurrentThemeColors();
    const baseColors = [
      colors.primary,
      colors.accent,
      colors.success,
      colors.warning,
      colors.error,
      colors.secondary
    ];

    const palette = [];
    for (let i = 0; i < count; i++) {
      if (i < baseColors.length) {
        palette.push(baseColors[i]);
      } else {
        // Generate additional colors by varying hue
        const hue = (i * 137.508) % 360; // Golden angle approximation
        palette.push(`hsl(${hue}, 70%, 60%)`);
      }
    }

    return palette;
  }

  /**
   * Get dataset color by index
   */
  getDatasetColor(index, alpha = 1) {
    const colors = this.getCurrentThemeColors();
    const colorKeys = ['primary', 'accent', 'success', 'warning', 'error', 'secondary'];
    const colorKey = colorKeys[index % colorKeys.length];
    const color = colors[colorKey];

    if (alpha < 1) {
      // Convert hex to rgba
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return color;
  }

  /**
   * Update all charts theme
   */
  updateChartsTheme(theme) {
    const colors = this.themeColors[theme];
    
    this.charts.forEach((chart, canvasId) => {
      // Update chart colors
      chart.options.plugins.legend.labels.color = colors.text;
      chart.options.scales && Object.keys(chart.options.scales).forEach(scaleKey => {
        const scale = chart.options.scales[scaleKey];
        if (scale.ticks) scale.ticks.color = colors.textSecondary;
        if (scale.grid) scale.grid.color = colors.grid;
        if (scale.title) scale.title.color = colors.text;
      });

      // Update dataset colors
      chart.data.datasets.forEach((dataset, index) => {
        const chartType = chart.config.type;
        
        switch (chartType) {
          case 'line':
            dataset.borderColor = this.getDatasetColor(index);
            dataset.backgroundColor = this.getDatasetColor(index, 0.1);
            dataset.pointBackgroundColor = this.getDatasetColor(index);
            dataset.pointBorderColor = colors.background;
            break;
          
          case 'bar':
            dataset.backgroundColor = this.getDatasetColor(index, 0.8);
            dataset.borderColor = this.getDatasetColor(index);
            break;
          
          case 'doughnut':
          case 'pie':
            dataset.backgroundColor = this.generateColorPalette(dataset.data.length);
            dataset.borderColor = colors.background;
            break;
        }
      });

      chart.update('none'); // Update without animation
    });
  }

  /**
   * Merge chart options
   */
  mergeOptions(defaults, custom) {
    return this.deepMerge(defaults, custom);
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Destroy chart
   */
  destroyChart(canvasId) {
    const chart = this.charts.get(canvasId);
    if (chart) {
      chart.destroy();
      this.charts.delete(canvasId);
    }
  }

  /**
   * Destroy all charts
   */
  destroyAllCharts() {
    this.charts.forEach((chart, canvasId) => {
      chart.destroy();
    });
    this.charts.clear();
  }

  /**
   * Get chart instance
   */
  getChart(canvasId) {
    return this.charts.get(canvasId);
  }

  /**
   * Update chart data
   */
  updateChartData(canvasId, newData) {
    const chart = this.charts.get(canvasId);
    if (chart) {
      chart.data = this.applyThemeToData(newData, chart.config.type);
      chart.update();
    }
  }

  /**
   * Resize all charts
   */
  resizeCharts() {
    this.charts.forEach(chart => {
      chart.resize();
    });
  }

  /**
   * Export chart as image
   */
  exportChart(canvasId, filename = 'chart.png') {
    const chart = this.charts.get(canvasId);
    if (chart) {
      const url = chart.toBase64Image();
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
    }
  }

  /**
   * Add drill-down functionality to chart
   */
  addDrillDown(canvasId, drillDownConfig) {
    const chart = this.charts.get(canvasId);
    if (!chart) return;

    const originalOnClick = chart.options.onClick;

    chart.options.onClick = (event, elements) => {
      if (elements.length > 0) {
        const element = elements[0];
        const dataIndex = element.index;
        const datasetIndex = element.datasetIndex;

        const clickedData = {
          label: chart.data.labels[dataIndex],
          value: chart.data.datasets[datasetIndex].data[dataIndex],
          dataIndex,
          datasetIndex,
          chartId: canvasId
        };

        this.handleDrillDown(clickedData, drillDownConfig);
      }

      // Call original onClick if it exists
      if (originalOnClick) {
        originalOnClick.call(chart, event, elements);
      }
    };

    chart.update();
  }

  /**
   * Handle drill-down action
   */
  handleDrillDown(clickedData, config) {
    if (config.onDrillDown && typeof config.onDrillDown === 'function') {
      config.onDrillDown(clickedData);
    }

    // Show drill-down modal or panel
    this.showDrillDownModal(clickedData, config);
  }

  /**
   * Show drill-down modal with detailed data
   */
  showDrillDownModal(clickedData, config) {
    const modal = document.createElement('div');
    modal.className = 'drill-down-modal';
    modal.innerHTML = `
      <div class="drill-down-content">
        <div class="drill-down-header">
          <h3>Detailed View: ${clickedData.label}</h3>
          <button class="close-drill-down" aria-label="Close">&times;</button>
        </div>
        <div class="drill-down-body">
          <div class="drill-down-summary">
            <div class="summary-item">
              <span class="summary-label">Value:</span>
              <span class="summary-value">${clickedData.value}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Category:</span>
              <span class="summary-value">${clickedData.label}</span>
            </div>
          </div>
          <div class="drill-down-chart-container">
            <canvas id="drillDownChart"></canvas>
          </div>
          <div class="drill-down-actions">
            <button class="btn btn-primary" onclick="window.chartManager.exportDrillDownData('${clickedData.chartId}', '${clickedData.label}')">
              Export Data
            </button>
            <button class="btn btn-secondary" onclick="window.chartManager.closeDrillDown()">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelector('.close-drill-down').addEventListener('click', () => {
      this.closeDrillDown();
    });

    // Create drill-down chart if data is available
    if (config.drillDownData && config.drillDownData[clickedData.label]) {
      this.createDrillDownChart(config.drillDownData[clickedData.label]);
    }

    // Show modal
    setTimeout(() => modal.classList.add('show'), 10);
  }

  /**
   * Create drill-down chart
   */
  createDrillDownChart(data) {
    const canvas = document.getElementById('drillDownChart');
    if (!canvas) return;

    const chart = new Chart(canvas, {
      type: data.type || 'bar',
      data: data,
      options: {
        ...this.defaultOptions,
        plugins: {
          ...this.defaultOptions.plugins,
          title: {
            display: true,
            text: data.title || 'Detailed Breakdown'
          }
        }
      }
    });

    this.charts.set('drillDownChart', chart);
  }

  /**
   * Close drill-down modal
   */
  closeDrillDown() {
    const modal = document.querySelector('.drill-down-modal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.remove();
        // Clean up drill-down chart
        const drillChart = this.charts.get('drillDownChart');
        if (drillChart) {
          drillChart.destroy();
          this.charts.delete('drillDownChart');
        }
      }, 300);
    }
  }

  /**
   * Export drill-down data
   */
  exportDrillDownData(chartId, category) {
    const data = {
      chartId,
      category,
      timestamp: new Date().toISOString(),
      exportType: 'drill-down'
    };

    // Trigger export via dashboard manager
    if (window.dashboardManager) {
      window.dashboardManager.exportData('drill-down', data);
    }
  }

  /**
   * Add chart annotations
   */
  addAnnotation(canvasId, annotation) {
    const chart = this.charts.get(canvasId);
    if (!chart) return;

    if (!chart.options.plugins.annotation) {
      chart.options.plugins.annotation = { annotations: {} };
    }

    chart.options.plugins.annotation.annotations[annotation.id] = annotation;
    chart.update();
  }

  /**
   * Remove chart annotation
   */
  removeAnnotation(canvasId, annotationId) {
    const chart = this.charts.get(canvasId);
    if (!chart || !chart.options.plugins.annotation) return;

    delete chart.options.plugins.annotation.annotations[annotationId];
    chart.update();
  }

  /**
   * Highlight chart data points
   */
  highlightDataPoints(canvasId, indices) {
    const chart = this.charts.get(canvasId);
    if (!chart) return;

    // Store original colors
    if (!chart._originalColors) {
      chart._originalColors = chart.data.datasets.map(dataset => ({
        backgroundColor: [...(dataset.backgroundColor || [])],
        borderColor: [...(dataset.borderColor || [])]
      }));
    }

    // Reset to original colors
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (chart._originalColors[datasetIndex]) {
        dataset.backgroundColor = [...chart._originalColors[datasetIndex].backgroundColor];
        dataset.borderColor = [...chart._originalColors[datasetIndex].borderColor];
      }
    });

    // Highlight specified indices
    indices.forEach(index => {
      chart.data.datasets.forEach(dataset => {
        if (Array.isArray(dataset.backgroundColor)) {
          dataset.backgroundColor[index] = '#ff6b6b';
        }
        if (Array.isArray(dataset.borderColor)) {
          dataset.borderColor[index] = '#ff5252';
        }
      });
    });

    chart.update();
  }

  /**
   * Clear chart highlights
   */
  clearHighlights(canvasId) {
    const chart = this.charts.get(canvasId);
    if (!chart || !chart._originalColors) return;

    // Restore original colors
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (chart._originalColors[datasetIndex]) {
        dataset.backgroundColor = [...chart._originalColors[datasetIndex].backgroundColor];
        dataset.borderColor = [...chart._originalColors[datasetIndex].borderColor];
      }
    });

    chart.update();
  }
}

// Initialize chart manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.chartManager = new ChartManager();
  });
} else {
  window.chartManager = new ChartManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartManager;
}
