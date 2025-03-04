// src/metrics/tracker.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { CodeComplexityAnalyzer, ComplexityMetrics } from './complexity';
import { ConfigManager } from '../utils/config';
import { MetricsStorage } from './storage';

export interface FileMetadata {
  path: string;
  language: string;
  lines: number;
  complexity: ComplexityMetrics;
  lastModified: Date;
}

export class MetricsTracker {
  private context: vscode.ExtensionContext;
  private config: ConfigManager;
  private storage: MetricsStorage;
  private trackedFiles: Map<string, FileMetadata> = new Map();
  private sessionStartTime: number = Date.now();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.config = ConfigManager.getInstance();
    this.storage = new MetricsStorage(context);

    this.initializeTracking();
  }

  private initializeTracking() {
    // Track active text editor changes
    vscode.window.onDidChangeActiveTextEditor(this.handleEditorChange.bind(this));
    
    // Track file save events
    vscode.workspace.onDidSaveTextDocument(this.handleFileSave.bind(this));
  }

  private handleEditorChange(editor?: vscode.TextEditor) {
    if (!editor) return;
    
    const { document } = editor;
    this.analyzeDocument(document);
  }

  private handleFileSave(document: vscode.TextDocument) {
    if (this.shouldTrackDocument(document)) {
      this.analyzeDocument(document, true);
    }
  }

  private shouldTrackDocument(document: vscode.TextDocument): boolean {
    const config = this.config.getConfig();
    const fileExtension = path.extname(document.fileName).slice(1);
    
    return config.enableMetricTracking && 
           !config.excludedLanguages.includes(fileExtension);
  }

  private analyzeDocument(document: vscode.TextDocument, isSaved: boolean = false) {
    const filePath = document.fileName;
    const fileExtension = path.extname(filePath).slice(1);
    const content = document.getText();

    // Complexity analysis
    const complexity = CodeComplexityAnalyzer.analyzeComplexity(
      content, 
      fileExtension
    );

    const fileMetadata: FileMetadata = {
      path: filePath,
      language: fileExtension,
      lines: document.lineCount,
      complexity,
      lastModified: new Date()
    };

    // Store or update tracked file
    this.trackedFiles.set(filePath, fileMetadata);

    // Optional: Generate recommendations
    const recommendations = CodeComplexityAnalyzer.getComplexityRecommendations(complexity);
    
    if (isSaved && this.config.getConfig().enableDetailedLogging) {
      this.logComplexityInsights(fileMetadata, recommendations);
    }
  }

  private logComplexityInsights(
    file: FileMetadata, 
    recommendations: string[]
  ) {
    // Use VS Code's output channel for logging
    const channel = vscode.window.createOutputChannel('Productivity Insights');
    
    channel.appendLine(`📄 File Analysis: ${path.basename(file.path)}`);
    channel.appendLine(`Language: ${file.language}`);
    channel.appendLine(`Lines of Code: ${file.lines}`);
    channel.appendLine('Complexity Metrics:');
    channel.appendLine(`  - Cyclomatic Complexity: ${file.complexity.cyclomaticComplexity}`);
    channel.appendLine(`  - Maintainability Index: ${file.complexity.maintainabilityIndex.toFixed(2)}`);
    
    channel.appendLine('\n🔍 Recommendations:');
    recommendations.forEach(rec => channel.appendLine(`  • ${rec}`);
    
    channel.show(true);
  }

  /**
   * Persist metrics at regular intervals or on-demand
   */
  public persistMetrics() {
    const storedMetrics = this.storage.loadMetrics();
    
    // Update stored metrics with current tracked files
    const updatedFileMetrics = {
      ...storedMetrics.fileMetrics
    };

    this.trackedFiles.forEach((metadata, path) => {
      updatedFileMetrics[path] = metadata;
    });

    this.storage.saveMetrics({
      ...storedMetrics,
      fileMetrics: updatedFileMetrics
    });
  }

  /**
   * Get comprehensive session insights
   */
  public getSessionInsights() {
    const sessionDuration = (Date.now() - this.sessionStartTime) / 60000; // minutes
    const languageBreakdown = this.getLanguageBreakdown();

    return {
      duration: sessionDuration,
      filesTracked: this.trackedFiles.size,
      languageBreakdown,
      averageComplexity: this.calculateAverageComplexity()
    };
  }

  private getLanguageBreakdown() {
    const breakdown: Record<string, number> = {};
    
    this.trackedFiles.forEach(file => {
      breakdown[file.language] = (breakdown[file.language] || 0) + 1;
    });

    return breakdown;
  }

  private calculateAverageComplexity() {
    const complexities = Array.from(this.trackedFiles.values())
      .map(file => file.complexity.cyclomaticComplexity);
    
    return complexities.length 
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length
      : 0;
  }
}