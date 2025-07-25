/**
 * @file EXPORT-MANAGER.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Export Manager
 * Handles exporting dashboard data in multiple formats including
 * PDF, Excel, CSV, JSON, and image formats with customizable options.
 */

// ------------ MAIN
class ExportManager {
  constructor() {
    this.exportFormats = {
      pdf: { name: 'PDF Report', extension: 'pdf', mimeType: 'application/pdf' },
      excel: { name: 'Excel Spreadsheet', extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      csv: { name: 'CSV Data', extension: 'csv', mimeType: 'text/csv' },
      json: { name: 'JSON Data', extension: 'json', mimeType: 'application/json' },
      png: { name: 'PNG Image', extension: 'png', mimeType: 'image/png' },
      svg: { name: 'SVG Vector', extension: 'svg', mimeType: 'image/svg+xml' }
    };
    
    this.exportOptions = {
      includeCharts: true,
      includeMetrics: true,
      includeInsights: true,
      includeFilters: true,
      dateRange: 'all',
      theme: 'current'
    };

    this.init();
  }

  /**
   * Initialize export manager
   */
  init() {
    this.createExportUI();
    this.setupEventListeners();
  }

  /**
   * Create export UI
   */
  createExportUI() {
    const exportModal = document.createElement('div');
    exportModal.className = 'export-modal';
    exportModal.id = 'exportModal';
    exportModal.innerHTML = `
      <div class="export-modal-content">
        <div class="export-modal-header">
          <h3>Export Dashboard</h3>
          <button class="close-export-modal" aria-label="Close">&times;</button>
        </div>
        
        <div class="export-modal-body">
          <div class="export-format-selection">
            <h4>Export Format</h4>
            <div class="format-options">
              ${Object.entries(this.exportFormats).map(([key, format]) => `
                <label class="format-option">
                  <input type="radio" name="exportFormat" value="${key}" ${key === 'pdf' ? 'checked' : ''}>
                  <span class="format-icon">${this.getFormatIcon(key)}</span>
                  <span class="format-name">${format.name}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="export-options">
            <h4>Export Options</h4>
            
            <div class="option-group">
              <label class="option-label">Include Content</label>
              <div class="checkbox-group">
                <label><input type="checkbox" name="includeCharts" checked> Charts</label>
                <label><input type="checkbox" name="includeMetrics" checked> Metrics</label>
                <label><input type="checkbox" name="includeInsights" checked> Insights</label>
                <label><input type="checkbox" name="includeFilters" checked> Applied Filters</label>
              </div>
            </div>

            <div class="option-group">
              <label class="option-label">Date Range</label>
              <select name="dateRange" class="export-select">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            <div class="option-group custom-date-range" style="display: none;">
              <label class="option-label">Custom Date Range</label>
              <div class="date-inputs">
                <input type="date" name="startDate" class="export-input">
                <span>to</span>
                <input type="date" name="endDate" class="export-input">
              </div>
            </div>

            <div class="option-group">
              <label class="option-label">Theme</label>
              <select name="theme" class="export-select">
                <option value="current">Current Theme</option>
                <option value="light">Light Theme</option>
                <option value="dark">Dark Theme</option>
                <option value="print">Print Optimized</option>
              </select>
            </div>

            <div class="option-group format-specific-options">
              <!-- Populated based on selected format -->
            </div>
          </div>

          <div class="export-preview">
            <h4>Preview</h4>
            <div class="preview-container">
              <div class="preview-placeholder">
                Select options to see preview
              </div>
            </div>
          </div>
        </div>

        <div class="export-modal-footer">
          <div class="export-progress" style="display: none;">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <span class="progress-text">Preparing export...</span>
          </div>
          
          <div class="export-actions">
            <button class="btn btn-secondary" onclick="window.exportManager.closeExportModal()">Cancel</button>
            <button class="btn btn-primary" onclick="window.exportManager.startExport()">Export</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(exportModal);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Format selection change
    document.addEventListener('change', (e) => {
      if (e.target.name === 'exportFormat') {
        this.updateFormatSpecificOptions(e.target.value);
        this.updatePreview();
      }
    });

    // Date range change
    document.addEventListener('change', (e) => {
      if (e.target.name === 'dateRange') {
        const customRange = document.querySelector('.custom-date-range');
        customRange.style.display = e.target.value === 'custom' ? 'block' : 'none';
        this.updatePreview();
      }
    });

    // Option changes
    document.addEventListener('change', (e) => {
      if (e.target.closest('.export-options')) {
        this.updateExportOptions();
        this.updatePreview();
      }
    });

    // Close modal
    document.addEventListener('click', (e) => {
      if (e.target.matches('.close-export-modal')) {
        this.closeExportModal();
      }
    });
  }

  /**
   * Get format icon
   */
  getFormatIcon(format) {
    const icons = {
      pdf: '📄',
      excel: '📊',
      csv: '📋',
      json: '🔧',
      png: '🖼️',
      svg: '🎨'
    };
    return icons[format] || '📁';
  }

  /**
   * Show export modal
   */
  showExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
      modal.classList.add('show');
      this.updatePreview();
    }
  }

  /**
   * Close export modal
   */
  closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  /**
   * Update format-specific options
   */
  updateFormatSpecificOptions(format) {
    const container = document.querySelector('.format-specific-options');
    
    switch (format) {
      case 'pdf':
        container.innerHTML = `
          <label class="option-label">PDF Options</label>
          <div class="checkbox-group">
            <label><input type="checkbox" name="pdfPageNumbers" checked> Page Numbers</label>
            <label><input type="checkbox" name="pdfTableOfContents" checked> Table of Contents</label>
            <label><input type="checkbox" name="pdfHighResolution" checked> High Resolution</label>
          </div>
          <div class="select-group">
            <label>Page Size:</label>
            <select name="pdfPageSize">
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </div>
        `;
        break;
      
      case 'excel':
        container.innerHTML = `
          <label class="option-label">Excel Options</label>
          <div class="checkbox-group">
            <label><input type="checkbox" name="excelMultipleSheets" checked> Multiple Sheets</label>
            <label><input type="checkbox" name="excelChartImages" checked> Include Chart Images</label>
            <label><input type="checkbox" name="excelFormatting" checked> Apply Formatting</label>
          </div>
        `;
        break;
      
      case 'csv':
        container.innerHTML = `
          <label class="option-label">CSV Options</label>
          <div class="select-group">
            <label>Delimiter:</label>
            <select name="csvDelimiter">
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value="\t">Tab</option>
            </select>
          </div>
          <div class="checkbox-group">
            <label><input type="checkbox" name="csvHeaders" checked> Include Headers</label>
          </div>
        `;
        break;
      
      case 'png':
      case 'svg':
        container.innerHTML = `
          <label class="option-label">Image Options</label>
          <div class="select-group">
            <label>Resolution:</label>
            <select name="imageResolution">
              <option value="1x">Standard (1x)</option>
              <option value="2x">High (2x)</option>
              <option value="3x">Ultra (3x)</option>
            </select>
          </div>
          <div class="checkbox-group">
            <label><input type="checkbox" name="imageTransparent"> Transparent Background</label>
          </div>
        `;
        break;
      
      default:
        container.innerHTML = '';
    }
  }

  /**
   * Update export options
   */
  updateExportOptions() {
    const form = document.querySelector('.export-modal');
    const formData = new FormData(form);
    
    // Update options object
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('include') || key.endsWith('Headers') || key.endsWith('Numbers')) {
        this.exportOptions[key] = true;
      } else {
        this.exportOptions[key] = value;
      }
    }

    // Handle unchecked checkboxes
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      if (!formData.has(checkbox.name)) {
        this.exportOptions[checkbox.name] = false;
      }
    });
  }

  /**
   * Update preview
   */
  updatePreview() {
    const previewContainer = document.querySelector('.preview-container');
    const selectedFormat = document.querySelector('input[name="exportFormat"]:checked')?.value;
    
    if (!selectedFormat) return;

    const previewContent = this.generatePreviewContent(selectedFormat);
    previewContainer.innerHTML = previewContent;
  }

  /**
   * Generate preview content
   */
  generatePreviewContent(format) {
    const options = this.exportOptions;
    
    let content = `<div class="preview-header">Export Preview - ${this.exportFormats[format].name}</div>`;
    
    if (options.includeMetrics) {
      content += `<div class="preview-section">📊 Metrics Summary</div>`;
    }
    
    if (options.includeCharts) {
      content += `<div class="preview-section">📈 Charts and Visualizations</div>`;
    }
    
    if (options.includeInsights) {
      content += `<div class="preview-section">💡 Insights and Analysis</div>`;
    }
    
    if (options.includeFilters) {
      content += `<div class="preview-section">🔍 Applied Filters</div>`;
    }

    content += `<div class="preview-footer">Format: ${format.toUpperCase()} | Theme: ${options.theme}</div>`;
    
    return content;
  }

  /**
   * Start export process
   */
  async startExport() {
    this.updateExportOptions();
    const selectedFormat = document.querySelector('input[name="exportFormat"]:checked')?.value;
    
    if (!selectedFormat) {
      this.showNotification('Please select an export format', 'error');
      return;
    }

    this.showProgress('Preparing export...');

    try {
      const data = await this.collectExportData();
      const result = await this.exportData(selectedFormat, data);
      
      this.hideProgress();
      this.downloadFile(result, selectedFormat);
      this.closeExportModal();
      this.showNotification('Export completed successfully', 'success');
      
    } catch (error) {
      this.hideProgress();
      this.showNotification(`Export failed: ${error.message}`, 'error');
    }
  }

  /**
   * Collect data for export
   */
  async collectExportData() {
    const data = {
      metadata: {
        exportDate: new Date().toISOString(),
        format: document.querySelector('input[name="exportFormat"]:checked')?.value,
        options: { ...this.exportOptions }
      }
    };

    if (this.exportOptions.includeMetrics) {
      data.metrics = this.collectMetricsData();
    }

    if (this.exportOptions.includeCharts) {
      data.charts = await this.collectChartsData();
    }

    if (this.exportOptions.includeInsights) {
      data.insights = this.collectInsightsData();
    }

    if (this.exportOptions.includeFilters && window.filterManager) {
      data.filters = window.filterManager.activeFilters;
    }

    return data;
  }

  /**
   * Collect metrics data
   */
  collectMetricsData() {
    const metrics = [];
    
    document.querySelectorAll('.metric-card').forEach(card => {
      const label = card.querySelector('.metric-label')?.textContent || '';
      const value = card.querySelector('.metric-value')?.textContent || '';
      const change = card.querySelector('.metric-change')?.textContent || '';
      
      metrics.push({ label, value, change });
    });

    return metrics;
  }

  /**
   * Collect charts data
   */
  async collectChartsData() {
    const charts = [];
    
    if (window.chartManager) {
      for (const [chartId, chart] of window.chartManager.charts) {
        const chartData = {
          id: chartId,
          type: chart.config.type,
          data: chart.data,
          options: chart.options
        };

        // Get chart image
        if (this.exportOptions.includeCharts) {
          chartData.image = chart.toBase64Image();
        }

        charts.push(chartData);
      }
    }

    return charts;
  }

  /**
   * Collect insights data
   */
  collectInsightsData() {
    const insights = [];
    
    document.querySelectorAll('.insight-item').forEach(item => {
      const title = item.querySelector('.insight-title')?.textContent || '';
      const description = item.querySelector('.insight-description')?.textContent || '';
      const type = item.querySelector('.insight-type')?.textContent || '';
      
      insights.push({ title, description, type });
    });

    return insights;
  }

  /**
   * Export data in specified format
   */
  async exportData(format, data) {
    switch (format) {
      case 'json':
        return this.exportAsJSON(data);
      case 'csv':
        return this.exportAsCSV(data);
      case 'pdf':
        return await this.exportAsPDF(data);
      case 'excel':
        return await this.exportAsExcel(data);
      case 'png':
        return await this.exportAsPNG(data);
      case 'svg':
        return await this.exportAsSVG(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as JSON
   */
  exportAsJSON(data) {
    return {
      content: JSON.stringify(data, null, 2),
      filename: `dashboard-export-${new Date().toISOString().split('T')[0]}.json`
    };
  }

  /**
   * Export as CSV
   */
  exportAsCSV(data) {
    const delimiter = this.exportOptions.csvDelimiter || ',';
    let csv = '';

    if (data.metrics && data.metrics.length > 0) {
      csv += 'Metrics\n';
      if (this.exportOptions.csvHeaders) {
        csv += `Label${delimiter}Value${delimiter}Change\n`;
      }
      
      data.metrics.forEach(metric => {
        csv += `"${metric.label}"${delimiter}"${metric.value}"${delimiter}"${metric.change}"\n`;
      });
      csv += '\n';
    }

    if (data.insights && data.insights.length > 0) {
      csv += 'Insights\n';
      if (this.exportOptions.csvHeaders) {
        csv += `Title${delimiter}Description${delimiter}Type\n`;
      }
      
      data.insights.forEach(insight => {
        csv += `"${insight.title}"${delimiter}"${insight.description}"${delimiter}"${insight.type}"\n`;
      });
    }

    return {
      content: csv,
      filename: `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`
    };
  }

  /**
   * Export as PDF (simplified - would need PDF library in real implementation)
   */
  async exportAsPDF(data) {
    // This would require a PDF library like jsPDF
    // TODO: For now, return a placeholder
    return {
      content: 'PDF export TODO: Would be implemented with jsPDF library',
      filename: `dashboard-export-${new Date().toISOString().split('T')[0]}.pdf`
    };
  }

  /**
   * Export as Excel (simplified - would need Excel library)
   */
  async exportAsExcel(data) {
    // This would require a library like SheetJS
    return {
      content: 'Excel export TODO: Would be implemented with SheetJS library',
      filename: `dashboard-export-${new Date().toISOString().split('T')[0]}.xlsx`
    };
  }

  /**
   * Export as PNG
   */
  async exportAsPNG(data) {
    // Capture dashboard as image
    const dashboard = document.querySelector('.dashboard-content');
    // This would use html2canvas or similar library
    return {
      content: 'PNG export TODO: Would be implemented with html2canvas',
      filename: `dashboard-export-${new Date().toISOString().split('T')[0]}.png`
    };
  }

  /**
   * Export as SVG
   */
  async exportAsSVG(data) {
    // Generate SVG representation
    return {
      content: 'SVG export TODO: Would be implemented with custom SVG generation',
      filename: `dashboard-export-${new Date().toISOString().split('T')[0]}.svg`
    };
  }

  /**
   * Download file
   */
  downloadFile(result, format) {
    const blob = new Blob([result.content], { 
      type: this.exportFormats[format].mimeType 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Show progress
   */
  showProgress(message) {
    const progress = document.querySelector('.export-progress');
    const text = document.querySelector('.progress-text');
    
    if (progress && text) {
      text.textContent = message;
      progress.style.display = 'block';
    }
  }

  /**
   * Hide progress
   */
  hideProgress() {
    const progress = document.querySelector('.export-progress');
    if (progress) {
      progress.style.display = 'none';
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type) {
    if (window.dashboardManager) {
      window.dashboardManager.showNotification(message, type);
    }
  }
}
