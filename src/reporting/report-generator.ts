/**
 * Comprehensive Report Generator
 * 
 * Generates various types of reports including PDF reports, team summaries,
 * scheduled reports, and CI/CD integration reports with customizable templates.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MetricsStorage, StoredMetrics } from '../metrics/storage';
import { AnalyticsService } from '../analytics/analytics-service';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
  defaultConfig: any;
}

export interface ReportBranding {
  logo: string;
  companyName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  footer: string;
}

export interface ReportConfig {
  id: string;
  name: string;
  type: 'individual' | 'team' | 'project' | 'cicd' | 'executive';
  format: 'pdf' | 'html' | 'json' | 'csv' | 'markdown';
  template: string;
  schedule?: ScheduleConfig;
  recipients?: string[];
  filters?: ReportFilters;
  sections: ReportSection[];
  branding?: BrandingConfig;
}

export interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  timezone: string;
  lastRun?: number;
  nextRun?: number;
}

export interface ReportFilters {
  dateRange: {
    start: number;
    end: number;
    type: 'absolute' | 'relative';
    relativePeriod?: string; // e.g., 'last30days', 'thisMonth'
  };
  projects?: string[];
  teams?: string[];
  languages?: string[];
  metrics?: string[];
  minConfidence?: number;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'metrics' | 'trends' | 'charts' | 'insights' | 'recommendations' | 'table' | 'text';
  config: any;
  order: number;
  enabled: boolean;
}

export interface BrandingConfig {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  companyName: string;
  reportFooter?: string;
}

export interface GeneratedReport {
  id: string;
  configId: string;
  generatedAt: number;
  format: string;
  filePath: string;
  metadata: {
    title: string;
    subtitle?: string;
    author: string;
    dateRange: { start: number; end: number };
    pageCount?: number;
    fileSize: number;
  };
  sections: GeneratedSection[];
  summary: ReportSummary;
}

export interface GeneratedSection {
  id: string;
  title: string;
  type: string;
  content: any;
  charts?: ChartData[];
  tables?: TableData[];
}

export interface ChartData {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  data: any;
  options: any;
  base64Image?: string;
}

export interface TableData {
  id: string;
  title: string;
  headers: string[];
  rows: any[][];
  formatting?: TableFormatting;
}

export interface TableFormatting {
  headerStyle?: any;
  rowStyle?: any;
  alternateRowColor?: boolean;
  borders?: boolean;
}

export interface ReportSummary {
  totalSections: number;
  generatedAt: number;
  dataPoints: number;
  insights: number;
  recommendations: number;
  totalMetrics: number;
  keyInsights: string[];
  criticalAlerts: number;
  overallTrend: 'improving' | 'stable' | 'declining';
  healthScore: number;
}

// ------------ MAIN CLASS

export class ReportGenerator {
  private storage: MetricsStorage;
  private analyticsService: AnalyticsService;
  private errorHandler = ErrorHandler.getInstance();
  private reportConfigs = new Map<string, ReportConfig>();
  private templates = new Map<string, ReportTemplate>();
  
  constructor(
    private context: vscode.ExtensionContext,
    analyticsService: AnalyticsService
  ) {
    this.storage = new MetricsStorage(context);
    this.analyticsService = analyticsService;
    this.loadReportConfigs();
    this.loadReportTemplates();
  }

  /**
   * Generate a report based on configuration
   */
  public async generateReport(configId: string, overrides?: Partial<ReportConfig>): Promise<GeneratedReport> {
    try {
      const config = this.reportConfigs.get(configId);
      if (!config) {
        throw new Error(`Report configuration not found: ${configId}`);
      }

      // Apply overrides if provided
      const finalConfig = overrides ? { ...config, ...overrides } : config;

      // Collect data for the report
      const reportData = await this.collectReportData(finalConfig);

      // Generate sections
      const sections = await this.generateSections(finalConfig, reportData);

      // Create report summary
      const summary = this.createReportSummary(reportData, sections);

      // Generate the actual report file
      const filePath = await this.generateReportFile(finalConfig, sections, summary);

      // Create report metadata
      const generatedReport: GeneratedReport = {
        id: `report_${Date.now()}`,
        configId,
        generatedAt: Date.now(),
        format: finalConfig.format,
        filePath,
        metadata: {
          title: finalConfig.name,
          author: 'CodePulse Analytics',
          dateRange: {
            start: finalConfig.filters?.dateRange.start || Date.now() - (30 * 24 * 60 * 60 * 1000),
            end: finalConfig.filters?.dateRange.end || Date.now()
          },
          fileSize: this.getFileSize(filePath)
        },
        sections,
        summary
      };

      // Save report record
      await this.saveReportRecord(generatedReport);

      return generatedReport;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Generate team summary report
   */
  public async generateTeamSummaryReport(
    teamId: string,
    dateRange: { start: number; end: number },
    format: 'pdf' | 'html' | 'json' = 'pdf'
  ): Promise<GeneratedReport> {
    const config: ReportConfig = {
      id: `team_summary_${teamId}`,
      name: `Team Summary Report - ${teamId}`,
      type: 'team',
      format,
      template: 'team-summary',
      filters: {
        dateRange: { ...dateRange, type: 'absolute' },
        teams: [teamId]
      },
      sections: [
        {
          id: 'team_overview',
          title: 'Team Overview',
          type: 'summary',
          config: { includeMembers: true, includeMetrics: true },
          order: 1,
          enabled: true
        },
        {
          id: 'productivity_metrics',
          title: 'Productivity Metrics',
          type: 'metrics',
          config: { metrics: ['productivity', 'velocity', 'quality'] },
          order: 2,
          enabled: true
        },
        {
          id: 'trend_analysis',
          title: 'Trend Analysis',
          type: 'trends',
          config: { showConfidence: true, includeForecast: true },
          order: 3,
          enabled: true
        },
        {
          id: 'team_insights',
          title: 'Key Insights',
          type: 'insights',
          config: { maxInsights: 5, minImpact: 'medium' },
          order: 4,
          enabled: true
        },
        {
          id: 'recommendations',
          title: 'Recommendations',
          type: 'recommendations',
          config: { maxRecommendations: 8, priorityFilter: ['critical', 'high'] },
          order: 5,
          enabled: true
        }
      ],
      branding: this.getDefaultBranding()
    };

    return this.generateReport(config.id, config);
  }

  /**
   * Generate CI/CD integration report
   */
  public async generateCICDReport(
    pipelineId: string,
    buildData: any,
    format: 'json' | 'html' = 'json'
  ): Promise<GeneratedReport> {
    const config: ReportConfig = {
      id: `cicd_${pipelineId}`,
      name: `CI/CD Integration Report - ${pipelineId}`,
      type: 'cicd',
      format,
      template: 'cicd-integration',
      filters: {
        dateRange: {
          start: buildData.startTime || Date.now() - (24 * 60 * 60 * 1000),
          end: buildData.endTime || Date.now(),
          type: 'absolute'
        }
      },
      sections: [
        {
          id: 'build_summary',
          title: 'Build Summary',
          type: 'summary',
          config: { buildData },
          order: 1,
          enabled: true
        },
        {
          id: 'quality_gates',
          title: 'Quality Gates',
          type: 'metrics',
          config: { 
            metrics: ['complexity', 'coverage', 'quality'],
            thresholds: buildData.qualityGates
          },
          order: 2,
          enabled: true
        },
        {
          id: 'regression_check',
          title: 'Regression Analysis',
          type: 'insights',
          config: { focusOnRegressions: true },
          order: 3,
          enabled: true
        },
        {
          id: 'recommendations',
          title: 'Action Items',
          type: 'recommendations',
          config: { cicdFocus: true },
          order: 4,
          enabled: true
        }
      ],
      branding: this.getDefaultBranding()
    };

    return this.generateReport(config.id, config);
  }

  /**
   * Schedule a report for automatic generation
   */
  public async scheduleReport(configId: string, schedule: ScheduleConfig): Promise<void> {
    const config = this.reportConfigs.get(configId);
    if (!config) {
      throw new Error(`Report configuration not found: ${configId}`);
    }

    config.schedule = {
      ...schedule,
      nextRun: this.calculateNextRun(schedule)
    };

    this.reportConfigs.set(configId, config);
    await this.saveReportConfigs();

    // Register with VS Code scheduler if available
    this.registerScheduledReport(config);
  }

  /**
   * Process scheduled reports
   */
  public async processScheduledReports(): Promise<void> {
    const now = Date.now();
    
    for (const [configId, config] of this.reportConfigs) {
      if (config.schedule?.enabled && config.schedule.nextRun && config.schedule.nextRun <= now) {
        try {
          const report = await this.generateReport(configId);
          
          // Send to recipients if configured
          if (config.recipients && config.recipients.length > 0) {
            await this.distributeReport(report, config.recipients);
          }

          // Update next run time
          config.schedule.lastRun = now;
          config.schedule.nextRun = this.calculateNextRun(config.schedule);
          this.reportConfigs.set(configId, config);
          
        } catch (error) {
          this.errorHandler.handleError(error as Error);
        }
      }
    }

    await this.saveReportConfigs();
  }

  /**
   * Get available report templates
   */
  public getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Create a new report configuration
   */
  public async createReportConfig(config: ReportConfig): Promise<void> {
    this.reportConfigs.set(config.id, config);
    await this.saveReportConfigs();
  }

  /**
   * Update an existing report configuration
   */
  public async updateReportConfig(configId: string, updates: Partial<ReportConfig>): Promise<void> {
    const existing = this.reportConfigs.get(configId);
    if (!existing) {
      throw new Error(`Report configuration not found: ${configId}`);
    }

    const updated = { ...existing, ...updates };
    this.reportConfigs.set(configId, updated);
    await this.saveReportConfigs();
  }

  /**
   * Delete a report configuration
   */
  public async deleteReportConfig(configId: string): Promise<void> {
    this.reportConfigs.delete(configId);
    await this.saveReportConfigs();
  }

  /**
   * Get all report configurations
   */
  public getReportConfigs(): ReportConfig[] {
    return Array.from(this.reportConfigs.values());
  }

  /**
   * Get report generation history
   */
  public async getReportHistory(limit: number = 50): Promise<GeneratedReport[]> {
    try {
      const historyPath = path.join(this.context.globalStorageUri.fsPath, 'report-history.json');
      if (!fs.existsSync(historyPath)) {
        return [];
      }

      const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      return historyData.slice(0, limit);
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return [];
    }
  }

  /**
   * Collect data for report generation
   */
  private async collectReportData(config: ReportConfig): Promise<any> {
    const data: any = {
      metrics: {},
      analytics: {},
      insights: [],
      recommendations: []
    };

    // Get basic metrics
    const metricsData = this.storage.loadMetrics();
    data.metrics = this.filterMetricsData(metricsData, config.filters);

    // Get analytics data if analytics service is available
    if (this.analyticsService) {
      try {
        const timeRange = config.filters?.dateRange ? {
          start: config.filters.dateRange.start,
          end: config.filters.dateRange.end,
          granularity: 'day' as const
        } : undefined;

        data.analytics = await this.analyticsService.generateAnalyticsReport(timeRange);
      } catch (error) {
        console.warn('Failed to get analytics data:', error);
      }
    }

    return data;
  }

  /**
   * Filter metrics data based on report filters
   */
  private filterMetricsData(data: StoredMetrics, filters?: ReportFilters): any {
    if (!filters) {return data;}

    let filtered = { ...data };

    // Filter by date range
    if (filters.dateRange) {
      filtered.dailyMetrics = data.dailyMetrics.filter(day => {
        const timestamp = new Date(day.date).getTime();
        return timestamp >= filters.dateRange.start && timestamp <= filters.dateRange.end;
      });
    }

    // Filter by projects (would need project metadata)
    if (filters.projects && filters.projects.length > 0) {
      // Implementation would depend on how project data is stored
    }

    // Filter by languages
    if (filters.languages && filters.languages.length > 0) {
      filtered.fileMetrics = Object.fromEntries(
        Object.entries(data.fileMetrics).filter(([_path, metrics]) =>
          filters.languages!.includes(metrics.language)
        )
      );
    }

    return filtered;
  }

  /**
   * Generate report sections
   */
  private async generateSections(config: ReportConfig, data: any): Promise<GeneratedSection[]> {
    const sections: GeneratedSection[] = [];

    for (const sectionConfig of config.sections.filter(s => s.enabled).sort((a, b) => a.order - b.order)) {
      try {
        const section = await this.generateSection(sectionConfig, data, config);
        sections.push(section);
      } catch (error) {
        console.error(`Failed to generate section ${sectionConfig.id}:`, error);
      }
    }

    return sections;
  }

  /**
   * Generate individual section
   */
  private async generateSection(sectionConfig: ReportSection, data: any, _reportConfig: ReportConfig): Promise<GeneratedSection> {
    const section: GeneratedSection = {
      id: sectionConfig.id,
      title: sectionConfig.title,
      type: sectionConfig.type,
      content: {},
      charts: [],
      tables: []
    };

    switch (sectionConfig.type) {
      case 'summary':
        section.content = this.generateSummaryContent(data, sectionConfig.config);
        break;

      case 'metrics':
        const metricsResult = this.generateMetricsContent(data, sectionConfig.config);
        section.content = metricsResult.content;
        section.charts = metricsResult.charts;
        section.tables = metricsResult.tables;
        break;

      case 'trends':
        const trendsResult = this.generateTrendsContent(data, sectionConfig.config);
        section.content = trendsResult.content;
        section.charts = trendsResult.charts;
        break;

      case 'insights':
        section.content = this.generateInsightsContent(data, sectionConfig.config);
        break;

      case 'recommendations':
        section.content = this.generateRecommendationsContent(data, sectionConfig.config);
        break;

      case 'table':
        section.tables = [this.generateTableContent(data, sectionConfig.config)];
        break;

      case 'text':
        section.content = { text: sectionConfig.config.text || '' };
        break;
    }

    return section;
  }

  /**
   * Generate summary content
   */
  private generateSummaryContent(data: any, config: any): any {
    const summary: any = {
      reportPeriod: this.formatDateRange(data.analytics?.timeRange),
      totalMetrics: Object.keys(data.metrics.fileMetrics || {}).length,
      activeDays: data.metrics.dailyMetrics?.length || 0
    };

    if (config.includeMetrics && data.analytics?.summary) {
      summary.keyMetrics = data.analytics.summary.keyMetrics;
      summary.healthScore = data.analytics.summary.healthScore;
      summary.overallTrend = data.analytics.summary.overallTrend;
    }

    if (config.includeMembers && config.teamData) {
      summary.teamSize = config.teamData.members?.length || 0;
      summary.teamMembers = config.teamData.members || [];
    }

    return summary;
  }

  /**
   * Generate metrics content
   */
  private generateMetricsContent(data: any, config: any): { content: any; charts: ChartData[]; tables: TableData[] } {
    const content: any = {};
    const charts: ChartData[] = [];
    const tables: TableData[] = [];

    const requestedMetrics = config.metrics || ['productivity', 'quality', 'velocity', 'complexity'];

    requestedMetrics.forEach((metric: string) => {
      const metricData = this.extractMetricData(data, metric);
      content[metric] = metricData;

      // Generate chart for metric
      if (metricData.timeSeries && metricData.timeSeries.length > 0) {
        charts.push({
          id: `${metric}_chart`,
          type: 'line',
          title: `${metric.charAt(0).toUpperCase() + metric.slice(1)} Trend`,
          data: {
            labels: metricData.timeSeries.map((d: any) => d.date),
            datasets: [{
              label: metric,
              data: metricData.timeSeries.map((d: any) => d.value),
              borderColor: this.getMetricColor(metric),
              backgroundColor: this.getMetricColor(metric, 0.1)
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
      }
    });

    // Generate summary table
    if (requestedMetrics.length > 1) {
      tables.push({
        id: 'metrics_summary',
        title: 'Metrics Summary',
        headers: ['Metric', 'Current Value', 'Change', 'Trend'],
        rows: requestedMetrics.map((metric: string) => {
          const metricData = content[metric];
          return [
            metric.charAt(0).toUpperCase() + metric.slice(1),
            metricData.currentValue?.toFixed(2) || 'N/A',
            metricData.change ? `${metricData.change > 0 ? '+' : ''}${metricData.change.toFixed(1)}%` : 'N/A',
            metricData.trend || 'stable'
          ];
        }),
        formatting: {
          headerStyle: { fontWeight: 'bold', backgroundColor: '#f5f5f5' },
          alternateRowColor: true,
          borders: true
        }
      });
    }

    return { content, charts, tables };
  }

  /**
   * Generate trends content
   */
  private generateTrendsContent(data: any, config: any): { content: any; charts: ChartData[] } {
    const content: any = {};
    const charts: ChartData[] = [];

    if (data.analytics?.trends) {
      content.trends = data.analytics.trends.map((trend: any) => ({
        metric: trend.metric,
        direction: trend.trendDirection,
        confidence: trend.confidence,
        changeRate: trend.changeRate,
        description: `${trend.metric} is ${trend.trendDirection} with ${(trend.confidence * 100).toFixed(1)}% confidence`
      }));

      // Generate trend charts
      data.analytics.trends.forEach((trend: any) => {
        if (trend.dataPoints && trend.dataPoints.length > 0) {
          const chartData = {
            labels: trend.dataPoints.map((d: any) => new Date(d.timestamp).toLocaleDateString()),
            datasets: [
              {
                label: trend.metric,
                data: trend.dataPoints.map((d: any) => d.value),
                borderColor: this.getTrendColor(trend.trendDirection),
                backgroundColor: this.getTrendColor(trend.trendDirection, 0.1),
                fill: true
              }
            ]
          };

          if (config.showConfidence && trend.dataPoints.some((d: any) => d.movingAverage)) {
            chartData.datasets.push({
              label: 'Moving Average',
              data: trend.dataPoints.map((d: any) => d.movingAverage),
              borderColor: '#666',
              backgroundColor: 'transparent',
              borderDash: [5, 5]
            } as any);
          }

          charts.push({
            id: `trend_${trend.metric}`,
            type: 'line',
            title: `${trend.metric} Trend Analysis`,
            data: chartData,
            options: {
              responsive: true,
              plugins: {
                legend: { display: true },
                title: {
                  display: true,
                  text: `Confidence: ${(trend.confidence * 100).toFixed(1)}%`
                }
              }
            }
          });
        }
      });
    }

    return { content, charts };
  }

  /**
   * Generate insights content
   */
  private generateInsightsContent(data: any, config: any): any {
    const insights: any[] = [];

    if (data.analytics?.insights) {
      const filteredInsights = data.analytics.insights
        .filter((insight: any) => {
          if (config.minImpact) {
            const impactOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
            return impactOrder[insight.impact] >= impactOrder[config.minImpact];
          }
          return true;
        })
        .slice(0, config.maxInsights || 10);

      insights.push(...filteredInsights.map((insight: any) => ({
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        confidence: insight.confidence,
        category: insight.category,
        evidence: insight.evidence,
        timeframe: insight.timeframe
      })));
    }

    // Add regression-specific insights if requested
    if (config.focusOnRegressions && data.analytics?.regressions) {
      const regressionInsights = data.analytics.regressions
        .filter((r: any) => r.severity === 'critical' || r.severity === 'major')
        .map((r: any) => ({
          title: `${r.severity.toUpperCase()}: ${r.metric} Regression`,
          description: r.description,
          impact: r.severity === 'critical' ? 'high' : 'medium',
          confidence: r.confidence,
          category: 'regression',
          evidence: r.possibleCauses.map((c: any) => c.description),
          timeframe: 'immediate'
        }));

      insights.push(...regressionInsights);
    }

    return { insights, totalCount: insights.length };
  }

  /**
   * Generate recommendations content
   */
  private generateRecommendationsContent(data: any, config: any): any {
    const recommendations: any[] = [];

    if (data.analytics?.recommendations) {
      let filteredRecommendations = data.analytics.recommendations;

      // Filter by priority
      if (config.priorityFilter && config.priorityFilter.length > 0) {
        filteredRecommendations = filteredRecommendations.filter((r: any) =>
          config.priorityFilter.includes(r.priority)
        );
      }

      // Filter for CI/CD focus
      if (config.cicdFocus) {
        filteredRecommendations = filteredRecommendations.filter((r: any) =>
          r.category === 'technical' || r.category === 'process'
        );
      }

      recommendations.push(...filteredRecommendations
        .slice(0, config.maxRecommendations || 10)
        .map((rec: any) => ({
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          category: rec.category,
          expectedImpact: rec.expectedImpact,
          effort: rec.effort,
          timeline: rec.timeline,
          actionItems: rec.actionItems,
          successMetrics: rec.successMetrics
        })));
    }

    return { recommendations, totalCount: recommendations.length };
  }

  /**
   * Generate table content
   */
  private generateTableContent(_data: any, config: any): TableData {
    // Implementation would depend on specific table requirements
    return {
      id: config.id || 'custom_table',
      title: config.title || 'Data Table',
      headers: config.headers || [],
      rows: config.rows || [],
      formatting: config.formatting
    };
  }

  /**
   * Extract metric data from collected data
   */
  private extractMetricData(data: any, metric: string): any {
    const result: any = {
      currentValue: 0,
      change: 0,
      trend: 'stable',
      timeSeries: []
    };

    // Extract from analytics data if available
    if (data.analytics?.summary?.keyMetrics?.[metric]) {
      const metricData = data.analytics.summary.keyMetrics[metric];
      result.currentValue = metricData.current;
      result.change = metricData.change;
      result.trend = metricData.trend;
    }

    // Extract time series data
    if (data.metrics?.dailyMetrics) {
      result.timeSeries = data.metrics.dailyMetrics.map((day: any) => {
        let value = 0;
        switch (metric) {
          case 'productivity':
            value = day.totalCodingTime / (1000 * 60 * 60); // Convert to hours
            break;
          case 'velocity':
            value = day.filesEdited;
            break;
          case 'quality':
            // Simplified quality calculation
            value = Math.max(0, 100 - (day.averageComplexity || 0) * 5);
            break;
          case 'complexity':
            value = day.averageComplexity || 0;
            break;
        }
        return {
          date: day.date,
          value
        };
      });
    }

    return result;
  }

  /**
   * Get color for metric
   */
  private getMetricColor(metric: string, alpha: number = 1): string {
    const colors: { [key: string]: string } = {
      productivity: `rgba(34, 197, 94, ${alpha})`, // Green
      quality: `rgba(59, 130, 246, ${alpha})`, // Blue
      velocity: `rgba(168, 85, 247, ${alpha})`, // Purple
      complexity: `rgba(239, 68, 68, ${alpha})` // Red
    };
    return colors[metric] || `rgba(107, 114, 128, ${alpha})`;
  }

  /**
   * Get color for trend direction
   */
  private getTrendColor(direction: string, alpha: number = 1): string {
    switch (direction) {
      case 'improving': return `rgba(34, 197, 94, ${alpha})`;
      case 'declining': return `rgba(239, 68, 68, ${alpha})`;
      default: return `rgba(107, 114, 128, ${alpha})`;
    }
  }

  /**
   * Format date range for display
   */
  private formatDateRange(timeRange?: { start: number; end: number }): string {
    if (!timeRange) {return 'Unknown period';}

    const start = new Date(timeRange.start).toLocaleDateString();
    const end = new Date(timeRange.end).toLocaleDateString();
    return `${start} - ${end}`;
  }

  /**
   * Load report configurations from storage
   */
  private loadReportConfigs(): void {
    try {
      const stored = this.context.globalState.get<Record<string, ReportConfig>>('reportConfigs');
      if (stored) {
        this.reportConfigs = new Map(Object.entries(stored));
      }
    } catch (error) {
      console.error('Failed to load report configs:', error);
    }
  }

  /**
   * Load report templates from storage
   */
  private loadReportTemplates(): void {
    try {
      const stored = this.context.globalState.get<Record<string, any>>('reportTemplates');
      if (stored) {
        this.templates = new Map(Object.entries(stored));
      }
    } catch (error) {
      console.error('Failed to load report templates:', error);
    }
  }

  /**
   * Create report summary from data and sections
   */
  private createReportSummary(reportData: any, sections: GeneratedSection[]): ReportSummary {
    return {
      totalSections: sections.length,
      generatedAt: Date.now(),
      dataPoints: Object.keys(reportData.metrics || {}).length,
      insights: reportData.analytics?.insights?.length || 0,
      recommendations: reportData.analytics?.recommendations?.length || 0,
      totalMetrics: Object.keys(reportData.metrics || {}).length,
      keyInsights: reportData.analytics?.insights?.slice(0, 3).map((i: any) => i.title) || [],
      criticalAlerts: reportData.analytics?.insights?.filter((i: any) => i.impact === 'high').length || 0,
      overallTrend: reportData.analytics?.summary?.overallTrend || 'stable',
      healthScore: reportData.analytics?.summary?.healthScore || 75
    };
  }

  /**
   * Generate the actual report file
   */
  private async generateReportFile(config: ReportConfig, sections: GeneratedSection[], summary: ReportSummary): Promise<string> {
    const fileName = `${config.name.replace(/\s+/g, '_')}_${Date.now()}.${config.format}`;
    const filePath = path.join(this.context.extensionPath, 'reports', fileName);

    // Ensure reports directory exists
    const reportsDir = path.dirname(filePath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate content based on format
    let content: string;
    switch (config.format) {
      case 'json':
        content = JSON.stringify({ config, sections, summary }, null, 2);
        break;
      case 'html':
        content = this.generateHTMLReport(config, sections, summary);
        break;
      default:
        content = this.generateTextReport(config, sections, summary);
    }

    fs.writeFileSync(filePath, content);
    return filePath;
  }

  /**
   * Get file size in bytes
   */
  private getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Save report record to storage
   */
  private async saveReportRecord(report: GeneratedReport): Promise<void> {
    try {
      const reports = this.context.globalState.get<GeneratedReport[]>('generatedReports') || [];
      reports.push(report);

      // Keep only last 100 reports
      if (reports.length > 100) {
        reports.splice(0, reports.length - 100);
      }

      await this.context.globalState.update('generatedReports', reports);
    } catch (error) {
      console.error('Failed to save report record:', error);
    }
  }

  /**
   * Get default branding configuration
   */
  private getDefaultBranding(): BrandingConfig {
    return {
      logo: '',
      companyName: 'CodePulse Analytics',
      primaryColor: '#007ACC',
      secondaryColor: '#1E1E1E',
      fontFamily: 'Arial, sans-serif',
      reportFooter: 'Generated by CodePulse - Developer Productivity Analytics'
    };
  }

  /**
   * Calculate next run time for scheduled report
   */
  private calculateNextRun(schedule: ScheduleConfig): number {
    const now = new Date();
    const next = new Date(now);

    switch (schedule.frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
    }

    return next.getTime();
  }

  /**
   * Save report configurations to storage
   */
  private async saveReportConfigs(): Promise<void> {
    try {
      const configs = Object.fromEntries(this.reportConfigs);
      await this.context.globalState.update('reportConfigs', configs);
    } catch (error) {
      console.error('Failed to save report configs:', error);
    }
  }

  /**
   * Register scheduled report with VS Code
   */
  private registerScheduledReport(config: ReportConfig): void {
    // Implementation would integrate with VS Code's task scheduler
    console.log(`Registered scheduled report: ${config.name}`);
  }

  /**
   * Distribute report to recipients
   */
  private async distributeReport(report: GeneratedReport, recipients: string[]): Promise<void> {
    // Implementation would handle email/notification distribution
    console.log(`Distributing report ${report.id} to ${recipients.length} recipients`);
  }

  /**
   * Generate HTML report content
   */
  private generateHTMLReport(config: ReportConfig, sections: GeneratedSection[], _summary: ReportSummary): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #007ACC; padding-bottom: 10px; }
            .section { margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${config.name}</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
          ${sections.map(section => `
            <div class="section">
              <h2>${section.title}</h2>
              <div>${section.content}</div>
            </div>
          `).join('')}
        </body>
      </html>
    `;
  }

  /**
   * Generate text report content
   */
  private generateTextReport(config: ReportConfig, sections: GeneratedSection[], _summary: ReportSummary): string {
    return `
${config.name}
${'='.repeat(config.name.length)}

Generated: ${new Date().toLocaleString()}

${sections.map(section => `
${section.title}
${'-'.repeat(section.title.length)}
${section.content}
`).join('\n')}
    `.trim();
  }
}
