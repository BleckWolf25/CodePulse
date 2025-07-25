/**
 * @file HISTORICAL-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * Historical Data Analysis System
 * Provides comprehensive historical analysis including long-term trends,
 * comparative analysis across projects, performance regression detection,
 * and productivity pattern recognition.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import { StoredMetrics, DailyMetrics } from '../metrics/storage';
import { MetricsStorage } from '../metrics/storage';
import { ErrorHandler } from '../utils/error-handler';
import { TimeRange } from '../metrics/types';

// ------------ INTERFACES
// Historical analysis interfaces
export interface HistoricalTrend {
  metric: string;
  timeRange: TimeRange;
  dataPoints: TrendDataPoint[];
  trendDirection: 'improving' | 'stable' | 'declining';
  changeRate: number;
  confidence: number;
  seasonality?: SeasonalPattern;
}

// Productivity analysis interfaces
export interface TrendDataPoint {
  timestamp: number;
  value: number;
  movingAverage?: number;
  anomaly?: boolean;
  context?: {
    projectName?: string;
    language?: string;
    fileCount?: number;
  };
}



// Seasonal pattern interface for trend analysis
export interface SeasonalPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  peaks: number[];
  valleys: number[];
  amplitude: number;
  confidence: number;
}

// Project comparison interface
export interface ProjectComparison {
  projectA: string;
  projectB: string;
  metrics: {
    productivity: ComparisonResult;
    codeQuality: ComparisonResult;
    complexity: ComparisonResult;
    velocity: ComparisonResult;
  };
  recommendations: string[];
}

// Comparison result interface
export interface ComparisonResult {
  metricName: string;
  valueA: number;
  valueB: number;
  difference: number;
  percentageChange: number;
  significance: 'high' | 'medium' | 'low';
  trend: 'better' | 'worse' | 'similar';
}

// Performance regression interface
export interface PerformanceRegression {
  metric: string;
  detectedAt: number;
  severity: 'critical' | 'major' | 'minor';
  baselineValue: number;
  currentValue: number;
  degradationPercent: number;
  affectedFiles?: string[];
  possibleCauses: string[];
  recommendations: string[];
}

// Productivity pattern interface
export interface ProductivityPattern {
  type: 'peak_hours' | 'productive_days' | 'language_efficiency' | 'session_length' | 'break_patterns';
  pattern: any;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  description: string;
  recommendations: string[];
}

// ------------ MAIN CLASS
export class HistoricalAnalyzer {
  private storage: MetricsStorage;
  private errorHandler = ErrorHandler.getInstance();
  
  // Analysis configuration
  private readonly REGRESSION_THRESHOLD = 0.15; // 15% degradation
  private readonly MIN_DATA_POINTS = 10;
  private readonly ANOMALY_THRESHOLD = 2.5; // Standard deviations
  
  // Constructor
  constructor(context: vscode.ExtensionContext) {
    this.storage = new MetricsStorage(context);
  }

  /**
   * Perform comprehensive long-term trend analysis
   */
  public async analyzeLongTermTrends(timeRange: TimeRange): Promise<HistoricalTrend[]> {
    try {
      const historicalData = this.storage.loadMetrics();
      const trends: HistoricalTrend[] = [];

      // Analyze productivity trends
      const productivityTrend = await this.analyzeProductivityTrend(historicalData, timeRange);
      if (productivityTrend) {trends.push(productivityTrend);}

      // Analyze code quality trends
      const qualityTrend = await this.analyzeCodeQualityTrend(historicalData, timeRange);
      if (qualityTrend) {trends.push(qualityTrend);}

      // Analyze complexity trends
      const complexityTrend = await this.analyzeComplexityTrend(historicalData, timeRange);
      if (complexityTrend) {trends.push(complexityTrend);}

      // Analyze velocity trends
      const velocityTrend = await this.analyzeVelocityTrend(historicalData, timeRange);
      if (velocityTrend) {trends.push(velocityTrend);}

      // Analyze language usage trends
      const languageTrends = await this.analyzeLanguageTrends(historicalData, timeRange);
      trends.push(...languageTrends);

      return trends;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return [];
    }
  }

  /**
   * Compare metrics across different projects
   */
  public async compareProjects(projectA: string, projectB: string, timeRange: TimeRange): Promise<ProjectComparison> {
    try {
      const dataA = await this.getProjectData(projectA, timeRange);
      const dataB = await this.getProjectData(projectB, timeRange);

      const productivity = this.compareMetric('productivity', dataA.productivity, dataB.productivity);
      const codeQuality = this.compareMetric('codeQuality', dataA.codeQuality, dataB.codeQuality);
      const complexity = this.compareMetric('complexity', dataA.complexity, dataB.complexity);
      const velocity = this.compareMetric('velocity', dataA.velocity, dataB.velocity);

      const recommendations = this.generateComparisonRecommendations({
        productivity, codeQuality, complexity, velocity
      });

      return {
        projectA,
        projectB,
        metrics: { productivity, codeQuality, complexity, velocity },
        recommendations
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Detect performance regressions in metrics
   */
  public async detectPerformanceRegressions(lookbackDays: number = 30): Promise<PerformanceRegression[]> {
    try {
      const historicalData = this.storage.loadMetrics();
      const regressions: PerformanceRegression[] = [];

      // Define metrics to monitor for regressions
      const metricsToMonitor = [
        'productivity',
        'codeQuality',
        'complexity',
        'velocity',
        'testCoverage',
        'buildTime'
      ];

      for (const metric of metricsToMonitor) {
        const regression = await this.detectMetricRegression(historicalData, metric, lookbackDays);
        if (regression) {
          regressions.push(regression);
        }
      }

      // Sort by severity
      return regressions.sort((a, b) => {
        const severityOrder = { critical: 3, major: 2, minor: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return [];
    }
  }

  /**
   * Recognize productivity patterns in historical data
   */
  public async recognizeProductivityPatterns(): Promise<ProductivityPattern[]> {
    try {
      const historicalData = this.storage.loadMetrics();
      const patterns: ProductivityPattern[] = [];

      // Analyze peak hours pattern
      const peakHours = await this.analyzePeakHoursPattern(historicalData);
      if (peakHours) {patterns.push(peakHours);}

      // Analyze productive days pattern
      const productiveDays = await this.analyzeProductiveDaysPattern(historicalData);
      if (productiveDays) {patterns.push(productiveDays);}

      // Analyze language efficiency patterns
      const languageEfficiency = await this.analyzeLanguageEfficiencyPattern(historicalData);
      if (languageEfficiency) {patterns.push(languageEfficiency);}

      // Analyze session length patterns
      const sessionLength = await this.analyzeSessionLengthPattern(historicalData);
      if (sessionLength) {patterns.push(sessionLength);}

      // Analyze break patterns
      const breakPatterns = await this.analyzeBreakPatterns(historicalData);
      if (breakPatterns) {patterns.push(breakPatterns);}

      return patterns;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return [];
    }
  }

  /**
   * Generate comprehensive historical insights
   */
  public async generateHistoricalInsights(timeRange: TimeRange): Promise<{
    trends: HistoricalTrend[];
    regressions: PerformanceRegression[];
    patterns: ProductivityPattern[];
    summary: {
      overallTrend: 'improving' | 'stable' | 'declining';
      keyFindings: string[];
      actionItems: string[];
      confidence: number;
    };
  }> {
    try {
      const [trends, regressions, patterns] = await Promise.all([
        this.analyzeLongTermTrends(timeRange),
        this.detectPerformanceRegressions(),
        this.recognizeProductivityPatterns()
      ]);

      const summary = this.generateInsightsSummary(trends, regressions, patterns);

      return { trends, regressions, patterns, summary };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Analyze productivity trend over time
   */
  private async analyzeProductivityTrend(data: StoredMetrics, timeRange: TimeRange): Promise<HistoricalTrend | null> {
    const dailyMetrics = this.filterDataByTimeRange(data.dailyMetrics, timeRange);
    if (dailyMetrics.length < this.MIN_DATA_POINTS) {return null;}

    const dataPoints: TrendDataPoint[] = dailyMetrics.map(day => ({
      timestamp: new Date(day.date).getTime(),
      value: day.totalCodingTime,
      context: {
        fileCount: day.filesEdited
      }
    }));

    // Calculate moving averages
    this.calculateMovingAverages(dataPoints, 7); // 7-day moving average

    // Detect anomalies
    this.detectAnomalies(dataPoints);

    // Calculate trend direction and change rate
    const { trendDirection, changeRate, confidence } = this.calculateTrendMetrics(dataPoints);

    // Detect seasonality
    const seasonality = this.detectSeasonality(dataPoints, 'weekly');

    return {
      metric: 'productivity',
      timeRange,
      dataPoints,
      trendDirection,
      changeRate,
      confidence,
      seasonality
    };
  }

  /**
   * Analyze code quality trend over time
   */
  private async analyzeCodeQualityTrend(data: StoredMetrics, timeRange: TimeRange): Promise<HistoricalTrend | null> {
    const fileMetrics = Object.values(data.fileMetrics);
    if (fileMetrics.length < this.MIN_DATA_POINTS) {return null;}

    // Group by date and calculate average complexity
    const qualityByDate = new Map<string, number[]>();
    
    fileMetrics.forEach(file => {
      const date = new Date(file.lastModified).toISOString().split('T')[0];
      if (!qualityByDate.has(date)) {
        qualityByDate.set(date, []);
      }
      qualityByDate.get(date)!.push(file.complexity.cyclomaticComplexity);
    });

    const dataPoints: TrendDataPoint[] = Array.from(qualityByDate.entries())
      .map(([date, complexities]) => ({
        timestamp: new Date(date).getTime(),
        value: complexities.reduce((sum, c) => sum + c, 0) / complexities.length,
        context: {
          fileCount: complexities.length
        }
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (dataPoints.length < this.MIN_DATA_POINTS) {return null;}

    this.calculateMovingAverages(dataPoints, 7);
    this.detectAnomalies(dataPoints);

    const { trendDirection, changeRate, confidence } = this.calculateTrendMetrics(dataPoints);

    return {
      metric: 'codeQuality',
      timeRange,
      dataPoints,
      trendDirection,
      changeRate,
      confidence
    };
  }

  /**
   * Calculate moving averages for data points
   */
  private calculateMovingAverages(dataPoints: TrendDataPoint[], window: number): void {
    for (let i = window - 1; i < dataPoints.length; i++) {
      const windowData = dataPoints.slice(i - window + 1, i + 1);
      const average = windowData.reduce((sum, point) => sum + point.value, 0) / window;
      dataPoints[i].movingAverage = average;
    }
  }

  /**
   * Detect anomalies in data points using statistical methods
   */
  private detectAnomalies(dataPoints: TrendDataPoint[]): void {
    const values = dataPoints.map(p => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    dataPoints.forEach(point => {
      const zScore = Math.abs(point.value - mean) / stdDev;
      point.anomaly = zScore > this.ANOMALY_THRESHOLD;
    });
  }

  /**
   * Calculate trend metrics including direction, change rate, and confidence
   */
  private calculateTrendMetrics(dataPoints: TrendDataPoint[]): {
    trendDirection: 'improving' | 'stable' | 'declining';
    changeRate: number;
    confidence: number;
  } {
    if (dataPoints.length < 2) {
      return { trendDirection: 'stable', changeRate: 0, confidence: 0 };
    }

    // Linear regression to determine trend
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, _, i) => sum + i, 0);
    const sumY = dataPoints.reduce((sum, p) => sum + p.value, 0);
    const sumXY = dataPoints.reduce((sum, p, i) => sum + i * p.value, 0);
    const sumXX = dataPoints.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = dataPoints.reduce((sum, p) => sum + Math.pow(p.value - yMean, 2), 0);
    const ssResidual = dataPoints.reduce((sum, p, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(p.value - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (ssResidual / ssTotal);
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Determine trend direction
    const changeRate = slope / (sumY / n); // Normalized change rate
    let trendDirection: 'improving' | 'stable' | 'declining';
    
    if (Math.abs(changeRate) < 0.05) {
      trendDirection = 'stable';
    } else if (changeRate > 0) {
      trendDirection = 'improving';
    } else {
      trendDirection = 'declining';
    }

    return { trendDirection, changeRate, confidence };
  }

  /**
   * Filter data by time range
   */
  private filterDataByTimeRange(data: DailyMetrics[], timeRange: TimeRange): DailyMetrics[] {
    return data.filter(item => {
      const timestamp = new Date(item.date).getTime();
      return timestamp >= timeRange.start && timestamp <= timeRange.end;
    });
  }

  /**
   * Detect seasonality patterns in data
   */
  private detectSeasonality(dataPoints: TrendDataPoint[], type: 'daily' | 'weekly' | 'monthly'): SeasonalPattern | undefined {
    if (dataPoints.length < 14) {return undefined;} // Need at least 2 weeks of data

    const periods = type === 'daily' ? 24 : type === 'weekly' ? 7 : 30;
    const cycles = Math.floor(dataPoints.length / periods);
    
    if (cycles < 2) {return undefined;}

    // Group data by period position
    const periodData: number[][] = Array.from({ length: periods }, () => []);
    
    dataPoints.forEach((point, index) => {
      const periodPosition = index % periods;
      periodData[periodPosition].push(point.value);
    });

    // Calculate averages for each period position
    const periodAverages = periodData.map(values => 
      values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
    );

    // Find peaks and valleys
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    for (let i = 1; i < periodAverages.length - 1; i++) {
      if (periodAverages[i] > periodAverages[i - 1] && periodAverages[i] > periodAverages[i + 1]) {
        peaks.push(i);
      }
      if (periodAverages[i] < periodAverages[i - 1] && periodAverages[i] < periodAverages[i + 1]) {
        valleys.push(i);
      }
    }

    // Calculate amplitude
    const max = Math.max(...periodAverages);
    const min = Math.min(...periodAverages);
    const amplitude = max - min;

    // Calculate confidence based on consistency across cycles
    const variance = this.calculateSeasonalVariance(periodData);
    const confidence = Math.max(0, 1 - variance);

    return {
      type,
      peaks,
      valleys,
      amplitude,
      confidence
    };
  }

  /**
   * Calculate seasonal variance for confidence measurement
   */
  private calculateSeasonalVariance(periodData: number[][]): number {
    let totalVariance = 0;
    let validPeriods = 0;

    periodData.forEach(values => {
      if (values.length > 1) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        totalVariance += variance;
        validPeriods++;
      }
    });

    return validPeriods > 0 ? totalVariance / validPeriods : 1;
  }

  /**
   * Analyze complexity trend over time
   */
  private async analyzeComplexityTrend(data: StoredMetrics, timeRange: TimeRange): Promise<HistoricalTrend | null> {
    const fileMetrics = Object.values(data.fileMetrics);
    if (fileMetrics.length < this.MIN_DATA_POINTS) {return null;}

    const complexityByDate = new Map<string, number[]>();

    fileMetrics.forEach(file => {
      const date = new Date(file.lastModified).toISOString().split('T')[0];
      if (!complexityByDate.has(date)) {
        complexityByDate.set(date, []);
      }
      complexityByDate.get(date)!.push(file.complexity.cyclomaticComplexity);
    });

    const dataPoints: TrendDataPoint[] = Array.from(complexityByDate.entries())
      .map(([date, complexities]) => ({
        timestamp: new Date(date).getTime(),
        value: complexities.reduce((sum, c) => sum + c, 0) / complexities.length,
        context: { fileCount: complexities.length }
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (dataPoints.length < this.MIN_DATA_POINTS) {return null;}

    this.calculateMovingAverages(dataPoints, 7);
    this.detectAnomalies(dataPoints);

    const { trendDirection, changeRate, confidence } = this.calculateTrendMetrics(dataPoints);

    return {
      metric: 'complexity',
      timeRange,
      dataPoints,
      trendDirection,
      changeRate,
      confidence
    };
  }

  /**
   * Analyze velocity trend over time
   */
  private async analyzeVelocityTrend(data: StoredMetrics, timeRange: TimeRange): Promise<HistoricalTrend | null> {
    const dailyMetrics = this.filterDataByTimeRange(data.dailyMetrics, timeRange);
    if (dailyMetrics.length < this.MIN_DATA_POINTS) {return null;}

    const dataPoints: TrendDataPoint[] = dailyMetrics.map(day => ({
      timestamp: new Date(day.date).getTime(),
      value: day.filesEdited,
      context: {
        fileCount: day.filesEdited
      }
    }));

    this.calculateMovingAverages(dataPoints, 7);
    this.detectAnomalies(dataPoints);

    const { trendDirection, changeRate, confidence } = this.calculateTrendMetrics(dataPoints);

    return {
      metric: 'velocity',
      timeRange,
      dataPoints,
      trendDirection,
      changeRate,
      confidence
    };
  }

  /**
   * Analyze language usage trends
   */
  private async analyzeLanguageTrends(data: StoredMetrics, timeRange: TimeRange): Promise<HistoricalTrend[]> {
    const dailyMetrics = this.filterDataByTimeRange(data.dailyMetrics, timeRange);
    const trends: HistoricalTrend[] = [];

    // Get all unique languages
    const languages = new Set<string>();
    dailyMetrics.forEach(day => {
      Object.keys(day.languages).forEach(lang => languages.add(lang));
    });

    // Analyze trend for each language
    for (const language of languages) {
      const dataPoints: TrendDataPoint[] = dailyMetrics.map(day => ({
        timestamp: new Date(day.date).getTime(),
        value: day.languages[language] || 0,
        context: { language }
      }));

      if (dataPoints.filter(p => p.value > 0).length < this.MIN_DATA_POINTS) {continue;}

      this.calculateMovingAverages(dataPoints, 7);
      this.detectAnomalies(dataPoints);

      const { trendDirection, changeRate, confidence } = this.calculateTrendMetrics(dataPoints);

      trends.push({
        metric: `language_${language}`,
        timeRange,
        dataPoints,
        trendDirection,
        changeRate,
        confidence
      });
    }

    return trends;
  }

  /**
   * Get project data for comparison
   */
  private async getProjectData(_projectName: string, timeRange: TimeRange): Promise<{
    productivity: number;
    codeQuality: number;
    complexity: number;
    velocity: number;
  }> {
    // Overall metrics
    const data = this.storage.loadMetrics();
    const dailyMetrics = this.filterDataByTimeRange(data.dailyMetrics, timeRange);

    const productivity = dailyMetrics.reduce((sum, day) => sum + day.totalCodingTime, 0) / dailyMetrics.length;
    const velocity = dailyMetrics.reduce((sum, day) => sum + day.filesEdited, 0) / dailyMetrics.length;

    const fileMetrics = Object.values(data.fileMetrics);
    const complexity = fileMetrics.reduce((sum, file) => sum + file.complexity.cyclomaticComplexity, 0) / fileMetrics.length;
    const codeQuality = 100 - (complexity * 2); // Simplified quality score

    return { productivity, codeQuality, complexity, velocity };
  }

  /**
   * Compare two metric values
   */
  private compareMetric(metricName: string, valueA: number, valueB: number): ComparisonResult {
    const difference = valueB - valueA;
    const percentageChange = valueA !== 0 ? (difference / valueA) * 100 : 0;

    let significance: 'high' | 'medium' | 'low' = 'low';
    if (Math.abs(percentageChange) > 20) {significance = 'high';}
    else if (Math.abs(percentageChange) > 10) {significance = 'medium';}

    let trend: 'better' | 'worse' | 'similar' = 'similar';
    if (Math.abs(percentageChange) > 5) {
      // For complexity, lower is better; for others, higher is better
      const isLowerBetter = metricName === 'complexity';
      trend = (difference > 0) !== isLowerBetter ? 'better' : 'worse';
    }

    return {
      metricName,
      valueA,
      valueB,
      difference,
      percentageChange,
      significance,
      trend
    };
  }

  /**
   * Generate comparison recommendations
   */
  private generateComparisonRecommendations(metrics: {
    productivity: ComparisonResult;
    codeQuality: ComparisonResult;
    complexity: ComparisonResult;
    velocity: ComparisonResult;
  }): string[] {
    const recommendations: string[] = [];

    if (metrics.productivity.trend === 'worse' && metrics.productivity.significance === 'high') {
      recommendations.push('Focus on improving development productivity through better tooling and processes');
    }

    if (metrics.codeQuality.trend === 'worse' && metrics.codeQuality.significance === 'high') {
      recommendations.push('Implement code review processes and quality gates to improve code quality');
    }

    if (metrics.complexity.trend === 'worse' && metrics.complexity.significance === 'high') {
      recommendations.push('Refactor complex code and establish complexity guidelines');
    }

    if (metrics.velocity.trend === 'worse' && metrics.velocity.significance === 'high') {
      recommendations.push('Analyze bottlenecks in the development process to improve velocity');
    }

    return recommendations;
  }

  /**
   * Detect metric regression
   */
  private async detectMetricRegression(data: StoredMetrics, metric: string, lookbackDays: number): Promise<PerformanceRegression | null> {
    const cutoffDate = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);
    const recentData = data.dailyMetrics.filter(day => new Date(day.date).getTime() >= cutoffDate);

    if (recentData.length < 7) {return null;} // Need at least a week of data

    // Calculate baseline (first half) and current (second half) values
    const midpoint = Math.floor(recentData.length / 2);
    const baseline = recentData.slice(0, midpoint);
    const current = recentData.slice(midpoint);

    let baselineValue: number, currentValue: number;

    switch (metric) {
      case 'productivity':
        baselineValue = baseline.reduce((sum, day) => sum + day.totalCodingTime, 0) / baseline.length;
        currentValue = current.reduce((sum, day) => sum + day.totalCodingTime, 0) / current.length;
        break;
      case 'velocity':
        baselineValue = baseline.reduce((sum, day) => sum + day.filesEdited, 0) / baseline.length;
        currentValue = current.reduce((sum, day) => sum + day.filesEdited, 0) / current.length;
        break;
      default:
        return null;
    }

    const degradationPercent = ((baselineValue - currentValue) / baselineValue) * 100;

    if (degradationPercent < this.REGRESSION_THRESHOLD * 100) {return null;}

    let severity: 'critical' | 'major' | 'minor' = 'minor';
    if (degradationPercent > 30) {severity = 'critical';}
    else if (degradationPercent > 20) {severity = 'major';}

    const possibleCauses = this.identifyRegressionCauses(metric, degradationPercent);
    const recommendations = this.generateRegressionRecommendations(metric, severity);

    return {
      metric,
      detectedAt: Date.now(),
      severity,
      baselineValue,
      currentValue,
      degradationPercent,
      possibleCauses,
      recommendations
    };
  }

  /**
   * Identify possible causes of regression
   */
  private identifyRegressionCauses(metric: string, degradationPercent: number): string[] {
    const causes: string[] = [];

    if (degradationPercent > 25) {
      causes.push('Significant change in development environment or tools');
      causes.push('Team composition changes or new team members');
    }

    if (metric === 'productivity') {
      causes.push('Increased complexity in current tasks');
      causes.push('Technical debt accumulation');
      causes.push('Distractions or context switching');
    }

    if (metric === 'velocity') {
      causes.push('Larger feature scope or requirements changes');
      causes.push('Increased testing or review requirements');
      causes.push('Infrastructure or tooling issues');
    }

    return causes;
  }

  /**
   * Generate regression recommendations
   */
  private generateRegressionRecommendations(metric: string, severity: 'critical' | 'major' | 'minor'): string[] {
    const recommendations: string[] = [];

    if (severity === 'critical') {
      recommendations.push('Immediate investigation required - schedule team retrospective');
      recommendations.push('Review recent changes in process, tools, or team composition');
    }

    if (metric === 'productivity') {
      recommendations.push('Analyze time allocation and identify productivity blockers');
      recommendations.push('Consider pair programming or mentoring for skill development');
      recommendations.push('Review and optimize development environment setup');
    }

    if (metric === 'velocity') {
      recommendations.push('Break down large features into smaller, manageable tasks');
      recommendations.push('Identify and address process bottlenecks');
      recommendations.push('Ensure adequate testing automation to maintain quality');
    }

    return recommendations;
  }

  /**
   * Analyze peak hours pattern
   */
  private async analyzePeakHoursPattern(data: StoredMetrics): Promise<ProductivityPattern | null> {
    const sessions = data.sessions.filter(s => s.endTime && s.activeTime > 0);
    if (sessions.length < 20) {return null;}

    // Group sessions by hour of day
    const hourlyActivity = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    sessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      hourlyActivity[hour] += session.activeTime;
      hourlyCounts[hour]++;
    });

    // Calculate average activity per hour
    const hourlyAverages = hourlyActivity.map((total, hour) =>
      hourlyCounts[hour] > 0 ? total / hourlyCounts[hour] : 0
    );

    // Find peak hours (top 25% of hours)
    const sortedHours = hourlyAverages
      .map((avg, hour) => ({ hour, avg }))
      .sort((a, b) => b.avg - a.avg);

    const peakHours = sortedHours.slice(0, 6).map(h => h.hour).sort((a, b) => a - b);

    // Calculate confidence based on consistency
    const maxActivity = Math.max(...hourlyAverages);
    const avgActivity = hourlyAverages.reduce((sum, a) => sum + a, 0) / 24;
    const confidence = maxActivity > 0 ? Math.min(1, (maxActivity - avgActivity) / maxActivity) : 0;

    return {
      type: 'peak_hours',
      pattern: {
        peakHours,
        hourlyAverages,
        bestHour: sortedHours[0].hour,
        worstHour: sortedHours[sortedHours.length - 1].hour
      },
      confidence,
      impact: confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low',
      description: `Peak productivity hours: ${peakHours.map(h => `${h}:00`).join(', ')}`,
      recommendations: [
        `Schedule important tasks during peak hours: ${peakHours.slice(0, 3).map(h => `${h}:00`).join(', ')}`,
        'Avoid meetings and interruptions during peak productivity times',
        'Use low-productivity hours for administrative tasks and planning'
      ]
    };
  }

  /**
   * Analyze productive days pattern
   */
  private async analyzeProductiveDaysPattern(data: StoredMetrics): Promise<ProductivityPattern | null> {
    const dailyMetrics = data.dailyMetrics.filter(day => day.totalCodingTime > 0);
    if (dailyMetrics.length < 14) {return null;}

    // Group by day of week
    const weeklyActivity = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);

    dailyMetrics.forEach(day => {
      const dayOfWeek = new Date(day.date).getDay();
      weeklyActivity[dayOfWeek] += day.totalCodingTime;
      weeklyCounts[dayOfWeek]++;
    });

    const weeklyAverages = weeklyActivity.map((total, day) =>
      weeklyCounts[day] > 0 ? total / weeklyCounts[day] : 0
    );

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bestDay = weeklyAverages.indexOf(Math.max(...weeklyAverages));
    const worstDay = weeklyAverages.indexOf(Math.min(...weeklyAverages.filter(a => a > 0)));

    const maxActivity = Math.max(...weeklyAverages);
    const avgActivity = weeklyAverages.reduce((sum, a) => sum + a, 0) / 7;
    const confidence = maxActivity > 0 ? Math.min(1, (maxActivity - avgActivity) / maxActivity) : 0;

    return {
      type: 'productive_days',
      pattern: {
        weeklyAverages,
        bestDay: dayNames[bestDay],
        worstDay: dayNames[worstDay],
        weekendProductivity: (weeklyAverages[0] + weeklyAverages[6]) / 2,
        weekdayProductivity: weeklyAverages.slice(1, 6).reduce((sum, a) => sum + a, 0) / 5
      },
      confidence,
      impact: confidence > 0.6 ? 'high' : confidence > 0.3 ? 'medium' : 'low',
      description: `Most productive day: ${dayNames[bestDay]}, least productive: ${dayNames[worstDay]}`,
      recommendations: [
        `Schedule challenging tasks on ${dayNames[bestDay]}`,
        `Use ${dayNames[worstDay]} for planning and administrative work`,
        'Consider adjusting work schedule to align with natural productivity patterns'
      ]
    };
  }

  /**
   * Analyze language efficiency pattern
   */
  private async analyzeLanguageEfficiencyPattern(data: StoredMetrics): Promise<ProductivityPattern | null> {
    const dailyMetrics = data.dailyMetrics.filter(day => day.totalCodingTime > 0);
    if (dailyMetrics.length < 10) {return null;}

    // Calculate efficiency (files edited per hour) by language
    const languageStats = new Map<string, { totalTime: number; totalFiles: number; days: number }>();

    dailyMetrics.forEach(day => {
      Object.entries(day.languages).forEach(([language, fileCount]) => {
        if (!languageStats.has(language)) {
          languageStats.set(language, { totalTime: 0, totalFiles: 0, days: 0 });
        }
        const stats = languageStats.get(language)!;
        stats.totalTime += day.totalCodingTime * (fileCount / day.filesEdited);
        stats.totalFiles += fileCount;
        stats.days++;
      });
    });

    // Calculate efficiency scores
    const languageEfficiency = Array.from(languageStats.entries())
      .map(([language, stats]) => ({
        language,
        efficiency: stats.totalTime > 0 ? stats.totalFiles / (stats.totalTime / 3600000) : 0, // files per hour
        avgFilesPerDay: stats.totalFiles / stats.days,
        totalDays: stats.days
      }))
      .filter(l => l.totalDays >= 3) // Only languages used for at least 3 days
      .sort((a, b) => b.efficiency - a.efficiency);

    if (languageEfficiency.length < 2) {return null;}

    const mostEfficient = languageEfficiency[0];
    const leastEfficient = languageEfficiency[languageEfficiency.length - 1];
    const efficiencyRange = mostEfficient.efficiency - leastEfficient.efficiency;
    const confidence = efficiencyRange > 0 ? Math.min(1, efficiencyRange / mostEfficient.efficiency) : 0;

    return {
      type: 'language_efficiency',
      pattern: {
        languageEfficiency,
        mostEfficient: mostEfficient.language,
        leastEfficient: leastEfficient.language,
        efficiencyGap: efficiencyRange
      },
      confidence,
      impact: confidence > 0.5 ? 'high' : confidence > 0.25 ? 'medium' : 'low',
      description: `Most efficient language: ${mostEfficient.language} (${mostEfficient.efficiency.toFixed(1)} files/hour)`,
      recommendations: [
        `Consider using ${mostEfficient.language} for rapid prototyping`,
        `Invest in better tooling for ${leastEfficient.language}`,
        'Analyze what makes certain languages more efficient for your workflow'
      ]
    };
  }

  /**
   * Analyze session length pattern
   */
  private async analyzeSessionLengthPattern(data: StoredMetrics): Promise<ProductivityPattern | null> {
    const sessions = data.sessions.filter(s => s.endTime && s.activeTime > 0);
    if (sessions.length < 20) {return null;}

    // Calculate session lengths and productivity
    const sessionData = sessions.map(session => {
      const totalTime = session.endTime! - session.startTime;
      const productivity = session.activeTime / totalTime;
      return {
        length: totalTime / 60000, // minutes
        productivity,
        activeTime: session.activeTime / 60000 // minutes
      };
    });

    // Group by session length ranges
    const ranges = [
      { min: 0, max: 30, label: '0-30 min' },
      { min: 30, max: 60, label: '30-60 min' },
      { min: 60, max: 120, label: '1-2 hours' },
      { min: 120, max: 240, label: '2-4 hours' },
      { min: 240, max: Infinity, label: '4+ hours' }
    ];

    const rangeStats = ranges.map(range => {
      const rangeSessions = sessionData.filter(s => s.length >= range.min && s.length < range.max);
      const avgProductivity = rangeSessions.length > 0
        ? rangeSessions.reduce((sum, s) => sum + s.productivity, 0) / rangeSessions.length
        : 0;

      return {
        ...range,
        count: rangeSessions.length,
        avgProductivity,
        avgActiveTime: rangeSessions.length > 0
          ? rangeSessions.reduce((sum, s) => sum + s.activeTime, 0) / rangeSessions.length
          : 0
      };
    }).filter(r => r.count > 0);

    const bestRange = rangeStats.reduce((best, current) =>
      current.avgProductivity > best.avgProductivity ? current : best
    );

    const confidence = rangeStats.length > 1 ?
      Math.min(1, (bestRange.avgProductivity - rangeStats.reduce((sum, r) => sum + r.avgProductivity, 0) / rangeStats.length) / bestRange.avgProductivity) : 0;

    return {
      type: 'session_length',
      pattern: {
        rangeStats,
        optimalRange: bestRange.label,
        optimalProductivity: bestRange.avgProductivity
      },
      confidence,
      impact: confidence > 0.4 ? 'high' : confidence > 0.2 ? 'medium' : 'low',
      description: `Optimal session length: ${bestRange.label} (${(bestRange.avgProductivity * 100).toFixed(1)}% productivity)`,
      recommendations: [
        `Aim for ${bestRange.label} coding sessions for optimal productivity`,
        'Take breaks between sessions to maintain focus',
        'Use time-blocking techniques to structure your work sessions'
      ]
    };
  }

  /**
   * Analyze break patterns
   */
  private async analyzeBreakPatterns(data: StoredMetrics): Promise<ProductivityPattern | null> {
    const sessions = data.sessions.filter(s => s.endTime && s.activeTime > 0);
    if (sessions.length < 10) {return null;}

    // Calculate break patterns between sessions
    const breaks: { duration: number; beforeProductivity: number; afterProductivity: number }[] = [];

    for (let i = 1; i < sessions.length; i++) {
      const prevSession = sessions[i - 1];
      const currentSession = sessions[i];

      if (prevSession.endTime && currentSession.startTime > prevSession.endTime) {
        const breakDuration = (currentSession.startTime - prevSession.endTime) / 60000; // minutes

        if (breakDuration > 5 && breakDuration < 480) { // 5 minutes to 8 hours
          const beforeProductivity = prevSession.activeTime / (prevSession.endTime - prevSession.startTime);
          const afterProductivity = currentSession.activeTime / (currentSession.endTime! - currentSession.startTime);

          breaks.push({
            duration: breakDuration,
            beforeProductivity,
            afterProductivity
          });
        }
      }
    }

    if (breaks.length < 5) {return null;}

    // Group breaks by duration ranges
    const breakRanges = [
      { min: 5, max: 15, label: '5-15 min' },
      { min: 15, max: 30, label: '15-30 min' },
      { min: 30, max: 60, label: '30-60 min' },
      { min: 60, max: 120, label: '1-2 hours' },
      { min: 120, max: 480, label: '2+ hours' }
    ];

    const breakStats = breakRanges.map(range => {
      const rangeBreaks = breaks.filter(b => b.duration >= range.min && b.duration < range.max);
      const productivityImprovement = rangeBreaks.length > 0
        ? rangeBreaks.reduce((sum, b) => sum + (b.afterProductivity - b.beforeProductivity), 0) / rangeBreaks.length
        : 0;

      return {
        ...range,
        count: rangeBreaks.length,
        avgImprovement: productivityImprovement
      };
    }).filter(r => r.count > 0);

    const bestBreakLength = breakStats.reduce((best, current) =>
      current.avgImprovement > best.avgImprovement ? current : best
    );

    const confidence = breakStats.length > 1 ?
      Math.min(1, Math.abs(bestBreakLength.avgImprovement) * 10) : 0;

    return {
      type: 'break_patterns',
      pattern: {
        breakStats,
        optimalBreakLength: bestBreakLength.label,
        avgImprovement: bestBreakLength.avgImprovement
      },
      confidence,
      impact: confidence > 0.3 ? 'high' : confidence > 0.15 ? 'medium' : 'low',
      description: `Optimal break length: ${bestBreakLength.label} (${(bestBreakLength.avgImprovement * 100).toFixed(1)}% productivity improvement)`,
      recommendations: [
        `Take ${bestBreakLength.label} breaks for optimal productivity recovery`,
        'Use break time for physical activity or mental rest',
        'Avoid checking emails or social media during short breaks'
      ]
    };
  }

  /**
   * Generate insights summary
   */
  private generateInsightsSummary(
    trends: HistoricalTrend[],
    regressions: PerformanceRegression[],
    patterns: ProductivityPattern[]
  ): {
    overallTrend: 'improving' | 'stable' | 'declining';
    keyFindings: string[];
    actionItems: string[];
    confidence: number;
  } {
    // Calculate overall trend
    const trendScores = trends.map(t => {
      switch (t.trendDirection) {
        case 'improving': return 1;
        case 'stable': return 0;
        case 'declining': return -1;
      }
    });

    const avgTrendScore = trendScores.length > 0
      ? trendScores.reduce((sum: number, score: -1 | 0 | 1): number => sum + score, 0) / trendScores.length
      : 0;

    let overallTrend: 'improving' | 'stable' | 'declining';
    if (avgTrendScore > 0.2) {overallTrend = 'improving';}
    else if (avgTrendScore < -0.2) {overallTrend = 'declining';}
    else {overallTrend = 'stable';}

    // Generate key findings
    const keyFindings: string[] = [];

    const improvingTrends = trends.filter(t => t.trendDirection === 'improving' && t.confidence > 0.6);
    const decliningTrends = trends.filter(t => t.trendDirection === 'declining' && t.confidence > 0.6);

    if (improvingTrends.length > 0) {
      keyFindings.push(`Improving trends in: ${improvingTrends.map(t => t.metric).join(', ')}`);
    }

    if (decliningTrends.length > 0) {
      keyFindings.push(`Declining trends in: ${decliningTrends.map(t => t.metric).join(', ')}`);
    }

    if (regressions.length > 0) {
      const criticalRegressions = regressions.filter(r => r.severity === 'critical');
      if (criticalRegressions.length > 0) {
        keyFindings.push(`Critical performance regressions detected in: ${criticalRegressions.map(r => r.metric).join(', ')}`);
      }
    }

    const highImpactPatterns = patterns.filter(p => p.impact === 'high');
    if (highImpactPatterns.length > 0) {
      keyFindings.push(`Strong productivity patterns identified: ${highImpactPatterns.map(p => p.type).join(', ')}`);
    }

    // Generate action items
    const actionItems: string[] = [];

    regressions.forEach(regression => {
      if (regression.severity === 'critical' || regression.severity === 'major') {
        actionItems.push(`Address ${regression.metric} regression (${regression.degradationPercent.toFixed(1)}% decline)`);
      }
    });

    patterns.forEach(pattern => {
      if (pattern.impact === 'high' && pattern.recommendations.length > 0) {
        actionItems.push(pattern.recommendations[0]);
      }
    });

    if (decliningTrends.length > 0) {
      actionItems.push('Investigate causes of declining trends and implement corrective measures');
    }

    // Calculate overall confidence
    const allConfidences = [
      ...trends.map(t => t.confidence),
      ...patterns.map(p => p.confidence)
    ];

    const confidence = allConfidences.length > 0
      ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
      : 0;

    return {
      overallTrend,
      keyFindings,
      actionItems,
      confidence
    };
  }
}
