/**
 * @file TEAM-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Team Collaboration Analytics
 * Analyzes team collaboration patterns, code ownership,
 * knowledge distribution, and team productivity metrics.
 */

// ------------ IMPORTS
import { StoredMetrics } from '../storage';
import { ErrorHandler } from '../../utils/error-handler';
import * as vscode from 'vscode';

// ------------ CLASS
export class TeamCollaborationAnalyzer {
  private errorHandler = ErrorHandler.getInstance();
  
  /**
   * Analyze code ownership patterns
   */
  public async analyzeCodeOwnership(data: StoredMetrics): Promise<Map<string, string[]>> {
    try {
      const ownership = new Map<string, string[]>();
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      
      if (!gitExtension) {
        return ownership;
      }

      const git = gitExtension.exports.getAPI(1);
      const repository = git.repositories[0];
      
      if (!repository) {
        return ownership;
      }

      // Analyze file ownership based on git blame and recent commits
      for (const [filePath] of Object.entries(data.fileMetrics)) {
        try {
          const contributors = await this.getFileContributors(repository, filePath);
          ownership.set(filePath, contributors);
        } catch (error) {
          // Skip files that can't be analyzed
          continue;
        }
      }
      
      return ownership;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return new Map();
    }
  }

  /**
   * Calculate team collaboration score
   */
  public async calculateCollaborationScore(_data: StoredMetrics): Promise<number> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      
      if (!gitExtension) {
        return 0;
      }

      const git = gitExtension.exports.getAPI(1);
      const repository = git.repositories[0];
      
      if (!repository) {
        return 0;
      }

      // Get recent commits (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const commits = await this.getRecentCommits(repository, thirtyDaysAgo);
      
      // Calculate collaboration metrics
      const uniqueAuthors = new Set(commits.map(c => c.authorEmail)).size;
      const totalCommits = commits.length;
      const filesPerCommit = this.calculateAverageFilesPerCommit(commits);
      const crossFileCollaboration = await this.calculateCrossFileCollaboration(commits);
      
      // Scoring algorithm
      let score = 0;
      
      // Author diversity (0-30 points)
      score += Math.min(30, uniqueAuthors * 5);
      
      // Commit frequency (0-25 points)
      score += Math.min(25, totalCommits * 0.5);
      
      // Files per commit (0-25 points) - moderate is better
      const idealFilesPerCommit = 3;
      const filesScore = Math.max(0, 25 - Math.abs(filesPerCommit - idealFilesPerCommit) * 5);
      score += filesScore;
      
      // Cross-file collaboration (0-20 points)
      score += crossFileCollaboration * 20;
      
