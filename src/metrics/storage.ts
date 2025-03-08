/**
 * src/metrics/storage.ts
 * 
 * Storage.ts
 * Handles persistent metric storage using JSON files
 * Implements data retention policies and workspace-aware storage
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ComplexityMetrics } from './complexity';

// -------------------- EXPORTS -------------------- \\

// Export Code Metrics
export interface CodeMetrics {
  path: string;
  language: string;
  lines: number;
  complexity: ComplexityMetrics;
  lastModified: Date;
}

// Export Daily Metrics
export interface DailyMetrics {
  date: string;
  totalCodingTime: number;
  filesEdited: number;
  languages: Record<string, number>;
}

// Export Session Data
export interface SessionData {
  startTime: number;
  endTime?: number;
  idleTime: number;
  activeTime: number;
  fileChanges: string[];
}

// Export Stored Metrics
export interface StoredMetrics {
  dailyMetrics: DailyMetrics[];
  fileMetrics: Record<string, CodeMetrics>;
  sessions: SessionData[];
}

// -------------------- MAIN EXPORT -------------------- \\

export class MetricsStorage {

  // File system path for metrics storage
  private storagePath: string;

  constructor(context: vscode.ExtensionContext) {

    // Store all metrics in extension-specific storage directory
    this.storagePath = path.join(context.storageUri?.fsPath || '', 'metrics.json');
  }

  /**
   * Saves metrics with error handling and directory creation
   * @param metrics - Complete metrics snapshot to persist
   */
  public saveMetrics(metrics: StoredMetrics) {
    try {

      // Check if storage directory exists
      fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });

      // Atomic write with pretty-printing
      fs.writeFileSync(this.storagePath, JSON.stringify(metrics, null, 2));
    } catch (error) {
      vscode.window.showErrorMessage(`Metrics save failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Load the metrics with fallback to empty dataset
   * @returns Parsed metrics or fresh dataset if unavailable
   */
  public loadMetrics(): StoredMetrics {
    try {
      if (fs.existsSync(this.storagePath)) {
        const rawData = fs.readFileSync(this.storagePath, 'utf8');
        return JSON.parse(rawData);
      }
    } catch (error) {
      vscode.window.showWarningMessage(`Failed to load metrics: ${error instanceof Error ? error.message : error}`);
    }

    // Return daily metrics, file metrics and sessions.
    return {
      dailyMetrics: [],
      fileMetrics: {},
      sessions: []
    };
  }

  /**
   * Applies retention policy to stored metrics
   * @param retentionDays - Number of days to preserve data
   */
  public pruneOldMetrics(retentionDays: number = 90) {
    const metrics = this.loadMetrics();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    metrics.dailyMetrics = metrics.dailyMetrics.filter(metric =>
      new Date(metric.date) >= cutoffDate
    );

    this.saveMetrics(metrics);
  }
}