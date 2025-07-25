/**
 * @file AGGREGATOR.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Unified metrics aggregation system for code complexity analysis.
 * Provides comprehensive methods to calculate aggregate metrics, perform statistical analysis,
 * generate summaries, and produce reports from file metadata collections.
 */

// ------------ IMPORTS
import { FileMetadata } from './tracker';
import {
  CompleteReport,
  CodeHealthMetrics,
  PerformanceMetrics,
  SecurityMetrics,
  TeamMetrics,
  TrendAnalysis
} from './types';
import { MetricsStorage } from './storage';
import { ErrorHandler } from '../utils/error-handler';
import { TrendAnalyzer } from './analyzers/trend-analyzer';
import { TeamCollaborationAnalyzer } from './analyzers/team-analyzer';
import { PerformanceBenchmarkAnalyzer } from './analyzers/performance-analyzer';
import { CodeHealthAnalyzer } from './analyzers/code-health-analyzer';

// ------------ INTERFACES
// Summary of aggregated metrics across multiple files
export interface MetricsSummary {
  totalFiles: number;
  averageComplexity: number;
  languageBreakdown: Record<string, number>;
  totalLines: number;
}

// Aggregated metrics interface
interface AggregatedMetrics {
  averageComplexity: number;
  averageMaintainability: number;
  totalMetrics: number;
}

// ------------ CLASS
/**
 * Core metrics aggregation class providing statistical analysis methods
 * for code complexity metrics
 */
export class MetricsAggregator {
  private readonly storage: MetricsStorage;
  private readonly errorHandler: ErrorHandler;

  /**
   * Creates a new instance of the MetricsAggregator
   * 
   * @param storage - Storage provider for metrics data
   */
  constructor(storage: MetricsStorage) {
    this.storage = storage;
    this.errorHandler = ErrorHandler.getInstance();
  }

  public aggregate(metrics: Array<{ 
    cyclomaticComplexity?: number; 
    maintainabilityIndex?: number; 
  }>): AggregatedMetrics {
    if (metrics.length === 0) {
      return {
        averageComplexity: 0,
        averageMaintainability: 100,
        totalMetrics: 0
      };
    }

    const validComplexities = metrics
      .map(m => m.cyclomaticComplexity)
      .filter((x): x is number => typeof x === 'number');
    
    const validMaintainability = metrics
      .map(m => m.maintainabilityIndex)
      .filter((x): x is number => typeof x === 'number');

    return {
      averageComplexity: validComplexities.length > 0 
        ? validComplexities.reduce((a, b) => a + b, 0) / validComplexities.length 
        : 0,
      averageMaintainability: validMaintainability.length > 0
        ? validMaintainability.reduce((a, b) => a + b, 0) / validMaintainability.length
        : 100,
      totalMetrics: metrics.length
    };
  }

  /**
   * Calculates the average cyclomatic complexity across files, filtering outliers
   * using a statistical approach (mean ± 2 * standard deviation)
   * 
   * @param files - Array of file metadata containing complexity metrics
   * @returns The average complexity score with outliers removed, or 0 for empty arrays
   */
  public calculateAverageComplexity(files: FileMetadata[]): number {
    const complexities = files
      .filter(f => f && f.complexity && typeof f.complexity.cyclomaticComplexity === 'number')
      .map(f => f.complexity.cyclomaticComplexity);

    // Handle empty array case
    if (complexities.length === 0) {
      return 0;
    }

    // Calculate mean and standard deviation
    const mean = complexities.reduce((a, b) => a + b, 0) / complexities.length;
    const variance = complexities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / complexities.length;
    const stdDev = Math.sqrt(variance);

    // Filter values within 2 standard deviations from the mean
    const threshold = stdDev * 2;
    const filteredComplexities = complexities.filter(c => Math.abs(c - mean) <= threshold);

    // Return filtered mean or original mean if all values were filtered out
    return filteredComplexities.length > 0 ?
      filteredComplexities.reduce((a, b) => a + b, 0) / filteredComplexities.length :
      mean;
  }

  /**
   * Analyzes file distribution by programming language
   * 
   * @param files - Array of file metadata
   * @returns An object mapping language names to file counts
   */
  public getLanguageBreakdown(files: FileMetadata[]): Record<string, number> {
    // Use reduce for better performance than forEach with object mutation
    return files.reduce<Record<string, number>>((breakdown, file) => {
      breakdown[file.language] = (breakdown[file.language] || 0) + 1;
      return breakdown;
    }, {});
  }

