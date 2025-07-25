/**
 * src/views/dashboard.ts
 * 
 * Dashboard View Controller
 * 
 * Handles webview panel management and user interactions for:
 * - Real-time metric visualization
 * - Dashboard refresh functionality
 * - Data export operations
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MetricsChartGenerator } from './charts';
import { MetricsTracker } from '../metrics/tracker';
import { WebSocketManager } from '../services/websocket-manager';
import { AdvancedAnalyticsService } from '../services/advanced-analytics-service';

// -------------------- MAIN EXPORT -------------------- \\

export class ProductivityDashboard {
  private context: vscode.ExtensionContext;
  private chartGenerator: MetricsChartGenerator;
  private metricsTracker: MetricsTracker | null = null;
  private webSocketManager: WebSocketManager | null = null;
  private advancedAnalyticsService: AdvancedAnalyticsService | null = null;

  /**
   * Initialize dashboard components
   * @param context - Extension context for resource management
   * @param metricsTracker - Optional existing MetricsTracker instance
   * @param webSocketManager - Optional WebSocket manager for real-time updates
   */
  constructor(context: vscode.ExtensionContext, metricsTracker?: MetricsTracker, webSocketManager?: WebSocketManager) {
    this.context = context;
    this.chartGenerator = new MetricsChartGenerator(context);
    this.metricsTracker = metricsTracker || null;
    this.webSocketManager = webSocketManager || null;
    this.advancedAnalyticsService = new AdvancedAnalyticsService(context);
  }

  /**
   * Creates and displays the main dashboard interface
   * @remarks
   * - Uses Webview Panel for rich HTML content
   * - Maintains UI state when hidden (retainContextWhenHidden)
   * - Sets up bi-directional communication channel
   * - Includes interactive components
   */
  public show() {

    // Configure webview panel
    const panel = vscode.window.createWebviewPanel(
      'productivityDashboard', // Unique view type ID
      'Code Pulse - Developer Productivity Dashboard', // Panel title
      vscode.ViewColumn.One, // Editor column placement
      {
        enableScripts: true, // Enable JavaScript execution
        retainContextWhenHidden: true, // Maintain UI state when hidden
        localResourceRoots: [this.context.extensionUri] // Allow local resources
      }
    );

    // Set custom icon
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'CP_original.jpg'),
      dark: vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'CP_original.jpg')
    };

    // Initial content rendering with features
    panel.webview.html = this.generateDashboardHTML(panel.webview);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'refreshMetrics':
            this.refreshDashboard(panel);
            break;
          case 'getLatestMetrics':
            this.sendLatestMetrics(panel);
            break;
          case 'getWebSocketPort':
            this.sendWebSocketPort(panel);
            break;
          case 'exportMetrics':
            this.exportMetrics();
            break;
          case 'applyFilters':
            this.applyFilters(panel, message.filters);
            break;
          case 'updateTimeRange':
            this.updateTimeRange(panel, message.timeRange);
            break;
          case 'getInsights':
            this.sendSmartInsights(panel);
            break;
          case 'toggleTheme':
            this.toggleTheme(panel);
            break;
          case 'executeAction':
            this.executeInsightAction(message.actionType, message.metadata);
            break;
          case 'saveTheme':
            this.handleThemeChange(message.theme);
            break;
          case 'getHistoricalAnalytics':
            this.handleHistoricalAnalytics(panel, message);
            break;
          case 'generateAnalyticsReport':
            this.handleGenerateAnalyticsReport(panel, message);
            break;
          case 'getProductivityForecast':
            this.handleProductivityForecast(panel, message);
            break;
          case 'detectRegressions':
            this.handleRegressionDetection(panel);
            break;
          case 'compareProjects':
            this.handleProjectComparison(panel, message);
            break;
          case 'generateReport':
            this.handleGenerateReport(panel, message);
            break;
          case 'getReportingStats':
            this.handleGetReportingStats(panel);
            break;
          case 'getScheduledReports':
            this.handleGetScheduledReports(panel);
            break;
          case 'getReportHistory':
            this.handleGetReportHistory(panel);
            break;
          case 'getReportTemplates':
            this.handleGetReportTemplates(panel);
            break;
          case 'scheduleReport':
            this.handleScheduleReport(panel, message);
            break;
          case 'getSystemHealth':
            this.handleGetSystemHealth(panel);
            break;
          case 'getErrorHistory':
            this.handleGetErrorHistory(panel, message);
            break;
          case 'getPerformanceMetrics':
            this.handleGetPerformanceMetrics(panel);
            break;
          case 'getMemoryData':
            this.handleGetMemoryData(panel);
            break;
          case 'getLogs':
            this.handleGetLogs(panel, message);
            break;
          case 'clearErrors':
            this.handleClearErrors(panel);
            break;
          case 'clearLogs':
            this.handleClearLogs(panel);
            break;
          case 'exportLogs':
            this.handleExportLogs(panel, message);
            break;
          case 'updateMonitoringSettings':
            this.handleUpdateMonitoringSettings(panel, message);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Set up auto-refresh if real-time is enabled
    this.setupAutoRefresh(panel);
  }

  /**
   * Updates dashboard with latest metrics
   * @param panel - Reference to active webview panel
   * @remarks
   * 1. Persists current metrics to storage
   * 2. Regenerates visualization content
   * 3. Displays summary notification
   */
  private refreshDashboard(panel: vscode.WebviewPanel) {

    // Check data persistence before refresh
    if (this.metricsTracker) {
      this.metricsTracker.persistMetrics();
    }

    // Update visualization content
    panel.webview.html = this.chartGenerator.generateDashboardHTML();

    // Show session summary
    if (this.metricsTracker) {
      const insights = this.metricsTracker.getSessionInsights();
      vscode.window.showInformationMessage(
        `Session Insights: ${insights.duration.toFixed(2)} mins, ` +
        `${insights.filesTracked} files tracked`
      );
    } else {
      vscode.window.showInformationMessage('Dashboard refreshed');
    }
  }

  /**
   * Exports metrics data to JSON format
   * @remarks
   * - Uses native save dialog for file selection
   * - Saves data with pretty-printed JSON formatting
   * - Handles both workspace and local file paths
   */
  public exportMetrics() {
    if (!this.metricsTracker) {
      vscode.window.showWarningMessage('No metrics tracker available for export');
      return;
    }

    const metrics = this.metricsTracker.getSessionInsights();

    vscode.window.showSaveDialog({
      saveLabel: 'Export Metrics',
      filters: { 'JSON Files': ['json'] }
    }).then(fileUri => {
      if (fileUri) {
        const content = JSON.stringify(metrics, null, 2); // 2-space indentation
        vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(content, 'utf8')
        );
        vscode.window.showInformationMessage('Metrics exported successfully!');
      }
    });
  }

  /**
   * Show advanced analytics dashboard
   */
  public showAdvancedAnalytics() {
    const panel = vscode.window.createWebviewPanel(
      'advancedAnalytics',
      'Advanced Analytics - Code Pulse',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'web'))
        ]
      }
    );

    // Set the HTML content
    panel.webview.html = this.generateAdvancedAnalyticsHTML(panel.webview);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'getAdvancedAnalytics':
            this.sendAdvancedAnalyticsData(panel);
            break;
          case 'refreshAdvancedAnalytics':
            this.sendAdvancedAnalyticsData(panel);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Send initial data
    setTimeout(() => {
      this.sendAdvancedAnalyticsData(panel);
    }, 1000);
  }

  /**
   * Send advanced analytics data to webview
   */
  private async sendAdvancedAnalyticsData(panel: vscode.WebviewPanel) {
    try {
      if (!this.advancedAnalyticsService) {
        console.warn('Advanced Analytics Service not available');
        return;
      }

      // Get real data from AdvancedAnalyticsService
      const report = await this.advancedAnalyticsService.generateAdvancedReport();

      // Transform the report data to match the expected format
      const analyticsData = {
        productivityScore: {
          score: this.calculateProductivityScore(report),
          breakdown: {
            codeQuality: report.codeQuality?.maintainabilityIndex || 0,
            performance: this.calculatePerformanceScore(report.performance),
            teamCollaboration: report.teamMetrics?.collaborationScore || 0,
            trends: this.calculateTrendScore(report.trends)
          }
        },
        trends: report.trends || {
          seasonalPatterns: {
            monthlyTrends: []
          },
          velocityPrediction: {
            nextWeek: 0,
            confidence: 0
          }
        },
        performance: report.performance || {
          executionHotspots: [],
          memoryProfile: {
            allocation: 0,
            leaks: []
          },
          asyncOperations: {
            pending: 0
          }
        },
        teamMetrics: report.teamMetrics || {
          contributorCount: 0,
          collaborationScore: 0,
          knowledgeDistribution: 0
        },
        codeQuality: report.codeQuality || {
          duplicationType: { percentage: 0 },
          testCoverage: { percentage: 0 },
          documentation: { coverage: 0 }
        },
        recommendations: report.recommendations || []
      };

      panel.webview.postMessage({
        command: 'updateAdvancedAnalytics',
        data: analyticsData
      });
    } catch (error) {
      console.error('Error sending advanced analytics data:', error);

      // Fallback to basic data if advanced analytics fails
      const fallbackData = {
        productivityScore: { score: 0, breakdown: { codeQuality: 0, performance: 0, teamCollaboration: 0, trends: 0 } },
        trends: { seasonalPatterns: { monthlyTrends: [] }, velocityPrediction: { nextWeek: 0, confidence: 0 } },
        performance: { executionHotspots: [], memoryProfile: { allocation: 0, leaks: [] }, asyncOperations: { pending: 0 } },
        teamMetrics: { contributorCount: 0, collaborationScore: 0, knowledgeDistribution: 0 },
        codeQuality: { duplicationType: { percentage: 0 }, testCoverage: { percentage: 0 }, documentation: { coverage: 0 } },
        recommendations: ['Unable to load advanced analytics. Please check your configuration.']
      };

      panel.webview.postMessage({
        command: 'updateAdvancedAnalytics',
        data: fallbackData
      });
    }
  }

  /**
   * Handle historical analytics request
   */
  private async handleHistoricalAnalytics(panel: vscode.WebviewPanel, _message: any) {
    try {
      // Get analytics service from extension
      const analyticsService = (global as any).analyticsService;
      if (!analyticsService) {
        throw new Error('Analytics service not available');
      }

      // Parse time range (for future use in filtering)
      // const timeRange = this.parseTimeRange(message.timeRange);

      // Generate analytics report
      const report = await analyticsService.getDashboardAnalytics();

      panel.webview.postMessage({
        command: 'updateHistoricalAnalytics',
        data: report
      });
    } catch (error) {
      console.error('Error handling historical analytics:', error);
      panel.webview.postMessage({
        command: 'analyticsError',
        error: error.message
      });
    }
  }

  /**
   * Handle analytics report generation
   */
  private async handleGenerateAnalyticsReport(panel: vscode.WebviewPanel, message: any) {
    try {
      const analyticsService = (global as any).analyticsService;
      if (!analyticsService) {
        throw new Error('Analytics service not available');
      }

      const timeRange = this.parseTimeRange(message.timeRange);
      const projectIds = message.projectIds;

      const report = await analyticsService.generateAnalyticsReport(timeRange, projectIds);

      panel.webview.postMessage({
        command: 'analyticsReportGenerated',
        data: report
      });
    } catch (error) {
      console.error('Error generating analytics report:', error);
      panel.webview.postMessage({
        command: 'analyticsError',
        error: error.message
      });
    }
  }

  /**
   * Handle productivity forecast request
   */
  private async handleProductivityForecast(panel: vscode.WebviewPanel, message: any) {
    try {
      const analyticsService = (global as any).analyticsService;
      if (!analyticsService) {
        throw new Error('Analytics service not available');
      }

      const days = message.days || 30;
      const forecast = await analyticsService.getProductivityForecast(days);

      panel.webview.postMessage({
        command: 'productivityForecastGenerated',
        data: forecast
      });
    } catch (error) {
      console.error('Error generating productivity forecast:', error);
      panel.webview.postMessage({
        command: 'analyticsError',
        error: error.message
      });
    }
  }

  /**
   * Handle regression detection
   */
  private async handleRegressionDetection(panel: vscode.WebviewPanel) {
    try {
      const regressionDetector = (global as any).regressionDetector;
      if (!regressionDetector) {
        throw new Error('Regression detector not available');
      }

      const regressions = await regressionDetector.detectRegressions();
      const summary = await regressionDetector.getRegressionSummary();

      panel.webview.postMessage({
        command: 'regressionsDetected',
        data: { regressions, summary }
      });
    } catch (error) {
      console.error('Error detecting regressions:', error);
      panel.webview.postMessage({
        command: 'analyticsError',
        error: error.message
      });
    }
  }

  /**
   * Handle project comparison
   */
  private async handleProjectComparison(panel: vscode.WebviewPanel, message: any) {
    try {
      const projectComparator = (global as any).projectComparator;
      if (!projectComparator) {
        throw new Error('Project comparator not available');
      }

      const projectIds = message.projectIds;
      const timeRange = this.parseTimeRange(message.timeRange);

      const comparison = await projectComparator.compareProjects(projectIds, timeRange);

      panel.webview.postMessage({
        command: 'projectComparisonGenerated',
        data: comparison
      });
    } catch (error) {
      console.error('Error comparing projects:', error);
      panel.webview.postMessage({
        command: 'analyticsError',
        error: error.message
      });
    }
  }

  /**
   * Parse time range from string
   */
  private parseTimeRange(timeRangeStr: string): { start: number; end: number; granularity: string } {
    const end = Date.now();
    let start: number;
    let granularity = 'day';

    switch (timeRangeStr) {
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start = today.getTime();
        granularity = 'hour';
        break;
      case 'week':
        start = end - (7 * 24 * 60 * 60 * 1000);
        granularity = 'day';
        break;
      case 'month':
        start = end - (30 * 24 * 60 * 60 * 1000);
        granularity = 'day';
        break;
      case 'quarter':
        start = end - (90 * 24 * 60 * 60 * 1000);
        granularity = 'week';
        break;
      case '30d':
        start = end - (30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = end - (90 * 24 * 60 * 60 * 1000);
        break;
      case '180d':
        start = end - (180 * 24 * 60 * 60 * 1000);
        granularity = 'week';
        break;
      case '365d':
        start = end - (365 * 24 * 60 * 60 * 1000);
        granularity = 'week';
        break;
      default:
        start = end - (7 * 24 * 60 * 60 * 1000); // Default to 1 week
    }

    return { start, end, granularity };
  }

  /**
   * Filter metrics data based on provided filters
   */
  private filterMetricsData(storedMetrics: any, filters: any): any {
    if (!filters || Object.keys(filters).length === 0) {
      return storedMetrics;
    }

    const filtered = JSON.parse(JSON.stringify(storedMetrics)); // Deep clone

    // Filter daily metrics
    if (filters.timeRange && filtered.dailyMetrics) {
      filtered.dailyMetrics = filtered.dailyMetrics.filter((day: any) => {
        const timestamp = new Date(day.date).getTime();
        return timestamp >= filters.timeRange.start && timestamp <= filters.timeRange.end;
      });
    }

    // Filter by language
    if (filters.language && filters.language !== 'all' && filtered.fileMetrics) {
      const filteredFileMetrics: any = {};
      Object.entries(filtered.fileMetrics).forEach(([path, metrics]: [string, any]) => {
        if (metrics.language === filters.language) {
          filteredFileMetrics[path] = metrics;
        }
      });
      filtered.fileMetrics = filteredFileMetrics;
    }

    // Filter by complexity range
    if (filters.complexity && filtered.fileMetrics) {
      const filteredFileMetrics: any = {};
      Object.entries(filtered.fileMetrics).forEach(([path, metrics]: [string, any]) => {
        const complexity = metrics.complexity?.cyclomaticComplexity || 0;
        switch (filters.complexity) {
          case 'low':
            if (complexity <= 5) {filteredFileMetrics[path] = metrics;}
            break;
          case 'medium':
            if (complexity > 5 && complexity <= 15) {filteredFileMetrics[path] = metrics;}
            break;
          case 'high':
            if (complexity > 15) {filteredFileMetrics[path] = metrics;}
            break;
          default:
            filteredFileMetrics[path] = metrics;
        }
      });
      filtered.fileMetrics = filteredFileMetrics;
    }

    // Filter by search term
    if (filters.search && filtered.fileMetrics) {
      const searchTerm = filters.search.toLowerCase();
      const filteredFileMetrics: any = {};
      Object.entries(filtered.fileMetrics).forEach(([path, metrics]: [string, any]) => {
        if (path.toLowerCase().includes(searchTerm)) {
          filteredFileMetrics[path] = metrics;
        }
      });
      filtered.fileMetrics = filteredFileMetrics;
    }

    return filtered;
  }

  /**
   * Filter data by time range
   */
  private filterDataByTimeRange(storedMetrics: any, timeRange: { start: number; end: number; granularity: string }): any {
    const filtered = JSON.parse(JSON.stringify(storedMetrics)); // Deep clone

    // Filter daily metrics by time range
    if (filtered.dailyMetrics) {
      filtered.dailyMetrics = filtered.dailyMetrics.filter((day: any) => {
        const timestamp = new Date(day.date).getTime();
        return timestamp >= timeRange.start && timestamp <= timeRange.end;
      });
    }

    // Filter file metrics by last modified date
    if (filtered.fileMetrics) {
      const filteredFileMetrics: any = {};
      Object.entries(filtered.fileMetrics).forEach(([path, metrics]: [string, any]) => {
        const lastModified = new Date(metrics.lastModified).getTime();
        if (lastModified >= timeRange.start && lastModified <= timeRange.end) {
          filteredFileMetrics[path] = metrics;
        }
      });
      filtered.fileMetrics = filteredFileMetrics;
    }

    // Filter sessions by time range
    if (filtered.sessions) {
      filtered.sessions = filtered.sessions.filter((session: any) => {
        return session.startTime >= timeRange.start && session.startTime <= timeRange.end;
      });
    }

    return filtered;
  }

  /**
   * Generate filtered metrics summary
   */
  private generateFilteredMetricsSummary(filteredData: any): any {
    const fileMetrics = Object.values(filteredData.fileMetrics || {});
    const dailyMetrics = filteredData.dailyMetrics || [];

    const totalFiles = fileMetrics.length;
    const totalDays = dailyMetrics.length;
    const totalCodingTime = dailyMetrics.reduce((sum: number, day: any) => sum + (day.totalCodingTime || 0), 0);
    const totalFilesEdited = dailyMetrics.reduce((sum: number, day: any) => sum + (day.filesEdited || 0), 0);

    // Calculate average complexity
    const complexities = fileMetrics.map((file: any) => file.complexity?.cyclomaticComplexity || 0);
    const avgComplexity = complexities.length > 0
      ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length
      : 0;

    // Language breakdown
    const languageBreakdown: any = {};
    fileMetrics.forEach((file: any) => {
      const lang = file.language || 'unknown';
      languageBreakdown[lang] = (languageBreakdown[lang] || 0) + 1;
    });

    return {
      totalFiles,
      totalDays,
      totalCodingTime: Math.round(totalCodingTime / 60), // Convert to minutes
      totalFilesEdited,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      languageBreakdown,
      dateRange: {
        start: dailyMetrics.length > 0 ? dailyMetrics[0].date : null,
        end: dailyMetrics.length > 0 ? dailyMetrics[dailyMetrics.length - 1].date : null
      }
    };
  }

  /**
   * Prepare filtered chart data
   */
  private prepareFilteredChartData(filteredData: any, _filters: any): any {
    return this.prepareRealTimeData({
      languageBreakdown: this.calculateLanguageBreakdown(filteredData.fileMetrics),
      activeTime: this.calculateTotalActiveTime(filteredData.dailyMetrics),
      averageComplexity: this.calculateAverageComplexity(filteredData.fileMetrics),
      filesTracked: Object.keys(filteredData.fileMetrics || {}).length,
      fileChanges: this.calculateTotalFileChanges(filteredData.dailyMetrics),
      duration: this.calculateTotalDuration(filteredData.sessions)
    });
  }

  /**
   * Prepare time range chart data
   */
  private prepareTimeRangeChartData(timeFilteredData: any, _timeRange: any): any {
    return this.prepareRealTimeData({
      languageBreakdown: this.calculateLanguageBreakdown(timeFilteredData.fileMetrics),
      activeTime: this.calculateTotalActiveTime(timeFilteredData.dailyMetrics),
      averageComplexity: this.calculateAverageComplexity(timeFilteredData.fileMetrics),
      filesTracked: Object.keys(timeFilteredData.fileMetrics || {}).length,
      fileChanges: this.calculateTotalFileChanges(timeFilteredData.dailyMetrics),
      duration: this.calculateTotalDuration(timeFilteredData.sessions)
    });
  }

  /**
   * Count filtered records
   */
  private countFilteredRecords(filteredData: any): number {
    const fileCount = Object.keys(filteredData.fileMetrics || {}).length;
    const dayCount = (filteredData.dailyMetrics || []).length;
    const sessionCount = (filteredData.sessions || []).length;
    return fileCount + dayCount + sessionCount;
  }

  /**
   * Count time range records
   */
  private countTimeRangeRecords(timeFilteredData: any): number {
    return this.countFilteredRecords(timeFilteredData);
  }

  /**
   * Generate filter summary
   */
  private generateFilterSummary(filters: any): string {
    const summaryParts: string[] = [];

    if (filters.language && filters.language !== 'all') {
      summaryParts.push(`Language: ${filters.language}`);
    }

    if (filters.complexity) {
      summaryParts.push(`Complexity: ${filters.complexity}`);
    }

    if (filters.search) {
      summaryParts.push(`Search: "${filters.search}"`);
    }

    if (filters.timeRange) {
      const start = new Date(filters.timeRange.start).toLocaleDateString();
      const end = new Date(filters.timeRange.end).toLocaleDateString();
      summaryParts.push(`Date: ${start} - ${end}`);
    }

    return summaryParts.length > 0 ? summaryParts.join(', ') : 'No filters';
  }

  /**
   * Generate time range metrics summary
   */
  private generateTimeRangeMetricsSummary(timeFilteredData: any): any {
    return this.generateFilteredMetricsSummary(timeFilteredData);
  }

  /**
   * Calculate time range statistics
   */
  private calculateTimeRangeStats(timeFilteredData: any, timeRange: any): any {
    const dailyMetrics = timeFilteredData.dailyMetrics || [];
    const fileMetrics = Object.values(timeFilteredData.fileMetrics || {});

    const totalDays = Math.ceil((timeRange.end - timeRange.start) / (24 * 60 * 60 * 1000));
    const activeDays = dailyMetrics.length;
    const activityRate = totalDays > 0 ? (activeDays / totalDays) * 100 : 0;

    const avgCodingTimePerDay = dailyMetrics.length > 0
      ? dailyMetrics.reduce((sum: number, day: any) => sum + (day.totalCodingTime || 0), 0) / dailyMetrics.length / 60
      : 0;

    const avgFilesPerDay = dailyMetrics.length > 0
      ? dailyMetrics.reduce((sum: number, day: any) => sum + (day.filesEdited || 0), 0) / dailyMetrics.length
      : 0;

    return {
      totalDays,
      activeDays,
      activityRate: Math.round(activityRate * 10) / 10,
      avgCodingTimePerDay: Math.round(avgCodingTimePerDay * 10) / 10,
      avgFilesPerDay: Math.round(avgFilesPerDay * 10) / 10,
      totalFiles: fileMetrics.length,
      granularity: timeRange.granularity
    };
  }

  /**
   * Get time range label
   */
  private getTimeRangeLabel(timeRange: string): string {
    const labels: Record<string, string> = {
      'today': 'Today',
      'week': 'This Week',
      'month': 'This Month',
      'quarter': 'This Quarter',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
      '180d': 'Last 180 Days',
      '365d': 'Last Year'
    };

    return labels[timeRange] || timeRange;
  }

  /**
   * Helper method to calculate language breakdown
   */
  private calculateLanguageBreakdown(fileMetrics: any): Record<string, number> {
    const breakdown: Record<string, number> = {};

    if (fileMetrics) {
      Object.values(fileMetrics).forEach((file: any) => {
        const lang = file.language || 'unknown';
        breakdown[lang] = (breakdown[lang] || 0) + 1;
      });
    }

    return breakdown;
  }

  /**
   * Helper method to calculate total active time
   */
  private calculateTotalActiveTime(dailyMetrics: any[]): number {
    if (!dailyMetrics) {return 0;}
    return dailyMetrics.reduce((sum, day) => sum + (day.totalCodingTime || 0), 0) / 60; // Convert to minutes
  }

  /**
   * Helper method to calculate average complexity
   */
  private calculateAverageComplexity(fileMetrics: any): number {
    if (!fileMetrics) {return 0;}

    const complexities = Object.values(fileMetrics).map((file: any) =>
      file.complexity?.cyclomaticComplexity || 0
    );

    return complexities.length > 0
      ? complexities.reduce((sum: number, c: number) => sum + c, 0) / complexities.length
      : 0;
  }

  /**
   * Helper method to calculate total file changes
   */
  private calculateTotalFileChanges(dailyMetrics: any[]): number {
    if (!dailyMetrics) {return 0;}
    return dailyMetrics.reduce((sum, day) => sum + (day.filesEdited || 0), 0);
  }

  /**
   * Helper method to calculate total duration
   */
  private calculateTotalDuration(sessions: any[]): number {
    if (!sessions) {return 0;}
    return sessions.reduce((sum, session) => {
      const duration = session.endTime ? session.endTime - session.startTime : 0;
      return sum + duration;
    }, 0) / (60 * 1000); // Convert to minutes
  }

  /**
   * Handle report generation request
   */
  private async handleGenerateReport(panel: vscode.WebviewPanel, message: any) {
    try {
      const reportingService = (global as any).reportingService;
      if (!reportingService) {
        throw new Error('Reporting service not available');
      }

      const report = await reportingService.generateReport(message.config);

      panel.webview.postMessage({
        command: 'reportGenerated',
        data: report
      });
    } catch (error) {
      console.error('Error generating report:', error);
      panel.webview.postMessage({
        command: 'reportError',
        error: error.message
      });
    }
  }

  /**
   * Handle get reporting stats request
   */
  private async handleGetReportingStats(panel: vscode.WebviewPanel) {
    try {
      const reportingService = (global as any).reportingService;
      if (!reportingService) {
        throw new Error('Reporting service not available');
      }

      const stats = await reportingService.getReportingStats();

      panel.webview.postMessage({
        command: 'reportingStatsLoaded',
        data: stats
      });
    } catch (error) {
      console.error('Error getting reporting stats:', error);
      panel.webview.postMessage({
        command: 'reportError',
        error: error.message
      });
    }
  }

  /**
   * Handle get scheduled reports request
   */
  private async handleGetScheduledReports(panel: vscode.WebviewPanel) {
    try {
      const reportingService = (global as any).reportingService;
      if (!reportingService) {
        throw new Error('Reporting service not available');
      }

      const scheduledReports = reportingService.getScheduledReports();

      panel.webview.postMessage({
        command: 'scheduledReportsLoaded',
        data: scheduledReports
      });
    } catch (error) {
      console.error('Error getting scheduled reports:', error);
      panel.webview.postMessage({
        command: 'reportError',
        error: error.message
      });
    }
  }

  /**
   * Handle get report history request
   */
  private async handleGetReportHistory(panel: vscode.WebviewPanel) {
    try {
      const reportingService = (global as any).reportingService;
      if (!reportingService) {
        throw new Error('Reporting service not available');
      }

      const history = await reportingService.getReportHistory();

      panel.webview.postMessage({
        command: 'reportHistoryLoaded',
        data: history
      });
    } catch (error) {
      console.error('Error getting report history:', error);
      panel.webview.postMessage({
        command: 'reportError',
        error: error.message
      });
    }
  }

  /**
   * Handle get report templates request
   */
  private async handleGetReportTemplates(panel: vscode.WebviewPanel) {
    try {
      const reportingService = (global as any).reportingService;
      if (!reportingService) {
        throw new Error('Reporting service not available');
      }

      const templates = reportingService.getAvailableTemplates();

      panel.webview.postMessage({
        command: 'reportTemplatesLoaded',
        data: templates.map((name: string) => ({ id: name, name, type: 'general' }))
      });
    } catch (error) {
      console.error('Error getting report templates:', error);
      panel.webview.postMessage({
        command: 'reportError',
        error: error.message
      });
    }
  }

  /**
   * Handle schedule report request
   */
  private async handleScheduleReport(panel: vscode.WebviewPanel, message: any) {
    try {
      const reportingService = (global as any).reportingService;
      if (!reportingService) {
        throw new Error('Reporting service not available');
      }

      const jobId = await reportingService.scheduleReport(
        message.configId,
        message.schedule,
        message.recipients
      );

      panel.webview.postMessage({
        command: 'reportScheduled',
        data: { jobId }
      });
    } catch (error) {
      console.error('Error scheduling report:', error);
      panel.webview.postMessage({
        command: 'reportError',
        error: error.message
      });
    }
  }

  /**
   * Handle get system health request
   */
  private async handleGetSystemHealth(panel: vscode.WebviewPanel) {
    try {
      const errorHandler = (global as any).errorHandler;
      const performanceMonitor = (global as any).performanceMonitor;
      const memoryLeakDetector = (global as any).memoryLeakDetector;

      if (!errorHandler || !performanceMonitor || !memoryLeakDetector) {
        throw new Error('Monitoring services not available');
      }

      const errorMetrics = errorHandler.getErrorMetrics();
      const performanceSummary = performanceMonitor.getPerformanceSummary();
      const memoryUsage = memoryLeakDetector.getMemoryUsageSummary();

      const systemHealth = {
        overallStatus: this.determineOverallStatus(errorMetrics, performanceSummary, memoryUsage),
        errorRate: errorMetrics.totalErrors > 0 ? (errorMetrics.errorsByCategory.critical / errorMetrics.totalErrors) * 100 : 0,
        performanceScore: Math.max(0, 100 - performanceSummary.criticalIssuesCount * 10),
        memoryUsage: memoryUsage.currentHeapMB,
        activeIssues: errorMetrics.criticalErrorsLast24h + performanceSummary.criticalIssuesCount + memoryUsage.leakCount,
        uptime: Date.now() - (global as any).extensionStartTime || 0
      };

      panel.webview.postMessage({
        command: 'systemHealthLoaded',
        data: systemHealth
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle get error history request
   */
  private async handleGetErrorHistory(panel: vscode.WebviewPanel, message: any) {
    try {
      const errorHandler = (global as any).errorHandler;
      if (!errorHandler) {
        throw new Error('Error handler not available');
      }

      const history = errorHandler.getErrorHistory(message.limit || 100);

      panel.webview.postMessage({
        command: 'errorHistoryLoaded',
        data: history
      });
    } catch (error) {
      console.error('Error getting error history:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle get performance metrics request
   */
  private async handleGetPerformanceMetrics(panel: vscode.WebviewPanel) {
    try {
      const performanceMonitor = (global as any).performanceMonitor;
      if (!performanceMonitor) {
        throw new Error('Performance monitor not available');
      }

      const metrics = {
        current: performanceMonitor.getCurrentMetrics(),
        history: performanceMonitor.getMetricsHistory(50),
        issues: performanceMonitor.getPerformanceIssues(),
        slowOperations: performanceMonitor.getSlowOperations(20),
        summary: performanceMonitor.getPerformanceSummary()
      };

      panel.webview.postMessage({
        command: 'performanceMetricsLoaded',
        data: metrics
      });
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle get memory data request
   */
  private async handleGetMemoryData(panel: vscode.WebviewPanel) {
    try {
      const memoryLeakDetector = (global as any).memoryLeakDetector;
      if (!memoryLeakDetector) {
        throw new Error('Memory leak detector not available');
      }

      const memoryData = {
        snapshots: memoryLeakDetector.getMemorySnapshots(50),
        leaks: memoryLeakDetector.getDetectedLeaks(),
        usage: memoryLeakDetector.getMemoryUsageSummary(),
        tracking: Object.fromEntries(memoryLeakDetector.getObjectTrackingStats())
      };

      panel.webview.postMessage({
        command: 'memoryDataLoaded',
        data: memoryData
      });
    } catch (error) {
      console.error('Error getting memory data:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle get logs request
   */
  private async handleGetLogs(panel: vscode.WebviewPanel, message: any) {
    try {
      const logger = (global as any).logger;
      if (!logger) {
        throw new Error('Logger not available');
      }

      const logs = await logger.searchLogs(message.filter || {}, message.limit || 500);

      panel.webview.postMessage({
        command: 'logsLoaded',
        data: logs
      });
    } catch (error) {
      console.error('Error getting logs:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle clear errors request
   */
  private async handleClearErrors(panel: vscode.WebviewPanel) {
    try {
      const errorHandler = (global as any).errorHandler;
      if (!errorHandler) {
        throw new Error('Error handler not available');
      }

      errorHandler.clearErrorHistory();

      panel.webview.postMessage({
        command: 'errorsCleared'
      });
    } catch (error) {
      console.error('Error clearing errors:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle clear logs request
   */
  private async handleClearLogs(panel: vscode.WebviewPanel) {
    try {
      const logger = (global as any).logger;
      if (!logger) {
        throw new Error('Logger not available');
      }

      await logger.clearLogs();

      panel.webview.postMessage({
        command: 'logsCleared'
      });
    } catch (error) {
      console.error('Error clearing logs:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle export logs request
   */
  private async handleExportLogs(panel: vscode.WebviewPanel, message: any) {
    try {
      const logger = (global as any).logger;
      if (!logger) {
        throw new Error('Logger not available');
      }

      const outputPath = message.outputPath || path.join(os.tmpdir(), `codepulse-logs-${Date.now()}.json`);
      await logger.exportLogs(outputPath, message.filter, message.format || 'json');

      panel.webview.postMessage({
        command: 'logsExported',
        data: { outputPath }
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Handle update monitoring settings request
   */
  private async handleUpdateMonitoringSettings(panel: vscode.WebviewPanel, message: any) {
    try {
      const { errorHandler, performanceMonitor, memoryLeakDetector, logger } = global as any;

      if (message.settings.errorHandling && errorHandler) {
        // Update error handler settings
      }

      if (message.settings.performance && performanceMonitor) {
        performanceMonitor.updateThresholds(message.settings.performance);
      }

      if (message.settings.memory && memoryLeakDetector) {
        memoryLeakDetector.updateConfiguration(message.settings.memory);
      }

      if (message.settings.logging && logger) {
        logger.updateConfiguration(message.settings.logging);
      }

      panel.webview.postMessage({
        command: 'monitoringSettingsUpdated'
      });
    } catch (error) {
      console.error('Error updating monitoring settings:', error);
      panel.webview.postMessage({
        command: 'monitoringError',
        error: error.message
      });
    }
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(errorMetrics: any, performanceSummary: any, memoryUsage: any): string {
    const criticalIssues = errorMetrics.criticalErrorsLast24h + performanceSummary.criticalIssuesCount + memoryUsage.leakCount;

    if (criticalIssues > 0) {
      return 'critical';
    }

    const warningConditions = [
      errorMetrics.totalErrors > 10,
      performanceSummary.slowOperationsCount > 5,
      memoryUsage.currentHeapMB > 500,
      performanceSummary.averageResponseTime > 2000
    ];

    if (warningConditions.some(condition => condition)) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Generate advanced analytics HTML
   */
  private generateAdvancedAnalyticsHTML(webview: vscode.Webview): string {
    try {
      const htmlPath = path.join(this.context.extensionPath, 'src', 'web', 'advanced-analytics.html');

      // Check if file exists before reading
      if (!fs.existsSync(htmlPath)) {
        console.warn(`Advanced analytics HTML file not found at: ${htmlPath}`);
        return this.generateFallbackAdvancedAnalyticsHTML(webview);
      }

      let htmlContent = fs.readFileSync(htmlPath, 'utf8');

      // Replace relative paths with webview URIs
      const webviewUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'web')));
      htmlContent = htmlContent.replace(/src="scripts\//g, `src="${webviewUri}/scripts/`);
      htmlContent = htmlContent.replace(/href="styles\//g, `href="${webviewUri}/styles/`);

      return htmlContent;
    } catch (error) {
      console.error('Error loading advanced analytics HTML:', error);
      return this.generateFallbackAdvancedAnalyticsHTML(webview);
    }
  }

  /**
   * Generate fallback advanced analytics HTML when file is not available
   */
  private generateFallbackAdvancedAnalyticsHTML(webview: vscode.Webview): string {
    const webviewUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'web')));

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Advanced Analytics</title>
        <link href="${webviewUri}/styles/variables.css" rel="stylesheet">
        <link href="${webviewUri}/styles/base.css" rel="stylesheet">
        <link href="${webviewUri}/styles/components.css" rel="stylesheet">
      </head>
      <body>
        <div class="container">
          <h1>Advanced Analytics</h1>
          <p>Advanced analytics features are being loaded...</p>
          <div id="analytics-content">
            <div class="loading">Loading advanced analytics data...</div>
          </div>
        </div>
        <script src="${webviewUri}/scripts/advanced-analytics.js"></script>
      </body>
      </html>
    `;
  }

  /**
   * Generate dashboard HTML with all components
   */
  private generateDashboardHTML(webview: vscode.Webview): string {
    const insights = this.metricsTracker?.getSessionInsights() || {
      duration: 0,
      activeTime: 0,
      idleTime: 0,
      filesTracked: 0,
      fileChanges: 0,
      languageBreakdown: {},
      averageComplexity: 0
    };
    const currentDate = new Date().toLocaleString();

    // Generate CSS link tags for webview
    const cssFiles = [
      'variables.css',
      'base.css',
      'components.css',
      'dashboard.css',
      'responsive.css',
      'interactive-features.css',
      'historical-analytics.css',
      'reporting.css',
      'error-monitoring.css'
    ];

    const webviewUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'web')));
    const cssLinks = cssFiles.map(filename =>
      `<link rel="stylesheet" href="${webviewUri}/styles/${filename}">`
    ).join('\n        ');

    // Generate JavaScript script tags for webview
    const jsFiles = [
      'utils.js',
      'theme-manager.js',
      'charts.js',
      'advanced-filters.js',
      'export-manager.js',
      'goal-manager.js',
      'historical-analytics.js',
      'reporting-manager.js',
      'error-monitoring.js',
      'websocket-client.js',
      'connection-status.js',
      'dashboard.js',
      'realtime-data.js'
    ];

    const jsScripts = jsFiles.map(filename =>
      `<script src="${webviewUri}/scripts/${filename}"></script>`
    ).join('\n        ');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code Pulse - Developer Productivity Dashboard</title>

        <!-- External Dependencies -->
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>

        <!-- Google Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

        <!-- CSS Files -->
        ${cssLinks}
      </head>
      <body data-theme="${this.loadThemePreference()}">
        ${this.generateModernDashboard(insights, currentDate)}

        <!-- JavaScript Files -->
        ${jsScripts}

        <script>
          ${this.generateInitializationScript(insights)}
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generate modern dashboard HTML structure
   */
  private generateModernDashboard(insights: any, currentDate: string): string {
    return `
      <div class="dashboard">
        <!-- Header -->
        <header class="dashboard-header">
          <div class="dashboard-container">
            <div class="header-content">
              <div class="header-title">
                <div class="header-logo">CP</div>
                <div class="header-text">
                  <h1>Code Pulse</h1>
                  <p class="header-subtitle">Developer Productivity Dashboard</p>
                </div>
              </div>

              <div class="header-actions">
                <div class="search-container">
                  <input
                    type="text"
                    id="searchInput"
                    class="search-input"
                    placeholder="Search metrics..."
                    autocomplete="off"
                  >
                  <span class="search-icon">🔍</span>
                </div>

                <button class="btn btn-ghost" data-action="refresh" title="Refresh Dashboard (Ctrl+R)">
                  🔄 Refresh
                </button>

                <button class="btn btn-secondary" data-action="export" title="Export Data (Ctrl+E)">
                  📊 Export
                </button>

                <button class="theme-toggle" title="Toggle Theme (Ctrl+Shift+T)" aria-label="Toggle theme" data-action="toggleTheme">
                  <span class="theme-icon">🌙</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Content -->
        <main class="dashboard-content">
          <div class="dashboard-container">

            <!-- Metrics Overview -->
            <section class="metrics-overview">
              <div class="metric-card">
                <div class="metric-value" data-metric="linesOfCode">${insights.fileChanges || 0}</div>
                <div class="metric-label">Files Modified</div>
                <div class="metric-change positive">
                  <span>↗</span> +12.5%
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-value" data-metric="filesModified">${insights.filesTracked}</div>
                <div class="metric-label">Files Tracked</div>
                <div class="metric-change positive">
                  <span>↗</span> +8.3%
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-value" data-metric="activeTime">${insights.activeTime.toFixed(1)}</div>
                <div class="metric-label">Active Time (min)</div>
                <div class="metric-change negative">
                  <span>↘</span> -2.1%
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-value" data-metric="complexity">${insights.averageComplexity?.toFixed(1) || '0.0'}</div>
                <div class="metric-label">Avg Complexity</div>
                <div class="metric-change positive">
                  <span>↗</span> +5.7%
                </div>
              </div>
            </section>

            <!-- Smart Insights Panel -->
            <section class="insights-panel">
              <div class="insights-header">
                <h2 class="insights-title">
                  💡 Smart Insights
                </h2>
              </div>
              <div class="insights-list">
                <div class="insight-item">
                  <div class="insight-icon suggestion">💡</div>
                  <div class="insight-content">
                    <h4 class="insight-title">Optimize Focus Time</h4>
                    <p class="insight-description">Your productivity peaks between 9-11 AM. Consider scheduling complex tasks during this time.</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Charts Section -->
            <section class="charts-section">
              <div class="charts-header">
                <h2 class="charts-title">Analytics</h2>
                <div class="charts-filters">
                  <select class="filter-select" name="timeRange">
                    <option value="today">Today</option>
                    <option value="week" selected>This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </select>

                  <select class="filter-select" name="language">
                    <option value="all" selected>All Languages</option>
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                  </select>
                </div>
              </div>

              <div class="charts-grid">
                <div class="chart-container">
                  <div class="chart-header">
                    <h3 class="chart-title">Language Distribution</h3>
                    <div class="chart-actions">
                      <button class="btn btn-ghost btn-sm" data-chart-action="fullscreen" data-chart-id="languageChart">⛶</button>
                      <button class="btn btn-ghost btn-sm" data-chart-action="download" data-chart-id="languageChart">⬇</button>
                    </div>
                  </div>
                  <div class="chart-canvas">
                    <canvas id="languageChart"></canvas>
                  </div>
                </div>

                <div class="chart-container">
                  <div class="chart-header">
                    <h3 class="chart-title">Activity Timeline</h3>
                    <div class="chart-actions">
                      <button class="btn btn-ghost btn-sm" data-chart-action="fullscreen" data-chart-id="activityChart">⛶</button>
                      <button class="btn btn-ghost btn-sm" data-chart-action="download" data-chart-id="activityChart">⬇</button>
                    </div>
                  </div>
                  <div class="chart-canvas">
                    <canvas id="activityChart"></canvas>
                  </div>
                </div>

                <div class="chart-container">
                  <div class="chart-header">
                    <h3 class="chart-title">Complexity Trends</h3>
                    <div class="chart-actions">
                      <button class="btn btn-ghost btn-sm" data-chart-action="fullscreen" data-chart-id="complexityChart">⛶</button>
                      <button class="btn btn-ghost btn-sm" data-chart-action="download" data-chart-id="complexityChart">⬇</button>
                    </div>
                  </div>
                  <div class="chart-canvas">
                    <canvas id="complexityChart"></canvas>
                  </div>
                </div>

                <div class="chart-container">
                  <div class="chart-header">
                    <h3 class="chart-title">Productivity Score</h3>
                    <div class="chart-actions">
                      <button class="btn btn-ghost btn-sm" data-chart-action="fullscreen" data-chart-id="productivityChart">⛶</button>
                      <button class="btn btn-ghost btn-sm" data-chart-action="download" data-chart-id="productivityChart">⬇</button>
                    </div>
                  </div>
                  <div class="chart-canvas">
                    <canvas id="productivityChart"></canvas>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </main>

        <!-- Footer -->
        <footer class="dashboard-footer">
          <div class="dashboard-container">
            <div class="footer-content">
              <p>Last updated: <span id="lastUpdate">${currentDate}</span></p>
              <div class="footer-stats">
                <div class="footer-stat">
                  <span>Session: <span data-metric="sessionDuration">${insights.duration.toFixed(1)}</span>min</span>
                </div>
                <div class="footer-stat">
                  <span>Files: <span data-metric="sessionFiles">${insights.filesTracked}</span></span>
                </div>
                <div class="footer-stat">
                  <span>Active: <span data-metric="sessionActive">${insights.activeTime.toFixed(1)}</span>min</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <!-- Notification Container -->
      <div class="notification-container" id="notificationContainer"></div>

      <!-- Loading Overlays -->
      <div class="loading-overlay" style="display: none;">
        <div class="loading-spinner"></div>
      </div>
    `;
  }

  /**
   * Generate initialization script for the dashboard
   */
  private generateInitializationScript(insights: any): string {
    return `
      // Global function for initializing charts
      window.initializeRealTimeCharts = function() {
        const realTimeData = ${JSON.stringify(this.prepareRealTimeData(insights))};

        // Language Distribution Chart
        if (document.getElementById('languageChart')) {
          window.chartManager.createChart('languageChart', 'doughnut', realTimeData.languageData);
        }

        // Activity Timeline Chart
        if (document.getElementById('activityChart')) {
          window.chartManager.createChart('activityChart', 'line', realTimeData.activityData);
        }

        // Complexity Trend Chart
        if (document.getElementById('complexityChart')) {
          window.chartManager.createChart('complexityChart', 'bar', realTimeData.complexityData);
        }

        // Productivity Score Chart
        if (document.getElementById('productivityChart')) {
          window.chartManager.createChart('productivityChart', 'line', realTimeData.productivityData);
        }
      };

      // Global function for updating charts with real data
      window.updateChartsWithRealData = function(newData) {
        if (window.chartManager && newData) {
          // Update language chart
          if (newData.languageData) {
            window.chartManager.updateChartData('languageChart', newData.languageData);
          }

          // Update activity chart
          if (newData.activityData) {
            window.chartManager.updateChartData('activityChart', newData.activityData);
          }

          // Update complexity chart
          if (newData.complexityData) {
            window.chartManager.updateChartData('complexityChart', newData.complexityData);
          }

          // Update productivity chart
          if (newData.productivityData) {
            window.chartManager.updateChartData('productivityChart', newData.productivityData);
          }
        }
      };

      // Global function for updating metrics
      window.updateDashboardMetrics = function(newMetrics) {
        const metrics = newMetrics || ${JSON.stringify(insights)};

        // Update metric values with animation
        document.querySelectorAll('[data-metric]').forEach(element => {
          const metric = element.dataset.metric;
          let value = '';

          switch(metric) {
            case 'linesOfCode':
              value = metrics.fileChanges || 0;
              break;
            case 'filesModified':
              value = metrics.filesTracked || 0;
              break;
            case 'activeTime':
              value = (metrics.activeTime || 0).toFixed(1);
              break;
            case 'complexity':
              value = (metrics.averageComplexity || 0).toFixed(1);
              break;
            case 'sessionDuration':
              value = (metrics.duration || 0).toFixed(1);
              break;
            case 'sessionFiles':
              value = metrics.filesTracked || 0;
              break;
            case 'sessionActive':
              value = (metrics.activeTime || 0).toFixed(1);
              break;
          }

          if (element.textContent !== value.toString()) {
            // Animate value change
            if (window.animateNumber) {
              const oldValue = parseFloat(element.textContent) || 0;
              const newValue = parseFloat(value) || 0;
              window.animateNumber(element, oldValue, newValue);
            } else {
              element.textContent = value;
            }
          }
        });
      }



      // Call initial update
      if (window.updateDashboardMetrics) {
        window.updateDashboardMetrics();
      }

      // Set up VS Code API communication
      if (typeof acquireVsCodeApi !== 'undefined') {
        const vscode = acquireVsCodeApi();

        // Listen for messages from extension
        window.addEventListener('message', (event) => {
          const message = event.data;
          switch (message.command) {
            case 'updateMetrics':
              if (window.updateDashboardMetrics) {
                window.updateDashboardMetrics(message.data);
              }
              if (window.dashboard) {
                window.dashboard.showNotification('Metrics updated', 'success');
              }
              break;
            case 'updateCharts':
              if (window.updateChartsWithRealData) {
                window.updateChartsWithRealData(message.data);
              }
              break;
            case 'updateInsights':
              if (window.dashboard) {
                window.dashboard.updateInsightsPanel(message.data);
              }
              break;
            case 'themeChanged':
              if (window.themeManager) {
                window.themeManager.setTheme(message.theme);
              }
              break;
          }
        });
      }

      // Initialize dashboard when DOM is ready
      document.addEventListener('DOMContentLoaded', function() {
        // Wait for chart manager to be ready
        setTimeout(() => {
          if (window.chartManager && window.initializeRealTimeCharts) {
            window.initializeRealTimeCharts();
          }
        }, 100);
      });

      // If DOM is already loaded, initialize immediately
      if (document.readyState === 'loading') {
        // DOM is still loading, wait for DOMContentLoaded
      } else {
        // DOM is already loaded
        setTimeout(() => {
          if (window.chartManager && window.initializeRealTimeCharts) {
            window.initializeRealTimeCharts();
          }
        }, 100);
      }
    `;
  }

  /**
   * Prepare real-time data for charts
   */
  private prepareRealTimeData(insights: any) {
    const storedMetrics = this.metricsTracker?.getStoredMetrics() || { dailyMetrics: [], fileMetrics: {}, sessions: [] };

    // Language Distribution Data
    const languageBreakdown = insights.languageBreakdown || {};
    const languageData = {
      labels: Object.keys(languageBreakdown).length > 0
        ? Object.keys(languageBreakdown)
        : ['No data'],
      datasets: [{
        data: Object.keys(languageBreakdown).length > 0
          ? Object.values(languageBreakdown)
          : [1],
        backgroundColor: this.getLanguageColors(Object.keys(languageBreakdown))
      }]
    };

    // Activity Timeline Data (last 7 days)
    const last7Days = this.getLast7DaysData(storedMetrics.dailyMetrics);
    const activityData = {
      labels: last7Days.map(d => d.label),
      datasets: [{
        label: 'Files Modified',
        data: last7Days.map(d => d.filesEdited),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4
      }, {
        label: 'Coding Time (min)',
        data: last7Days.map(d => d.totalCodingTime),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4
      }]
    };

    // Complexity Trend Data (last 4 weeks)
    const complexityTrend = this.getComplexityTrend(storedMetrics.fileMetrics);
    const complexityData = {
      labels: complexityTrend.map(d => d.label),
      datasets: [{
        label: 'Average Complexity',
        data: complexityTrend.map(d => d.complexity),
        backgroundColor: complexityTrend.map(d => d.complexity > 10 ? '#f59e0b' : '#10b981')
      }]
    };

    // Productivity Score Data (last 5 days)
    const productivityTrend = this.getProductivityTrend(storedMetrics.dailyMetrics);
    const productivityData = {
      labels: productivityTrend.map(d => d.label),
      datasets: [{
        label: 'Productivity Score',
        data: productivityTrend.map(d => d.score),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4
      }]
    };

    return {
      languageData,
      activityData,
      complexityData,
      productivityData
    };
  }

  /**
   * Get language colors for chart
   */
  private getLanguageColors(languages: string[]): string[] {
    const colorMap: Record<string, string> = {
      'typescript': '#3178c6',
      'javascript': '#f7df1e',
      'python': '#3776ab',
      'css': '#1572b6',
      'html': '#e34f26',
      'java': '#ed8b00',
      'cpp': '#00599c',
      'csharp': '#239120',
      'go': '#00add8',
      'rust': '#000000',
      'php': '#777bb4',
      'ruby': '#cc342d',
      'swift': '#fa7343',
      'kotlin': '#7f52ff'
    };

    return languages.map(lang =>
      colorMap[lang.toLowerCase()] || `hsl(${Math.random() * 360}, 70%, 60%)`
    );
  }

  /**
   * Get last 7 days data
   */
  private getLast7DaysData(dailyMetrics: any[]) {
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = dailyMetrics.find(m => m.date === dateStr);
      last7Days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        filesEdited: dayData?.filesEdited || 0,
        totalCodingTime: Math.round((dayData?.totalCodingTime || 0) / 60) // Convert to minutes
      });
    }

    return last7Days;
  }

  /**
   * Get complexity trend for last 4 weeks
   */
  private getComplexityTrend(fileMetrics: Record<string, any>) {
    const weeks = [];
    const today = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (i * 7));

      const complexities = Object.values(fileMetrics)
        .filter((file: any) => {
          const fileDate = new Date(file.lastModified);
          return fileDate >= weekStart && fileDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        })
        .map((file: any) => file.complexity?.cyclomaticComplexity || 1);

      const avgComplexity = complexities.length > 0
        ? complexities.reduce((a, b) => a + b, 0) / complexities.length
        : 0;

      weeks.push({
        label: `Week ${4 - i}`,
        complexity: Math.round(avgComplexity * 10) / 10
      });
    }

    return weeks;
  }

  /**
   * Get productivity trend for last 5 days
   */
  private getProductivityTrend(dailyMetrics: any[]) {
    const last5Days = [];
    const today = new Date();

    for (let i = 4; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = dailyMetrics.find(m => m.date === dateStr);
      const codingTime = dayData?.totalCodingTime || 0;
      const filesEdited = dayData?.filesEdited || 0;

      // Simple productivity score calculation
      const score = Math.min(100, Math.round((codingTime / 60) * 2 + filesEdited * 5));

      last5Days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        score: score
      });
    }

    return last5Days;
  }

  /**
   * Send latest metrics to webview
   */
  private sendLatestMetrics(panel: vscode.WebviewPanel): void {
    if (!this.metricsTracker) {
      return;
    }

    const insights = this.metricsTracker.getSessionInsights();
    const chartData = this.prepareRealTimeData(insights);

    // Send metrics update
    panel.webview.postMessage({
      command: 'updateMetrics',
      data: insights
    });

    // Send chart data update
    panel.webview.postMessage({
      command: 'updateCharts',
      data: chartData
    });

    // Also send via WebSocket if available
    if (this.webSocketManager) {
      this.webSocketManager.sendMetricsUpdate(insights);
      this.webSocketManager.sendChartUpdate(chartData);
    }
  }

  /**
   * Send WebSocket port to webview
   */
  private sendWebSocketPort(panel: vscode.WebviewPanel): void {
    const port = this.webSocketManager?.getPort() || null;

    panel.webview.postMessage({
      command: 'webSocketPort',
      port: port
    });
  }

  /**
   * Apply filters to dashboard data
   */
  private async applyFilters(panel: vscode.WebviewPanel, filters: any): Promise<void> {
    try {
      if (!this.metricsTracker) {
        throw new Error('Metrics tracker not available');
      }

      // Get stored metrics
      const storedMetrics = this.metricsTracker.getStoredMetrics();

      // Apply filters to the data
      const filteredData = this.filterMetricsData(storedMetrics, filters);

      // Generate filtered charts data
      const chartData = this.prepareFilteredChartData(filteredData, filters);

      // Send filtered data to webview
      panel.webview.postMessage({
        command: 'filtersApplied',
        data: {
          success: true,
          filters,
          metrics: this.generateFilteredMetricsSummary(filteredData),
          chartData,
          totalRecords: this.countFilteredRecords(filteredData)
        }
      });

      // Show notification
      const recordCount = this.countFilteredRecords(filteredData);
      const filterSummary = this.generateFilterSummary(filters);

      if (recordCount === 0) {
        panel.webview.postMessage({
          command: 'showNotification',
          data: {
            message: `No data found for the applied filters: ${filterSummary}`,
            type: 'warning'
          }
        });
      } else {
        panel.webview.postMessage({
          command: 'showNotification',
          data: {
            message: `Filters applied: ${filterSummary} (${recordCount} records)`,
            type: 'success'
          }
        });
      }

    } catch (error) {
      console.error('Error applying filters:', error);
      panel.webview.postMessage({
        command: 'filtersApplied',
        data: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          filters
        }
      });
    }
  }

  /**
   * Update time range for dashboard
   */
  private async updateTimeRange(panel: vscode.WebviewPanel, timeRange: string): Promise<void> {
    try {
      if (!this.metricsTracker) {
        throw new Error('Metrics tracker not available');
      }

      // Parse the time range
      const parsedTimeRange = this.parseTimeRange(timeRange);

      // Get stored metrics
      const storedMetrics = this.metricsTracker.getStoredMetrics();

      // Filter data by time range
      const timeFilteredData = this.filterDataByTimeRange(storedMetrics, parsedTimeRange);

      // Generate time-filtered charts data
      const chartData = this.prepareTimeRangeChartData(timeFilteredData, parsedTimeRange);

      // Calculate time range statistics
      const timeRangeStats = this.calculateTimeRangeStats(timeFilteredData, parsedTimeRange);

      // Send updated data to webview
      panel.webview.postMessage({
        command: 'timeRangeUpdated',
        data: {
          timeRange,
          parsedTimeRange,
          metrics: this.generateTimeRangeMetricsSummary(timeFilteredData),
          chartData,
          stats: timeRangeStats,
          totalRecords: this.countTimeRangeRecords(timeFilteredData)
        }
      });

      // Show notification with time range info
      const recordCount = this.countTimeRangeRecords(timeFilteredData);
      const timeRangeLabel = this.getTimeRangeLabel(timeRange);

      panel.webview.postMessage({
        command: 'showNotification',
        data: {
          message: `Time range updated to ${timeRangeLabel} (${recordCount} records)`,
          type: 'info'
        }
      });

    } catch (error) {
      console.error('Error updating time range:', error);
      panel.webview.postMessage({
        command: 'timeRangeUpdated',
        data: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timeRange
        }
      });
    }
  }

  /**
   * Send smart insights to webview
   */
  private sendSmartInsights(panel: vscode.WebviewPanel): void {
    if (!this.metricsTracker) {
      return;
    }

    const sessionInsights = this.metricsTracker.getSessionInsights();
    const storedMetrics = this.metricsTracker.getStoredMetrics();
    const insights = this.generateDynamicInsights(sessionInsights, storedMetrics);

    panel.webview.postMessage({
      command: 'updateInsights',
      data: insights
    });
  }

  /**
   * Generate dynamic insights based on real data
   */
  private generateDynamicInsights(sessionInsights: any, storedMetrics: any) {
    const insights = [];

    // Productivity insights
    if (sessionInsights.activeTime > 60) {
      insights.push({
        type: 'success',
        title: 'Great Focus Session!',
        description: `You've been actively coding for ${sessionInsights.activeTime.toFixed(1)} minutes. Keep up the momentum!`,
        actionable: false
      });
    } else if (sessionInsights.duration > 30 && sessionInsights.activeTime < 15) {
      insights.push({
        type: 'warning',
        title: 'Low Activity Detected',
        description: `You've been idle for most of your ${sessionInsights.duration.toFixed(1)} minute session. Consider taking a break or switching tasks.`,
        actionable: true,
        actionType: 'break',
        metadata: { duration: sessionInsights.duration }
      });
    }

    // Complexity insights
    if (sessionInsights.averageComplexity > 15) {
      insights.push({
        type: 'warning',
        title: 'High Complexity Alert',
        description: `Current average complexity is ${sessionInsights.averageComplexity.toFixed(1)}. Consider refactoring for better maintainability.`,
        actionable: true,
        actionType: 'refactor',
        metadata: { complexity: sessionInsights.averageComplexity }
      });
    } else if (sessionInsights.averageComplexity > 0 && sessionInsights.averageComplexity < 5) {
      insights.push({
        type: 'success',
        title: 'Clean Code Detected',
        description: `Excellent! Your code complexity is low (${sessionInsights.averageComplexity.toFixed(1)}). This indicates good code quality.`,
        actionable: false
      });
    }

    // File tracking insights
    if (sessionInsights.filesTracked > 10) {
      insights.push({
        type: 'info',
        title: 'Multi-File Session',
        description: `You're working across ${sessionInsights.filesTracked} files. Consider using workspace search to navigate efficiently.`,
        actionable: true,
        actionType: 'organize',
        metadata: { fileCount: sessionInsights.filesTracked }
      });
    }

    // Language diversity insights
    const languageCount = Object.keys(sessionInsights.languageBreakdown || {}).length;
    if (languageCount > 3) {
      insights.push({
        type: 'info',
        title: 'Polyglot Session',
        description: `You're working with ${languageCount} different languages today. Great versatility!`,
        actionable: false
      });
    }

    // Time-based insights
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour <= 6) {
      insights.push({
        type: 'suggestion',
        title: 'Late Night Coding',
        description: 'Coding late? Remember to take breaks and maintain work-life balance.',
        actionable: true,
        actionType: 'break',
        metadata: { time: currentHour }
      });
    }

    // Historical comparison
    const recentDays = storedMetrics.dailyMetrics.slice(-7);
    if (recentDays.length > 0) {
      const avgDailyCodingTime = recentDays.reduce((sum: number, day: any) => sum + (day.totalCodingTime || 0), 0) / recentDays.length;
      const todayTime = sessionInsights.activeTime;

      if (todayTime > avgDailyCodingTime * 1.5) {
        insights.push({
          type: 'success',
          title: 'Above Average Performance',
          description: `You're coding ${Math.round(((todayTime - avgDailyCodingTime) / avgDailyCodingTime) * 100)}% more than your weekly average!`,
          actionable: false
        });
      }
    }

    // Default insight if no specific insights
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Ready to Code',
        description: 'Start coding to see personalized insights based on your activity.',
        actionable: false
      });
    }

    return insights.slice(0, 4); // Limit to 4 insights
  }

  /**
   * Execute insight action
   */
  private executeInsightAction(actionType: string, metadata: any): void {
    // Log metadata for debugging purposes
    console.log('Executing insight action:', actionType, metadata);

    switch (actionType) {
      case 'refactor':
        vscode.window.showInformationMessage('Opening refactoring suggestions...');
        break;
      case 'schedule':
        vscode.window.showInformationMessage('Adding to calendar...');
        break;
      default:
        vscode.window.showInformationMessage(`Executing action: ${actionType}`);
    }
  }

  /**
   * Setup auto-refresh for real-time updates
   */
  private setupAutoRefresh(panel: vscode.WebviewPanel): void {
    // Send initial data
    this.sendLatestMetrics(panel);
    this.sendSmartInsights(panel);

    // Set up periodic updates
    const refreshInterval = setInterval(() => {
      if (panel.visible && this.metricsTracker) {
        this.sendLatestMetrics(panel);

        // Send insights every 30 seconds
        if (Date.now() % 30000 < 2000) {
          this.sendSmartInsights(panel);
        }
      }
    }, 2000); // Refresh every 2 seconds for real-time feel

    panel.onDidDispose(() => {
      clearInterval(refreshInterval);
    });
  }







  /**
   * Handle theme change message from webview
   */
  private handleThemeChange(theme: string): void {
    // Save theme preference to workspace configuration
    vscode.workspace.getConfiguration('codePulse').update('theme', theme, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Load theme preference from configuration
   */
  private loadThemePreference(): string {
    const config = vscode.workspace.getConfiguration('codePulse');
    return config.get('theme', 'light');
  }

  /**
   * Save theme preference to configuration
   */
  private saveThemePreference(theme: string): void {
    const config = vscode.workspace.getConfiguration('codePulse');
    config.update('theme', theme, vscode.ConfigurationTarget.Global);
  }

  /**
   * Toggle theme between light and dark
   */
  private toggleTheme(panel: vscode.WebviewPanel): void {
    const currentTheme = this.loadThemePreference();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    this.saveThemePreference(newTheme);

    // Send theme update to webview
    panel.webview.postMessage({
      command: 'themeChanged',
      theme: newTheme
    });

    vscode.window.showInformationMessage(`Theme switched to ${newTheme} mode`);
  }


  /**
   * Calculate overall productivity score from report data
   */
  private calculateProductivityScore(report: any): number {
    const codeQuality = report.codeQuality?.maintainabilityIndex || 0;
    const performance = this.calculatePerformanceScore(report.performance);
    const teamCollaboration = report.teamMetrics?.collaborationScore || 0;
    const trends = this.calculateTrendScore(report.trends);

    return Math.round((codeQuality + performance + teamCollaboration + trends) / 4);
  }

  /**
   * Calculate performance score from performance metrics
   */
  private calculatePerformanceScore(performance: any): number {
    if (!performance) return 0;

    // Simple scoring based on memory usage and execution time
    const memoryScore = performance.memoryProfile?.allocation ?
      Math.max(0, 100 - (performance.memoryProfile.allocation / (1024 * 1024 * 100))) : 50;
    const executionScore = performance.executionHotspots?.length ?
      Math.max(0, 100 - performance.executionHotspots.length * 10) : 80;

    return Math.round((memoryScore + executionScore) / 2);
  }

  /**
   * Calculate trend score from trend analysis
   */
  private calculateTrendScore(trends: any): number {
    if (!trends) return 0;

    // Simple scoring based on trend patterns
    const seasonalScore = trends.seasonalPatterns?.monthlyTrends?.length ?
      Math.min(100, trends.seasonalPatterns.monthlyTrends.length * 20) : 0;
    const velocityScore = trends.velocityPrediction?.confidence ?
      trends.velocityPrediction.confidence * 100 : 0;

    return Math.round((seasonalScore + velocityScore) / 2);
  }

}