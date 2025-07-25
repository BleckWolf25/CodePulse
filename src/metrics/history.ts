/**
 * @file HISTORY.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Historical Analyzer for Code Pulse
 * Provides comprehensive historical data analysis including trend analysis, regression detection,
 * performance benchmarking, and predictive analytics for code complexity metrics.
 */

// ------------ IMPORTS
import { NormalizedMetrics } from './normalizer';
import { IndexedDB } from '../utils/indexed-db';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES
/**
 * Represents a single data point in the historical trend analysis
 */
interface TrendPoint {
    timestamp: number;
    metrics: NormalizedMetrics;
    velocity: number;
}

// ------------ CLASS
/**
 * Handles historical analysis of code complexity metrics with trend detection and prediction
 */
export class HistoricalAnalyzer {
    /**
     * Threshold for detecting performance regressions (20% increase)
     */
    private readonly REGRESSION_THRESHOLD = 1.2;

    /**
     * Time window for velocity calculations (7 days)
     */
    private readonly VELOCITY_WINDOW = 7;

    /**
     * Minimum number of samples required for analysis
     */
    private readonly MIN_SAMPLES = 3;

    /**
     * Data retention periods for different analysis timeframes
     */
    private readonly RETENTION_PERIODS = {
        SHORT_TERM: 30, // 30 days
        MEDIUM_TERM: 90, // 90 days
        LONG_TERM: 365 // 1 year
    };

    /**
     * Maximum number of data points to retain
     */
    private readonly MAX_DATAPOINTS = 10000;

    /**
     * IndexedDB instance for persistent storage
     */
    private db: IndexedDB;

    /**
     * Error handler instance for logging and error management
     */
    private errorHandler = ErrorHandler.getInstance();

    /**
     * Creates a new HistoricalAnalyzer instance with IndexedDB storage
     */
    constructor() {
        this.db = new IndexedDB('metrics-history', 1);
        this.initializeStorage();
    }

    /**
     * Initializes the IndexedDB storage with required object stores and indices
     * @private
     */
    private async initializeStorage(): Promise<void> {
        try {
            await this.db.createStore('trends', { keyPath: 'timestamp' });
            await this.db.createIndex('trends', 'complexity', 'complexity');
            await this.db.createIndex('trends', 'date', 'date');
        } catch (error) {
            this.errorHandler.handleWorkerError(error as Error, 'initializeStorage');
        }
    }

    /**
     * Analyzes historical trend data to detect patterns, regressions, and predict future values
     * @param history Array of historical trend points
     * @returns Comprehensive trend analysis including velocity, regressions, peaks, and predictions
     */
    public async analyzeTrend(history: TrendPoint[]): Promise<{
        velocity: number;
        regressions: TrendPoint[];
        peaks: TrendPoint[];
        trend: 'improving' | 'stable' | 'degrading';
        prediction?: {
            nextValue: number;
            confidence: number;
            range: [number, number];
        };
    }> {
        try {
            if (history.length < this.MIN_SAMPLES) {
                return { velocity: 0, regressions: [], peaks: [], trend: 'stable' };
            }

            // Store historical data
            await this.storeHistoricalData(history);

            // Calculate core metrics
            const velocity = this.calculateVelocity(history);
            const regressions = this.detectRegressions(history);
            const peaks = this.detectPeaks(history);
            const trend = this.determineTrend(velocity, regressions);

            // Generate prediction if enough data
            const prediction = history.length >= 10 ? 
                await this.predictNextValue(history) : undefined;

            return { velocity, regressions, peaks, trend, prediction };
        } catch (error) {
            this.errorHandler.logComplexityError({
                context: 'trend-analysis',
                error: error instanceof Error ? error.message : 'Unknown error',
                file: 'history.ts',
                language: 'typescript',
                timestamp: Date.now()
            });
            throw error;
        }
    }

    /**
     * Stores historical data points in IndexedDB with automatic retention policy enforcement
     * @param points Array of trend points to store
     * @private
     */
    private async storeHistoricalData(points: TrendPoint[]): Promise<void> {
        const transaction = this.db.transaction('trends', 'readwrite');
        const store = transaction.objectStore('trends');

        for (const point of points) {
            store.put({
                ...point,
                date: new Date(point.timestamp).toISOString().split('T')[0]
            });
        }

        // Apply retention policy
        await this.enforceRetentionPolicy();
    }

