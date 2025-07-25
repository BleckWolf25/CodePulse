/**
 * @file PROJECT-COMPARATOR.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * Project Comparison Analyzer
 * Provides comprehensive comparison analysis across different projects,
 * including performance benchmarking, best practice identification,
 * and cross-project learning insights.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import { DailyMetrics, CodeMetrics } from '../metrics/storage';
import { MetricsStorage } from '../metrics/storage';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES
// Project Metrics
export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  timeRange: {
    start: number;
    end: number;
  };
  metrics: {
    productivity: ProductivityMetrics;
    quality: QualityMetrics;
    complexity: ComplexityMetrics;
    velocity: VelocityMetrics;
    languages: LanguageMetrics;
    patterns: PatternMetrics;
  };
  metadata: {
    totalFiles: number;
    totalLines: number;
    activeDays: number;
    teamSize?: number;
    projectType?: string;
  };
}

// Project Metrics Interfaces
export interface ProductivityMetrics {
  avgDailyCodingTime: number;
  peakProductivityHours: number[];
  productivityScore: number;
  consistencyScore: number;
  burnoutRisk: 'low' | 'medium' | 'high';
}

// Quality Metrics Interface
export interface QualityMetrics {
  avgComplexity: number;
  codeQualityScore: number;
  maintainabilityIndex: number;
  technicalDebtRatio: number;
  qualityTrend: 'improving' | 'stable' | 'declining';
}

// Complexity Metrics Interface
export interface ComplexityMetrics {
  avgCyclomaticComplexity: number;
  maxComplexity: number;
  complexityDistribution: { [range: string]: number };
  hotspots: string[];
  complexityTrend: 'improving' | 'stable' | 'declining';
}

// Velocity Metrics Interface
export interface VelocityMetrics {
  avgFilesPerDay: number;
  avgLinesPerDay: number;
  velocityTrend: 'improving' | 'stable' | 'declining';
  sprintVelocity?: number;
  deliveryConsistency: number;
}

// Language Metrics Interface
export interface LanguageMetrics {
  primaryLanguages: { language: string; percentage: number }[];
  languageEfficiency: { language: string; filesPerHour: number }[];
  languageTrends: { language: string; trend: 'growing' | 'stable' | 'declining' }[];
}

// Pattern Metrics Interface
export interface PatternMetrics {
  workingPatterns: {
    preferredHours: number[];
    sessionLength: number;
    breakFrequency: number;
  };
  collaborationPatterns: {
    pairProgrammingFreq: number;
    reviewParticipation: number;
    knowledgeSharing: number;
  };
}

// Project Comparison Interface
export interface ProjectComparison {
  projects: ProjectMetrics[];
  comparison: {
    productivity: ComparisonAnalysis;
    quality: ComparisonAnalysis;
    complexity: ComparisonAnalysis;
    velocity: ComparisonAnalysis;
    languages: LanguageComparison;
  };
  insights: {
    bestPractices: BestPractice[];
    learningOpportunities: LearningOpportunity[];
    recommendations: string[];
  };
  benchmarks: {
    industryBenchmarks?: IndustryBenchmark[];
    internalBenchmarks: InternalBenchmark[];
  };
}

// Comparison Analysis
export interface ComparisonAnalysis {
  metric: string;
  values: { projectId: string; value: number; rank: number }[];
  leader: string;
  laggard: string;
  variance: number;
  insights: string[];
}

// Language Comparison Interface
export interface LanguageComparison {
  commonLanguages: string[];
  uniqueLanguages: { projectId: string; languages: string[] }[];
  efficiencyComparison: { language: string; bestProject: string; efficiency: number }[];
  variance?: number;
  insights?: string[];
}

// Best Practice Interface
export interface BestPractice {
  category: 'productivity' | 'quality' | 'process' | 'tooling';
  practice: string;
  sourceProject: string;
  impact: 'high' | 'medium' | 'low';
  applicability: string[];
  implementation: string;
}

// Learning Opportunity Interface
export interface LearningOpportunity {
  area: string;
  sourceProject: string;
  targetProjects: string[];
  potentialImprovement: number;
  effort: 'low' | 'medium' | 'high';
  description: string;
}

// Industry Benchmark Interface
export interface IndustryBenchmark {
  metric: string;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile90: number;
  source: string;
}

// Internal Benchmark Interface
export interface InternalBenchmark {
  metric: string;
  average: number;
  standardDeviation: number;
  topPerformer: string;
  bottomPerformer: string;
}

// ------------ MAIN CLASS
export class ProjectComparator {
  private storage: MetricsStorage;
  private errorHandler = ErrorHandler.getInstance();
  
  // Constructor
  constructor(context: vscode.ExtensionContext) {
    this.storage = new MetricsStorage(context);
  }

  /**
   * Compare multiple projects across various metrics
   */
  public async compareProjects(projectIds: string[], timeRange?: { start: number; end: number }): Promise<ProjectComparison> {
    try {
      // Collect metrics for each project
      const projects: ProjectMetrics[] = [];
      
      for (const projectId of projectIds) {
        const projectMetrics = await this.collectProjectMetrics(projectId, timeRange);
        if (projectMetrics) {
          projects.push(projectMetrics);
        }
      }

      if (projects.length < 2) {
        throw new Error('At least 2 projects required for comparison');
      }

      // Perform comparative analysis
      const comparison = this.performComparativeAnalysis(projects);
      
      // Generate insights and recommendations
      const insights = this.generateInsights(projects, comparison);
      
      // Calculate benchmarks
      const benchmarks = this.calculateBenchmarks(projects);

      return {
        projects,
        comparison,
        insights,
        benchmarks
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Collect comprehensive metrics for a specific project
   */
  private async collectProjectMetrics(projectId: string, timeRange?: { start: number; end: number }): Promise<ProjectMetrics | null> {
    try {
      // Load project-specific data (could be improved to filter by project)
      const data = this.storage.loadMetrics();
      
      // Filter data by time range if provided
      let dailyMetrics = data.dailyMetrics;
      if (timeRange) {
        dailyMetrics = dailyMetrics.filter(day => {
          const timestamp = new Date(day.date).getTime();
          return timestamp >= timeRange.start && timestamp <= timeRange.end;
        });
      }

      if (dailyMetrics.length === 0) {return null;}

      const fileMetrics = Object.values(data.fileMetrics);
      
      // Calculate productivity metrics
      const productivity = this.calculateProductivityMetrics(dailyMetrics, data.sessions);
      
      // Calculate quality metrics
      const quality = this.calculateQualityMetrics(fileMetrics);
      
      // Calculate complexity metrics
      const complexity = this.calculateComplexityMetrics(fileMetrics);
      
      // Calculate velocity metrics
      const velocity = this.calculateVelocityMetrics(dailyMetrics);
      
      // Calculate language metrics
      const languages = this.calculateLanguageMetrics(dailyMetrics, fileMetrics);
      
      // Calculate pattern metrics
      const patterns = this.calculatePatternMetrics(data.sessions);

      // Calculate metadata
      const metadata = {
        totalFiles: fileMetrics.length,
        totalLines: fileMetrics.reduce((sum, file) => sum + file.lines, 0),
        activeDays: dailyMetrics.length,
        projectType: this.inferProjectType(fileMetrics)
      };

      const actualTimeRange = timeRange || {
        start: Math.min(...dailyMetrics.map(d => new Date(d.date).getTime())),
        end: Math.max(...dailyMetrics.map(d => new Date(d.date).getTime()))
      };

      return {
        projectId,
        projectName: projectId, // Could be improved to get actual project name
        timeRange: actualTimeRange,
        metrics: {
          productivity,
          quality,
          complexity,
          velocity,
          languages,
          patterns
        },
        metadata
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return null;
    }
  }

  /**
   * Calculate productivity metrics for a project
   */
  private calculateProductivityMetrics(dailyMetrics: DailyMetrics[], sessions: any[]): ProductivityMetrics {
    const avgDailyCodingTime = dailyMetrics.reduce((sum, day) => sum + day.totalCodingTime, 0) / dailyMetrics.length;
    
    // Calculate peak productivity hours from sessions
    const hourlyActivity = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    sessions.forEach(session => {
      if (session.endTime && session.activeTime > 0) {
        const hour = new Date(session.startTime).getHours();
        hourlyActivity[hour] += session.activeTime;
        hourlyCounts[hour]++;
      }
    });

    const hourlyAverages = hourlyActivity.map((total, hour) => 
      hourlyCounts[hour] > 0 ? total / hourlyCounts[hour] : 0
    );

    const peakProductivityHours = hourlyAverages
      .map((avg, hour) => ({ hour, avg }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4)
      .map(h => h.hour)
      .sort((a, b) => a - b);

    // Calculate productivity score (0-100)
    const maxPossibleTime = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const productivityScore = Math.min(100, (avgDailyCodingTime / maxPossibleTime) * 100);

    // Calculate consistency score
    const codingTimes = dailyMetrics.map(day => day.totalCodingTime);
    const mean = avgDailyCodingTime;
    const variance = codingTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / codingTimes.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - (stdDev / mean) * 100);

    // Calculate burnout risk
    const recentDays = dailyMetrics.slice(-7); // Last 7 days
    const recentAvg = recentDays.reduce((sum, day) => sum + day.totalCodingTime, 0) / recentDays.length;
    const burnoutThreshold = 10 * 60 * 60 * 1000; // 10 hours
    
    let burnoutRisk: 'low' | 'medium' | 'high' = 'low';
    if (recentAvg > burnoutThreshold) {burnoutRisk = 'high';}
    else if (recentAvg > burnoutThreshold * 0.8) {burnoutRisk = 'medium';}

    return {
      avgDailyCodingTime,
      peakProductivityHours,
      productivityScore,
      consistencyScore,
      burnoutRisk
    };
  }

  /**
   * Calculate quality metrics for a project
   */
  private calculateQualityMetrics(fileMetrics: CodeMetrics[]): QualityMetrics {
    if (fileMetrics.length === 0) {
      return {
        avgComplexity: 0,
        codeQualityScore: 0,
        maintainabilityIndex: 0,
        technicalDebtRatio: 0,
        qualityTrend: 'stable'
      };
    }

    const avgComplexity = fileMetrics.reduce((sum, file) => sum + file.complexity.cyclomaticComplexity, 0) / fileMetrics.length;
    
    // Calculate code quality score (inverse of complexity, normalized)
    const maxComplexity = Math.max(...fileMetrics.map(f => f.complexity.cyclomaticComplexity));
    const codeQualityScore = Math.max(0, 100 - (avgComplexity / maxComplexity) * 100);
    
    // Calculate maintainability index (simplified)
    const avgLines = fileMetrics.reduce((sum, file) => sum + file.lines, 0) / fileMetrics.length;
    const maintainabilityIndex = Math.max(0, 100 - (avgComplexity * 2) - (avgLines / 100));
    
    // Calculate technical debt ratio (percentage of high-complexity files)
    const highComplexityFiles = fileMetrics.filter(f => f.complexity.cyclomaticComplexity > 10).length;
    const technicalDebtRatio = (highComplexityFiles / fileMetrics.length) * 100;
    
    // Determine quality trend (simplified - would need historical data)
    const qualityTrend: 'improving' | 'stable' | 'declining' = 'stable';

    return {
      avgComplexity,
      codeQualityScore,
      maintainabilityIndex,
      technicalDebtRatio,
      qualityTrend
    };
  }

  /**
   * Calculate complexity metrics for a project
   */
  private calculateComplexityMetrics(fileMetrics: CodeMetrics[]): ComplexityMetrics {
    if (fileMetrics.length === 0) {
      return {
        avgCyclomaticComplexity: 0,
        maxComplexity: 0,
        complexityDistribution: {},
        hotspots: [],
        complexityTrend: 'stable'
      };
    }

    const complexities = fileMetrics.map(f => f.complexity.cyclomaticComplexity);
    const avgCyclomaticComplexity = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
    const maxComplexity = Math.max(...complexities);

    // Calculate complexity distribution
    const ranges = [
      { min: 0, max: 5, label: '0-5 (Simple)' },
      { min: 5, max: 10, label: '5-10 (Moderate)' },
      { min: 10, max: 20, label: '10-20 (Complex)' },
      { min: 20, max: Infinity, label: '20+ (Very Complex)' }
    ];

    const complexityDistribution: { [range: string]: number } = {};
    ranges.forEach(range => {
      const count = complexities.filter(c => c >= range.min && c < range.max).length;
      complexityDistribution[range.label] = (count / complexities.length) * 100;
    });

    // Identify hotspots (top 10% most complex files)
    const sortedFiles = fileMetrics
      .sort((a, b) => b.complexity.cyclomaticComplexity - a.complexity.cyclomaticComplexity)
      .slice(0, Math.ceil(fileMetrics.length * 0.1));
    
    const hotspots = sortedFiles.map(f => f.path);

    return {
      avgCyclomaticComplexity,
      maxComplexity,
      complexityDistribution,
      hotspots,
      complexityTrend: 'stable' // TODO: Would be calculated from historical data
    };
  }

  /**
   * Calculate velocity metrics for a project
   */
  private calculateVelocityMetrics(dailyMetrics: DailyMetrics[]): VelocityMetrics {
    if (dailyMetrics.length === 0) {
      return {
        avgFilesPerDay: 0,
        avgLinesPerDay: 0,
        velocityTrend: 'stable',
        deliveryConsistency: 0
      };
    }

    const avgFilesPerDay = dailyMetrics.reduce((sum, day) => sum + day.filesEdited, 0) / dailyMetrics.length;
    
    // Estimate lines per day (TODO: Would be more accurate with actual line change data)
    const avgLinesPerDay = avgFilesPerDay * 50; // Rough estimate
    
    // Calculate delivery consistency
    const filesPerDay = dailyMetrics.map(day => day.filesEdited);
    const mean = avgFilesPerDay;
    const variance = filesPerDay.reduce((sum, files) => sum + Math.pow(files - mean, 2), 0) / filesPerDay.length;
    const stdDev = Math.sqrt(variance);
    const deliveryConsistency = Math.max(0, 100 - (stdDev / mean) * 100);

    return {
      avgFilesPerDay,
      avgLinesPerDay,
      velocityTrend: 'stable', // TODO: Would be calculated from historical data
      deliveryConsistency
    };
  }

  /**
   * Calculate language metrics for a project
   */
  private calculateLanguageMetrics(dailyMetrics: DailyMetrics[], _fileMetrics: CodeMetrics[]): LanguageMetrics {
    // Calculate primary languages from daily metrics
    const languageTotals = new Map<string, number>();
    let totalFiles = 0;

    dailyMetrics.forEach(day => {
      Object.entries(day.languages).forEach(([language, count]) => {
        languageTotals.set(language, (languageTotals.get(language) || 0) + count);
        totalFiles += count;
      });
    });

    const primaryLanguages = Array.from(languageTotals.entries())
      .map(([language, count]) => ({
        language,
        percentage: (count / totalFiles) * 100
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    // Calculate language efficiency (simplified)
    const languageEfficiency = primaryLanguages.map(lang => ({
      language: lang.language,
      filesPerHour: lang.percentage / 10 // Simplified calculation
    }));

    // Language trends (simplified - would need historical data)
    const languageTrends = primaryLanguages.map(lang => ({
      language: lang.language,
      trend: 'stable' as 'growing' | 'stable' | 'declining'
    }));

    return {
      primaryLanguages,
      languageEfficiency,
      languageTrends
    };
  }

  /**
   * Calculate pattern metrics for a project
   */
  private calculatePatternMetrics(sessions: any[]): PatternMetrics {
    const validSessions = sessions.filter(s => s.endTime && s.activeTime > 0);
    
    if (validSessions.length === 0) {
      return {
        workingPatterns: {
          preferredHours: [],
          sessionLength: 0,
          breakFrequency: 0
        },
        collaborationPatterns: {
          pairProgrammingFreq: 0,
          reviewParticipation: 0,
          knowledgeSharing: 0
        }
      };
    }

    // Calculate preferred working hours
    const hourlyActivity = new Array(24).fill(0);
    validSessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      hourlyActivity[hour] += session.activeTime;
    });

    const preferredHours = hourlyActivity
      .map((activity, hour) => ({ hour, activity }))
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 4)
      .map(h => h.hour)
      .sort((a, b) => a - b);

    // Calculate average session length
    const sessionLengths = validSessions.map(s => (s.endTime - s.startTime) / 60000); // minutes
    const sessionLength = sessionLengths.reduce((sum, length) => sum + length, 0) / sessionLengths.length;

    // Calculate break frequency (simplified)
    const breakFrequency = validSessions.length > 1 ? 
      (validSessions.length - 1) / (validSessions.length * sessionLength / 60) : 0;

    return {
      workingPatterns: {
        preferredHours,
        sessionLength,
        breakFrequency
      },
      collaborationPatterns: {
        pairProgrammingFreq: 0, // Would need additional data
        reviewParticipation: 0, // Would need additional data
        knowledgeSharing: 0 // Would need additional data
      }
    };
  }

  /**
   * Infer project type from file metrics
   */
  private inferProjectType(fileMetrics: CodeMetrics[]): string {
    const languages = fileMetrics.map(f => f.language);
    const languageCounts = new Map<string, number>();
    
    languages.forEach(lang => {
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
    });

    const primaryLanguage = Array.from(languageCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    // Simple project type inference
    if (primaryLanguage === 'javascript' || primaryLanguage === 'typescript') {
      return languages.includes('html') || languages.includes('css') ? 'web' : 'node';
    } else if (primaryLanguage === 'python') {
      return 'python';
    } else if (primaryLanguage === 'java') {
      return 'java';
    } else if (primaryLanguage === 'csharp') {
      return 'dotnet';
    }

    return 'general';
  }

  /**
   * Perform comparative analysis across projects
   */
  private performComparativeAnalysis(projects: ProjectMetrics[]): {
    productivity: ComparisonAnalysis;
    quality: ComparisonAnalysis;
    complexity: ComparisonAnalysis;
    velocity: ComparisonAnalysis;
    languages: LanguageComparison;
  } {
    const productivity = this.compareProductivity(projects);
    const quality = this.compareQuality(projects);
    const complexity = this.compareComplexity(projects);
    const velocity = this.compareVelocity(projects);
    const languages = this.compareLanguages(projects);

    return { productivity, quality, complexity, velocity, languages };
  }

  /**
   * Compare productivity across projects
   */
  private compareProductivity(projects: ProjectMetrics[]): ComparisonAnalysis {
    const values = projects.map(p => ({
      projectId: p.projectId,
      value: p.metrics.productivity.productivityScore,
      rank: 0
    }));

    // Sort and assign ranks
    values.sort((a, b) => b.value - a.value);
    values.forEach((v, index) => v.rank = index + 1);

    const leader = values[0].projectId;
    const laggard = values[values.length - 1].projectId;

    // Calculate variance
    const mean = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) / values.length;

    const insights = this.generateProductivityInsights(projects, values);

    return {
      metric: 'productivity',
      values,
      leader,
      laggard,
      variance,
      insights
    };
  }

  /**
   * Compare quality across projects
   */
  private compareQuality(projects: ProjectMetrics[]): ComparisonAnalysis {
    const values = projects.map(p => ({
      projectId: p.projectId,
      value: p.metrics.quality.codeQualityScore,
      rank: 0
    }));

    values.sort((a, b) => b.value - a.value);
    values.forEach((v, index) => v.rank = index + 1);

    const leader = values[0].projectId;
    const laggard = values[values.length - 1].projectId;

    const mean = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) / values.length;

    const insights = this.generateQualityInsights(projects, values);

    return {
      metric: 'quality',
      values,
      leader,
      laggard,
      variance,
      insights
    };
  }

  /**
   * Compare complexity across projects
   */
  private compareComplexity(projects: ProjectMetrics[]): ComparisonAnalysis {
    const values = projects.map(p => ({
      projectId: p.projectId,
      value: p.metrics.complexity.avgCyclomaticComplexity,
      rank: 0
    }));

    // For complexity, lower is better, so sort ascending
    values.sort((a, b) => a.value - b.value);
    values.forEach((v, index) => v.rank = index + 1);

    const leader = values[0].projectId; // Lowest complexity
    const laggard = values[values.length - 1].projectId; // Highest complexity

    const mean = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) / values.length;

    const insights = this.generateComplexityInsights(projects, values);

    return {
      metric: 'complexity',
      values,
      leader,
      laggard,
      variance,
      insights
    };
  }

  /**
   * Compare velocity across projects
   */
  private compareVelocity(projects: ProjectMetrics[]): ComparisonAnalysis {
    const values = projects.map(p => ({
      projectId: p.projectId,
      value: p.metrics.velocity.avgFilesPerDay,
      rank: 0
    }));

    values.sort((a, b) => b.value - a.value);
    values.forEach((v, index) => v.rank = index + 1);

    const leader = values[0].projectId;
    const laggard = values[values.length - 1].projectId;

    const mean = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) / values.length;

    const insights = this.generateVelocityInsights(projects, values);

    return {
      metric: 'velocity',
      values,
      leader,
      laggard,
      variance,
      insights
    };
  }

  /**
   * Compare languages across projects
   */
  private compareLanguages(projects: ProjectMetrics[]): LanguageComparison {
    // Find common languages
    const allLanguages = new Set<string>();
    projects.forEach(p => {
      p.metrics.languages.primaryLanguages.forEach(lang => {
        allLanguages.add(lang.language);
      });
    });

    const commonLanguages = Array.from(allLanguages).filter(lang => {
      return projects.every(p =>
        p.metrics.languages.primaryLanguages.some(l => l.language === lang)
      );
    });

    // Find unique languages per project
    const uniqueLanguages = projects.map(p => ({
      projectId: p.projectId,
      languages: p.metrics.languages.primaryLanguages
        .map(l => l.language)
        .filter(lang => !commonLanguages.includes(lang))
    }));

    // Compare efficiency for common languages
    const efficiencyComparison = commonLanguages.map(language => {
      const projectEfficiencies = projects.map(p => {
        const langMetric = p.metrics.languages.languageEfficiency.find(l => l.language === language);
        return {
          projectId: p.projectId,
          efficiency: langMetric?.filesPerHour || 0
        };
      });

      const bestProject = projectEfficiencies.reduce((best, current) =>
        current.efficiency > best.efficiency ? current : best
      );

      return {
        language,
        bestProject: bestProject.projectId,
        efficiency: bestProject.efficiency
      };
    });

    return {
      commonLanguages,
      uniqueLanguages,
      efficiencyComparison
    };
  }

  /**
   * Generate productivity insights
   */
  private generateProductivityInsights(projects: ProjectMetrics[], values: { projectId: string; value: number; rank: number }[]): string[] {
    const insights: string[] = [];
    const leader = projects.find(p => p.projectId === values[0].projectId)!;
    const laggard = projects.find(p => p.projectId === values[values.length - 1].projectId)!;

    const gap = values[0].value - values[values.length - 1].value;
    if (gap > 20) {
      insights.push(`Significant productivity gap: ${gap.toFixed(1)} points between highest and lowest performing projects`);
    }

    if (leader.metrics.productivity.burnoutRisk === 'low' && leader.metrics.productivity.consistencyScore > 80) {
      insights.push(`${leader.projectName} demonstrates sustainable high productivity with low burnout risk`);
    }

    if (laggard.metrics.productivity.burnoutRisk === 'high') {
      insights.push(`${laggard.projectName} shows signs of potential burnout - consider workload adjustment`);
    }

    // Analyze peak hours patterns
    const leaderPeakHours = leader.metrics.productivity.peakProductivityHours;
    const commonPeakHours = projects.every(p =>
      p.metrics.productivity.peakProductivityHours.some(hour => leaderPeakHours.includes(hour))
    );

    if (commonPeakHours) {
      insights.push(`Common peak productivity hours identified: ${leaderPeakHours.join(', ')} - consider scheduling important work during these times`);
    }

    return insights;
  }

  /**
   * Generate quality insights
   */
  private generateQualityInsights(projects: ProjectMetrics[], values: { projectId: string; value: number; rank: number }[]): string[] {
    const insights: string[] = [];
    const leader = projects.find(p => p.projectId === values[0].projectId)!;
    const laggard = projects.find(p => p.projectId === values[values.length - 1].projectId)!;

    if (leader.metrics.quality.technicalDebtRatio < 10) {
      insights.push(`${leader.projectName} maintains excellent code quality with minimal technical debt`);
    }

    if (laggard.metrics.quality.technicalDebtRatio > 30) {
      insights.push(`${laggard.projectName} has high technical debt ratio - prioritize refactoring efforts`);
    }

    const avgMaintainability = projects.reduce((sum, p) => sum + p.metrics.quality.maintainabilityIndex, 0) / projects.length;
    if (leader.metrics.quality.maintainabilityIndex > avgMaintainability + 20) {
      insights.push(`${leader.projectName} shows superior maintainability - analyze practices for replication`);
    }

    return insights;
  }

  /**
   * Generate complexity insights
   */
  private generateComplexityInsights(projects: ProjectMetrics[], values: { projectId: string; value: number; rank: number }[]): string[] {
    const insights: string[] = [];
    const leader = projects.find(p => p.projectId === values[0].projectId)!; // Lowest complexity
    const laggard = projects.find(p => p.projectId === values[values.length - 1].projectId)!; // Highest complexity

    if (leader.metrics.complexity.avgCyclomaticComplexity < 5) {
      insights.push(`${leader.projectName} maintains excellent code simplicity with average complexity under 5`);
    }

    if (laggard.metrics.complexity.avgCyclomaticComplexity > 15) {
      insights.push(`${laggard.projectName} has high average complexity - consider refactoring complex functions`);
    }

    // Analyze complexity distribution
    const leaderSimpleCode = leader.metrics.complexity.complexityDistribution['0-5 (Simple)'] || 0;
    if (leaderSimpleCode > 70) {
      insights.push(`${leader.projectName} has ${leaderSimpleCode.toFixed(1)}% simple code - excellent architectural practices`);
    }

    const laggardComplexCode = (laggard.metrics.complexity.complexityDistribution['10-20 (Complex)'] || 0) +
                              (laggard.metrics.complexity.complexityDistribution['20+ (Very Complex)'] || 0);
    if (laggardComplexCode > 20) {
      insights.push(`${laggard.projectName} has ${laggardComplexCode.toFixed(1)}% complex code - focus on simplification`);
    }

    return insights;
  }

  /**
   * Generate velocity insights
   */
  private generateVelocityInsights(projects: ProjectMetrics[], values: { projectId: string; value: number; rank: number }[]): string[] {
    const insights: string[] = [];
    const leader = projects.find(p => p.projectId === values[0].projectId)!;
    const laggard = projects.find(p => p.projectId === values[values.length - 1].projectId)!;

    if (leader.metrics.velocity.deliveryConsistency > 80) {
      insights.push(`${leader.projectName} demonstrates high delivery consistency - reliable development pace`);
    }

    if (laggard.metrics.velocity.deliveryConsistency < 50) {
      insights.push(`${laggard.projectName} shows inconsistent delivery patterns - investigate process bottlenecks`);
    }

    const velocityGap = values[0].value - values[values.length - 1].value;
    if (velocityGap > 5) {
      insights.push(`Significant velocity difference: ${velocityGap.toFixed(1)} files/day between fastest and slowest projects`);
    }

    return insights;
  }

  /**
   * Generate comprehensive insights and recommendations
   */
  private generateInsights(projects: ProjectMetrics[], comparison: any): {
    bestPractices: BestPractice[];
    learningOpportunities: LearningOpportunity[];
    recommendations: string[];
  } {
    const bestPractices = this.identifyBestPractices(projects, comparison);
    const learningOpportunities = this.identifyLearningOpportunities(projects, comparison);
    const recommendations = this.generateRecommendations(projects, comparison);

    return { bestPractices, learningOpportunities, recommendations };
  }

  /**
   * Identify best practices from high-performing projects
   */
  private identifyBestPractices(projects: ProjectMetrics[], comparison: any): BestPractice[] {
    const practices: BestPractice[] = [];

    // Productivity best practices
    const productivityLeader = projects.find(p => p.projectId === comparison.productivity.leader)!;
    if (productivityLeader.metrics.productivity.consistencyScore > 80) {
      practices.push({
        category: 'productivity',
        practice: 'Consistent daily coding schedule with optimal session lengths',
        sourceProject: productivityLeader.projectName,
        impact: 'high',
        applicability: projects.filter(p => p.projectId !== productivityLeader.projectId).map(p => p.projectName),
        implementation: `Establish regular coding sessions during peak hours: ${productivityLeader.metrics.productivity.peakProductivityHours.join(', ')}`
      });
    }

    // Quality best practices
    const qualityLeader = projects.find(p => p.projectId === comparison.quality.leader)!;
    if (qualityLeader.metrics.quality.technicalDebtRatio < 15) {
      practices.push({
        category: 'quality',
        practice: 'Proactive technical debt management',
        sourceProject: qualityLeader.projectName,
        impact: 'high',
        applicability: projects.filter(p => p.projectId !== qualityLeader.projectId).map(p => p.projectName),
        implementation: 'Implement regular refactoring cycles and code quality gates'
      });
    }

    // Complexity best practices
    const complexityLeader = projects.find(p => p.projectId === comparison.complexity.leader)!;
    if (complexityLeader.metrics.complexity.avgCyclomaticComplexity < 8) {
      practices.push({
        category: 'quality',
        practice: 'Simple, maintainable code architecture',
        sourceProject: complexityLeader.projectName,
        impact: 'medium',
        applicability: projects.filter(p => p.projectId !== complexityLeader.projectId).map(p => p.projectName),
        implementation: 'Enforce complexity limits and promote single responsibility principle'
      });
    }

    // Process best practices
    const velocityLeader = projects.find(p => p.projectId === comparison.velocity.leader)!;
    if (velocityLeader.metrics.velocity.deliveryConsistency > 75) {
      practices.push({
        category: 'process',
        practice: 'Consistent delivery rhythm',
        sourceProject: velocityLeader.projectName,
        impact: 'medium',
        applicability: projects.filter(p => p.projectId !== velocityLeader.projectId).map(p => p.projectName),
        implementation: 'Establish predictable development cycles and remove process bottlenecks'
      });
    }

    return practices;
  }

  /**
   * Identify learning opportunities between projects
   */
  private identifyLearningOpportunities(projects: ProjectMetrics[], comparison: any): LearningOpportunity[] {
    const opportunities: LearningOpportunity[] = [];

    // Productivity improvement opportunities
    const productivityGaps = comparison.productivity.values
      .filter((v: any) => v.rank > 1)
      .map((v: any) => {
        const project = projects.find(p => p.projectId === v.projectId)!;
        const leader = projects.find(p => p.projectId === comparison.productivity.leader)!;
        const gap = comparison.productivity.values[0].value - v.value;

        return {
          area: 'Productivity Enhancement',
          sourceProject: leader.projectName,
          targetProjects: [project.projectName],
          potentialImprovement: gap,
          effort: gap > 30 ? 'high' : gap > 15 ? 'medium' : 'low',
          description: `Adopt peak hour scheduling and consistency practices from ${leader.projectName}`
        };
      });

    opportunities.push(...productivityGaps);

    // Quality improvement opportunities
    const qualityGaps = comparison.quality.values
      .filter((v: any) => v.rank > 1)
      .map((v: any) => {
        const project = projects.find(p => p.projectId === v.projectId)!;
        const leader = projects.find(p => p.projectId === comparison.quality.leader)!;
        const gap = comparison.quality.values[0].value - v.value;

        return {
          area: 'Code Quality Improvement',
          sourceProject: leader.projectName,
          targetProjects: [project.projectName],
          potentialImprovement: gap,
          effort: gap > 25 ? 'high' : gap > 10 ? 'medium' : 'low',
          description: `Implement quality practices and technical debt management from ${leader.projectName}`
        };
      });

    opportunities.push(...qualityGaps);

    // Language efficiency opportunities
    comparison.languages.efficiencyComparison.forEach((langComp: any) => {
      const bestProject = projects.find(p => p.projectId === langComp.bestProject)!;
      const otherProjects = projects.filter(p =>
        p.projectId !== langComp.bestProject &&
        p.metrics.languages.primaryLanguages.some(l => l.language === langComp.language)
      );

      if (otherProjects.length > 0) {
        opportunities.push({
          area: `${langComp.language} Development Efficiency`,
          sourceProject: bestProject.projectName,
          targetProjects: otherProjects.map(p => p.projectName),
          potentialImprovement: langComp.efficiency * 0.2, // Assume 20% improvement potential
          effort: 'medium',
          description: `Learn ${langComp.language} best practices and tooling from ${bestProject.projectName}`
        });
      }
    });

    return opportunities;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(projects: ProjectMetrics[], comparison: any): string[] {
    const recommendations: string[] = [];

    // High-level strategic recommendations
    const productivityVariance = comparison.productivity.variance;
    if (productivityVariance > 400) {
      recommendations.push('High productivity variance detected - standardize development practices across projects');
    }

    const qualityVariance = comparison.quality.variance;
    if (qualityVariance > 300) {
      recommendations.push('Inconsistent code quality across projects - implement organization-wide quality standards');
    }

    // Project-specific recommendations
    projects.forEach(project => {
      const productivityRank = comparison.productivity.values.find((v: any) => v.projectId === project.projectId)?.rank;
      const qualityRank = comparison.quality.values.find((v: any) => v.projectId === project.projectId)?.rank;

      if (productivityRank && productivityRank > projects.length * 0.7) {
        recommendations.push(`${project.projectName}: Focus on productivity improvement through better time management and process optimization`);
      }

      if (qualityRank && qualityRank > projects.length * 0.7) {
        recommendations.push(`${project.projectName}: Prioritize code quality initiatives and technical debt reduction`);
      }

      if (project.metrics.productivity.burnoutRisk === 'high') {
        recommendations.push(`${project.projectName}: Address burnout risk through workload balancing and process improvements`);
      }

      if (project.metrics.quality.technicalDebtRatio > 25) {
        recommendations.push(`${project.projectName}: Implement aggressive technical debt reduction strategy`);
      }
    });

    // Language-specific recommendations
    comparison.languages.efficiencyComparison.forEach((langComp: any) => {
      if (langComp.efficiency < 2) {
        recommendations.push(`Improve ${langComp.language} development efficiency through better tooling and training`);
      }
    });

    return recommendations;
  }

  /**
   * Calculate internal and industry benchmarks
   */
  private calculateBenchmarks(projects: ProjectMetrics[]): {
    internalBenchmarks: InternalBenchmark[];
  } {
    const internalBenchmarks: InternalBenchmark[] = [];

    // Productivity benchmark
    const productivityScores = projects.map(p => p.metrics.productivity.productivityScore);
    internalBenchmarks.push(this.calculateInternalBenchmark('productivity', productivityScores, projects));

    // Quality benchmark
    const qualityScores = projects.map(p => p.metrics.quality.codeQualityScore);
    internalBenchmarks.push(this.calculateInternalBenchmark('quality', qualityScores, projects));

    // Complexity benchmark
    const complexityScores = projects.map(p => p.metrics.complexity.avgCyclomaticComplexity);
    internalBenchmarks.push(this.calculateInternalBenchmark('complexity', complexityScores, projects));

    // Velocity benchmark
    const velocityScores = projects.map(p => p.metrics.velocity.avgFilesPerDay);
    internalBenchmarks.push(this.calculateInternalBenchmark('velocity', velocityScores, projects));

    return { internalBenchmarks };
  }

  /**
   * Calculate internal benchmark for a specific metric
   */
  private calculateInternalBenchmark(metric: string, values: number[], projects: ProjectMetrics[]): InternalBenchmark {
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    const sortedValues = [...values].sort((a, b) => b - a);
    const topPerformerIndex = values.indexOf(sortedValues[0]);
    const bottomPerformerIndex = values.indexOf(sortedValues[sortedValues.length - 1]);

    // For complexity, lower is better
    const isLowerBetter = metric === 'complexity';
    const topPerformer = projects[isLowerBetter ? bottomPerformerIndex : topPerformerIndex].projectName;
    const bottomPerformer = projects[isLowerBetter ? topPerformerIndex : bottomPerformerIndex].projectName;

    return {
      metric,
      average,
      standardDeviation,
      topPerformer,
      bottomPerformer
    };
  }
}
