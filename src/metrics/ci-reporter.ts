/**
 * @file CI-REPORTER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * CI Reporter for Code Pulse
 * Generates detailed reports for code complexity metrics in CI-friendly formats.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import { ComplexityMetrics } from './complexity';

// ------------ INTERFACES
// CI Report Interface
interface CIReport {
  timestamp: string;
  metrics: {
    overall: {
      averageComplexity: number;
      totalFiles: number;
      highComplexityFiles: number;
    };
    details: Array<{
      file: string;
      metrics: ComplexityMetrics;
      status: 'pass' | 'warn' | 'fail';
    }>;
  };
}

// ------------ CLASS
/**
 * Handles reporting of code complexity metrics in CI-friendly formats
 */
export class CIReporter {
  /**
   * Complexity thresholds for report status determination
   */
  private static readonly COMPLEXITY_THRESHOLDS = {
    warn: 15,
    fail: 25
  };

  /**
   * Generates a CI-friendly report from collected metrics
   * @param fileMetrics - Collection of file metrics
   * @returns Structured CI report
   */
  public static generateReport(fileMetrics: Record<string, ComplexityMetrics>): CIReport {
    const details = Object.entries(fileMetrics).map(([file, metrics]) => ({
      file,
      metrics,
      status: this.getMetricStatus(metrics)
    }));

    const report: CIReport = {
      timestamp: new Date().toISOString(),
      metrics: {
        overall: {
          averageComplexity: this.calculateAverageComplexity(details),
          totalFiles: details.length,
          highComplexityFiles: details.filter(d => d.status === 'fail').length
        },
        details
      }
    };

    return report;
  }

  /**
   * Exports report to VS Code output channel
   * @param report - Generated complexity report
   */
  public static async exportReport(report: CIReport): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('Code Pulse CI Report');
    
    // Report header
    outputChannel.appendLine(`# Code Pulse Complexity Report`);
    outputChannel.appendLine(`Generated: ${report.timestamp}`);
    
    // Overall metrics section
    outputChannel.appendLine('\n## Overall Metrics');
    outputChannel.appendLine(`Average Complexity: ${report.metrics.overall.averageComplexity.toFixed(2)}`);
    outputChannel.appendLine(`Total Files: ${report.metrics.overall.totalFiles}`);
    outputChannel.appendLine(`High Complexity Files: ${report.metrics.overall.highComplexityFiles}`);
    
    // File details section
    outputChannel.appendLine('\n## File Details');
    report.metrics.details.forEach(detail => {
      outputChannel.appendLine(`\nFile: ${detail.file}`);
      outputChannel.appendLine(`Status: ${detail.status.toUpperCase()}`);
      const complexity = detail.metrics?.cyclomaticComplexity ?? 0;
      outputChannel.appendLine(`Complexity: ${complexity}`);

      // Optional cognitive complexity
      if (detail.metrics.cognitiveComplexity) {
        outputChannel.appendLine(`Cognitive Complexity: ${detail.metrics.cognitiveComplexity.score}`);
      }
    });

    outputChannel.show();
  }

  /**
   * Determines status based on complexity metrics and thresholds
   * @param metrics - Complexity metrics
   * @returns Status indication ('pass', 'warn', or 'fail')
   */
  private static getMetricStatus(metrics: ComplexityMetrics): 'pass' | 'warn' | 'fail' {
    const complexity = metrics?.cyclomaticComplexity ?? 0;

    if (complexity >= this.COMPLEXITY_THRESHOLDS.fail) {
      return 'fail';
    }

    if (complexity >= this.COMPLEXITY_THRESHOLDS.warn) {
      return 'warn';
    }

    return 'pass';
  }

  /**
   * Calculates average complexity across all files
   * @param details - File detail entries
   * @returns Average complexity value
   */
  private static calculateAverageComplexity(details: CIReport['metrics']['details']): number {
    if (details.length === 0) {
      return 0;
    }

    const sum = details.reduce((acc, detail) => acc + (detail.metrics?.cyclomaticComplexity ?? 0), 0);
    return sum / details.length;
  }
}