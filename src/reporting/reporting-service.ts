/**
 * Comprehensive Reporting Service
 * 
 * Central service that orchestrates all reporting functionality including
 * PDF generation, scheduled reports, team summaries, and CI/CD integration.
 */

import * as vscode from 'vscode';
import { ReportGenerator, ReportConfig, GeneratedReport } from './report-generator';
import { PDFGenerator } from './pdf-generator';
import { ScheduledReportsManager } from './scheduled-reports';
import { CICDIntegration } from './cicd-integration';
import { AnalyticsService } from '../analytics/analytics-service';
import { RegressionDetector } from '../analytics/regression-detector';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES

export interface ReportingServiceConfig {
  defaultFormat: 'pdf' | 'html' | 'json';
  enableScheduledReports: boolean;
  enableCICDIntegration: boolean;
  outputDirectory: string;
  retentionDays: number;
  maxConcurrentReports: number;
}

export interface ReportRequest {
  type: 'individual' | 'team' | 'project' | 'cicd' | 'executive';
  format: 'pdf' | 'html' | 'json' | 'csv';
  template?: string;
  timeRange?: { start: number; end: number };
  filters?: any;
  recipients?: string[];
  schedule?: any;
}

export interface ReportingStats {
  totalReports: number;
  reportsThisMonth: number;
  scheduledReports: number;
  failedReports: number;
  averageGenerationTime: number;
  mostPopularFormat: string;
  storageUsed: number;
}

// ------------ MAIN CLASS

export class ReportingService {
  private reportGenerator: ReportGenerator;
  private pdfGenerator: PDFGenerator;
  private scheduledReportsManager: ScheduledReportsManager;
  private cicdIntegration: CICDIntegration;
  private errorHandler = ErrorHandler.getInstance();
  
  private config: ReportingServiceConfig = {
    defaultFormat: 'pdf',
    enableScheduledReports: true,
    enableCICDIntegration: true,
    outputDirectory: 'reports',
    retentionDays: 90,
    maxConcurrentReports: 3
  };

  constructor(
    private context: vscode.ExtensionContext,
    analyticsService: AnalyticsService,
    regressionDetector: RegressionDetector
  ) {
    this.reportGenerator = new ReportGenerator(context, analyticsService);
    this.pdfGenerator = new PDFGenerator(context);
    this.scheduledReportsManager = new ScheduledReportsManager(context, this.reportGenerator);
    this.cicdIntegration = new CICDIntegration(context, this.reportGenerator, analyticsService, regressionDetector);
    
    this.loadConfiguration();
    this.initializeService();
  }

  /**
   * Initialize the reporting service
   */
  private initializeService(): void {
    if (this.config.enableScheduledReports) {
      this.scheduledReportsManager.start();
    }

    // Register cleanup on extension deactivation
    this.context.subscriptions.push({
      dispose: () => {
        this.scheduledReportsManager.stop();
      }
    });
  }

