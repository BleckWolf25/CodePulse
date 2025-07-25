/**
 * @file TREND-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Advanced Trend Analysis for Development Metrics
 * Provides sophisticated trend analysis including seasonal patterns,
 * velocity prediction, and productivity forecasting.
 */

// ------------ IMPORTS
import { StoredMetrics, DailyMetrics, SessionData } from '../storage';
import { TrendAnalysis, TrendPoint, TimeRange } from '../types';
import { ErrorHandler } from '../../utils/error-handler';

// ------------ CLASS
export class TrendAnalyzer {
  private errorHandler = ErrorHandler.getInstance();
  
  /**
   * Analyze seasonal patterns in development activity
   */
  public async analyzeSeasonalPatterns(data: StoredMetrics): Promise<TrendAnalysis['seasonalPatterns']> {
    try {
      const dailyPeaks = await this.analyzeDailyPeaks(data.sessions);
      const weeklyPatterns = await this.analyzeWeeklyPatterns(data.dailyMetrics);
      const monthlyTrends = await this.analyzeMonthlyTrends(data.dailyMetrics);
      
      return {
        dailyPeaks,
        weeklyPatterns,
        monthlyTrends
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        dailyPeaks: [],
        weeklyPatterns: {},
        monthlyTrends: []
      };
    }
  }

