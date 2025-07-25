/**
 * Advanced Analytics Service
 * 
 * Orchestrates advanced analytics features including trend analysis,
 * performance benchmarking, team collaboration metrics, and code health scoring.
 */

import * as vscode from 'vscode';
import { MetricsAggregator } from '../metrics/aggregator';
import { MetricsStorage } from '../metrics/storage';
import { WebSocketServer } from './websocket-server';
import { ErrorHandler } from '../utils/error-handler';
import { CompleteReport } from '../metrics/types';

export class AdvancedAnalyticsService {
  private aggregator: MetricsAggregator;
  private storage: MetricsStorage;
  private webSocketServer: WebSocketServer | null = null;
  private errorHandler = ErrorHandler.getInstance();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(context: vscode.ExtensionContext) {
    this.storage = new MetricsStorage(context);
    this.aggregator = new MetricsAggregator(this.storage);
  }

  /**
   * Initialize the advanced analytics service
   */
  public async initialize(webSocketServer?: WebSocketServer): Promise<void> {
    try {
      this.webSocketServer = webSocketServer || null;
      this.isRunning = true;
      
      // Start periodic analytics updates
      this.startPeriodicUpdates();
      
      console.log('Advanced Analytics Service initialized');
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Stop the advanced analytics service
   */
  public async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      console.log('Advanced Analytics Service stopped');
    } catch (error) {
      this.errorHandler.handleError(error as Error);
    }
  }