  /**
   * Generates a comprehensive summary of code metrics across all files
   * 
   * @param files - Array of file metadata
   * @returns A summary object containing aggregated metrics
   */
  public generateMetricsSummary(files: FileMetadata[]): MetricsSummary {
    return {
      totalFiles: files.length,
      averageComplexity: this.calculateAverageComplexity(files),
      languageBreakdown: this.getLanguageBreakdown(files),
      totalLines: files.reduce((sum, file) => sum + file.lines, 0)
    };
  }

  /**
   * Generates a complete analysis report with all available metrics
   * 
   * @returns Promise resolving to a complete metrics report
   * @throws Error if report generation fails
   */
  public async generateFullReport(): Promise<CompleteReport> {
    try {
      // Run analyses in parallel for better performance
      const [
        codeQuality,
        performance,
        security,
        teamMetrics,
        trends
      ] = await Promise.all([
        this.analyzeCodeQuality(),
        this.analyzePerformance(),
        this.analyzeSecurity(),
        this.analyzeTeamMetrics(),
        this.analyzeTrends()
      ]);
      
      // Generate recommendations based on the collected data
      const recommendations = await this.generateRecommendations();
      
      return {
        codeQuality,
        performance,
        security,
        teamMetrics,
        trends,
        recommendations
      };
    } catch (error) {
      this.errorHandler.logComplexityError({
        context: 'generateFullReport',
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'metrics-aggregator.ts',
        language: 'typescript',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Analyzes code quality metrics including duplication, test coverage and documentation
   *
   * @returns Promise resolving to code health metrics
   * @private
   */
  private async analyzeCodeQuality(): Promise<CodeHealthMetrics> {
    try {
      const codeHealthAnalyzer = new CodeHealthAnalyzer();
      const historicalData = await this.storage.loadMetrics();

      // Analyze code duplication
      const duplicationType = await codeHealthAnalyzer.analyzeDuplication(historicalData);

      // Analyze test coverage
      const testCoverage = await codeHealthAnalyzer.analyzeTestCoverage(historicalData);

      // Analyze documentation coverage
      const documentation = await codeHealthAnalyzer.analyzeDocumentation(historicalData);

      // Calculate technical debt
      const technicalDebt = await codeHealthAnalyzer.calculateTechnicalDebt(historicalData);

      // Calculate maintainability index
      const maintainabilityIndex = await codeHealthAnalyzer.calculateMaintainabilityIndex(historicalData);

      return {
        duplicationType,
        testCoverage,
        documentation,
        technicalDebt,
        maintainabilityIndex
      };
    } catch (error) {
      this.errorHandler.logComplexityError({
        context: 'analyzeCodeQuality',
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'aggregator.ts',
        language: 'typescript',
        timestamp: Date.now()
      });

      // Return default values on error
      return {
        duplicationType: {
          percentage: 0,
          locations: [],
          severity: 'low'
        },
        testCoverage: {
          percentage: 0,
          uncoveredPaths: [],
          criticalPaths: []
        },
        documentation: {
          coverage: 0,
          quality: 0,
          missingDocs: []
        }
      };
    }
  }

  /**
   * Analyzes performance metrics including hotspots and memory usage
   *
   * @returns Promise resolving to performance metrics
   * @private
   */
  private async analyzePerformance(): Promise<PerformanceMetrics> {
    try {
      const performanceAnalyzer = new PerformanceBenchmarkAnalyzer();
      const historicalData = await this.storage.loadMetrics();

      // Analyze execution hotspots
      const executionHotspots = await performanceAnalyzer.analyzeExecutionHotspots(historicalData);

      // Analyze memory profile
      const memoryProfile = await performanceAnalyzer.analyzeMemoryProfile(historicalData);

      // Analyze async operations
      const asyncOperations = await performanceAnalyzer.analyzeAsyncOperations(historicalData);

      // Analyze performance regression
      const regressionAnalysis = await performanceAnalyzer.analyzePerformanceRegression(historicalData);

      // Analyze performance benchmarks
      const benchmarkComparison = await performanceAnalyzer.analyzePerformanceBenchmarks(historicalData);

      return {
        executionHotspots,
        memoryProfile,
        asyncOperations,
        regressionAnalysis,
        benchmarkComparison
      };
    } catch (error) {
      this.errorHandler.logComplexityError({
        context: 'analyzePerformance',
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'aggregator.ts',
        language: 'typescript',
        timestamp: Date.now()
      });

      // Return default values on error
      return {
        executionHotspots: [],
        memoryProfile: {
          allocation: 0,
          leaks: [],
          garbageCollection: 0
        },
        asyncOperations: {
          pending: 0,
          avgResolutionTime: 0
        }
      };
    }
  }

  /**
   * Analyzes security metrics including vulnerabilities and security scoring
   * 
   * @returns Promise resolving to security metrics
   * @private
   */
  private async analyzeSecurity(): Promise<SecurityMetrics> {
    return {
      vulnerabilities: [],
      securityScore: 0,
      sanitizationCoverage: 0
    };
  }

  /**
   * Analyzes team-related metrics including contributions and ownership
   *
   * @returns Promise resolving to team metrics
   * @private
   */
  private async analyzeTeamMetrics(): Promise<TeamMetrics> {
    try {
      const teamAnalyzer = new TeamCollaborationAnalyzer();
      const historicalData = await this.storage.loadMetrics();

      // Analyze code ownership patterns
      const codeOwnership = await teamAnalyzer.analyzeCodeOwnership(historicalData);

      // Calculate collaboration score
      const collaborationScore = await teamAnalyzer.calculateCollaborationScore(historicalData);

      // Analyze knowledge distribution
      const knowledgeDistribution = await teamAnalyzer.analyzeKnowledgeDistribution(historicalData);

      // Count unique contributors
      const contributorCount = await teamAnalyzer.countContributors(historicalData);

      // Analyze communication patterns
      const communicationPatterns = await teamAnalyzer.analyzeCommunicationPatterns(historicalData);

      // Analyze team productivity patterns
      const productivityPatterns = await teamAnalyzer.analyzeTeamProductivityPatterns(historicalData);

      return {
        contributorCount,
        codeOwnership,
        collaborationScore,
        knowledgeDistribution,
        communicationPatterns,
        productivityPatterns
      };
    } catch (error) {
      this.errorHandler.logComplexityError({
        context: 'analyzeTeamMetrics',
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'aggregator.ts',
        language: 'typescript',
        timestamp: Date.now()
      });

      // Return default values on error
      return {
        contributorCount: 0,
        codeOwnership: new Map(),
        collaborationScore: 0,
        knowledgeDistribution: 0
      };
    }
  }

  /**
   * Analyzes trends in development metrics over time
   *
   * @returns Promise resolving to trend analysis
   * @private
   */
  private async analyzeTrends(): Promise<TrendAnalysis> {
    try {
      const historicalData = await this.storage.loadMetrics();
      const trendAnalyzer = new TrendAnalyzer();

      // Analyze seasonal patterns
      const seasonalPatterns = await trendAnalyzer.analyzeSeasonalPatterns(historicalData);

      // Generate velocity predictions
      const velocityPrediction = await trendAnalyzer.predictVelocity(historicalData);

      // Analyze productivity regression
      const productivityRegression = await trendAnalyzer.analyzeProductivityRegression(historicalData);

      // Analyze advanced velocity trends
      const advancedVelocityTrends = await trendAnalyzer.analyzeAdvancedVelocityTrends(historicalData);

      return {
        seasonalPatterns,
        velocityPrediction,
        productivityRegression,
        advancedVelocityTrends
      };
    } catch (error) {
      this.errorHandler.logComplexityError({
        context: 'analyzeTrends',
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'aggregator.ts',
        language: 'typescript',
        timestamp: Date.now()
      });

      // Return default values on error
      return {
        seasonalPatterns: {
          dailyPeaks: [],
          weeklyPatterns: {},
          monthlyTrends: []
        },
        velocityPrediction: {
          nextWeek: 0,
          nextMonth: 0,
          confidence: 0
        }
      };
    }
  }

  /**
   * Generates actionable recommendations based on all analyzed metrics
   * 
   * @returns Promise resolving to array of recommendation strings
   * @private
   */
  private async generateRecommendations(): Promise<string[]> {
    return [];
  }
}