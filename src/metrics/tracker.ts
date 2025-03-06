// src/metrics/tracker.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { CodeComplexityAnalyzer, ComplexityMetrics } from './complexity';
import { ConfigManager } from '../utils/config';
import { MetricsStorage } from './storage';
import { performance } from 'perf_hooks';
import { MetricCache } from '../utils/cache';

export interface FileMetadata {
  path: string;
  language: string;
  lines: number;
  complexity: ComplexityMetrics;
  lastModified: Date;
}

export interface SessionData {
  startTime: number;
  endTime?: number;
  idleTime: number;
  activeTime: number;
  fileChanges: string[];
}

export class MetricsTracker {
  private context: vscode.ExtensionContext;
  private config: ConfigManager;
  private storage: MetricsStorage;
  private trackedFiles = new MetricCache<FileMetadata>();
  private outputChannel: vscode.OutputChannel | null = null;

  // Session tracking properties
  private sessionsLog: SessionData[] = [];
  private lastActivityTime: number = Date.now();
  private idleThreshold: number = 5 * 60 * 1000; // 5 minutes
  
  // Debounce handling
  private analysisQueue: Set<string> = new Set();
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 500; // ms

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.config = ConfigManager.getInstance();
    this.storage = new MetricsStorage(context);
    
    // Restore data from storage
    this.loadPersistedData();
    
    // Initialize first session
    this.startSession();
    