    /**
     * Enforces data retention policy by removing old data and thinning out medium-term data
     * @private
     */
    private async enforceRetentionPolicy(): Promise<void> {
        const transaction = this.db.transaction('trends', 'readwrite');
        const store = transaction.objectStore('trends');
        const index = store.index('date');

        // Delete data older than retention period
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_PERIODS.LONG_TERM);

        const oldRecords = await wrapRequest<IDBValidKey[]>(
            index.getAllKeys(IDBKeyRange.upperBound(cutoffDate.toISOString()))
        );
        
        for (const key of oldRecords) {
            await wrapRequest(store.delete(key));
        }

        // Thin out medium-term data
        const mediumTermDate = new Date();
        mediumTermDate.setDate(mediumTermDate.getDate() - this.RETENTION_PERIODS.MEDIUM_TERM);
        await this.thinOutData(mediumTermDate, 2); // Keep every 2nd point

        // Thin out short-term data if too many points
        const totalPoints = await wrapRequest<number>(index.count());
        if (totalPoints > this.MAX_DATAPOINTS) {
            const shortTermDate = new Date();
            shortTermDate.setDate(shortTermDate.getDate() - this.RETENTION_PERIODS.SHORT_TERM);
            await this.thinOutData(shortTermDate, 4); // Keep every 4th point
        }
    }

    /**
     * Thins out historical data by keeping only every nth data point
     * @param startDate Starting date for data thinning
     * @param factor Factor for data thinning (keep every nth point)
     * @private
     */
    private async thinOutData(startDate: Date, factor: number): Promise<void> {
        const transaction = this.db.transaction('trends', 'readwrite');
        const store = transaction.objectStore('trends');
        const index = store.index('date');

        const points = await wrapRequest<IDBValidKey[]>(
            index.getAllKeys(IDBKeyRange.upperBound(startDate.toISOString()))
        );
        
        for (let i = 0; i < points.length; i++) {
            if (i % factor !== 0) {
                await wrapRequest(store.delete(points[i]));
            }
        }
    }

    /**
     * Predicts the next value in the trend using linear regression and confidence intervals
     * @param history Array of historical trend points
     * @returns Prediction with confidence interval and range
     * @private
     */
    private async predictNextValue(history: TrendPoint[]): Promise<{
        nextValue: number;
        confidence: number;
        range: [number, number];
    }> {
        // Get recent points for better prediction
        const recentPoints = history.slice(-30);
        
        // Calculate trend line using linear regression
        const trend = this.calculateTrendLine(recentPoints);
        
        // Calculate standard deviation for confidence interval
        const stdDev = this.calculateStandardDeviation(recentPoints.map(p => p.metrics.normalizedScore));
        
        // Predict next value
        const nextTimestamp = history[history.length - 1].timestamp + 
            (history[history.length - 1].timestamp - history[history.length - 2].timestamp);
        
        const predictedValue = trend.slope * nextTimestamp + trend.intercept;
        const confidence = this.calculatePredictionConfidence(history);
        
        // Calculate prediction range
        const range: [number, number] = [
            predictedValue - (stdDev * 2),
            predictedValue + (stdDev * 2)
        ];

        return {
            nextValue: predictedValue,
            confidence,
            range
        };
    }

    /**
     * Calculates linear regression trend line from historical data points
     * @param points Array of trend points for regression analysis
     * @returns Slope and intercept values for the trend line
     * @private
     */
    private calculateTrendLine(points: TrendPoint[]): { slope: number; intercept: number } {
        const n = points.length;
        const timestamps = points.map(p => p.timestamp);
        const values = points.map(p => p.metrics.normalizedScore);
        
        const sumX = timestamps.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
        const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return { slope, intercept };
    }

    /**
     * Calculates standard deviation for a set of values
     * @param values Array of numerical values
     * @returns Standard deviation value
     * @private
     */
    private calculateStandardDeviation(values: number[]): number {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Calculates confidence level for predictions based on data quality factors
     * @param history Array of historical trend points
     * @returns Confidence value between 0 and 1
     * @private
     */
    private calculatePredictionConfidence(history: TrendPoint[]): number {
        // Base confidence on data quality
        let confidence = 1.0;
        
        // Reduce confidence for gaps in data
        const gaps = this.detectDataGaps(history);
        confidence *= (1 - (gaps.length * 0.1));
        
        // Reduce confidence for high volatility
        const volatility = this.calculateVolatility(history);
        confidence *= (1 - (volatility * 0.2));
        
        // Reduce confidence for old data
        const dataAge = (Date.now() - history[history.length - 1].timestamp) / (24 * 60 * 60 * 1000);
        confidence *= Math.max(0, 1 - (dataAge / 30)); // Reduce confidence for data older than 30 days
        
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Detects gaps in historical data that might affect prediction accuracy
     * @param history Array of historical trend points
     * @returns Array of detected gaps with start and end timestamps
     * @private
     */
    private detectDataGaps(history: TrendPoint[]): Array<{ start: number; end: number }> {
        const gaps = [];
        const maxGap = 24 * 60 * 60 * 1000; // 1 day in milliseconds
        
        for (let i = 1; i < history.length; i++) {
            const gap = history[i].timestamp - history[i - 1].timestamp;
            if (gap > maxGap) {
                gaps.push({
                    start: history[i - 1].timestamp,
                    end: history[i].timestamp
                });
            }
        }
        
        return gaps;
    }

    /**
     * Calculates volatility of the historical data as a measure of stability
     * @param history Array of historical trend points
     * @returns Volatility value representing data stability
     * @private
     */
    private calculateVolatility(history: TrendPoint[]): number {
        const changes = history.map((point, i) => {
            if (i === 0) {return 0;}
            return Math.abs(point.metrics.normalizedScore - history[i - 1].metrics.normalizedScore) / history[i - 1].metrics.normalizedScore;
        }).slice(1);
        
        return changes.reduce((sum, change) => sum + change, 0) / changes.length;
    }

    /**
     * Calculates velocity of change over the specified time window
     * @param history Array of historical trend points
     * @returns Average velocity of change
     * @private
     */
    private calculateVelocity(history: TrendPoint[]): number {
        const recentPoints = history.slice(-this.VELOCITY_WINDOW);
        if (recentPoints.length < 2) {return 0;}

        const changes = recentPoints.map((point, i) => {
            if (i === 0) {return 0;}
            return point.metrics.normalizedScore - recentPoints[i - 1].metrics.normalizedScore;
        }).slice(1);

        return changes.reduce((sum, change) => sum + change, 0) / changes.length;
    }

    /**
     * Detects performance regressions based on threshold criteria
     * @param history Array of historical trend points
     * @returns Array of trend points that represent regressions
     * @private
     */
    private detectRegressions(history: TrendPoint[]): TrendPoint[] {
        return history.filter((point, i) => {
            if (i === 0) {return false;}
            const prevScore = history[i - 1].metrics.normalizedScore;
            const currentScore = point.metrics.normalizedScore;
            return currentScore > prevScore * this.REGRESSION_THRESHOLD;
        });
    }

    /**
     * Detects peak values in the historical data
     * @param history Array of historical trend points
     * @returns Array of trend points that represent peaks
     * @private
     */
    private detectPeaks(history: TrendPoint[]): TrendPoint[] {
        return history.filter((point, i) => {
            if (i === 0 || i === history.length - 1) {return false;}
            const prev = history[i - 1].metrics.normalizedScore;
            const current = point.metrics.normalizedScore;
            const next = history[i + 1].metrics.normalizedScore;
            return current > prev && current > next;
        });
    }

    /**
     * Determines overall trend direction based on velocity and regression analysis
     * @param velocity Average velocity of change
     * @param regressions Array of detected regression points
     * @returns Trend classification ('improving', 'stable', or 'degrading')
     * @private
     */
    private determineTrend(velocity: number, regressions: TrendPoint[]): 'improving' | 'stable' | 'degrading' {
        if (velocity < -0.5 || regressions.length === 0) {return 'improving';}
        if (velocity > 0.5 || regressions.length > 2) {return 'degrading';}
        return 'stable';
    }
}

// ------------ UTILITY FUNCTIONS
/**
 * Wraps an IndexedDB request in a Promise for async/await compatibility
 * @param request IndexedDB request to wrap
 * @returns Promise that resolves with the request result
 */
function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

