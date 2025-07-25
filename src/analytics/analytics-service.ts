/**
 * @file ANALYTICS-SERVICE.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @summary 
 * Comprehensive Analytics Service.
 * Central service that orchestrates all historical data analysis,
 * trend analysis, project comparison, and regression detection.
 * 
 * @since 2.0.0
 * 
 * @requires vscode
 * @requires historical-analyzer
 * @requires project-comparator
 * @requires regression-detector
 * @requires metrics/storage
 * @requires utils/error-handler
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import { HistoricalAnalyzer, HistoricalTrend, ProductivityPattern } from './historical-analyzer';
import { ProjectComparator, ProjectComparison } from './project-comparator';
import { RegressionDetector, RegressionAlert } from './regression-detector';
import { ErrorHandler } from '../utils/error-handler';
import { TimeRange } from '../metrics/types';

// ------------ INTERFACES
// Analytics report interface
export interface AnalyticsReport {
  id: string;
  generatedAt: number;
  timeRange: TimeRange & {
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  summary: AnalyticsSummary;
  trends: HistoricalTrend[];
  patterns: ProductivityPattern[];
  regressions: RegressionAlert[];
  comparisons?: ProjectComparison;
  insights: AnalyticsInsight[];
  recommendations: AnalyticsRecommendation[];
  confidence: number;
}

// Analytics summary interface
export interface AnalyticsSummary {
  overallTrend: 'improving' | 'stable' | 'declining';
  keyMetrics: {
    productivity: { current: number; change: number; trend: string };
    quality: { current: number; change: number; trend: string };
    velocity: { current: number; change: number; trend: string };
    complexity: { current: number; change: number; trend: string };
  };
  healthScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  alertCount: {
    critical: number;
    major: number;
    minor: number;
    warning: number;
  };
}

// Analytics insight interface
export interface AnalyticsInsight {
  id: string;
  category: 'trend' | 'pattern' | 'regression' | 'comparison' | 'prediction';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  evidence: string[];
  relatedMetrics: string[];
  timeframe: string;
}

// Analytics recommendation interface
export interface AnalyticsRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'process' | 'technical' | 'organizational' | 'tooling';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  actionItems: string[];
  successMetrics: string[];
  relatedMetrics?: string[];
}

// Analytics configuration interface
export interface AnalyticsConfig {
  enableTrendAnalysis: boolean;
  enablePatternRecognition: boolean;
  enableRegressionDetection: boolean;
  enableProjectComparison: boolean;
  analysisDepth: 'basic' | 'standard' | 'comprehensive';
  alertThresholds: {
    productivity: number;
    quality: number;
    velocity: number;
    complexity: number;
  };
  reportFrequency: 'daily' | 'weekly' | 'monthly';
  retentionPeriod: number; // days
}

// ------------ MAIN CLASS
export class AnalyticsService {
  private historicalAnalyzer: HistoricalAnalyzer;
  private projectComparator: ProjectComparator;
  private regressionDetector: RegressionDetector;
  private errorHandler = ErrorHandler.getInstance();
  
  // Configuration
  private config: AnalyticsConfig = {
    enableTrendAnalysis: true,
    enablePatternRecognition: true,
    enableRegressionDetection: true,
    enableProjectComparison: false,
    analysisDepth: 'standard',
    alertThresholds: {
      productivity: 15,
      quality: 10,
      velocity: 20,
      complexity: 25
    },
    reportFrequency: 'weekly',
    retentionPeriod: 90
  };

  // Constructor
  constructor(context: vscode.ExtensionContext) {
    this.historicalAnalyzer = new HistoricalAnalyzer(context);
    this.projectComparator = new ProjectComparator(context);
    this.regressionDetector = new RegressionDetector(context);
  }

  /**
   * Generate comprehensive analytics report
   */
  public async generateAnalyticsReport(
    timeRange?: { start: number; end: number; granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year' },
    projectIds?: string[]
  ): Promise<AnalyticsReport> {
    try {
      const defaultTimeRange = this.getDefaultTimeRange();
      const reportTimeRange = timeRange ? {
        ...timeRange,
        granularity: timeRange.granularity || defaultTimeRange.granularity
      } : defaultTimeRange;
      const reportId = `analytics_${Date.now()}`;

      // Collect all analytics data
      const [trends, patterns, regressions, comparison] = await Promise.all([
        this.config.enableTrendAnalysis ? this.historicalAnalyzer.analyzeLongTermTrends(reportTimeRange) : [],
        this.config.enablePatternRecognition ? this.historicalAnalyzer.recognizeProductivityPatterns() : [],
        this.config.enableRegressionDetection ? this.regressionDetector.detectRegressions() : [],
        this.config.enableProjectComparison && projectIds && projectIds.length > 1 
          ? this.projectComparator.compareProjects(projectIds, reportTimeRange) 
          : undefined
      ]);

      // Generate summary
      const summary = this.generateAnalyticsSummary(trends, patterns, regressions);

      // Generate insights
      const insights = this.generateInsights(trends, patterns, regressions, comparison);

      // Generate recommendations
      const recommendations = this.generateRecommendations(trends, patterns, regressions, insights);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(trends, patterns, regressions);

      return {
        id: reportId,
        generatedAt: Date.now(),
        timeRange: reportTimeRange,
        summary,
        trends,
        patterns,
        regressions,
        comparisons: comparison,
        insights,
        recommendations,
        confidence
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get real-time analytics dashboard data
   */
  public async getDashboardAnalytics(): Promise<{
    summary: AnalyticsSummary;
    recentTrends: HistoricalTrend[];
    activeAlerts: RegressionAlert[];
    topInsights: AnalyticsInsight[];
    urgentRecommendations: AnalyticsRecommendation[];
  }> {
    try {
      const timeRange = { 
        start: Date.now() - (30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: Date.now(),
        granularity: 'day' as const
      };

      const [trends, regressions] = await Promise.all([
        this.historicalAnalyzer.analyzeLongTermTrends(timeRange),
        this.regressionDetector.detectRegressions()
      ]);

      const summary = this.generateAnalyticsSummary(trends, [], regressions);
      const insights = this.generateInsights(trends, [], regressions);
      const recommendations = this.generateRecommendations(trends, [], regressions, insights);

      return {
        summary,
        recentTrends: trends.slice(0, 5), // Top 5 trends
        activeAlerts: regressions.filter(r => r.severity === 'critical' || r.severity === 'major'),
        topInsights: insights.filter(i => i.impact === 'high').slice(0, 3),
        urgentRecommendations: recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').slice(0, 3)
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Analyze specific metric in detail
   */
  public async analyzeMetricInDetail(
    metric: string,
    timeRange: { start: number; end: number }
  ): Promise<{
    trend: HistoricalTrend | null;
    patterns: ProductivityPattern[];
    regressions: RegressionAlert[];
    insights: AnalyticsInsight[];
    recommendations: AnalyticsRecommendation[];
  }> {
    try {
      const [allTrends, allPatterns, allRegressions] = await Promise.all([
        this.historicalAnalyzer.analyzeLongTermTrends(timeRange),
        this.historicalAnalyzer.recognizeProductivityPatterns(),
        this.regressionDetector.detectRegressions()
      ]);

      const trend = allTrends.find(t => t.metric === metric) || null;
      const patterns = allPatterns.filter(p => p.type.includes(metric) || this.isPatternRelatedToMetric(p, metric));
      const regressions = allRegressions.filter(r => r.metric === metric);

      const insights = this.generateMetricSpecificInsights(metric, trend, patterns, regressions);
      const recommendations = this.generateMetricSpecificRecommendations(metric, trend, patterns, regressions);

      return { trend, patterns, regressions, insights, recommendations };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get productivity forecasting
   */
  public async getProductivityForecast(days: number = 30): Promise<{
    forecast: { date: string; predicted: number; confidence: number }[];
    factors: { factor: string; impact: number; confidence: number }[];
    recommendations: string[];
  }> {
    try {
      // Get historical data for forecasting
      const timeRange = {
        start: Date.now() - (90 * 24 * 60 * 60 * 1000), // Last 90 days
        end: Date.now(),
        granularity: 'day' as const
      };

      const trends = await this.historicalAnalyzer.analyzeLongTermTrends(timeRange);
      const patterns = await this.historicalAnalyzer.recognizeProductivityPatterns();

      // Simple linear forecasting (could be improved with ML models)
      const productivityTrend = trends.find(t => t.metric === 'productivity');
      const forecast = this.generateSimpleForecast(productivityTrend, days);

      // Identify factors affecting forecast
      const factors = this.identifyForecastFactors(patterns, trends);

      // Generate forecast-based recommendations
      const recommendations = this.generateForecastRecommendations(forecast, factors);

      return { forecast, factors, recommendations };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Update analytics configuration
   */
  public updateConfiguration(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Generate default time range based on configuration
   */
  private getDefaultTimeRange(): { start: number; end: number; granularity: 'day' | 'week' | 'month' | 'quarter' | 'year' } {
    const end = Date.now();
    let start: number;
    let granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';

    switch (this.config.analysisDepth) {
      case 'basic':
        start = end - (30 * 24 * 60 * 60 * 1000); // 30 days
        granularity = 'day';
        break;
      case 'standard':
        start = end - (90 * 24 * 60 * 60 * 1000); // 90 days
        granularity = 'day';
        break;
      case 'comprehensive':
        start = end - (365 * 24 * 60 * 60 * 1000); // 1 year
        granularity = 'week';
        break;
    }

    return { start, end, granularity };
  }

  /**
   * Generate analytics summary
   */
  private generateAnalyticsSummary(
    trends: HistoricalTrend[],
    _patterns: ProductivityPattern[],
    regressions: RegressionAlert[]
  ): AnalyticsSummary {
    // Calculate overall trend
    const trendScores = trends.map(t => {
      switch (t.trendDirection) {
        case 'improving': return 1;
        case 'stable': return 0;
        case 'declining': return -1;
      }
    });

    const avgTrendScore = trendScores.length > 0 
      ? trendScores.reduce<number>((sum, score) => sum + score, 0) / trendScores.length 
      : 0;

    let overallTrend: 'improving' | 'stable' | 'declining';
    if (avgTrendScore > 0.2) {overallTrend = 'improving';}
    else if (avgTrendScore < -0.2) {overallTrend = 'declining';}
    else {overallTrend = 'stable';}

    // Extract key metrics
    const productivityTrend = trends.find(t => t.metric === 'productivity');
    const qualityTrend = trends.find(t => t.metric === 'codeQuality');
    const velocityTrend = trends.find(t => t.metric === 'velocity');
    const complexityTrend = trends.find(t => t.metric === 'complexity');

    const keyMetrics = {
      productivity: this.extractMetricSummary(productivityTrend),
      quality: this.extractMetricSummary(qualityTrend),
      velocity: this.extractMetricSummary(velocityTrend),
      complexity: this.extractMetricSummary(complexityTrend)
    };

    // Calculate health score
    const healthScore = this.calculateHealthScore(trends, regressions);

    // Determine risk level
    const criticalRegressions = regressions.filter(r => r.severity === 'critical').length;
    const majorRegressions = regressions.filter(r => r.severity === 'major').length;
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (criticalRegressions > 0 || majorRegressions > 2) {riskLevel = 'high';}
    else if (majorRegressions > 0 || regressions.length > 3) {riskLevel = 'medium';}

    // Count alerts by severity
    const alertCount = {
      critical: regressions.filter(r => r.severity === 'critical').length,
      major: regressions.filter(r => r.severity === 'major').length,
      minor: regressions.filter(r => r.severity === 'minor').length,
      warning: regressions.filter(r => r.severity === 'warning').length
    };

    return {
      overallTrend,
      keyMetrics,
      healthScore,
      riskLevel,
      alertCount
    };
  }

  /**
   * Extract metric summary from trend data
   */
  private extractMetricSummary(trend: HistoricalTrend | undefined): { current: number; change: number; trend: string } {
    if (!trend || trend.dataPoints.length === 0) {
      return { current: 0, change: 0, trend: 'stable' };
    }

    const current = trend.dataPoints[trend.dataPoints.length - 1].value;
    const previous = trend.dataPoints.length > 1 ? trend.dataPoints[trend.dataPoints.length - 2].value : current;
    const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

    return {
      current,
      change,
      trend: trend.trendDirection
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(trends: HistoricalTrend[], regressions: RegressionAlert[]): number {
    let score = 100;

    // Deduct points for declining trends
    const decliningTrends = trends.filter(t => t.trendDirection === 'declining' && t.confidence > 0.6);
    score -= decliningTrends.length * 10;

    // Deduct points for regressions
    regressions.forEach(regression => {
      switch (regression.severity) {
        case 'critical': score -= 25; break;
        case 'major': score -= 15; break;
        case 'minor': score -= 8; break;
        case 'warning': score -= 3; break;
      }
    });

    // Add points for improving trends
    const improvingTrends = trends.filter(t => t.trendDirection === 'improving' && t.confidence > 0.6);
    score += improvingTrends.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate comprehensive insights
   */
  private generateInsights(
    trends: HistoricalTrend[],
    patterns: ProductivityPattern[],
    regressions: RegressionAlert[],
    comparison?: ProjectComparison
  ): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    // Trend-based insights
    trends.forEach(trend => {
      if (trend.confidence > 0.7) {
        insights.push({
          id: `trend_${trend.metric}_${Date.now()}`,
          category: 'trend',
          title: `${trend.metric} ${trend.trendDirection} trend detected`,
          description: `${trend.metric} shows a ${trend.trendDirection} trend with ${(trend.confidence * 100).toFixed(1)}% confidence over the analysis period`,
          impact: trend.confidence > 0.8 ? 'high' : 'medium',
          confidence: trend.confidence,
          evidence: [
            `Change rate: ${(trend.changeRate * 100).toFixed(1)}%`,
            `Data points analyzed: ${trend.dataPoints.length}`,
            trend.seasonality ? `Seasonal pattern detected` : 'No seasonal pattern'
          ],
          relatedMetrics: [trend.metric],
          timeframe: 'Last 30-90 days'
        });
      }
    });

    // Pattern-based insights
    patterns.forEach(pattern => {
      if (pattern.impact === 'high') {
        insights.push({
          id: `pattern_${pattern.type}_${Date.now()}`,
          category: 'pattern',
          title: `${pattern.type.replace('_', ' ')} pattern identified`,
          description: pattern.description,
          impact: pattern.impact,
          confidence: pattern.confidence,
          evidence: pattern.recommendations.slice(0, 2),
          relatedMetrics: this.getPatternRelatedMetrics(pattern.type),
          timeframe: 'Historical analysis'
        });
      }
    });

    // Regression-based insights
    regressions.forEach(regression => {
      if (regression.severity === 'critical' || regression.severity === 'major') {
        insights.push({
          id: `regression_${regression.metric}_${Date.now()}`,
          category: 'regression',
          title: `${regression.severity} regression in ${regression.metric}`,
          description: regression.description,
          impact: regression.severity === 'critical' ? 'high' : 'medium',
          confidence: regression.confidence,
          evidence: regression.possibleCauses.slice(0, 2).map(c => c.description),
          relatedMetrics: [regression.metric],
          timeframe: 'Recent period'
        });
      }
    });

    // Comparison-based insights
    if (comparison) {
      Object.entries(comparison.comparison).forEach(([metric, analysis]) => {
        if (analysis.variance && analysis.variance > 100) {
          insights.push({
            id: `comparison_${metric}_${Date.now()}`,
            category: 'comparison',
            title: `High variance in ${metric} across projects`,
            description: `Significant differences detected in ${metric} performance between projects`,
            impact: 'medium',
            confidence: 0.8,
            evidence: analysis.insights || [],
            relatedMetrics: [metric],
            timeframe: 'Cross-project analysis'
          });
        }
      });
    }

    return insights.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact] || b.confidence - a.confidence;
    });
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    trends: HistoricalTrend[],
    patterns: ProductivityPattern[],
    regressions: RegressionAlert[],
    insights: AnalyticsInsight[]
  ): AnalyticsRecommendation[] {
    const recommendations: AnalyticsRecommendation[] = [];

    // Critical regression recommendations
    regressions.filter(r => r.severity === 'critical').forEach(regression => {
      recommendations.push({
        id: `critical_${regression.metric}_${Date.now()}`,
        priority: 'critical',
        category: 'process',
        title: `Address critical ${regression.metric} regression`,
        description: `Immediate action required to address ${regression.degradationPercent.toFixed(1)}% degradation in ${regression.metric}`,
        expectedImpact: `Restore ${regression.metric} to baseline levels`,
        effort: 'high',
        timeline: '1-3 days',
        actionItems: regression.recommendations.slice(0, 3),
        successMetrics: [`${regression.metric} returns to within 5% of baseline`, 'No new critical alerts']
      });
    });

    // High-impact pattern recommendations
    patterns.filter(p => p.impact === 'high').forEach(pattern => {
      recommendations.push({
        id: `pattern_${pattern.type}_${Date.now()}`,
        priority: 'high',
        category: this.getPatternCategory(pattern.type),
        title: `Optimize ${pattern.type.replace('_', ' ')} patterns`,
        description: pattern.description,
        expectedImpact: 'Improve productivity and consistency',
        effort: 'medium',
        timeline: '1-2 weeks',
        actionItems: pattern.recommendations.slice(0, 3),
        successMetrics: ['Improved consistency scores', 'Better productivity metrics']
      });
    });

    // Declining trend recommendations
    trends.filter(t => t.trendDirection === 'declining' && t.confidence > 0.6).forEach(trend => {
      recommendations.push({
        id: `trend_${trend.metric}_${Date.now()}`,
        priority: 'medium',
        category: 'process',
        title: `Reverse declining ${trend.metric} trend`,
        description: `Address the declining trend in ${trend.metric} before it becomes critical`,
        expectedImpact: `Stabilize and improve ${trend.metric}`,
        effort: 'medium',
        timeline: '2-4 weeks',
        actionItems: this.getTrendRecommendations(trend.metric),
        successMetrics: [`${trend.metric} trend stabilizes`, 'Positive change rate achieved']
      });
    });

    // Proactive recommendations based on insights
    insights.filter(i => i.impact === 'high').forEach(insight => {
      if (!recommendations.some(r => r.relatedMetrics?.includes(insight.relatedMetrics[0]))) {
        recommendations.push({
          id: `insight_${insight.category}_${Date.now()}`,
          priority: 'medium',
          category: 'process',
          title: `Act on ${insight.title}`,
          description: insight.description,
          expectedImpact: 'Prevent potential issues and optimize performance',
          effort: 'low',
          timeline: '1-2 weeks',
          actionItems: insight.evidence.slice(0, 3),
          successMetrics: ['Improved related metrics', 'Reduced risk indicators']
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    trends: HistoricalTrend[],
    patterns: ProductivityPattern[],
    regressions: RegressionAlert[]
  ): number {
    const confidenceScores: number[] = [];

    // Add trend confidences
    trends.forEach(trend => confidenceScores.push(trend.confidence));

    // Add pattern confidences
    patterns.forEach(pattern => confidenceScores.push(pattern.confidence));

    // Add regression confidences
    regressions.forEach(regression => confidenceScores.push(regression.confidence));

    if (confidenceScores.length === 0) {return 0;}

    return confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
  }

  /**
   * Check if pattern is related to specific metric
   */
  private isPatternRelatedToMetric(pattern: ProductivityPattern, metric: string): boolean {
    const relationMap: { [key: string]: string[] } = {
      productivity: ['peak_hours', 'session_length', 'break_patterns'],
      velocity: ['session_length', 'break_patterns'],
      quality: ['language_efficiency'],
      complexity: ['language_efficiency']
    };

    return relationMap[metric]?.includes(pattern.type) || false;
  }

  /**
   * Generate metric-specific insights
   */
  private generateMetricSpecificInsights(
    metric: string,
    trend: HistoricalTrend | null,
    patterns: ProductivityPattern[],
    _regressions: RegressionAlert[]
  ): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    if (trend) {
      insights.push({
        id: `metric_trend_${metric}`,
        category: 'trend',
        title: `${metric} trend analysis`,
        description: `Detailed analysis of ${metric} trends over time`,
        impact: trend.confidence > 0.7 ? 'high' : 'medium',
        confidence: trend.confidence,
        evidence: [
          `Trend direction: ${trend.trendDirection}`,
          `Change rate: ${(trend.changeRate * 100).toFixed(1)}%`,
          `Data points: ${trend.dataPoints.length}`
        ],
        relatedMetrics: [metric],
        timeframe: 'Analysis period'
      });
    }

    patterns.forEach(pattern => {
      insights.push({
        id: `metric_pattern_${pattern.type}`,
        category: 'pattern',
        title: `${pattern.type} pattern for ${metric}`,
        description: pattern.description,
        impact: pattern.impact,
        confidence: pattern.confidence,
        evidence: pattern.recommendations.slice(0, 2),
        relatedMetrics: [metric],
        timeframe: 'Historical data'
      });
    });

    return insights;
  }

  /**
   * Generate metric-specific recommendations
   */
  private generateMetricSpecificRecommendations(
    metric: string,
    _trend: HistoricalTrend | null,
    patterns: ProductivityPattern[],
    regressions: RegressionAlert[]
  ): AnalyticsRecommendation[] {
    const recommendations: AnalyticsRecommendation[] = [];

    // Add regression-based recommendations
    regressions.forEach(regression => {
      recommendations.push({
        id: `metric_regression_${metric}`,
        priority: regression.severity === 'critical' ? 'critical' : 'high',
        category: 'process',
        title: `Address ${metric} regression`,
        description: regression.description,
        expectedImpact: `Restore ${metric} performance`,
        effort: 'high',
        timeline: '1-2 weeks',
        actionItems: regression.recommendations,
        successMetrics: [`${metric} improvement`, 'Regression resolution']
      });
    });

    // Add pattern-based recommendations
    patterns.filter(p => p.impact === 'high').forEach(pattern => {
      recommendations.push({
        id: `metric_pattern_${pattern.type}`,
        priority: 'medium',
        category: this.getPatternCategory(pattern.type),
        title: `Optimize ${pattern.type} for ${metric}`,
        description: pattern.description,
        expectedImpact: `Improve ${metric} through pattern optimization`,
        effort: 'medium',
        timeline: '2-3 weeks',
        actionItems: pattern.recommendations,
        successMetrics: [`${metric} consistency improvement`, 'Pattern optimization success']
      });
    });

    return recommendations;
  }

  /**
   * Get pattern-related metrics
   */
  private getPatternRelatedMetrics(patternType: string): string[] {
    const metricMap: { [key: string]: string[] } = {
      peak_hours: ['productivity'],
      productive_days: ['productivity', 'velocity'],
      language_efficiency: ['productivity', 'velocity', 'quality'],
      session_length: ['productivity'],
      break_patterns: ['productivity']
    };

    return metricMap[patternType] || [];
  }

  /**
   * Get pattern category
   */
  private getPatternCategory(patternType: string): 'process' | 'technical' | 'organizational' | 'tooling' {
    const categoryMap: { [key: string]: 'process' | 'technical' | 'organizational' | 'tooling' } = {
      peak_hours: 'organizational',
      productive_days: 'organizational',
      language_efficiency: 'technical',
      session_length: 'process',
      break_patterns: 'organizational'
    };

    return categoryMap[patternType] || 'process';
  }

  /**
   * Get trend-specific recommendations
   */
  private getTrendRecommendations(metric: string): string[] {
    const recommendationMap: { [key: string]: string[] } = {
      productivity: [
        'Analyze time allocation and eliminate productivity blockers',
        'Optimize development environment and tooling',
        'Review workload distribution and stress factors'
      ],
      quality: [
        'Implement stricter code review processes',
        'Enhance automated testing and quality gates',
        'Schedule technical debt reduction activities'
      ],
      velocity: [
        'Identify and remove process bottlenecks',
        'Improve task estimation and planning',
        'Enhance team collaboration and communication'
      ],
      complexity: [
        'Prioritize refactoring of complex code',
        'Establish complexity guidelines and monitoring',
        'Provide clean code training and best practices'
      ]
    };

    return recommendationMap[metric] || ['Investigate root causes', 'Implement monitoring', 'Take corrective action'];
  }

  /**
   * Generate simple forecast (could be improved with ML models)
   */
  private generateSimpleForecast(
    trend: HistoricalTrend | undefined,
    days: number
  ): { date: string; predicted: number; confidence: number }[] {
    const forecast: { date: string; predicted: number; confidence: number }[] = [];

    if (!trend || trend.dataPoints.length === 0) {
      return forecast;
    }

    const lastValue = trend.dataPoints[trend.dataPoints.length - 1].value;
    const changeRate = trend.changeRate;
    const baseConfidence = trend.confidence;

    for (let i = 1; i <= days; i++) {
      const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const predicted = lastValue * (1 + changeRate * i / 30); // Monthly change rate
      const confidence = Math.max(0.1, baseConfidence - (i / days) * 0.5); // Decreasing confidence over time

      forecast.push({ date, predicted, confidence });
    }

    return forecast;
  }

  /**
   * Identify factors affecting forecast
   */
  private identifyForecastFactors(
    patterns: ProductivityPattern[],
    trends: HistoricalTrend[]
  ): { factor: string; impact: number; confidence: number }[] {
    const factors: { factor: string; impact: number; confidence: number }[] = [];

    // Add pattern-based factors
    patterns.forEach(pattern => {
      if (pattern.impact === 'high') {
        factors.push({
          factor: pattern.type.replace('_', ' '),
          impact: pattern.confidence * 0.3, // Impact on forecast
          confidence: pattern.confidence
        });
      }
    });

    // Add trend-based factors
    trends.forEach(trend => {
      if (Math.abs(trend.changeRate) > 0.1) {
        factors.push({
          factor: `${trend.metric} trend`,
          impact: Math.abs(trend.changeRate) * 0.5,
          confidence: trend.confidence
        });
      }
    });

    return factors.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Generate forecast-based recommendations
   */
  private generateForecastRecommendations(
    forecast: { date: string; predicted: number; confidence: number }[],
    factors: { factor: string; impact: number; confidence: number }[]
  ): string[] {
    const recommendations: string[] = [];

    // Check forecast trend
    if (forecast.length > 7) {
      const weeklyChange = (forecast[6].predicted - forecast[0].predicted) / forecast[0].predicted;

      if (weeklyChange < -0.1) {
        recommendations.push('Declining productivity forecast - implement immediate intervention measures');
      } else if (weeklyChange > 0.1) {
        recommendations.push('Positive productivity forecast - maintain current practices and optimize further');
      }
    }

    // Add factor-based recommendations
    factors.slice(0, 3).forEach(factor => {
      if (factor.impact > 0.2) {
        recommendations.push(`Address ${factor.factor} as it significantly impacts productivity forecasting`);
      }
    });

    return recommendations;
  }
}