  /**
   * Generate a report based on request
   */
  public async generateReport(request: ReportRequest): Promise<GeneratedReport> {
    try {
      const startTime = Date.now();
      
      // Create report configuration
      const config = this.createReportConfig(request);
      
      // Generate the report
      let report = await this.reportGenerator.generateReport(config.id, config);
      
      // Convert to PDF if requested
      if (request.format === 'pdf') {
        const pdfPath = await this.pdfGenerator.generatePDF(report, request.template);
        report.filePath = pdfPath;
        report.format = 'pdf';
      }
      
      // Schedule if requested
      if (request.schedule) {
        await this.scheduleReport(config.id, request.schedule, request.recipients);
      }
      
      const generationTime = Date.now() - startTime;
      console.log(`Report generated in ${generationTime}ms: ${report.id}`);
      
      return report;
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
    timeRange: { start: number; end: number },
    format: 'pdf' | 'html' | 'json' = 'pdf'
  ): Promise<GeneratedReport> {
    const request: ReportRequest = {
      type: 'team',
      format,
      template: 'team-summary',
      timeRange,
      filters: { teams: [teamId] }
    };

    return this.generateReport(request);
  }

  /**
   * Generate CI/CD integration report
   */
  public async generateCICDReport(
    buildData: any,
    _format: 'json' | 'html' = 'json'
  ): Promise<any> {
    if (!this.config.enableCICDIntegration) {
      throw new Error('CI/CD integration is disabled');
    }

    return this.cicdIntegration.generateCICDReport(buildData);
  }

  /**
   * Generate executive summary report
   */
  public async generateExecutiveSummary(
    timeRange: { start: number; end: number },
    format: 'pdf' | 'html' = 'pdf'
  ): Promise<GeneratedReport> {
    const request: ReportRequest = {
      type: 'executive',
      format,
      template: 'executive-summary',
      timeRange
    };

    return this.generateReport(request);
  }

  /**
   * Schedule a report for automatic generation
   */
  public async scheduleReport(
    configId: string,
    schedule: any,
    recipients?: string[]
  ): Promise<string> {
    if (!this.config.enableScheduledReports) {
      throw new Error('Scheduled reports are disabled');
    }

    const distribution = recipients ? [{
      method: 'vscode_notification' as const,
      config: { recipients }
    }] : undefined;

    return this.scheduledReportsManager.scheduleReport(configId, schedule, distribution);
  }

  /**
   * Get all scheduled reports
   */
  public getScheduledReports(): any[] {
    return this.scheduledReportsManager.getScheduledJobs();
  }

  /**
   * Update scheduled report
   */
  public async updateScheduledReport(jobId: string, updates: any): Promise<void> {
    return this.scheduledReportsManager.updateScheduledReport(jobId, updates);
  }

  /**
   * Delete scheduled report
   */
  public async deleteScheduledReport(jobId: string): Promise<void> {
    return this.scheduledReportsManager.deleteScheduledReport(jobId);
  }

  /**
   * Pause scheduled report
   */
  public async pauseScheduledReport(jobId: string): Promise<void> {
    return this.scheduledReportsManager.pauseJob(jobId);
  }

  /**
   * Resume scheduled report
   */
  public async resumeScheduledReport(jobId: string): Promise<void> {
    return this.scheduledReportsManager.resumeJob(jobId);
  }

  /**
   * Run scheduled report immediately
   */
  public async runScheduledReportNow(jobId: string): Promise<GeneratedReport> {
    return this.scheduledReportsManager.runJobNow(jobId);
  }

  /**
   * Get report history
   */
  public async getReportHistory(limit: number = 50): Promise<GeneratedReport[]> {
    return this.reportGenerator.getReportHistory(limit);
  }

  /**
   * Get reporting statistics
   */
  public async getReportingStats(): Promise<ReportingStats> {
    const history = await this.getReportHistory(1000);
    const schedulerStats = this.scheduledReportsManager.getSchedulerStats();
    
    const now = Date.now();
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const reportsThisMonth = history.filter(r => r.generatedAt >= monthStart.getTime()).length;
    const failedReports = schedulerStats.failedRuns;
    
    // Calculate average generation time (simplified)
    const avgTime = history.length > 0 ? 5000 : 0; // Placeholder
    
    // Calculate storage used
    const storageUsed = history.reduce((sum, r) => sum + (r.metadata.fileSize || 0), 0);
    
    // Find most popular format
    const formatCounts = history.reduce((counts, r) => {
      counts[r.format] = (counts[r.format] || 0) + 1;
      return counts;
    }, {} as { [key: string]: number });
    
    const mostPopularFormat = Object.entries(formatCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'pdf';

    return {
      totalReports: history.length,
      reportsThisMonth,
      scheduledReports: schedulerStats.activeJobs,
      failedReports,
      averageGenerationTime: avgTime,
      mostPopularFormat,
      storageUsed
    };
  }

  /**
   * Get available report templates
   */
  public getAvailableTemplates(): string[] {
    return this.reportGenerator.getAvailableTemplates();
  }

  /**
   * Create custom report template
   */
  public async createReportTemplate(_template: any): Promise<void> {
    // Implementation would depend on template storage system
    throw new Error('Custom template creation not yet implemented');
  }

  /**
   * Export report in different format
   */
  public async exportReport(
    _reportId: string,
    _targetFormat: 'pdf' | 'html' | 'json' | 'csv'
  ): Promise<string> {
    // Implementation would convert existing report to target format
    throw new Error('Report format conversion not yet implemented');
  }

  /**
   * Clean up old reports based on retention policy
   */
  public async cleanupOldReports(): Promise<number> {
    const cutoffDate = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const history = await this.getReportHistory(1000);
    
    const oldReports = history.filter(r => r.generatedAt < cutoffDate);
    
    // In a real implementation, you would delete the actual files
    console.log(`Would clean up ${oldReports.length} old reports`);
    
    return oldReports.length;
  }

  /**
   * Update service configuration
   */
  public updateConfiguration(newConfig: Partial<ReportingServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
    
    // Restart scheduled reports if setting changed
    if ('enableScheduledReports' in newConfig) {
      if (newConfig.enableScheduledReports) {
        this.scheduledReportsManager.start();
      } else {
        this.scheduledReportsManager.stop();
      }
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): ReportingServiceConfig {
    return { ...this.config };
  }

  /**
   * Create report configuration from request
   */
  private createReportConfig(request: ReportRequest): ReportConfig {
    const configId = `${request.type}_${Date.now()}`;
    
    const config: ReportConfig = {
      id: configId,
      name: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} Report`,
      type: request.type,
      format: request.format,
      template: request.template || 'default',
      filters: {
        dateRange: request.timeRange ? {
          start: request.timeRange.start,
          end: request.timeRange.end,
          type: 'absolute' as const
        } : {
          start: Date.now() - (30 * 24 * 60 * 60 * 1000),
          end: Date.now(),
          type: 'relative' as const,
          relativePeriod: 'last30days'
        },
        ...request.filters
      },
      sections: this.getDefaultSections(request.type),
      branding: this.getDefaultBranding()
    };

    return config;
  }

  /**
   * Get default sections for report type
   */
  private getDefaultSections(type: string): any[] {
    const baseSections = [
      {
        id: 'summary',
        title: 'Summary',
        type: 'summary',
        config: {},
        order: 1,
        enabled: true
      },
      {
        id: 'metrics',
        title: 'Key Metrics',
        type: 'metrics',
        config: { metrics: ['productivity', 'quality', 'velocity', 'complexity'] },
        order: 2,
        enabled: true
      }
    ];

    switch (type) {
      case 'team':
        return [
          ...baseSections,
          {
            id: 'team_insights',
            title: 'Team Insights',
            type: 'insights',
            config: { maxInsights: 5 },
            order: 3,
            enabled: true
          }
        ];
      
      case 'executive':
        return [
          ...baseSections,
          {
            id: 'trends',
            title: 'Trends Analysis',
            type: 'trends',
            config: { showConfidence: true },
            order: 3,
            enabled: true
          },
          {
            id: 'recommendations',
            title: 'Strategic Recommendations',
            type: 'recommendations',
            config: { priorityFilter: ['critical', 'high'] },
            order: 4,
            enabled: true
          }
        ];
      
      case 'cicd':
        return [
          {
            id: 'build_summary',
            title: 'Build Summary',
            type: 'summary',
            config: { includeBuildData: true },
            order: 1,
            enabled: true
          },
          {
            id: 'quality_gates',
            title: 'Quality Gates',
            type: 'table',
            config: { tableType: 'qualityGates' },
            order: 2,
            enabled: true
          }
        ];
      
      default:
        return baseSections;
    }
  }

  /**
   * Get default branding configuration
   */
  private getDefaultBranding(): any {
    return {
      primaryColor: '#3b82f6',
      secondaryColor: '#1e40af',
      fontFamily: 'Segoe UI, sans-serif',
      companyName: 'CodePulse Analytics',
      reportFooter: 'Generated by CodePulse Analytics Extension'
    };
  }

  /**
   * Load configuration from storage
   */
  private loadConfiguration(): void {
    try {
      const config = this.context.globalState.get<ReportingServiceConfig>('reportingConfig');
      if (config) {
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      console.error('Failed to load reporting configuration:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('reportingConfig', this.config);
    } catch (error) {
      console.error('Failed to save reporting configuration:', error);
    }
  }
}
