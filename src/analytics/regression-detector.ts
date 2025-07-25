/**
 * @file REGRESSION-DETECTOR.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * Performance Regression Detection System.
 * System for detecting performance regressions in development metrics
 * using statistical analysis, machine learning techniques, and anomaly detection.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import { StoredMetrics, DailyMetrics, SessionData } from '../metrics/storage';
import { MetricsStorage } from '../metrics/storage';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES
// Regression Alert Interface
export interface RegressionAlert {
  id: string;
  metric: string;
  severity: 'critical' | 'major' | 'minor' | 'warning';
  detectedAt: number;
  description: string;
  currentValue: number;
  baselineValue: number;
  degradationPercent: number;
  confidence: number;
  affectedPeriod: {
    start: number;
    end: number;
  };
  possibleCauses: PossibleCause[];
  recommendations: string[];
  historicalContext: HistoricalContext;
}

// Possible Cause Interface
export interface PossibleCause {
  category: 'environmental' | 'process' | 'technical' | 'organizational';
  description: string;
  likelihood: number;
  evidence: string[];
}

// Historical Context Interface
export interface HistoricalContext {
  previousRegressions: number;
  recoveryTime: number; // Average time to recover from regressions
  seasonalFactors: SeasonalFactor[];
  trendContext: 'improving' | 'stable' | 'declining';
}

// Seasonal Factor Interface
export interface SeasonalFactor {
  type: 'daily' | 'weekly' | 'monthly';
  pattern: string;
  impact: number;
}

// Regression Threshold Interface
export interface RegressionThreshold {
  metric: string;
  warningThreshold: number;
  minorThreshold: number;
  majorThreshold: number;
  criticalThreshold: number;
  minimumSamples: number;
  lookbackPeriod: number; // days
}

// Statistical Analysis Interface
export interface StatisticalAnalysis {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  outliers: number[];
  trendSlope: number;
  seasonality: number;
}

// Anomaly Detection Result Interface
export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyScore: number;
  method: 'zscore' | 'iqr' | 'isolation_forest' | 'moving_average';
  confidence: number;
  context: string;
}

// ------------ MAIN CLASS
export class RegressionDetector {
  private storage: MetricsStorage;
  private errorHandler = ErrorHandler.getInstance();
  
  // Default thresholds for different metrics
  private readonly DEFAULT_THRESHOLDS: RegressionThreshold[] = [
    {
      metric: 'productivity',
      warningThreshold: 5,
      minorThreshold: 10,
      majorThreshold: 20,
      criticalThreshold: 35,
      minimumSamples: 7,
      lookbackPeriod: 30
    },
    {
      metric: 'codeQuality',
      warningThreshold: 3,
      minorThreshold: 8,
      majorThreshold: 15,
      criticalThreshold: 25,
      minimumSamples: 5,
      lookbackPeriod: 21
    },
    {
      metric: 'velocity',
      warningThreshold: 8,
      minorThreshold: 15,
      majorThreshold: 25,
      criticalThreshold: 40,
      minimumSamples: 7,
      lookbackPeriod: 30
    },
    {
      metric: 'complexity',
      warningThreshold: 10,
      minorThreshold: 20,
      majorThreshold: 35,
      criticalThreshold: 50,
      minimumSamples: 5,
      lookbackPeriod: 21
    }
  ];

  // Constructor
  constructor(context: vscode.ExtensionContext) {
    this.storage = new MetricsStorage(context);
  }

  /**
   * Detect regressions across all monitored metrics
   */
  public async detectRegressions(): Promise<RegressionAlert[]> {
    try {
      const data = this.storage.loadMetrics();
      const alerts: RegressionAlert[] = [];

      for (const threshold of this.DEFAULT_THRESHOLDS) {
        const regression = await this.detectMetricRegression(data, threshold);
        if (regression) {
          alerts.push(regression);
        }
      }

      // Sort by severity and confidence
      return alerts.sort((a, b) => {
        const severityOrder = { critical: 4, major: 3, minor: 2, warning: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        return severityDiff !== 0 ? severityDiff : b.confidence - a.confidence;
      });
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return [];
    }
  }

  /**
   * Detect regression for a specific metric
   */
  private async detectMetricRegression(data: StoredMetrics, threshold: RegressionThreshold): Promise<RegressionAlert | null> {
    const metricData = this.extractMetricData(data, threshold.metric, threshold.lookbackPeriod);
    
    if (metricData.length < threshold.minimumSamples) {
      return null;
    }

    // Perform statistical analysis
    const stats = this.performStatisticalAnalysis(metricData);
    
    // Detect anomalies using multiple methods
    const anomalyResults = this.detectAnomalies(metricData, stats);
    
    // Check for regression patterns
    const regressionAnalysis = this.analyzeRegression(metricData, stats, threshold);
    
    if (!regressionAnalysis.hasRegression) {
      return null;
    }

    // Generate alert
    const alert = await this.generateRegressionAlert(
      threshold.metric,
      metricData,
      stats,
      regressionAnalysis,
      anomalyResults,
      threshold
    );

    return alert;
  }

  /**
   * Extract metric data for analysis
   */
  private extractMetricData(data: StoredMetrics, metric: string, lookbackDays: number): { timestamp: number; value: number }[] {
    const cutoffDate = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);
    const recentData = data.dailyMetrics.filter(day => new Date(day.date).getTime() >= cutoffDate);

    switch (metric) {
      case 'productivity':
        return recentData.map(day => ({
          timestamp: new Date(day.date).getTime(),
          value: day.totalCodingTime / (1000 * 60 * 60) // Convert to hours
        }));
      
      case 'velocity':
        return recentData.map(day => ({
          timestamp: new Date(day.date).getTime(),
          value: day.filesEdited
        }));
      
      case 'codeQuality':
        // Calculate quality score from complexity (simplified)
        const qualityByDate = new Map<string, number[]>();
        Object.values(data.fileMetrics).forEach(file => {
          const date = new Date(file.lastModified).toISOString().split('T')[0];
          if (!qualityByDate.has(date)) {
            qualityByDate.set(date, []);
          }
          qualityByDate.get(date)!.push(100 - file.complexity.cyclomaticComplexity * 2);
        });

        return Array.from(qualityByDate.entries())
          .filter(([date]) => new Date(date).getTime() >= cutoffDate)
          .map(([date, scores]) => ({
            timestamp: new Date(date).getTime(),
            value: scores.reduce((sum, s) => sum + s, 0) / scores.length
          }));
      
      case 'complexity':
        const complexityByDate = new Map<string, number[]>();
        Object.values(data.fileMetrics).forEach(file => {
          const date = new Date(file.lastModified).toISOString().split('T')[0];
          if (!complexityByDate.has(date)) {
            complexityByDate.set(date, []);
          }
          complexityByDate.get(date)!.push(file.complexity.cyclomaticComplexity);
        });

        return Array.from(complexityByDate.entries())
          .filter(([date]) => new Date(date).getTime() >= cutoffDate)
          .map(([date, complexities]) => ({
            timestamp: new Date(date).getTime(),
            value: complexities.reduce((sum, c) => sum + c, 0) / complexities.length
          }));
      
      default:
        return [];
    }
  }

  /**
   * Perform comprehensive statistical analysis
   */
  private performStatisticalAnalysis(data: { timestamp: number; value: number }[]): StatisticalAnalysis {
    const values = data.map(d => d.value);
    const n = values.length;

    // Basic statistics
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = n % 2 === 0 
      ? (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2 
      : sortedValues[Math.floor(n / 2)];

    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Skewness and kurtosis
    const skewness = this.calculateSkewness(values, mean, standardDeviation);
    const kurtosis = this.calculateKurtosis(values, mean, standardDeviation);

    // Outlier detection using IQR method
    const q1 = sortedValues[Math.floor(n * 0.25)];
    const q3 = sortedValues[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = values.filter(v => v < lowerBound || v > upperBound);

    // Trend analysis using linear regression
    const trendSlope = this.calculateTrendSlope(data);

    // Seasonality detection (simplified)
    const seasonality = this.detectSeasonality(data);

    return {
      mean,
      median,
      standardDeviation,
      variance,
      skewness,
      kurtosis,
      outliers,
      trendSlope,
      seasonality
    };
  }

  /**
   * Calculate skewness
   */
  private calculateSkewness(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const skewSum = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * skewSum;
  }

  /**
   * Calculate kurtosis
   */
  private calculateKurtosis(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const kurtSum = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * kurtSum - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  /**
   * Calculate trend slope using linear regression
   */
  private calculateTrendSlope(data: { timestamp: number; value: number }[]): number {
    const n = data.length;
    const sumX = data.reduce((sum, _d, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.value, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumXX = data.reduce((sum, _d, i) => sum + i * i, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Detect seasonality patterns
   */
  private detectSeasonality(data: { timestamp: number; value: number }[]): number {
    if (data.length < 14) {return 0;} // Need at least 2 weeks

    // Simple autocorrelation for weekly pattern
    const values = data.map(d => d.value);
    const lag7Correlation = this.calculateAutocorrelation(values, 7);
    
    return Math.abs(lag7Correlation);
  }

  /**
   * Calculate autocorrelation at specific lag
   */
  private calculateAutocorrelation(values: number[], lag: number): number {
    if (lag >= values.length) {return 0;}

    const n = values.length - lag;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Detect anomalies using multiple methods
   */
  private detectAnomalies(data: { timestamp: number; value: number }[], stats: StatisticalAnalysis): AnomalyDetectionResult[] {
    const results: AnomalyDetectionResult[] = [];
    const recentValues = data.slice(-7).map(d => d.value); // Last 7 days

    // Z-score method
    recentValues.forEach((value, _index) => {
      const zScore = Math.abs(value - stats.mean) / stats.standardDeviation;
      if (zScore > 2.5) {
        results.push({
          isAnomaly: true,
          anomalyScore: zScore,
          method: 'zscore',
          confidence: Math.min(1, zScore / 3),
          context: `Value ${value.toFixed(2)} is ${zScore.toFixed(2)} standard deviations from mean`
        });
      }
    });

    // Moving average method
    if (data.length >= 7) {
      const movingAverage = this.calculateMovingAverage(data.map(d => d.value), 7);
      const latestValue = recentValues[recentValues.length - 1];
      const latestMA = movingAverage[movingAverage.length - 1];
      const deviation = Math.abs(latestValue - latestMA) / latestMA;
      
      if (deviation > 0.2) { // 20% deviation
        results.push({
          isAnomaly: true,
          anomalyScore: deviation,
          method: 'moving_average',
          confidence: Math.min(1, deviation / 0.5),
          context: `Current value deviates ${(deviation * 100).toFixed(1)}% from moving average`
        });
      }
    }

    return results;
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(values: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = window - 1; i < values.length; i++) {
      const windowValues = values.slice(i - window + 1, i + 1);
      const average = windowValues.reduce((sum, v) => sum + v, 0) / window;
      result.push(average);
    }
    return result;
  }

  /**
   * Analyze regression patterns
   */
  private analyzeRegression(
    data: { timestamp: number; value: number }[],
    stats: StatisticalAnalysis,
    threshold: RegressionThreshold
  ): { hasRegression: boolean; degradationPercent: number; confidence: number; pattern: string } {
    if (data.length < threshold.minimumSamples) {
      return { hasRegression: false, degradationPercent: 0, confidence: 0, pattern: 'insufficient_data' };
    }

    // Split data into baseline and recent periods
    const splitPoint = Math.floor(data.length * 0.6); // 60% baseline, 40% recent
    const baseline = data.slice(0, splitPoint);
    const recent = data.slice(splitPoint);

    const baselineAvg = baseline.reduce((sum, d) => sum + d.value, 0) / baseline.length;
    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;

    // For complexity, higher values are worse; for others, lower values are worse
    const isHigherWorse = threshold.metric === 'complexity';
    const degradationPercent = isHigherWorse
      ? ((recentAvg - baselineAvg) / baselineAvg) * 100
      : ((baselineAvg - recentAvg) / baselineAvg) * 100;

    // Determine if this constitutes a regression
    const hasRegression = degradationPercent >= threshold.warningThreshold;

    // Calculate confidence based on statistical significance
    const confidence = this.calculateRegressionConfidence(baseline, recent, stats);

    // Identify pattern
    let pattern = 'stable';
    if (stats.trendSlope < -0.1) {pattern = 'declining';}
    else if (stats.trendSlope > 0.1) {pattern = 'improving';}
    else if (stats.outliers.length > data.length * 0.2) {pattern = 'volatile';}

    return { hasRegression, degradationPercent, confidence, pattern };
  }

  /**
   * Calculate regression confidence using statistical tests
   */
  private calculateRegressionConfidence(
    baseline: { timestamp: number; value: number }[],
    recent: { timestamp: number; value: number }[],
    _stats: StatisticalAnalysis
  ): number {
    const baselineValues = baseline.map(d => d.value);
    const recentValues = recent.map(d => d.value);

    // Welch's t-test for unequal variances
    const baselineMean = baselineValues.reduce((sum, v) => sum + v, 0) / baselineValues.length;
    const recentMean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;

    const baselineVar = baselineValues.reduce((sum, v) => sum + Math.pow(v - baselineMean, 2), 0) / (baselineValues.length - 1);
    const recentVar = recentValues.reduce((sum, v) => sum + Math.pow(v - recentMean, 2), 0) / (recentValues.length - 1);

    const pooledSE = Math.sqrt(baselineVar / baselineValues.length + recentVar / recentValues.length);
    const tStat = Math.abs(baselineMean - recentMean) / pooledSE;

    // Approximate p-value calculation (simplified)
    const df = Math.min(baselineValues.length - 1, recentValues.length - 1);
    const pValue = this.approximatePValue(tStat, df);

    // Convert p-value to confidence (1 - p-value)
    return Math.max(0, Math.min(1, 1 - pValue));
  }

  /**
   * Approximate p-value for t-test (simplified)
   */
  private approximatePValue(tStat: number, _df: number): number {
    // Very simplified approximation - in practice, would use proper statistical library
    if (tStat > 3) {return 0.01;}
    if (tStat > 2.5) {return 0.05;}
    if (tStat > 2) {return 0.1;}
    if (tStat > 1.5) {return 0.2;}
    return 0.5;
  }

  /**
   * Generate comprehensive regression alert
   */
  private async generateRegressionAlert(
    metric: string,
    data: { timestamp: number; value: number }[],
    stats: StatisticalAnalysis,
    regressionAnalysis: any,
    anomalyResults: AnomalyDetectionResult[],
    threshold: RegressionThreshold
  ): Promise<RegressionAlert> {
    const severity = this.determineSeverity(regressionAnalysis.degradationPercent, threshold);
    const possibleCauses = this.identifyPossibleCauses(metric, regressionAnalysis, stats, anomalyResults);
    const recommendations = this.generateRecommendations(metric, severity, regressionAnalysis);
    const historicalContext = await this.getHistoricalContext(metric);

    const currentValue = data[data.length - 1].value;
    const baselineValue = data.slice(0, Math.floor(data.length * 0.6))
      .reduce((sum, d) => sum + d.value, 0) / Math.floor(data.length * 0.6);

    return {
      id: `regression_${metric}_${Date.now()}`,
      metric,
      severity,
      detectedAt: Date.now(),
      description: this.generateDescription(metric, regressionAnalysis.degradationPercent, severity),
      currentValue,
      baselineValue,
      degradationPercent: regressionAnalysis.degradationPercent,
      confidence: regressionAnalysis.confidence,
      affectedPeriod: {
        start: data[Math.floor(data.length * 0.6)].timestamp,
        end: data[data.length - 1].timestamp
      },
      possibleCauses,
      recommendations,
      historicalContext
    };
  }

  /**
   * Determine severity based on degradation percentage
   */
  private determineSeverity(degradationPercent: number, threshold: RegressionThreshold): 'critical' | 'major' | 'minor' | 'warning' {
    if (degradationPercent >= threshold.criticalThreshold) {return 'critical';}
    if (degradationPercent >= threshold.majorThreshold) {return 'major';}
    if (degradationPercent >= threshold.minorThreshold) {return 'minor';}
    return 'warning';
  }

  /**
   * Identify possible causes of regression
   */
  private identifyPossibleCauses(
    metric: string,
    regressionAnalysis: any,
    stats: StatisticalAnalysis,
    anomalyResults: AnomalyDetectionResult[]
  ): PossibleCause[] {
    const causes: PossibleCause[] = [];

    // Environmental causes
    if (anomalyResults.some(r => r.method === 'zscore' && r.anomalyScore > 3)) {
      causes.push({
        category: 'environmental',
        description: 'Significant environmental change or external factor',
        likelihood: 0.7,
        evidence: ['Statistical outliers detected', 'Sudden change in pattern']
      });
    }

    // Process causes
    if (regressionAnalysis.pattern === 'declining' && stats.trendSlope < -0.2) {
      causes.push({
        category: 'process',
        description: 'Gradual process degradation or workflow inefficiency',
        likelihood: 0.6,
        evidence: ['Consistent declining trend', 'Process-related metric affected']
      });
    }

    // Technical causes
    if (metric === 'complexity' && regressionAnalysis.degradationPercent > 20) {
      causes.push({
        category: 'technical',
        description: 'Technical debt accumulation or architectural issues',
        likelihood: 0.8,
        evidence: ['Code complexity increase', 'Maintainability concerns']
      });
    }

    if (metric === 'productivity' && stats.variance > stats.mean * 0.5) {
      causes.push({
        category: 'organizational',
        description: 'Team changes, training needs, or workload imbalance',
        likelihood: 0.5,
        evidence: ['High productivity variance', 'Inconsistent performance']
      });
    }

    // Seasonal causes
    if (stats.seasonality > 0.3) {
      causes.push({
        category: 'environmental',
        description: 'Seasonal pattern or cyclical factor',
        likelihood: 0.4,
        evidence: ['Seasonal correlation detected', 'Recurring pattern']
      });
    }

    return causes.sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * Generate recommendations based on regression analysis
   */
  private generateRecommendations(metric: string, severity: string, regressionAnalysis: any): string[] {
    const recommendations: string[] = [];

    // Severity-based recommendations
    if (severity === 'critical') {
      recommendations.push('Immediate investigation required - halt non-essential activities');
      recommendations.push('Conduct emergency team retrospective to identify root cause');
    } else if (severity === 'major') {
      recommendations.push('Schedule urgent investigation within 24 hours');
      recommendations.push('Review recent changes in process, tools, or team composition');
    }

    // Metric-specific recommendations
    switch (metric) {
      case 'productivity':
        recommendations.push('Analyze time allocation and identify productivity blockers');
        recommendations.push('Review development environment and tooling efficiency');
        if (regressionAnalysis.degradationPercent > 25) {
          recommendations.push('Consider workload rebalancing and stress management');
        }
        break;

      case 'codeQuality':
        recommendations.push('Implement immediate code review process improvements');
        recommendations.push('Schedule technical debt reduction sprint');
        recommendations.push('Enhance automated quality gates and testing');
        break;

      case 'velocity':
        recommendations.push('Identify and address development process bottlenecks');
        recommendations.push('Review task sizing and sprint planning effectiveness');
        recommendations.push('Analyze dependencies and external blockers');
        break;

      case 'complexity':
        recommendations.push('Prioritize refactoring of complex code modules');
        recommendations.push('Establish complexity limits and monitoring');
        recommendations.push('Provide training on clean code practices');
        break;
    }

    // Pattern-based recommendations
    if (regressionAnalysis.pattern === 'volatile') {
      recommendations.push('Investigate causes of performance inconsistency');
      recommendations.push('Implement process standardization measures');
    }

    return recommendations;
  }

  /**
   * Get historical context for the metric
   */
  private async getHistoricalContext(_metric: string): Promise<HistoricalContext> {
    // TODO: This would analyze historical regression data
    // For now, return simplified context
    return {
      previousRegressions: 0,
      recoveryTime: 7, // days
      seasonalFactors: [],
      trendContext: 'stable'
    };
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(metric: string, degradationPercent: number, severity: string): string {
    const metricNames: { [key: string]: string } = {
      productivity: 'Development Productivity',
      codeQuality: 'Code Quality',
      velocity: 'Development Velocity',
      complexity: 'Code Complexity'
    };

    const metricName = metricNames[metric] || metric;
    const direction = metric === 'complexity' ? 'increased' : 'decreased';

    return `${metricName} has ${direction} by ${degradationPercent.toFixed(1)}% - ${severity} regression detected`;
  }

  /**
   * Get regression summary for dashboard
   */
  public async getRegressionSummary(): Promise<{
    totalAlerts: number;
    criticalAlerts: number;
    majorAlerts: number;
    affectedMetrics: string[];
    overallHealth: 'good' | 'warning' | 'critical';
  }> {
    const alerts = await this.detectRegressions();

    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const majorAlerts = alerts.filter(a => a.severity === 'major').length;
    const affectedMetrics = [...new Set(alerts.map(a => a.metric))];

    let overallHealth: 'good' | 'warning' | 'critical' = 'good';
    if (criticalAlerts > 0) {overallHealth = 'critical';}
    else if (majorAlerts > 0 || alerts.length > 3) {overallHealth = 'warning';}

    return {
      totalAlerts: alerts.length,
      criticalAlerts,
      majorAlerts,
      affectedMetrics,
      overallHealth
    };
  }
}
