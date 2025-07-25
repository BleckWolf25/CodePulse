/**
 * @file STORAGE.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Metrics Storage for Code Pulse
 * Handles persistent metric storage using JSON files with data retention policies,
 * workspace-aware storage, and automatic data validation and migration capabilities.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ComplexityMetrics } from './complexity';

// ------------ INTERFACES
/**
 * Code metrics data structure for individual files
 */
export interface CodeMetrics {
  path: string;
  language: string;
  lines: number;
  complexity: ComplexityMetrics;
  lastModified: Date;
}

/**
 * Daily aggregated metrics for productivity tracking
 */
export interface DailyMetrics {
  date: string;
  totalCodingTime: number;
  filesEdited: number;
  languages: Record<string, number>;
}

/**
 * Individual coding session data for time tracking
 */
export interface SessionData {
  startTime: number;
  endTime?: number;
  idleTime: number;
  activeTime: number;
  fileChanges: string[];
}

/**
 * Complete stored metrics structure containing all persistent data
 */
export interface StoredMetrics {
  dailyMetrics: DailyMetrics[];
  fileMetrics: Record<string, CodeMetrics>;
  sessions: SessionData[];
}

// ------------ CLASS
/**
 * Handles persistent metric storage using JSON files with data retention and validation
 */
export class MetricsStorage {
  /**
   * File system path for metrics storage
   */
  private storagePath: string;

  /**
   * Creates a new MetricsStorage instance with workspace-aware storage path
   * @param context VS Code extension context for storage path resolution
   */
  constructor(context: vscode.ExtensionContext) {
    // Store all metrics in extension-specific storage directory
    // Use globalStorageUri as fallback if storageUri is not available
    const storageDir = context.storageUri?.fsPath ||
                      context.globalStorageUri?.fsPath ||
                      path.join(require('os').homedir(), '.vscode', 'code-pulse');

    this.storagePath = path.join(storageDir, 'metrics.json');
  }

  /**
   * Saves metrics with error handling and directory creation
   * @param metrics Complete metrics snapshot to persist
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
        const parsedData = JSON.parse(rawData);
        return this.validateAndMigrateData(parsedData);
      }
    } catch (error) {
      vscode.window.showWarningMessage(`Failed to load metrics: ${error instanceof Error ? error.message : error}`);
    }

    // Return daily metrics, file metrics and sessions
    return {
      dailyMetrics: [],
      fileMetrics: {},
      sessions: []
    };
  }

  /**
   * Applies retention policy to stored metrics
   * @param retentionDays Number of days to preserve data
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

  /**
   * Validates and migrates loaded data to ensure compatibility
   * @param data Raw data loaded from storage
   * @returns Validated and migrated data structure
   * @private
   */
  private validateAndMigrateData(data: any): StoredMetrics {
    // Ensure basic structure exists
    const result: StoredMetrics = {
      dailyMetrics: Array.isArray(data.dailyMetrics) ? data.dailyMetrics : [],
      fileMetrics: data.fileMetrics && typeof data.fileMetrics === 'object' ? {} : {},
      sessions: Array.isArray(data.sessions) ? data.sessions : []
    };

    // Validate and fix file metrics
    if (data.fileMetrics && typeof data.fileMetrics === 'object') {
      Object.entries(data.fileMetrics).forEach(([path, fileData]: [string, any]) => {
        if (this.isValidFileMetadata(fileData)) {
          result.fileMetrics[path] = fileData;
        } else {
          // Try to repair the file metadata
          const repairedData = this.repairFileMetadata(fileData);
          if (repairedData) {
            result.fileMetrics[path] = repairedData;
          }
          // If repair fails, the entry is simply omitted
        }
      });
    }

    return result;
  }

  /**
   * Validates file metadata structure
   * @param metadata File metadata to validate
   * @returns True if metadata is valid
   * @private
   */
  private isValidFileMetadata(metadata: any): metadata is CodeMetrics {
    return metadata &&
           typeof metadata === 'object' &&
           typeof metadata.path === 'string' &&
           typeof metadata.language === 'string' &&
           typeof metadata.lines === 'number' &&
           metadata.complexity &&
           typeof metadata.complexity === 'object' &&
           typeof metadata.complexity.cyclomaticComplexity === 'number' &&
           typeof metadata.complexity.maintainabilityIndex === 'number' &&
           metadata.complexity.halsteadMetrics &&
           typeof metadata.complexity.halsteadMetrics.difficulty === 'number';
  }

  /**
   * Attempts to repair corrupted file metadata
   * @param metadata Potentially corrupted metadata
   * @returns Repaired metadata or null if unrepairable
   * @private
   */
  private repairFileMetadata(metadata: any): CodeMetrics | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    // Try to extract basic properties
    const path = typeof metadata.path === 'string' ? metadata.path : null;
    const language = typeof metadata.language === 'string' ? metadata.language : 'unknown';
    const lines = typeof metadata.lines === 'number' ? metadata.lines : 1;

    if (!path) {
      return null; // Can't repair without a valid path
    }

    // Create default complexity if missing or corrupted
    const complexity: ComplexityMetrics = {
      totalComplexity: 1,
      cyclomaticComplexity: 1,
      maintainabilityIndex: 100,
      halsteadMetrics: {
        difficulty: 1,
        volume: 1,
        effort: 1
      }
    };

    // Try to preserve existing complexity data if partially valid
    if (metadata.complexity && typeof metadata.complexity === 'object') {
      if (typeof metadata.complexity.cyclomaticComplexity === 'number') {
        complexity.cyclomaticComplexity = metadata.complexity.cyclomaticComplexity;
        complexity.totalComplexity = metadata.complexity.cyclomaticComplexity;
      }
      if (typeof metadata.complexity.maintainabilityIndex === 'number') {
        complexity.maintainabilityIndex = metadata.complexity.maintainabilityIndex;
      }
      if (metadata.complexity.halsteadMetrics && typeof metadata.complexity.halsteadMetrics === 'object') {
        if (typeof metadata.complexity.halsteadMetrics.difficulty === 'number') {
          complexity.halsteadMetrics.difficulty = metadata.complexity.halsteadMetrics.difficulty;
        }
        if (typeof metadata.complexity.halsteadMetrics.volume === 'number') {
          complexity.halsteadMetrics.volume = metadata.complexity.halsteadMetrics.volume;
        }
        if (typeof metadata.complexity.halsteadMetrics.effort === 'number') {
          complexity.halsteadMetrics.effort = metadata.complexity.halsteadMetrics.effort;
        }
      }
    }

    return {
      path,
      language,
      lines,
      complexity,
      lastModified: metadata.lastModified ? new Date(metadata.lastModified) : new Date()
    };
  }
}