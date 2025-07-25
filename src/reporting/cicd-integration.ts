/**
 * CI/CD Integration Reporter
 * 
 * Provides specialized reporting for CI/CD pipelines with quality gates,
 * build metrics, and automated decision making for deployment readiness.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ReportGenerator, GeneratedReport } from './report-generator';
import { AnalyticsService } from '../analytics/analytics-service';
import { RegressionDetector } from '../analytics/regression-detector';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES

export interface CICDReport {
  buildId: string;
  pipelineId: string;
  buildNumber: number;
  branch: string;
  commit: string;
  timestamp: number;
  status: 'success' | 'failure' | 'warning';
  qualityGates: QualityGate[];
  metrics: CICDMetrics;
  regressions: any[];
  recommendations: string[];
  deploymentReadiness: DeploymentReadiness;
  artifacts: ReportArtifact[];
}

export interface QualityGate {
  id: string;
  name: string;
  type: 'threshold' | 'comparison' | 'trend';
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'within_range';
  threshold: number | { min: number; max: number };
  actualValue: number;
  status: 'passed' | 'failed' | 'warning';
  severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info';
  message: string;
}

export interface CICDMetrics {
  codeQuality: {
    complexity: number;
    maintainabilityIndex: number;
    technicalDebtRatio: number;
    codeSmells: number;
  };
  testCoverage: {
    linesCovered: number;
    totalLines: number;
    percentage: number;
    branchCoverage: number;
  };
  security: {
    vulnerabilities: number;
    securityHotspots: number;
    securityRating: string;
  };
  performance: {
    buildTime: number;
    testTime: number;
    deploymentTime?: number;
  };
  changeMetrics: {
    linesAdded: number;
    linesDeleted: number;
    filesChanged: number;
    complexity: number;
  };
}

export interface DeploymentReadiness {
  status: 'ready' | 'not_ready' | 'conditional';
  confidence: number;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  qualityScore: number;
}

export interface ReportArtifact {
  type: 'json' | 'html' | 'junit' | 'coverage' | 'security';
  name: string;
  path: string;
  size: number;
  checksum?: string;
}

export interface CICDConfig {
  qualityGates: QualityGateConfig[];
  thresholds: {
    complexity: number;
    coverage: number;
    maintainability: number;
    technicalDebt: number;
  };
  notifications: {
    onFailure: boolean;
    onSuccess: boolean;
    onWarning: boolean;
    webhooks: string[];
  };
  artifacts: {
    generateJson: boolean;
    generateHtml: boolean;
    generateJunit: boolean;
    outputPath: string;
  };
}

export interface QualityGateConfig {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number | { min: number; max: number };
  severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info';
  enabled: boolean;
}

// ------------ MAIN CLASS

export class CICDIntegration {
  private reportGenerator: ReportGenerator;
  private analyticsService: AnalyticsService;
  private regressionDetector: RegressionDetector;
  private errorHandler = ErrorHandler.getInstance();
  
  constructor(
    private context: vscode.ExtensionContext,
    reportGenerator: ReportGenerator,
    analyticsService: AnalyticsService,
    regressionDetector: RegressionDetector
  ) {
    this.reportGenerator = reportGenerator;
    this.analyticsService = analyticsService;
    this.regressionDetector = regressionDetector;
  }

  /**
   * Generate CI/CD report for build pipeline
   */
  public async generateCICDReport(
    buildData: any,
    config?: CICDConfig
  ): Promise<CICDReport> {
    try {
      const startTime = Date.now();
      
      // Collect metrics
      const metrics = await this.collectCICDMetrics(buildData);
      
      // Run quality gates
      const qualityGates = await this.runQualityGates(metrics, config?.qualityGates || []);
      
      // Check for regressions
      const regressions = await this.checkForRegressions();
      
      // Assess deployment readiness
      const deploymentReadiness = this.assessDeploymentReadiness(qualityGates, regressions, metrics);
      
      // Generate recommendations
      const recommendations = this.generateCICDRecommendations(qualityGates, regressions, metrics);
      
      // Determine overall status
      const status = this.determineOverallStatus(qualityGates, deploymentReadiness);
      
      // Generate artifacts
      const artifacts = await this.generateArtifacts(buildData, metrics, qualityGates, config);
      
      const report: CICDReport = {
        buildId: buildData.buildId || `build_${Date.now()}`,
        pipelineId: buildData.pipelineId || 'unknown',
        buildNumber: buildData.buildNumber || 1,
        branch: buildData.branch || 'main',
        commit: buildData.commit || 'unknown',
        timestamp: startTime,
        status,
        qualityGates,
        metrics,
        regressions,
        recommendations,
        deploymentReadiness,
        artifacts
      };

      // Send notifications if configured
      if (config?.notifications) {
        await this.sendNotifications(report, config.notifications);
      }

      return report;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Collect CI/CD specific metrics
   */
  private async collectCICDMetrics(buildData: any): Promise<CICDMetrics> {
    // Get current metrics from analytics service
    const analyticsData = await this.analyticsService.getDashboardAnalytics();
    
    // Extract relevant metrics for CI/CD
    const metrics: CICDMetrics = {
      codeQuality: {
        complexity: analyticsData.summary?.keyMetrics?.complexity?.current || 0,
        maintainabilityIndex: 75, // TODO: TODO: Would be calculated from actual data
        technicalDebtRatio: 15, // TODO: Would be calculated from actual data
        codeSmells: 0 // TODO: Would be calculated from static analysis
      },
      testCoverage: {
        linesCovered: buildData.coverage?.linesCovered || 0,
        totalLines: buildData.coverage?.totalLines || 1,
        percentage: buildData.coverage?.percentage || 0,
        branchCoverage: buildData.coverage?.branchCoverage || 0
      },
      security: {
        vulnerabilities: buildData.security?.vulnerabilities || 0,
        securityHotspots: buildData.security?.hotspots || 0,
        securityRating: buildData.security?.rating || 'A'
      },
      performance: {
        buildTime: buildData.performance?.buildTime || 0,
        testTime: buildData.performance?.testTime || 0,
        deploymentTime: buildData.performance?.deploymentTime
      },
      changeMetrics: {
        linesAdded: buildData.changes?.linesAdded || 0,
        linesDeleted: buildData.changes?.linesDeleted || 0,
        filesChanged: buildData.changes?.filesChanged || 0,
        complexity: buildData.changes?.complexity || 0
      }
    };

    return metrics;
  }

  /**
   * Run quality gates against metrics
   */
  private async runQualityGates(
    metrics: CICDMetrics,
    gateConfigs: QualityGateConfig[]
  ): Promise<QualityGate[]> {
    const qualityGates: QualityGate[] = [];

    // Default quality gates if none provided
    if (gateConfigs.length === 0) {
      gateConfigs = this.getDefaultQualityGates();
    }

    for (const config of gateConfigs.filter(g => g.enabled)) {
      const gate = await this.evaluateQualityGate(config, metrics);
      qualityGates.push(gate);
    }

    return qualityGates;
  }

  /**
   * Evaluate individual quality gate
   */
  private async evaluateQualityGate(
    config: QualityGateConfig,
    metrics: CICDMetrics
  ): Promise<QualityGate> {
    const actualValue = this.extractMetricValue(config.metric, metrics);
    const status = this.evaluateCondition(config.condition, actualValue, config.threshold);
    
    const gate: QualityGate = {
      id: config.id,
      name: config.name,
      type: 'threshold',
      metric: config.metric,
      condition: config.condition as any,
      threshold: config.threshold,
      actualValue,
      status,
      severity: config.severity,
      message: this.generateGateMessage(config, actualValue, status)
    };

    return gate;
  }

  /**
   * Extract metric value from metrics object
   */
  private extractMetricValue(metricPath: string, metrics: CICDMetrics): number {
    const parts = metricPath.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return typeof value === 'number' ? value : 0;
  }

  /**
   * Evaluate condition against threshold
   */
  private evaluateCondition(
    condition: string,
    actualValue: number,
    threshold: number | { min: number; max: number }
  ): 'passed' | 'failed' | 'warning' {
    switch (condition) {
      case 'greater_than':
        return actualValue > (threshold as number) ? 'passed' : 'failed';
      case 'less_than':
        return actualValue < (threshold as number) ? 'passed' : 'failed';
      case 'equals':
        return actualValue === (threshold as number) ? 'passed' : 'failed';
      case 'not_equals':
        return actualValue !== (threshold as number) ? 'passed' : 'failed';
      case 'within_range':
        const range = threshold as { min: number; max: number };
        return actualValue >= range.min && actualValue <= range.max ? 'passed' : 'failed';
      default:
        return 'warning';
    }
  }

  /**
   * Generate quality gate message
   */
  private generateGateMessage(
    config: QualityGateConfig,
    actualValue: number,
    status: 'passed' | 'failed' | 'warning'
  ): string {
    const threshold = typeof config.threshold === 'number' 
      ? config.threshold 
      : `${config.threshold.min}-${config.threshold.max}`;
    
    switch (status) {
      case 'passed':
        return `✅ ${config.name}: ${actualValue} meets requirement (${config.condition} ${threshold})`;
      case 'failed':
        return `❌ ${config.name}: ${actualValue} fails requirement (${config.condition} ${threshold})`;
      case 'warning':
        return `⚠️ ${config.name}: ${actualValue} - unable to evaluate condition`;
      default:
        return `${config.name}: ${actualValue}`;
    }
  }

  /**
   * Check for performance regressions
   */
  private async checkForRegressions(): Promise<any[]> {
    try {
      return await this.regressionDetector.detectRegressions();
    } catch (error) {
      console.warn('Failed to check for regressions:', error);
      return [];
    }
  }

  /**
   * Assess deployment readiness
   */
  private assessDeploymentReadiness(
    qualityGates: QualityGate[],
    regressions: any[],
    metrics: CICDMetrics
  ): DeploymentReadiness {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for blocking quality gates
    const failedBlockers = qualityGates.filter(g => g.status === 'failed' && g.severity === 'blocker');
    const failedCritical = qualityGates.filter(g => g.status === 'failed' && g.severity === 'critical');
    
    blockers.push(...failedBlockers.map(g => g.message));
    warnings.push(...failedCritical.map(g => g.message));

    // Check for critical regressions
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    blockers.push(...criticalRegressions.map(r => `Critical regression in ${r.metric}: ${r.description}`));

    // Calculate quality score
    const passedGates = qualityGates.filter(g => g.status === 'passed').length;
    const totalGates = qualityGates.length;
    const qualityScore = totalGates > 0 ? (passedGates / totalGates) * 100 : 100;

    // Determine status
    let status: 'ready' | 'not_ready' | 'conditional' = 'ready';
    if (blockers.length > 0) {
      status = 'not_ready';
    } else if (warnings.length > 0) {
      status = 'conditional';
    }

    // Calculate confidence
    const confidence = Math.max(0, qualityScore - (regressions.length * 10));

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (blockers.length > 0 || criticalRegressions.length > 0) {
      riskLevel = 'high';
    } else if (warnings.length > 0 || regressions.length > 0) {
      riskLevel = 'medium';
    }

    // Generate recommendations
    if (status !== 'ready') {
      recommendations.push('Address all blocking issues before deployment');
    }
    if (metrics.testCoverage.percentage < 80) {
      recommendations.push('Increase test coverage to at least 80%');
    }
    if (metrics.codeQuality.complexity > 10) {
      recommendations.push('Reduce code complexity in critical areas');
    }

    return {
      status,
      confidence,
      blockers,
      warnings,
      recommendations,
      riskLevel,
      qualityScore
    };
  }

  /**
   * Generate CI/CD specific recommendations
   */
  private generateCICDRecommendations(
    qualityGates: QualityGate[],
    regressions: any[],
    metrics: CICDMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Quality gate recommendations
    const failedGates = qualityGates.filter(g => g.status === 'failed');
    failedGates.forEach(gate => {
      switch (gate.metric) {
        case 'testCoverage.percentage':
          recommendations.push('Add more unit tests to increase coverage');
          break;
        case 'codeQuality.complexity':
          recommendations.push('Refactor complex methods to improve maintainability');
          break;
        case 'security.vulnerabilities':
          recommendations.push('Fix security vulnerabilities before deployment');
          break;
      }
    });

    // Regression recommendations
    regressions.forEach(regression => {
      recommendations.push(...regression.recommendations);
    });

    // Performance recommendations
    if (metrics.performance.buildTime > 600000) { // 10 minutes
      recommendations.push('Optimize build process to reduce build time');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Determine overall build status
   */
  private determineOverallStatus(
    qualityGates: QualityGate[],
    deploymentReadiness: DeploymentReadiness
  ): 'success' | 'failure' | 'warning' {
    if (deploymentReadiness.status === 'not_ready') {
      return 'failure';
    }
    
    const hasFailedGates = qualityGates.some(g => g.status === 'failed');
    if (hasFailedGates || deploymentReadiness.status === 'conditional') {
      return 'warning';
    }
    
    return 'success';
  }

  /**
   * Generate report artifacts
   */
  private async generateArtifacts(
    buildData: any,
    metrics: CICDMetrics,
    qualityGates: QualityGate[],
    config?: CICDConfig
  ): Promise<ReportArtifact[]> {
    const artifacts: ReportArtifact[] = [];
    const outputPath = config?.artifacts?.outputPath || path.join(this.context.globalStorageUri.fsPath, 'cicd-reports');

    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Generate JSON artifact
    if (config?.artifacts?.generateJson !== false) {
      const jsonPath = path.join(outputPath, `build-${buildData.buildNumber || Date.now()}.json`);
      const jsonData = { buildData, metrics, qualityGates };
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
      
      artifacts.push({
        type: 'json',
        name: 'Build Report JSON',
        path: jsonPath,
        size: fs.statSync(jsonPath).size
      });
    }

    // Generate JUnit XML for quality gates
    if (config?.artifacts?.generateJunit) {
      const junitPath = path.join(outputPath, `quality-gates-${buildData.buildNumber || Date.now()}.xml`);
      const junitXml = this.generateJUnitXML(qualityGates);
      fs.writeFileSync(junitPath, junitXml);
      
      artifacts.push({
        type: 'junit',
        name: 'Quality Gates JUnit',
        path: junitPath,
        size: fs.statSync(junitPath).size
      });
    }

    return artifacts;
  }

  /**
   * Generate JUnit XML for quality gates
   */
  private generateJUnitXML(qualityGates: QualityGate[]): string {
    const testCases = qualityGates.map(gate => {
      const status = gate.status === 'passed' ? '' : `<failure message="${gate.message}"></failure>`;
      return `    <testcase name="${gate.name}" classname="QualityGates">
      ${status}
    </testcase>`;
    }).join('\n');

    const failures = qualityGates.filter(g => g.status === 'failed').length;
    const total = qualityGates.length;

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Quality Gates" tests="${total}" failures="${failures}" time="0">
${testCases}
</testsuite>`;
  }

  /**
   * Send notifications based on configuration
   */
  private async sendNotifications(report: CICDReport, notifications: any): Promise<void> {
    const shouldNotify = 
      (report.status === 'success' && notifications.onSuccess) ||
      (report.status === 'failure' && notifications.onFailure) ||
      (report.status === 'warning' && notifications.onWarning);

    if (!shouldNotify) {return;}

    // VS Code notification
    const message = `Build ${report.buildNumber} ${report.status}: ${report.deploymentReadiness.status}`;
    
    switch (report.status) {
      case 'success':
        vscode.window.showInformationMessage(message);
        break;
      case 'warning':
        vscode.window.showWarningMessage(message);
        break;
      case 'failure':
        vscode.window.showErrorMessage(message);
        break;
    }

    // Webhook notifications
    for (const webhookUrl of notifications.webhooks || []) {
      try {
        // In a real implementation, you would make HTTP requests
        console.log(`Would send webhook to: ${webhookUrl}`, { report });
      } catch (error) {
        console.error('Failed to send webhook:', error);
      }
    }
  }

  /**
   * Get default quality gates
   */
  private getDefaultQualityGates(): QualityGateConfig[] {
    return [
      {
        id: 'coverage',
        name: 'Test Coverage',
        metric: 'testCoverage.percentage',
        condition: 'greater_than',
        threshold: 80,
        severity: 'major',
        enabled: true
      },
      {
        id: 'complexity',
        name: 'Code Complexity',
        metric: 'codeQuality.complexity',
        condition: 'less_than',
        threshold: 15,
        severity: 'major',
        enabled: true
      },
      {
        id: 'vulnerabilities',
        name: 'Security Vulnerabilities',
        metric: 'security.vulnerabilities',
        condition: 'equals',
        threshold: 0,
        severity: 'blocker',
        enabled: true
      },
      {
        id: 'maintainability',
        name: 'Maintainability Index',
        metric: 'codeQuality.maintainabilityIndex',
        condition: 'greater_than',
        threshold: 60,
        severity: 'major',
        enabled: true
      }
    ];
  }
}
