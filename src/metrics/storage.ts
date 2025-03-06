// src/metrics/storage.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ComplexityMetrics } from './complexity'; // Add this import

export interface CodeMetrics {
  path: string;
  language: string;
  lines: number;
  complexity: ComplexityMetrics;
  lastModified: Date;
}

export interface DailyMetrics {
  date: string;
  totalCodingTime: number;
  filesEdited: number;
  languages: Record<string, number>;
}

export interface StoredMetrics {
  dailyMetrics: DailyMetrics[];
  fileMetrics: Record<string, CodeMetrics>;
}

export class MetricsStorage {
  private context: vscode.ExtensionContext;
  private storagePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.storagePath = path.join(context.storageUri?.fsPath || '', 'metrics.json');
  }

  public saveMetrics(metrics: StoredMetrics) {
    try {
      fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(metrics, null, 2));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save metrics: ${error instanceof Error ? error.message : error}`);
    }
  }

  public loadMetrics(): StoredMetrics {
    try {
      if (fs.existsSync(this.storagePath)) {
        const rawData = fs.readFileSync(this.storagePath, 'utf8');
        return JSON.parse(rawData);
      }
    } catch (error) {
      vscode.window.showWarningMessage(`Failed to load metrics: ${error instanceof Error ? error.message : error}`);
    }

    // Return default structure if no existing data
    return {
      dailyMetrics: [],
      fileMetrics: {}
    };
  }

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