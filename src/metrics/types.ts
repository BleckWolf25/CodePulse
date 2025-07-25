/**
 * @file TYPES.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Type Definitions for Code Pulse
 * Comprehensive type definitions for metrics, analytics, and reporting including team metrics,
 * performance analysis, security metrics, and advanced trend analysis capabilities.
 */

// ------------ INTERFACES

/**
 * Represents a location within a source code file
 */
export interface Location {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

/**
 * Represents a time range for temporal analysis
 */
export interface TimeRange {
  start: number;
  end: number;
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

/**
 * Legacy time range interface with Date objects (deprecated)
 */
export interface DateTimeRange {
  start: Date;
  end: Date;
  magnitude: number;
}

/**
 * Represents a single data point in trend analysis
 */
export interface TrendPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Team collaboration and productivity metrics
 */
export interface TeamMetrics {
  contributorCount: number;
  codeOwnership: Map<string, string[]>;
  collaborationScore: number;
  knowledgeDistribution: number;
  communicationPatterns?: {
    communicationScore: number;
    collaborationFrequency: number;
    knowledgeSharingIndex: number;
    teamCohesion: number;
    communicationTrends: {
      increasing: boolean;
      stable: boolean;
      decreasing: boolean;
    };
  };
  productivityPatterns?: {
    productivityScore: number;
    teamVelocity: number;
    workloadDistribution: number;
    burnoutRisk: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
}

/**
 * Metrics for analyzing the impact of code changes
 */
export interface ChangeImpactMetrics {
  affectedModules: string[];
  dependencyChain: string[];
  riskScore: number;
  estimatedTestingEffort: number;
}

/**
 * Advanced trend analysis with seasonal patterns and velocity prediction
 */
export interface TrendAnalysis {
  seasonalPatterns: {
    dailyPeaks: TimeRange[];
    weeklyPatterns: Record<string, number>;
    monthlyTrends: TrendPoint[];
  };
  velocityPrediction: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
  productivityRegression?: {
    hasRegression: boolean;
    severity: 'low' | 'medium' | 'high';
    affectedPeriods: TrendPoint[];
    recoveryPrediction: number;
  };
  advancedVelocityTrends?: {
    currentVelocity: number;
    velocityTrend: 'increasing' | 'decreasing' | 'stable';
    forecastAccuracy: number;
    seasonalFactors: Record<string, number>;
  };
}

/**
 * Comprehensive code health metrics including duplication, coverage, and technical debt
 */
export interface CodeHealthMetrics {
  duplicationType: {
    percentage: number;
    locations: Location[];
    severity: 'low' | 'medium' | 'high';
  };
  testCoverage: {
    percentage: number;
    uncoveredPaths: string[];
    criticalPaths: string[];
  };
  documentation: {
    coverage: number;
    quality: number;
    missingDocs: string[];
  };
  technicalDebt?: {
    totalDebtScore: number;
    debtByCategory: {
      complexity: number;
      duplication: number;
      testCoverage: number;
      documentation: number;
      codeSmells: number;
    };
    estimatedRefactoringTime: number;
    priorityFiles: Array<{
      filePath: string;
      debtScore: number;
      issues: string[];
    }>;
    recommendations: string[];
  };
  maintainabilityIndex?: {
    overallIndex: number;
    fileIndices: Array<{
      filePath: string;
      index: number;
      rating: 'excellent' | 'good' | 'moderate' | 'difficult' | 'unmaintainable';
    }>;
    averageByLanguage: Record<string, number>;
    trendDirection: 'improving' | 'stable' | 'declining';
  };
}

/**
 * Performance analysis metrics including execution hotspots and regression detection
 */
export interface PerformanceMetrics {
  executionHotspots: {
    location: Location;
    executionTime: number;
    callFrequency: number;
  }[];
  memoryProfile: {
    allocation: number;
    leaks: string[];
    garbageCollection: number;
  };
  asyncOperations: {
    pending: number;
    avgResolutionTime: number;
  };
  regressionAnalysis?: {
    hasRegression: boolean;
    regressionScore: number;
    affectedFiles: string[];
    performanceTrend: 'improving' | 'degrading' | 'stable';
    recommendations: string[];
  };
  benchmarkComparison?: {
    overallScore: number;
    benchmarkComparison: {
      complexity: 'excellent' | 'good' | 'average' | 'poor';
      fileSize: 'excellent' | 'good' | 'average' | 'poor';
      memoryEfficiency: 'excellent' | 'good' | 'average' | 'poor';
    };
    industryPercentile: number;
    improvementAreas: string[];
  };
}

/**
 * Security analysis metrics including vulnerability detection and scoring
 */
export interface SecurityMetrics {
  vulnerabilities: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    location: Location;
    cwe: string;
  }[];
  securityScore: number;
  sanitizationCoverage: number;
}

/**
 * Complete analysis report containing all metric categories
 */
export interface CompleteReport {
  codeQuality: CodeHealthMetrics;
  performance: PerformanceMetrics;
  security: SecurityMetrics;
  teamMetrics: TeamMetrics;
  trends: TrendAnalysis;
  recommendations: string[];
}