    // Set up event listeners
    this.initializeTracking();
  }

  private initializeTracking() {
    // Track active text editor changes
    vscode.window.onDidChangeActiveTextEditor(this.handleEditorChange.bind(this));
    
    // Track document changes (more efficient than tracking each keystroke)
    vscode.workspace.onDidChangeTextDocument(this.handleDocumentChange.bind(this));
    
    // Track file save events
    vscode.workspace.onDidSaveTextDocument(this.handleFileSave.bind(this));

    // Check for idle every minute
    setInterval(() => this.checkIdleTime(), 60 * 1000);
  }

  private loadPersistedData() {
    try {
      const storedMetrics = this.storage.loadMetrics();
      
      // Restore tracked files data to cache
      Object.entries(storedMetrics.fileMetrics).forEach(([filePath, metadata]) => {
        // Only cache files that still exist and are in the workspace
        if (vscode.workspace.workspaceFolders) {
          const workspacePaths = vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
          const fileStillInWorkspace = workspacePaths.some(wsPath => filePath.startsWith(wsPath));
          
          if (fileStillInWorkspace) {
            this.trackedFiles.set(filePath, metadata);
          }
        }
      });
    } catch (error) {
      console.error('Failed to load persisted metrics:', error);
    }
  }

  private handleEditorChange(editor?: vscode.TextEditor) {
    if (!editor || !this.shouldTrackDocument(editor.document)) {
      return;
    }
    
    this.trackFileChange(editor.document.fileName);
  }

  private handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
    if (!this.shouldTrackDocument(event.document)) {
      return;
    }

    // Add to debounced analysis queue
    this.analysisQueue.add(event.document.fileName);
    
    // Debounce the analysis to prevent excessive processing
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    this.debounceTimeout = setTimeout(() => {
      this.processAnalysisQueue();
    }, this.DEBOUNCE_DELAY);
    
    this.trackFileChange(event.document.fileName);
  }

  private processAnalysisQueue() {
    this.analysisQueue.forEach(async (fileName) => {
      try {
        const document = await vscode.workspace.openTextDocument(fileName);
        this.analyzeDocument(document, false); // Light analysis
      } catch (error) {
        // File might have been deleted or moved
        this.analysisQueue.delete(fileName);
      }
    });
    
    this.analysisQueue.clear();
  }

  private handleFileSave(document: vscode.TextDocument) {
    if (this.shouldTrackDocument(document)) {
      this.analyzeDocument(document, true); // Full analysis on save
      this.trackFileChange(document.fileName);
    }
  }

  private shouldTrackDocument(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== 'file' || !document.fileName) {
      return false;
    }
    
    const config = this.config.getConfig();
    if (!config.enableMetricTracking) {
      return false;
    }
    
    const fileExtension = path.extname(document.fileName).slice(1).toLowerCase();
    return !config.excludedLanguages.includes(fileExtension);
  }

  // Session management methods
  private startSession() {
    this.sessionsLog.push({
      startTime: performance.now(),
      idleTime: 0,
      activeTime: 0,
      fileChanges: []
    });
  }

  private trackFileChange(filePath: string) {
    const currentSession = this.sessionsLog[this.sessionsLog.length - 1];
    if (!currentSession.fileChanges.includes(filePath)) {
      currentSession.fileChanges.push(filePath);
    }
    this.lastActivityTime = Date.now();
  }

  private checkIdleTime() {
    const currentTime = Date.now();
    const idleDuration = currentTime - this.lastActivityTime;

    if (idleDuration > this.idleThreshold) {
      const currentSession = this.sessionsLog[this.sessionsLog.length - 1];
      currentSession.idleTime += idleDuration;
      this.lastActivityTime = currentTime; // Prevent duplicate counting
    }
  }

  // File complexity analysis
  private analyzeDocument(document: vscode.TextDocument, isSaved: boolean = false) {
    try {
      const filePath = document.fileName;
      
      // Skip if we're doing a light analysis and we already have this file cached
      if (!isSaved && this.trackedFiles.get(filePath)) {
        return;
      }

      const fileExtension = path.extname(filePath).slice(1).toLowerCase();
      const content = document.getText();

      // Only do full complexity analysis on save or for small files
      let complexity: ComplexityMetrics;
      if (isSaved || content.length < 50000) {
        complexity = CodeComplexityAnalyzer.analyzeComplexity(content, fileExtension);
      } else {
        // For large files during typing, use a simpler analysis
        complexity = CodeComplexityAnalyzer.quickAnalyze(content, fileExtension);
      }

      const fileMetadata: FileMetadata = {
        path: filePath,
        language: fileExtension,
        lines: document.lineCount,
        complexity,
        lastModified: new Date()
      };

      // Update cache
      this.trackedFiles.set(filePath, fileMetadata);

      // Only show insights on save if enabled
      if (isSaved && this.config.getConfig().enableDetailedLogging) {
        const recommendations = CodeComplexityAnalyzer.getComplexityRecommendations(complexity);
        this.logComplexityInsights(fileMetadata, recommendations);
      }
    } catch (error) {
      console.error(`Error analyzing document: ${document.fileName}`, error);
    }
  }

  // Log Complexity Insights
  private logComplexityInsights(file: FileMetadata, recommendations: string[]) {
    try {
      if (!this.outputChannel) {
        this.outputChannel = vscode.window.createOutputChannel('Code Pulse Insights');
      }
      
      const channel = this.outputChannel;
      channel.clear();
      channel.appendLine(`📄 File Analysis: ${path.basename(file.path)}`);
      channel.appendLine(`Language: ${file.language}`);
      channel.appendLine(`Lines of Code: ${file.lines}`);
      channel.appendLine('Complexity Metrics:');
      channel.appendLine(`  - Cyclomatic Complexity: ${file.complexity.cyclomaticComplexity}`);
      channel.appendLine(`  - Maintainability Index: ${file.complexity.maintainabilityIndex.toFixed(2)}`);
      channel.appendLine('\n🔍 Recommendations:');
      recommendations.forEach(rec => channel.appendLine(`  • ${rec}`));
      channel.show(true);
    } catch (error) {
      console.error('Error showing complexity insights:', error);
    }
  }

  // Persist metrics to storage
  public persistMetrics() {
    try {
      const storedMetrics = this.storage.loadMetrics();
      const updatedFileMetrics = { ...storedMetrics.fileMetrics };
      
      this.trackedFiles.forEach((metadata, path) => {
        updatedFileMetrics[path] = metadata;
      });
      
      // Update daily metrics
      const today = new Date().toISOString().split('T')[0];
      const sessionInsights = this.getSessionInsights();
      
      let todayMetrics = storedMetrics.dailyMetrics.find(m => m.date === today);
      if (!todayMetrics) {
        todayMetrics = {
          date: today,
          totalCodingTime: sessionInsights.activeTime,
          filesEdited: sessionInsights.fileChanges,
          languages: sessionInsights.languageBreakdown
        };
        storedMetrics.dailyMetrics.push(todayMetrics);
      } else {
        // Update existing metrics
        todayMetrics.totalCodingTime += sessionInsights.activeTime;
        todayMetrics.filesEdited = Math.max(todayMetrics.filesEdited, sessionInsights.fileChanges);
        
        // Merge language data
        Object.entries(sessionInsights.languageBreakdown).forEach(([lang, count]) => {
          todayMetrics!.languages[lang] = (todayMetrics!.languages[lang] || 0) + count;
        });
      }
      
      this.storage.saveMetrics({ 
        dailyMetrics: storedMetrics.dailyMetrics, 
        fileMetrics: updatedFileMetrics 
      });
      
      // Reset session after persisting
      this.startSession();
    } catch (error) {
      console.error('Error persisting metrics:', error);
    }
  }

  // Session insights with activity data
  public getSessionInsights() {
    try {
      const currentSession = this.sessionsLog[this.sessionsLog.length - 1];
      const totalDuration = (performance.now() - currentSession.startTime) / 60000;
      const activeDuration = Math.max(0, (totalDuration * 60000 - currentSession.idleTime) / 60000);

      return {
        duration: Math.round(totalDuration * 10) / 10,
        activeTime: Math.round(activeDuration * 10) / 10,
        idleTime: Math.round((currentSession.idleTime / 60000) * 10) / 10,
        filesTracked: this.trackedFiles.size,
        fileChanges: currentSession.fileChanges.length,
        languageBreakdown: this.getLanguageBreakdown(),
        averageComplexity: this.calculateAverageComplexity()
      };
    } catch (error) {
      console.error('Error calculating session insights:', error);
      return {
        duration: 0,
        activeTime: 0,
        idleTime: 0,
        filesTracked: 0,
        fileChanges: 0,
        languageBreakdown: {},
        averageComplexity: 0
      };
    }
  }

  private getLanguageBreakdown() {
    const breakdown: Record<string, number> = {};
    this.trackedFiles.forEach((file: FileMetadata) => {
      breakdown[file.language] = (breakdown[file.language] || 0) + 1;
    });
    return breakdown;
  }

  private calculateAverageComplexity() {
    const complexities: number[] = [];
    this.trackedFiles.forEach((file: FileMetadata) => {
      complexities.push(file.complexity.cyclomaticComplexity);
    });
    
    if (complexities.length === 0) {
      return 0;
    }
    
    // Filter out outliers (values more than 2 standard deviations from mean)
    const mean = complexities.reduce((sum, val) => sum + val, 0) / complexities.length;
    const variance = complexities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / complexities.length;
    const stdDev = Math.sqrt(variance);
    const threshold = stdDev * 2;
    
    const filteredComplexities = complexities.filter(val => 
      Math.abs(val - mean) <= threshold
    );
    
    return filteredComplexities.length 
      ? filteredComplexities.reduce((a, b) => a + b, 0) / filteredComplexities.length
      : mean;
  }
}