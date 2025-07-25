/**
 * @file REPORTING-MANAGER.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Reporting Manager
 * Frontend component for managing report generation, scheduling,
 * and viewing report history with comprehensive UI controls.
 */

// ------------ MAIN
class ReportingManager {
  constructor() {
    this.currentReports = [];
    this.scheduledReports = [];
    this.reportHistory = [];
    this.reportingStats = null;
    
    this.init();
  }

  /**
   * Initialize reporting manager
   */
  init() {
    this.createReportingUI();
    this.setupEventListeners();
    this.loadInitialData();
  }

  /**
   * Create reporting dashboard UI
   */
  createReportingUI() {
    const reportingContainer = document.createElement('div');
    reportingContainer.className = 'reporting-manager-container';
    reportingContainer.innerHTML = `
      <div class="reporting-header">
        <h2>📊 Report Management</h2>
        <div class="reporting-actions">
          <button id="generateReportBtn" class="btn btn-primary">
            <span class="btn-icon">📄</span>
            Generate Report
          </button>
          <button id="scheduleReportBtn" class="btn btn-secondary">
            <span class="btn-icon">⏰</span>
            Schedule Report
          </button>
          <button id="reportSettingsBtn" class="btn btn-outline">
            <span class="btn-icon">⚙️</span>
            Settings
          </button>
        </div>
      </div>

      <div class="reporting-stats" id="reportingStats">
        <!-- Stats cards will be populated here -->
      </div>

      <div class="reporting-tabs">
        <button class="reporting-tab active" data-tab="generate">Generate</button>
        <button class="reporting-tab" data-tab="scheduled">Scheduled</button>
        <button class="reporting-tab" data-tab="history">History</button>
        <button class="reporting-tab" data-tab="templates">Templates</button>
      </div>

      <div class="reporting-content">
        <!-- Generate Tab -->
        <div class="reporting-tab-content active" id="generateTab">
          <div class="report-generator">
            <div class="generator-form">
              <div class="form-section">
                <h3>Report Configuration</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="reportType">Report Type</label>
                    <select id="reportType" class="form-control">
                      <option value="individual">Individual Report</option>
                      <option value="team">Team Summary</option>
                      <option value="project">Project Report</option>
                      <option value="executive">Executive Summary</option>
                      <option value="cicd">CI/CD Report</option>
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label for="reportFormat">Format</label>
                    <select id="reportFormat" class="form-control">
                      <option value="pdf">PDF</option>
                      <option value="html">HTML</option>
                      <option value="json">JSON</option>
                      <option value="csv">CSV</option>
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label for="reportTemplate">Template</label>
                    <select id="reportTemplate" class="form-control">
                      <option value="default">Default</option>
                      <option value="team-summary">Team Summary</option>
                      <option value="executive-summary">Executive Summary</option>
                      <option value="cicd-integration">CI/CD Integration</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="form-section">
                <h3>Time Range</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="timeRangePreset">Preset Range</label>
                    <select id="timeRangePreset" class="form-control">
                      <option value="last7days">Last 7 Days</option>
                      <option value="last30days" selected>Last 30 Days</option>
                      <option value="last90days">Last 90 Days</option>
                      <option value="thisMonth">This Month</option>
                      <option value="lastMonth">Last Month</option>
                      <option value="thisQuarter">This Quarter</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  
                  <div class="form-group custom-range" style="display: none;">
                    <label for="startDate">Start Date</label>
                    <input type="date" id="startDate" class="form-control">
                  </div>
                  
                  <div class="form-group custom-range" style="display: none;">
                    <label for="endDate">End Date</label>
                    <input type="date" id="endDate" class="form-control">
                  </div>
                </div>
              </div>

              <div class="form-section">
                <h3>Filters & Options</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="projectFilter">Projects</label>
                    <select id="projectFilter" class="form-control" multiple>
                      <option value="all">All Projects</option>
                      <!-- Projects will be populated dynamically -->
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label for="languageFilter">Languages</label>
                    <select id="languageFilter" class="form-control" multiple>
                      <option value="all">All Languages</option>
                      <!-- Languages will be populated dynamically -->
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label for="metricsFilter">Metrics</label>
                    <select id="metricsFilter" class="form-control" multiple>
                      <option value="productivity" selected>Productivity</option>
                      <option value="quality" selected>Code Quality</option>
                      <option value="velocity" selected>Velocity</option>
                      <option value="complexity" selected>Complexity</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button id="previewReportBtn" class="btn btn-outline">
                  <span class="btn-icon">👁️</span>
                  Preview
                </button>
                <button id="generateNowBtn" class="btn btn-primary">
                  <span class="btn-icon">🚀</span>
                  Generate Report
                </button>
              </div>
            </div>

            <div class="generation-progress" id="generationProgress" style="display: none;">
              <div class="progress-header">
                <h4>Generating Report...</h4>
                <button id="cancelGenerationBtn" class="btn btn-sm btn-outline">Cancel</button>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
              <div class="progress-status" id="progressStatus">Initializing...</div>
            </div>
          </div>
        </div>

        <!-- Scheduled Tab -->
        <div class="reporting-tab-content" id="scheduledTab">
          <div class="scheduled-reports">
            <div class="scheduled-header">
              <h3>Scheduled Reports</h3>
              <button id="addScheduleBtn" class="btn btn-primary">
                <span class="btn-icon">➕</span>
                Add Schedule
              </button>
            </div>
            
            <div class="scheduled-list" id="scheduledList">
              <!-- Scheduled reports will be populated here -->
            </div>
          </div>
        </div>

        <!-- History Tab -->
        <div class="reporting-tab-content" id="historyTab">
          <div class="report-history">
            <div class="history-header">
              <h3>Report History</h3>
              <div class="history-filters">
                <select id="historyTypeFilter" class="form-control">
                  <option value="all">All Types</option>
                  <option value="individual">Individual</option>
                  <option value="team">Team</option>
                  <option value="project">Project</option>
                  <option value="executive">Executive</option>
                  <option value="cicd">CI/CD</option>
                </select>
                <select id="historyFormatFilter" class="form-control">
                  <option value="all">All Formats</option>
                  <option value="pdf">PDF</option>
                  <option value="html">HTML</option>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
                <button id="clearHistoryBtn" class="btn btn-outline btn-sm">
                  Clear History
                </button>
              </div>
            </div>
            
            <div class="history-list" id="historyList">
              <!-- Report history will be populated here -->
            </div>
          </div>
        </div>

        <!-- Templates Tab -->
        <div class="reporting-tab-content" id="templatesTab">
          <div class="report-templates">
            <div class="templates-header">
              <h3>Report Templates</h3>
              <button id="createTemplateBtn" class="btn btn-primary">
                <span class="btn-icon">🎨</span>
                Create Template
              </button>
            </div>
            
            <div class="templates-grid" id="templatesGrid">
              <!-- Templates will be populated here -->
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div id="scheduleModal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Schedule Report</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Schedule form will be populated here -->
          </div>
        </div>
      </div>

      <div id="previewModal" class="modal" style="display: none;">
        <div class="modal-content large">
          <div class="modal-header">
            <h3>Report Preview</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="previewContent">
              <!-- Preview content will be populated here -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to dashboard
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
      dashboardContent.appendChild(reportingContainer);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.addEventListener('click', (e) => {
      if (e.target.matches('.reporting-tab')) {
        this.switchTab(e.target.dataset.tab);
      }
    });

    // Main actions
    document.getElementById('generateReportBtn')?.addEventListener('click', () => {
      this.switchTab('generate');
    });

    document.getElementById('scheduleReportBtn')?.addEventListener('click', () => {
      this.showScheduleModal();
    });

    document.getElementById('reportSettingsBtn')?.addEventListener('click', () => {
      this.showSettingsModal();
    });

    // Generate form
    document.getElementById('timeRangePreset')?.addEventListener('change', (e) => {
      this.toggleCustomRange(e.target.value === 'custom');
    });

    document.getElementById('previewReportBtn')?.addEventListener('click', () => {
      this.previewReport();
    });

    document.getElementById('generateNowBtn')?.addEventListener('click', () => {
      this.generateReport();
    });

    document.getElementById('cancelGenerationBtn')?.addEventListener('click', () => {
      this.cancelGeneration();
    });

    // Scheduled reports
    document.getElementById('addScheduleBtn')?.addEventListener('click', () => {
      this.showScheduleModal();
    });

    // History filters
    document.getElementById('historyTypeFilter')?.addEventListener('change', () => {
      this.filterHistory();
    });

    document.getElementById('historyFormatFilter')?.addEventListener('change', () => {
      this.filterHistory();
    });

    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
      this.clearHistory();
    });

    // Templates
    document.getElementById('createTemplateBtn')?.addEventListener('click', () => {
      this.showTemplateEditor();
    });

    // Modal close handlers
    document.addEventListener('click', (e) => {
      if (e.target.matches('.modal-close') || e.target.matches('.modal')) {
        this.closeModals();
      }
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      await Promise.all([
        this.loadReportingStats(),
        this.loadScheduledReports(),
        this.loadReportHistory(),
        this.loadAvailableTemplates()
      ]);
    } catch (error) {
      console.error('Failed to load initial reporting data:', error);
      this.showError('Failed to load reporting data');
    }
  }

  /**
   * Load reporting statistics
   */
  async loadReportingStats() {
    try {
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'getReportingStats'
        });
      } else {
        // Mock data for development
        this.handleReportingStats({
          totalReports: 45,
          reportsThisMonth: 12,
          scheduledReports: 3,
          failedReports: 2,
          averageGenerationTime: 4500,
          mostPopularFormat: 'pdf',
          storageUsed: 125000000
        });
      }
    } catch (error) {
      console.error('Failed to load reporting stats:', error);
    }
  }

  /**
   * Handle reporting statistics data
   */
  handleReportingStats(stats) {
    this.reportingStats = stats;
    this.updateStatsDisplay(stats);
  }

  /**
   * Update statistics display
   */
  updateStatsDisplay(stats) {
    const statsContainer = document.getElementById('reportingStats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-value">${stats.totalReports}</div>
            <div class="stat-label">Total Reports</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-value">${stats.reportsThisMonth}</div>
            <div class="stat-label">This Month</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">⏰</div>
          <div class="stat-content">
            <div class="stat-value">${stats.scheduledReports}</div>
            <div class="stat-label">Scheduled</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-content">
            <div class="stat-value">${(stats.averageGenerationTime / 1000).toFixed(1)}s</div>
            <div class="stat-label">Avg Generation</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">💾</div>
          <div class="stat-content">
            <div class="stat-value">${this.formatFileSize(stats.storageUsed)}</div>
            <div class="stat-label">Storage Used</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-content">
            <div class="stat-value">${stats.mostPopularFormat.toUpperCase()}</div>
            <div class="stat-label">Popular Format</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Switch reporting tab
   */
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.reporting-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.reporting-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    // Load tab-specific data
    switch (tabName) {
      case 'scheduled':
        this.loadScheduledReports();
        break;
      case 'history':
        this.loadReportHistory();
        break;
      case 'templates':
        this.loadAvailableTemplates();
        break;
    }
  }

  /**
   * Toggle custom date range inputs
   */
  toggleCustomRange(show) {
    const customRangeInputs = document.querySelectorAll('.custom-range');
    customRangeInputs.forEach(input => {
      input.style.display = show ? 'block' : 'none';
    });
  }

  /**
   * Generate report
   */
  async generateReport() {
    try {
      const config = this.getReportConfig();
      this.showGenerationProgress();

      if (window.vscode) {
        window.vscode.postMessage({
          command: 'generateReport',
          config
        });
      } else {
        // Mock generation for development
        this.simulateReportGeneration();
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      this.hideGenerationProgress();
      this.showError('Failed to generate report');
    }
  }

  /**
   * Get report configuration from form
   */
  getReportConfig() {
    const type = document.getElementById('reportType')?.value || 'individual';
    const format = document.getElementById('reportFormat')?.value || 'pdf';
    const template = document.getElementById('reportTemplate')?.value || 'default';
    const timeRangePreset = document.getElementById('timeRangePreset')?.value || 'last30days';
    
    let timeRange;
    if (timeRangePreset === 'custom') {
      const startDate = document.getElementById('startDate')?.value;
      const endDate = document.getElementById('endDate')?.value;
      timeRange = {
        start: new Date(startDate).getTime(),
        end: new Date(endDate).getTime()
      };
    } else {
      timeRange = this.getPresetTimeRange(timeRangePreset);
    }

    const projects = Array.from(document.getElementById('projectFilter')?.selectedOptions || [])
      .map(option => option.value)
      .filter(value => value !== 'all');

    const languages = Array.from(document.getElementById('languageFilter')?.selectedOptions || [])
      .map(option => option.value)
      .filter(value => value !== 'all');

    const metrics = Array.from(document.getElementById('metricsFilter')?.selectedOptions || [])
      .map(option => option.value);

    return {
      type,
      format,
      template,
      timeRange,
      filters: {
        projects: projects.length > 0 ? projects : undefined,
        languages: languages.length > 0 ? languages : undefined,
        metrics: metrics.length > 0 ? metrics : undefined
      }
    };
  }

  /**
   * Get preset time range
   */
  getPresetTimeRange(preset) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    switch (preset) {
      case 'last7days':
        return { start: now - (7 * day), end: now };
      case 'last30days':
        return { start: now - (30 * day), end: now };
      case 'last90days':
        return { start: now - (90 * day), end: now };
      case 'thisMonth':
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        return { start: thisMonth.getTime(), end: now };
      case 'lastMonth':
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setDate(1);
        lastMonth.setHours(0, 0, 0, 0);
        const lastMonthEnd = new Date(lastMonth);
        lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
        lastMonthEnd.setDate(0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        return { start: lastMonth.getTime(), end: lastMonthEnd.getTime() };
      case 'thisQuarter':
        const quarter = Math.floor(new Date().getMonth() / 3);
        const quarterStart = new Date(new Date().getFullYear(), quarter * 3, 1);
        return { start: quarterStart.getTime(), end: now };
      default:
        return { start: now - (30 * day), end: now };
    }
  }

  /**
   * Show generation progress
   */
  showGenerationProgress() {
    const form = document.querySelector('.generator-form');
    const progress = document.getElementById('generationProgress');
    
    if (form) form.style.display = 'none';
    if (progress) progress.style.display = 'block';
    
    this.updateProgress(0, 'Initializing report generation...');
  }

  /**
   * Hide generation progress
   */
  hideGenerationProgress() {
    const form = document.querySelector('.generator-form');
    const progress = document.getElementById('generationProgress');
    
    if (form) form.style.display = 'block';
    if (progress) progress.style.display = 'none';
  }

  /**
   * Update progress
   */
  updateProgress(percentage, status) {
    const progressFill = document.getElementById('progressFill');
    const progressStatus = document.getElementById('progressStatus');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressStatus) progressStatus.textContent = status;
  }

  /**
   * Simulate report generation for development
   */
  simulateReportGeneration() {
    let progress = 0;
    const steps = [
      'Collecting metrics data...',
      'Analyzing trends...',
      'Generating insights...',
      'Creating visualizations...',
      'Formatting report...',
      'Finalizing document...'
    ];
    
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        this.updateProgress(100, 'Report generated successfully!');
        setTimeout(() => {
          this.hideGenerationProgress();
          this.showSuccess('Report generated successfully!');
          this.loadReportHistory(); // Refresh history
        }, 1000);
      } else {
        const stepIndex = Math.floor((progress / 100) * steps.length);
        this.updateProgress(progress, steps[stepIndex] || 'Processing...');
      }
    }, 500);
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    if (window.dashboardManager) {
      window.dashboardManager.showNotification(message, 'success');
    } else {
      console.log('Success:', message);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (window.dashboardManager) {
      window.dashboardManager.showNotification(message, 'error');
    } else {
      console.error('Error:', message);
    }
  }

  /**
   * Load scheduled reports
   */
  async loadScheduledReports() {
    try {
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'getScheduledReports'
        });
      } else {
        // Mock data
        this.handleScheduledReports([
          {
            id: 'schedule_1',
            name: 'Weekly Team Report',
            type: 'team',
            frequency: 'weekly',
            nextRun: Date.now() + 86400000,
            status: 'active'
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load scheduled reports:', error);
    }
  }

  /**
   * Load report history
   */
  async loadReportHistory() {
    try {
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'getReportHistory'
        });
      } else {
        // Mock data
        this.handleReportHistory([
          {
            id: 'report_1',
            title: 'Team Summary Report',
            type: 'team',
            format: 'pdf',
            generatedAt: Date.now() - 3600000,
            fileSize: 2048000
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load report history:', error);
    }
  }

  /**
   * Load available templates
   */
  async loadAvailableTemplates() {
    try {
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'getReportTemplates'
        });
      } else {
        // Mock data
        this.handleReportTemplates([
          { id: 'default', name: 'Default Template', type: 'general' },
          { id: 'team-summary', name: 'Team Summary', type: 'team' },
          { id: 'executive-summary', name: 'Executive Summary', type: 'executive' }
        ]);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  /**
   * Handle scheduled reports data
   */
  handleScheduledReports(reports) {
    this.scheduledReports = reports;
    this.updateScheduledReportsList(reports);
  }

  /**
   * Handle report history data
   */
  handleReportHistory(history) {
    this.reportHistory = history;
    this.updateReportHistoryList(history);
  }

  /**
   * Handle report templates data
   */
  handleReportTemplates(templates) {
    this.availableTemplates = templates;
    this.updateTemplatesGrid(templates);
  }

  /**
   * Update scheduled reports list
   */
  updateScheduledReportsList(reports) {
    const listContainer = document.getElementById('scheduledList');
    if (!listContainer) return;

    if (reports.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No scheduled reports</div>';
      return;
    }

    listContainer.innerHTML = reports.map(report => `
      <div class="scheduled-item">
        <div class="scheduled-info">
          <h4>${report.name}</h4>
          <div class="scheduled-meta">
            <span class="report-type">${report.type}</span>
            <span class="report-frequency">${report.frequency}</span>
            <span class="next-run">Next: ${new Date(report.nextRun).toLocaleString()}</span>
          </div>
        </div>
        <div class="scheduled-actions">
          <button class="btn btn-sm btn-outline" onclick="reportingManager.runScheduledReport('${report.id}')">
            Run Now
          </button>
          <button class="btn btn-sm btn-outline" onclick="reportingManager.editScheduledReport('${report.id}')">
            Edit
          </button>
          <button class="btn btn-sm btn-outline" onclick="reportingManager.deleteScheduledReport('${report.id}')">
            Delete
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update report history list
   */
  updateReportHistoryList(history) {
    const listContainer = document.getElementById('historyList');
    if (!listContainer) return;

    if (history.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No reports generated yet</div>';
      return;
    }

    listContainer.innerHTML = history.map(report => `
      <div class="history-item">
        <div class="history-info">
          <h4>${report.title}</h4>
          <div class="history-meta">
            <span class="report-type">${report.type}</span>
            <span class="report-format">${report.format.toUpperCase()}</span>
            <span class="report-size">${this.formatFileSize(report.fileSize)}</span>
            <span class="report-date">${new Date(report.generatedAt).toLocaleString()}</span>
          </div>
        </div>
        <div class="history-actions">
          <button class="btn btn-sm btn-primary" onclick="reportingManager.downloadReport('${report.id}')">
            Download
          </button>
          <button class="btn btn-sm btn-outline" onclick="reportingManager.viewReport('${report.id}')">
            View
          </button>
          <button class="btn btn-sm btn-outline" onclick="reportingManager.shareReport('${report.id}')">
            Share
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update templates grid
   */
  updateTemplatesGrid(templates) {
    const gridContainer = document.getElementById('templatesGrid');
    if (!gridContainer) return;

    gridContainer.innerHTML = templates.map(template => `
      <div class="template-card">
        <div class="template-preview">
          <div class="template-icon">📄</div>
        </div>
        <div class="template-info">
          <h4>${template.name}</h4>
          <div class="template-type">${template.type}</div>
        </div>
        <div class="template-actions">
          <button class="btn btn-sm btn-primary" onclick="reportingManager.useTemplate('${template.id}')">
            Use Template
          </button>
          <button class="btn btn-sm btn-outline" onclick="reportingManager.editTemplate('${template.id}')">
            Edit
          </button>
        </div>
      </div>
    `).join('');
  }

  // Additional methods for report actions
  runScheduledReport(id) { /* Implementation */ }
  editScheduledReport(id) { /* Implementation */ }
  deleteScheduledReport(id) { /* Implementation */ }
  downloadReport(id) { /* Implementation */ }
  viewReport(id) { /* Implementation */ }
  shareReport(id) { /* Implementation */ }
  useTemplate(id) { /* Implementation */ }
  editTemplate(id) { /* Implementation */ }
  previewReport() { /* Implementation */ }
  showScheduleModal() { /* Implementation */ }
  showSettingsModal() { /* Implementation */ }
  showTemplateEditor() { /* Implementation */ }
  filterHistory() { /* Implementation */ }
  clearHistory() { /* Implementation */ }
  cancelGeneration() { /* Implementation */ }
  closeModals() { /* Implementation */ }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.reportingManager = new ReportingManager();
});