      return Math.min(100, score);
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return 0;
    }
  }

  /**
   * Analyze knowledge distribution across team
   */
  public async analyzeKnowledgeDistribution(data: StoredMetrics): Promise<number> {
    try {
      const ownership = await this.analyzeCodeOwnership(data);
      
      if (ownership.size === 0) {
        return 0;
      }

      // Calculate knowledge distribution using Gini coefficient
      const fileContributorCounts = Array.from(ownership.values())
        .map(contributors => contributors.length);
      
      if (fileContributorCounts.length === 0) {
        return 0;
      }

      const giniCoefficient = this.calculateGiniCoefficient(fileContributorCounts);
      
      // Convert Gini coefficient to knowledge distribution score
      // Lower Gini = better distribution = higher score
      return Math.max(0, (1 - giniCoefficient) * 100);
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return 0;
    }
  }

  /**
   * Count unique contributors
   */
  public async countContributors(_data: StoredMetrics): Promise<number> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      
      if (!gitExtension) {
        return 1; // Assume single contributor if no git
      }

      const git = gitExtension.exports.getAPI(1);
      const repository = git.repositories[0];
      
      if (!repository) {
        return 1;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const commits = await this.getRecentCommits(repository, thirtyDaysAgo);
      const uniqueAuthors = new Set(commits.map(c => c.authorEmail));
      
      return uniqueAuthors.size;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return 1;
    }
  }

  /**
   * Get file contributors from git history
   */
  private async getFileContributors(repository: any, filePath: string): Promise<string[]> {
    try {
      // Get git log for specific file
      const log = await repository.log({ path: filePath, maxEntries: 50 });
      const contributors = new Set<string>();
      
      log.forEach((commit: any) => {
        if (commit.authorEmail) {
          contributors.add(commit.authorEmail);
        }
      });
      
      return Array.from(contributors);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get recent commits from repository
   */
  private async getRecentCommits(repository: any, since: Date): Promise<any[]> {
    try {
      const log = await repository.log({ maxEntries: 200 });
      return log.filter((commit: any) => 
        commit.authorDate && new Date(commit.authorDate) >= since
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Calculate average files per commit
   */
  private calculateAverageFilesPerCommit(commits: any[]): number {
    if (commits.length === 0) {return 0;}
    
    const totalFiles = commits.reduce((sum, commit) => {
      return sum + (commit.changes?.length || 1);
    }, 0);
    
    return totalFiles / commits.length;
  }

  /**
   * Calculate cross-file collaboration score
   */
  private async calculateCrossFileCollaboration(commits: any[]): Promise<number> {
    if (commits.length === 0) {return 0;}
    
    // Group commits by author
    const authorCommits = new Map<string, any[]>();
    commits.forEach(commit => {
      const author = commit.authorEmail;
      if (!authorCommits.has(author)) {
        authorCommits.set(author, []);
      }
      authorCommits.get(author)!.push(commit);
    });

    // Calculate how often different authors work on the same files
    const fileAuthors = new Map<string, Set<string>>();
    
    commits.forEach(commit => {
      const author = commit.authorEmail;
      const files = commit.changes?.map((c: any) => c.uri?.path) || [];
      
      files.forEach((file: string) => {
        if (!fileAuthors.has(file)) {
          fileAuthors.set(file, new Set());
        }
        fileAuthors.get(file)!.add(author);
      });
    });

    // Calculate collaboration ratio
    const collaborativeFiles = Array.from(fileAuthors.values())
      .filter(authors => authors.size > 1).length;
    
    const totalFiles = fileAuthors.size;
    
    return totalFiles > 0 ? collaborativeFiles / totalFiles : 0;
  }

  /**
   * Calculate Gini coefficient for knowledge distribution
   */
  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) {return 0;}

    const sortedValues = values.sort((a, b) => a - b);
    const n = sortedValues.length;
    const sum = sortedValues.reduce((a, b) => a + b, 0);

    if (sum === 0) {return 0;}

    let gini = 0;
    for (let i = 0; i < n; i++) {
      gini += (2 * (i + 1) - n - 1) * sortedValues[i];
    }

    return gini / (n * sum);
  }

  /**
   * Analyze communication patterns and team dynamics
   */
  public async analyzeCommunicationPatterns(data: StoredMetrics): Promise<{
    communicationScore: number;
    collaborationFrequency: number;
    knowledgeSharingIndex: number;
    teamCohesion: number;
    communicationTrends: {
      increasing: boolean;
      stable: boolean;
      decreasing: boolean;
    };
  }> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');

      if (!gitExtension) {
        return this.getDefaultCommunicationMetrics();
      }

      const git = gitExtension.exports.getAPI(1);
      const repository = git.repositories[0];

      if (!repository) {
        return this.getDefaultCommunicationMetrics();
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const commits = await this.getRecentCommits(repository, thirtyDaysAgo);

      // Analyze communication patterns from commit messages and collaboration
      const communicationScore = this.calculateCommunicationScore(commits);
      const collaborationFrequency = this.calculateCollaborationFrequency(commits);
      const knowledgeSharingIndex = await this.calculateKnowledgeSharingIndex(commits, data);
      const teamCohesion = this.calculateTeamCohesion(commits);
      const communicationTrends = this.analyzeCommunicationTrends(commits);

      return {
        communicationScore,
        collaborationFrequency,
        knowledgeSharingIndex,
        teamCohesion,
        communicationTrends
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return this.getDefaultCommunicationMetrics();
    }
  }

  /**
   * Calculate communication score based on commit messages quality
   */
  private calculateCommunicationScore(commits: any[]): number {
    if (commits.length === 0) {return 0;}

    let totalScore = 0;

    commits.forEach(commit => {
      const message = commit.message || '';
      let messageScore = 0;

      // Length score (good commit messages are descriptive)
      if (message.length > 20 && message.length < 200) {
        messageScore += 25;
      }

      // Structure score (has subject and body)
      if (message.includes('\n\n')) {
        messageScore += 25;
      }

      // Conventional commits score
      if (/^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/.test(message)) {
        messageScore += 30;
      }

      // Issue reference score
      if (/#\d+|fixes|closes|resolves/i.test(message)) {
        messageScore += 20;
      }

      totalScore += messageScore;
    });

    return Math.min(100, totalScore / commits.length);
  }

  /**
   * Calculate collaboration frequency
   */
  private calculateCollaborationFrequency(commits: any[]): number {
    if (commits.length === 0) {return 0;}

    const authors = new Set(commits.map(c => c.authorEmail));
    const daysWithCommits = new Set(commits.map(c =>
      new Date(c.authorDate).toDateString()
    )).size;

    // More authors and more active days = higher collaboration frequency
    const authorScore = Math.min(50, authors.size * 10);
    const activityScore = Math.min(50, daysWithCommits * 2);

    return authorScore + activityScore;
  }

  /**
   * Calculate knowledge sharing index
   */
  private async calculateKnowledgeSharingIndex(commits: any[], _data: StoredMetrics): Promise<number> {
    if (commits.length === 0) {return 0;}

    // Analyze how knowledge is distributed across files and authors
    const fileAuthorMap = new Map<string, Set<string>>();

    commits.forEach(commit => {
      const author = commit.authorEmail;
      const files = commit.changes?.map((c: any) => c.uri?.path) || [];

      files.forEach((file: string) => {
        if (!fileAuthorMap.has(file)) {
          fileAuthorMap.set(file, new Set());
        }
        fileAuthorMap.get(file)!.add(author);
      });
    });

    // Calculate sharing score
    let sharingScore = 0;
    let totalFiles = 0;

    fileAuthorMap.forEach((authors) => {
      totalFiles++;
      if (authors.size > 1) {
        // Multiple authors = knowledge sharing
        sharingScore += Math.min(100, authors.size * 25);
      }
    });

    return totalFiles > 0 ? sharingScore / totalFiles : 0;
  }

  /**
   * Calculate team cohesion
   */
  private calculateTeamCohesion(commits: any[]): number {
    if (commits.length === 0) {return 0;}

    const authors = Array.from(new Set(commits.map(c => c.authorEmail)));

    if (authors.length <= 1) {return 100;} // Single author = perfect cohesion

    // Calculate how evenly distributed the commits are among authors
    const authorCommitCounts = authors.map(author =>
      commits.filter(c => c.authorEmail === author).length
    );

    const giniCoefficient = this.calculateGiniCoefficient(authorCommitCounts);

    // Lower Gini = better distribution = higher cohesion
    return Math.max(0, (1 - giniCoefficient) * 100);
  }

  /**
   * Analyze communication trends
   */
  private analyzeCommunicationTrends(commits: any[]): {
    increasing: boolean;
    stable: boolean;
    decreasing: boolean;
  } {
    if (commits.length < 14) {
      return { increasing: false, stable: true, decreasing: false };
    }

    // Split commits into two periods
    const midPoint = Math.floor(commits.length / 2);
    const earlierPeriod = commits.slice(0, midPoint);
    const laterPeriod = commits.slice(midPoint);

    const earlierScore = this.calculateCommunicationScore(earlierPeriod);
    const laterScore = this.calculateCommunicationScore(laterPeriod);

    const change = ((laterScore - earlierScore) / earlierScore) * 100;

    return {
      increasing: change > 10,
      stable: Math.abs(change) <= 10,
      decreasing: change < -10
    };
  }

  /**
   * Get default communication metrics when git is not available
   */
  private getDefaultCommunicationMetrics() {
    return {
      communicationScore: 0,
      collaborationFrequency: 0,
      knowledgeSharingIndex: 0,
      teamCohesion: 100, // Assume single developer
      communicationTrends: {
        increasing: false,
        stable: true,
        decreasing: false
      }
    };
  }

  /**
   * Analyze team productivity patterns
   */
  public async analyzeTeamProductivityPatterns(data: StoredMetrics): Promise<{
    productivityScore: number;
    teamVelocity: number;
    workloadDistribution: number;
    burnoutRisk: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    try {
      const ownership = await this.analyzeCodeOwnership(data);
      const collaborationScore = await this.calculateCollaborationScore(data);
      const contributorCount = await this.countContributors(data);

      // Calculate productivity score
      const productivityScore = this.calculateTeamProductivityScore(
        collaborationScore,
        contributorCount,
        ownership
      );

      // Calculate team velocity (commits per day)
      const teamVelocity = await this.calculateTeamVelocity(data);

      // Calculate workload distribution
      const workloadDistribution = await this.calculateWorkloadDistribution(data);

      // Assess burnout risk
      const burnoutRisk = this.assessBurnoutRisk(teamVelocity, workloadDistribution, contributorCount);

      // Generate recommendations
      const recommendations = this.generateTeamRecommendations(
        productivityScore,
        burnoutRisk,
        workloadDistribution,
        contributorCount
      );

      return {
        productivityScore,
        teamVelocity,
        workloadDistribution,
        burnoutRisk,
        recommendations
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        productivityScore: 0,
        teamVelocity: 0,
        workloadDistribution: 0,
        burnoutRisk: 'low',
        recommendations: []
      };
    }
  }

  /**
   * Calculate team productivity score
   */
  private calculateTeamProductivityScore(
    collaborationScore: number,
    contributorCount: number,
    ownership: Map<string, string[]>
  ): number {
    let score = 0;

    // Collaboration component (40%)
    score += (collaborationScore / 100) * 40;

    // Team size component (30%)
    const teamSizeScore = Math.min(30, contributorCount * 5);
    score += teamSizeScore;

    // Knowledge distribution component (30%)
    const avgContributorsPerFile = Array.from(ownership.values())
      .reduce((sum, contributors) => sum + contributors.length, 0) / ownership.size;
    const distributionScore = Math.min(30, avgContributorsPerFile * 10);
    score += distributionScore;

    return Math.min(100, score);
  }

  /**
   * Calculate team velocity
   */
  private async calculateTeamVelocity(_data: StoredMetrics): Promise<number> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');

      if (!gitExtension) {return 0;}

      const git = gitExtension.exports.getAPI(1);
      const repository = git.repositories[0];

      if (!repository) {return 0;}

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const commits = await this.getRecentCommits(repository, thirtyDaysAgo);

      return commits.length / 30; // Commits per day
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate workload distribution
   */
  private async calculateWorkloadDistribution(_data: StoredMetrics): Promise<number> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');

      if (!gitExtension) {return 100;}

      const git = gitExtension.exports.getAPI(1);
      const repository = git.repositories[0];

      if (!repository) {return 100;}

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const commits = await this.getRecentCommits(repository, thirtyDaysAgo);

      const authorCommitCounts = new Map<string, number>();
      commits.forEach(commit => {
        const author = commit.authorEmail;
        authorCommitCounts.set(author, (authorCommitCounts.get(author) || 0) + 1);
      });

      const commitCounts = Array.from(authorCommitCounts.values());
      const giniCoefficient = this.calculateGiniCoefficient(commitCounts);

      // Convert Gini to distribution score (lower Gini = better distribution)
      return Math.max(0, (1 - giniCoefficient) * 100);
    } catch (error) {
      return 100;
    }
  }

  /**
   * Assess burnout risk
   */
  private assessBurnoutRisk(
    teamVelocity: number,
    workloadDistribution: number,
    contributorCount: number
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // High velocity with few contributors = risk
    if (teamVelocity > 5 && contributorCount <= 2) {
      riskScore += 30;
    }

    // Poor workload distribution = risk
    if (workloadDistribution < 50) {
      riskScore += 25;
    }

    // Very high velocity = risk
    if (teamVelocity > 10) {
      riskScore += 20;
    }

    // Single contributor with high velocity = high risk
    if (contributorCount === 1 && teamVelocity > 3) {
      riskScore += 25;
    }

    if (riskScore >= 50) {return 'high';}
    if (riskScore >= 25) {return 'medium';}
    return 'low';
  }

  /**
   * Generate team recommendations
   */
  private generateTeamRecommendations(
    productivityScore: number,
    burnoutRisk: 'low' | 'medium' | 'high',
    workloadDistribution: number,
    contributorCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (productivityScore < 50) {
      recommendations.push('Consider implementing pair programming to improve collaboration');
      recommendations.push('Establish regular code review processes');
    }

    if (burnoutRisk === 'high') {
      recommendations.push('Monitor team workload and consider redistributing tasks');
      recommendations.push('Implement work-life balance policies');
    }

    if (workloadDistribution < 60) {
      recommendations.push('Balance workload distribution among team members');
      recommendations.push('Cross-train team members to reduce knowledge silos');
    }

    if (contributorCount === 1) {
      recommendations.push('Consider adding team members to reduce bus factor');
      recommendations.push('Document critical knowledge and processes');
    }

    if (contributorCount > 10) {
      recommendations.push('Consider breaking into smaller, focused teams');
      recommendations.push('Implement clear communication channels and processes');
    }

    return recommendations;
  }
}