  /**
   * Predict future velocity based on historical data
   */
  public async predictVelocity(data: StoredMetrics): Promise<TrendAnalysis['velocityPrediction']> {
    try {
      const recentMetrics = this.getRecentMetrics(data.dailyMetrics, 30); // Last 30 days
      
      if (recentMetrics.length < 7) {
        return { nextWeek: 0, nextMonth: 0, confidence: 0 };
      }

      const velocityTrend = this.calculateVelocityTrend(recentMetrics);
      const seasonalAdjustment = this.calculateSeasonalAdjustment(recentMetrics);
      
      const nextWeek = this.predictWeeklyVelocity(velocityTrend, seasonalAdjustment);
      const nextMonth = this.predictMonthlyVelocity(velocityTrend, seasonalAdjustment);
      const confidence = this.calculatePredictionConfidence(recentMetrics);
      
      return {
        nextWeek,
        nextMonth,
        confidence
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return { nextWeek: 0, nextMonth: 0, confidence: 0 };
    }
  }

  /**
   * Analyze daily activity peaks
   */
  private async analyzeDailyPeaks(sessions: SessionData[]): Promise<TimeRange[]> {
    const hourlyActivity = new Map<number, number>();
    
    // Aggregate activity by hour
    sessions.forEach(session => {
      const startHour = new Date(session.startTime).getHours();
      const duration = session.activeTime || 0;
      hourlyActivity.set(startHour, (hourlyActivity.get(startHour) || 0) + duration);
    });

    // Find peak hours (top 20% of activity)
    const sortedHours = Array.from(hourlyActivity.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const peakCount = Math.max(1, Math.floor(sortedHours.length * 0.2));
    const peaks: TimeRange[] = [];
    
    for (let i = 0; i < peakCount && i < sortedHours.length; i++) {
      const [hour, _magnitude] = sortedHours[i];
      peaks.push({
        start: new Date(2024, 0, 1, hour, 0).getTime(),
        end: new Date(2024, 0, 1, hour + 1, 0).getTime(),
        granularity: 'hour'
      });
    }
    
    return peaks;
  }

  /**
   * Analyze weekly activity patterns
   */
  private async analyzeWeeklyPatterns(dailyMetrics: DailyMetrics[]): Promise<Record<string, number>> {
    type WeekdayActivity = {
      [K in 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday']: number;
    };

    const weeklyActivity: WeekdayActivity = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    };

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
    
    dailyMetrics.forEach(metric => {
      const date = new Date(metric.date);
      const dayOfWeek = weekdayNames[date.getDay()];
      weeklyActivity[dayOfWeek] += metric.totalCodingTime;
    });

    // Normalize by number of occurrences
    const weekCounts: WeekdayActivity = { ...weeklyActivity };
    Object.keys(weekCounts).forEach(day => {
      weekCounts[day as keyof WeekdayActivity] = 0;
    });
    
    dailyMetrics.forEach(metric => {
      const date = new Date(metric.date);
      const dayOfWeek = weekdayNames[date.getDay()];
      weekCounts[dayOfWeek]++;
    });

    (Object.keys(weeklyActivity) as Array<keyof WeekdayActivity>).forEach(day => {
      if (weekCounts[day] > 0) {
        weeklyActivity[day] /= weekCounts[day];
      }
    });

    return weeklyActivity;
  }

  /**
   * Analyze monthly trends
   */
  private async analyzeMonthlyTrends(dailyMetrics: DailyMetrics[]): Promise<TrendPoint[]> {
    const monthlyData = new Map<string, { totalTime: number, count: number }>();
    
    dailyMetrics.forEach(metric => {
      const date = new Date(metric.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      const existing = monthlyData.get(monthKey) || { totalTime: 0, count: 0 };
      existing.totalTime += metric.totalCodingTime;
      existing.count++;
      monthlyData.set(monthKey, existing);
    });

    const trends: TrendPoint[] = [];
    monthlyData.forEach((data, monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      trends.push({
        timestamp: new Date(year, month - 1, 1).getTime(),
        value: data.totalTime / data.count, // Average daily time for the month
        metadata: {
          totalDays: data.count,
          totalTime: data.totalTime
        }
      });
    });

    return trends.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get recent metrics within specified days
   */
  private getRecentMetrics(dailyMetrics: DailyMetrics[], days: number): DailyMetrics[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return dailyMetrics.filter(metric => 
      new Date(metric.date) >= cutoffDate
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Calculate velocity trend from recent metrics
   */
  private calculateVelocityTrend(metrics: DailyMetrics[]): number {
    if (metrics.length < 2) {return 0;}
    
    const velocities = metrics.map((metric, index) => {
      if (index === 0) {return 0;}
      return metric.totalCodingTime - metrics[index - 1].totalCodingTime;
    }).slice(1);
    
    return velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
  }

  /**
   * Calculate seasonal adjustment factor
   */
  private calculateSeasonalAdjustment(_metrics: DailyMetrics[]): number {
    const currentDayOfWeek = new Date().getDay();
    const currentHour = new Date().getHours();
    
    // Simple seasonal adjustment based on day of week and time
    let adjustment = 1.0;
    
    // Weekend adjustment
    if (currentDayOfWeek === 0 || currentDayOfWeek === 6) {
      adjustment *= 0.7; // Lower activity on weekends
    }
    
    // Time of day adjustment
    if (currentHour < 9 || currentHour > 18) {
      adjustment *= 0.8; // Lower activity outside work hours
    }
    
    return adjustment;
  }

  /**
   * Predict weekly velocity
   */
  private predictWeeklyVelocity(trend: number, seasonalAdjustment: number): number {
    return Math.max(0, (trend * 7) * seasonalAdjustment);
  }

  /**
   * Predict monthly velocity
   */
  private predictMonthlyVelocity(trend: number, seasonalAdjustment: number): number {
    return Math.max(0, (trend * 30) * seasonalAdjustment);
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(metrics: DailyMetrics[]): number {
    if (metrics.length < 7) {return 0;}

    // Calculate variance in daily coding time
    const times = metrics.map(m => m.totalCodingTime);
    const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher confidence
    const varianceConfidence = Math.max(0, 1 - (stdDev / mean));

    // More data = higher confidence
    const dataConfidence = Math.min(1, metrics.length / 30);

    return (varianceConfidence + dataConfidence) / 2;
  }

  /**
   * Analyze productivity regression patterns
   */
  public async analyzeProductivityRegression(data: StoredMetrics): Promise<{
    hasRegression: boolean;
    severity: 'low' | 'medium' | 'high';
    affectedPeriods: TrendPoint[];
    recoveryPrediction: number;
  }> {
    try {
      const recentMetrics = this.getRecentMetrics(data.dailyMetrics, 60); // Last 60 days

      if (recentMetrics.length < 14) {
        return { hasRegression: false, severity: 'low', affectedPeriods: [], recoveryPrediction: 0 };
      }

      // Split into two periods for comparison
      const midPoint = Math.floor(recentMetrics.length / 2);
      const earlierPeriod = recentMetrics.slice(0, midPoint);
      const laterPeriod = recentMetrics.slice(midPoint);

      const earlierAvg = earlierPeriod.reduce((sum, m) => sum + m.totalCodingTime, 0) / earlierPeriod.length;
      const laterAvg = laterPeriod.reduce((sum, m) => sum + m.totalCodingTime, 0) / laterPeriod.length;

      const regressionPercentage = ((earlierAvg - laterAvg) / earlierAvg) * 100;
      const hasRegression = regressionPercentage > 10; // 10% drop threshold

      let severity: 'low' | 'medium' | 'high' = 'low';
      if (regressionPercentage > 30) {severity = 'high';}
      else if (regressionPercentage > 20) {severity = 'medium';}

      // Find affected periods
      const affectedPeriods: TrendPoint[] = [];
      if (hasRegression) {
        laterPeriod.forEach(metric => {
          if (metric.totalCodingTime < earlierAvg * 0.8) { // 20% below earlier average
            affectedPeriods.push({
              timestamp: new Date(metric.date).getTime(),
              value: metric.totalCodingTime,
              metadata: { regressionSeverity: severity }
            });
          }
        });
      }

      // Predict recovery time (simplified)
      const recoveryPrediction = hasRegression ? Math.max(7, regressionPercentage / 5) : 0; // Days

      return {
        hasRegression,
        severity,
        affectedPeriods,
        recoveryPrediction
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return { hasRegression: false, severity: 'low', affectedPeriods: [], recoveryPrediction: 0 };
    }
  }

  /**
   * Analyze development velocity trends with advanced forecasting
   */
  public async analyzeAdvancedVelocityTrends(data: StoredMetrics): Promise<{
    currentVelocity: number;
    velocityTrend: 'increasing' | 'decreasing' | 'stable';
    forecastAccuracy: number;
    seasonalFactors: Record<string, number>;
  }> {
    try {
      const recentMetrics = this.getRecentMetrics(data.dailyMetrics, 90); // Last 90 days

      if (recentMetrics.length < 30) {
        return {
          currentVelocity: 0,
          velocityTrend: 'stable',
          forecastAccuracy: 0,
          seasonalFactors: {}
        };
      }

      // Calculate current velocity (last 7 days average)
      const lastWeek = recentMetrics.slice(-7);
      const currentVelocity = lastWeek.reduce((sum, m) => sum + m.totalCodingTime, 0) / lastWeek.length;

      // Calculate velocity trend using linear regression
      const velocityTrend = this.calculateVelocityTrendDirection(recentMetrics);

      // Calculate forecast accuracy by comparing predictions with actual data
      const forecastAccuracy = this.calculateForecastAccuracy(recentMetrics);

      // Calculate seasonal factors
      const seasonalFactors = this.calculateSeasonalFactors(recentMetrics);

      return {
        currentVelocity,
        velocityTrend,
        forecastAccuracy,
        seasonalFactors
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        currentVelocity: 0,
        velocityTrend: 'stable',
        forecastAccuracy: 0,
        seasonalFactors: {}
      };
    }
  }

  /**
   * Calculate velocity trend direction using linear regression
   */
  private calculateVelocityTrendDirection(metrics: DailyMetrics[]): 'increasing' | 'decreasing' | 'stable' {
    if (metrics.length < 10) {return 'stable';}

    const n = metrics.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = metrics.map(m => m.totalCodingTime);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (slope > 0.1) {return 'increasing';}
    if (slope < -0.1) {return 'decreasing';}
    return 'stable';
  }

  /**
   * Calculate forecast accuracy
   */
  private calculateForecastAccuracy(metrics: DailyMetrics[]): number {
    if (metrics.length < 20) {return 0;}

    // Use first 80% of data to predict last 20%
    const splitPoint = Math.floor(metrics.length * 0.8);
    const trainingData = metrics.slice(0, splitPoint);
    const testData = metrics.slice(splitPoint);

    const predictions = this.generateSimplePredictions(trainingData, testData.length);
    const actual = testData.map(m => m.totalCodingTime);

    // Calculate Mean Absolute Percentage Error (MAPE)
    let totalError = 0;
    for (let i = 0; i < predictions.length && i < actual.length; i++) {
      if (actual[i] > 0) {
        totalError += Math.abs((actual[i] - predictions[i]) / actual[i]);
      }
    }

    const mape = totalError / Math.min(predictions.length, actual.length);
    return Math.max(0, 1 - mape); // Convert to accuracy (0-1)
  }

  /**
   * Generate simple predictions for accuracy testing
   */
  private generateSimplePredictions(trainingData: DailyMetrics[], predictionLength: number): number[] {
    const recentAvg = trainingData.slice(-7).reduce((sum, m) => sum + m.totalCodingTime, 0) / 7;
    return Array(predictionLength).fill(recentAvg);
  }

  /**
   * Calculate seasonal factors
   */
  private calculateSeasonalFactors(metrics: DailyMetrics[]): Record<string, number> {
    const factors: Record<string, number> = {};
    const dayOfWeekData: Record<number, number[]> = {};

    // Group by day of week
    metrics.forEach(metric => {
      const dayOfWeek = new Date(metric.date).getDay();
      if (!dayOfWeekData[dayOfWeek]) {
        dayOfWeekData[dayOfWeek] = [];
      }
      dayOfWeekData[dayOfWeek].push(metric.totalCodingTime);
    });

    // Calculate average for each day
    const overallAvg = metrics.reduce((sum, m) => sum + m.totalCodingTime, 0) / metrics.length;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    Object.entries(dayOfWeekData).forEach(([day, times]) => {
      const dayAvg = times.reduce((sum, t) => sum + t, 0) / times.length;
      const factor = overallAvg > 0 ? dayAvg / overallAvg : 1;
      factors[dayNames[parseInt(day)]] = factor;
    });

    return factors;
  }
}