  /**
   * Generate complete advanced analytics report
   */
  public async generateAdvancedReport(): Promise<CompleteReport> {
    try {
      const report = await this.aggregator.generateFullReport();
      
      // Send real-time update if WebSocket is available
      if (this.webSocketServer) {
        this.webSocketServer.sendAdvancedAnalyticsReport(report);
      }
      
      return report;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get trend analysis
   */
  public async getTrendAnalysis(): Promise<CompleteReport['trends']> {
    try {
      const report = await this.aggregator.generateFullReport();
      
      // Send real-time update
      if (this.webSocketServer) {
        this.webSocketServer.sendTrendUpdate(report.trends);
      }
      
      return report.trends;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get performance benchmarks
   */
  public async getPerformanceBenchmarks(): Promise<CompleteReport['performance']> {
    try {
      const report = await this.aggregator.generateFullReport();
      
      // Send real-time update
      if (this.webSocketServer) {
        this.webSocketServer.sendPerformanceUpdate(report.performance);
      }
      
      return report.performance;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get team collaboration metrics
   */
  public async getTeamMetrics(): Promise<CompleteReport['teamMetrics']> {
    try {
      const report = await this.aggregator.generateFullReport();
      
      // Send real-time update
      if (this.webSocketServer) {
        this.webSocketServer.sendTeamMetricsUpdate(report.teamMetrics);
      }
      
      return report.teamMetrics;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get code health metrics
   */
  public async getCodeHealthMetrics(): Promise<CompleteReport['codeQuality']> {
    try {
      const report = await this.aggregator.generateFullReport();
      
      // Send real-time update
      if (this.webSocketServer) {
        this.webSocketServer.sendCodeHealthUpdate(report.codeQuality);
      }
      
      return report.codeQuality;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get actionable recommendations
   */
  public async getRecommendations(): Promise<string[]> {
    try {
      const report = await this.aggregator.generateFullReport();
      return report.recommendations;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return [];
    }
  }

  /**
   * Calculate overall productivity score
   */
  public async calculateProductivityScore(): Promise<{
    score: number;
    breakdown: {
      codeQuality: number;
      performance: number;
      teamCollaboration: number;
      trends: number;
    };
  }> {
    try {
      const report = await this.aggregator.generateFullReport();
      
      // Calculate individual scores
      const codeQualityScore = this.calculateCodeQualityScore(report.codeQuality);
      const performanceScore = this.calculatePerformanceScore(report.performance);
      const teamScore = this.calculateTeamScore(report.teamMetrics);
      const trendsScore = this.calculateTrendsScore(report.trends);
      
      // Calculate weighted overall score
      const weights = {
        codeQuality: 0.3,
        performance: 0.25,
        teamCollaboration: 0.25,
        trends: 0.2
      };
      
      const overallScore = 
        (codeQualityScore * weights.codeQuality) +
        (performanceScore * weights.performance) +
        (teamScore * weights.teamCollaboration) +
        (trendsScore * weights.trends);
      
      return {
        score: Math.round(overallScore),
        breakdown: {
          codeQuality: Math.round(codeQualityScore),
          performance: Math.round(performanceScore),
          teamCollaboration: Math.round(teamScore),
          trends: Math.round(trendsScore)
        }
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        score: 0,
        breakdown: {
          codeQuality: 0,
          performance: 0,
          teamCollaboration: 0,
          trends: 0
        }
      };
    }
  }

  /**
   * Start periodic analytics updates
   */
  private startPeriodicUpdates(): void {
    // Update analytics every 5 minutes
    this.updateInterval = setInterval(async () => {
      if (!this.isRunning) {return;}
      
      try {
        // Generate and broadcast updates
        await this.generateAdvancedReport();
      } catch (error) {
        this.errorHandler.handleError(error as Error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Calculate code quality score
   */
  private calculateCodeQualityScore(codeQuality: CompleteReport['codeQuality']): number {
    let score = 100;
    
    // Deduct for duplication
    score -= codeQuality.duplicationType.percentage * 0.5;
    
    // Deduct for poor test coverage
    score -= (100 - codeQuality.testCoverage.percentage) * 0.3;
    
    // Deduct for poor documentation
    score -= (100 - codeQuality.documentation.coverage) * 0.2;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(performance: CompleteReport['performance']): number {
    let score = 100;
    
    // Deduct for execution hotspots
    score -= performance.executionHotspots.length * 2;
    
    // Deduct for memory leaks
    score -= performance.memoryProfile.leaks.length * 5;
    
    // Deduct for high GC pressure
    score -= Math.min(20, performance.memoryProfile.garbageCollection * 0.1);
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate team collaboration score
   */
  private calculateTeamScore(teamMetrics: CompleteReport['teamMetrics']): number {
    // Use the collaboration score directly, with adjustments
    let score = teamMetrics.collaborationScore;
    
    // Bonus for good knowledge distribution
    score += teamMetrics.knowledgeDistribution * 0.2;
    
    // Bonus for multiple contributors
    if (teamMetrics.contributorCount > 1) {
      score += Math.min(10, teamMetrics.contributorCount * 2);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate trends score
   */
  private calculateTrendsScore(trends: CompleteReport['trends']): number {
    let score = 50; // Base score
    
    // Bonus for positive velocity prediction
    if (trends.velocityPrediction.nextWeek > 0) {
      score += 25;
    }
    
    // Bonus for high confidence predictions
    score += trends.velocityPrediction.confidence * 25;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if service is running
   */
  public isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Set WebSocket server for real-time updates
   */
  public setWebSocketServer(webSocketServer: WebSocketServer): void {
    this.webSocketServer = webSocketServer;
  }

  /**
   * Get advanced trend analysis including regression and forecasting
   */
  public async getAdvancedTrendAnalysis(): Promise<{
    productivityRegression?: any;
    advancedVelocityTrends?: any;
    recommendations: string[];
  }> {
    try {
      const report = await this.aggregator.generateFullReport();

      const recommendations: string[] = [];

      // Add regression-specific recommendations
      if (report.trends.productivityRegression?.hasRegression) {
        recommendations.push('Productivity regression detected - investigate recent changes');
        recommendations.push(`Recovery expected in ${report.trends.productivityRegression.recoveryPrediction} days`);
      }

      // Add velocity trend recommendations
      if (report.trends.advancedVelocityTrends?.velocityTrend === 'decreasing') {
        recommendations.push('Velocity is decreasing - consider workload optimization');
      }

      const result = {
        productivityRegression: report.trends.productivityRegression,
        advancedVelocityTrends: report.trends.advancedVelocityTrends,
        recommendations
      };

      // Send real-time update
      if (this.webSocketServer) {
        this.webSocketServer.sendAdvancedTrendUpdate(result);
      }

      return result;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return { recommendations: [] };
    }
  }

  /**
   * Get advanced performance analysis including regression detection
   */
  public async getAdvancedPerformanceAnalysis(): Promise<{
    regressionAnalysis?: any;
    benchmarkComparison?: any;
    recommendations: string[];
  }> {
    try {
      const report = await this.aggregator.generateFullReport();

      const recommendations: string[] = [];

      // Add performance-specific recommendations
      if (report.performance.regressionAnalysis?.hasRegression) {
        recommendations.push('Performance regression detected in critical files');
        recommendations.push(...(report.performance.regressionAnalysis.recommendations || []));
      }

      if (report.performance.benchmarkComparison?.industryPercentile &&
          report.performance.benchmarkComparison.industryPercentile < 50) {
        recommendations.push('Performance below industry average - focus on optimization');
        recommendations.push(...(report.performance.benchmarkComparison.improvementAreas || []));
      }

      const result = {
        regressionAnalysis: report.performance.regressionAnalysis,
        benchmarkComparison: report.performance.benchmarkComparison,
        recommendations
      };

      // Send real-time update
      if (this.webSocketServer) {
        this.webSocketServer.sendAdvancedPerformanceUpdate(result);
      }

      return result;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return { recommendations: [] };
    }
  }

  /**
   * Get advanced team collaboration analysis
   */
  public async getAdvancedTeamAnalysis(): Promise<{
    communicationPatterns?: any;
    productivityPatterns?: any;
    recommendations: string[];
  }> {
    try {
      const report = await this.aggregator.generateFullReport();

      const recommendations: string[] = [];

      // Add team-specific recommendations
      if (report.teamMetrics.communicationPatterns?.communicationScore &&
          report.teamMetrics.communicationPatterns.communicationScore < 50) {
        recommendations.push('Improve team communication practices');
        recommendations.push('Consider implementing better commit message standards');
      }

      if (report.teamMetrics.productivityPatterns?.burnoutRisk === 'high') {
        recommendations.push('High burnout risk detected - redistribute workload');
        recommendations.push(...(report.teamMetrics.productivityPatterns.recommendations || []));
      }

      return {
        communicationPatterns: report.teamMetrics.communicationPatterns,
        productivityPatterns: report.teamMetrics.productivityPatterns,
        recommendations
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return { recommendations: [] };
    }
  }

  /**
   * Get advanced code health analysis including technical debt
   */
  public async getAdvancedCodeHealthAnalysis(): Promise<{
    technicalDebt?: any;
    maintainabilityIndex?: any;
    recommendations: string[];
  }> {
    try {
      const report = await this.aggregator.generateFullReport();

      const recommendations: string[] = [];

      // Add code health-specific recommendations
      if (report.codeQuality.technicalDebt?.totalDebtScore &&
          report.codeQuality.technicalDebt.totalDebtScore > 50) {
        recommendations.push('High technical debt detected - prioritize refactoring');
        recommendations.push(...(report.codeQuality.technicalDebt.recommendations || []));
      }

      if (report.codeQuality.maintainabilityIndex?.overallIndex &&
          report.codeQuality.maintainabilityIndex.overallIndex < 50) {
        recommendations.push('Low maintainability index - focus on code quality improvements');
      }

      return {
        technicalDebt: report.codeQuality.technicalDebt,
        maintainabilityIndex: report.codeQuality.maintainabilityIndex,
        recommendations
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return { recommendations: [] };
    }
  }

  /**
   * Generate comprehensive analytics summary
   */
  public async generateAnalyticsSummary(): Promise<{
    overallHealth: 'excellent' | 'good' | 'moderate' | 'poor';
    keyInsights: string[];
    criticalIssues: string[];
    priorityActions: string[];
    trendDirection: 'improving' | 'stable' | 'declining';
  }> {
    try {
      const report = await this.aggregator.generateFullReport();
      const productivityScore = await this.calculateProductivityScore();

      // Determine overall health
      let overallHealth: 'excellent' | 'good' | 'moderate' | 'poor' = 'moderate';
      if (productivityScore.score >= 85) {overallHealth = 'excellent';}
      else if (productivityScore.score >= 70) {overallHealth = 'good';}
      else if (productivityScore.score < 40) {overallHealth = 'poor';}

      // Generate key insights
      const keyInsights: string[] = [];
      const criticalIssues: string[] = [];
      const priorityActions: string[] = [];

      // Analyze trends
      if (report.trends.advancedVelocityTrends?.velocityTrend === 'increasing') {
        keyInsights.push('Development velocity is trending upward');
      }

      // Analyze performance
      if (report.performance.regressionAnalysis?.hasRegression) {
        criticalIssues.push('Performance regression detected');
        priorityActions.push('Investigate and fix performance issues');
      }

      // Analyze team metrics
      if (report.teamMetrics.productivityPatterns?.burnoutRisk === 'high') {
        criticalIssues.push('High team burnout risk');
        priorityActions.push('Redistribute workload and improve work-life balance');
      }

      // Analyze code health
      if (report.codeQuality.technicalDebt?.totalDebtScore &&
          report.codeQuality.technicalDebt.totalDebtScore > 70) {
        criticalIssues.push('Excessive technical debt');
        priorityActions.push('Schedule dedicated refactoring time');
      }

      // Determine trend direction
      const trendDirection = this.calculateOverallTrendDirection(report);

      return {
        overallHealth,
        keyInsights,
        criticalIssues,
        priorityActions,
        trendDirection
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        overallHealth: 'poor',
        keyInsights: [],
        criticalIssues: ['Analytics generation failed'],
        priorityActions: ['Check system configuration'],
        trendDirection: 'stable'
      };
    }
  }

  /**
   * Calculate overall trend direction
   */
  private calculateOverallTrendDirection(report: CompleteReport): 'improving' | 'stable' | 'declining' {
    let improvingFactors = 0;
    let decliningFactors = 0;

    // Check velocity trends
    if (report.trends.advancedVelocityTrends?.velocityTrend === 'increasing') {
      improvingFactors++;
    } else if (report.trends.advancedVelocityTrends?.velocityTrend === 'decreasing') {
      decliningFactors++;
    }

    // Check performance trends
    if (report.performance.regressionAnalysis?.performanceTrend === 'improving') {
      improvingFactors++;
    } else if (report.performance.regressionAnalysis?.performanceTrend === 'degrading') {
      decliningFactors++;
    }

    // Check maintainability trends
    if (report.codeQuality.maintainabilityIndex?.trendDirection === 'improving') {
      improvingFactors++;
    } else if (report.codeQuality.maintainabilityIndex?.trendDirection === 'declining') {
      decliningFactors++;
    }

    if (improvingFactors > decliningFactors) {return 'improving';}
    if (decliningFactors > improvingFactors) {return 'declining';}
    return 'stable';
  }
}
