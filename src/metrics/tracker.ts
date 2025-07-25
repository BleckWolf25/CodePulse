/**
 * @file TRACKER.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Metrics Tracker for Code Pulse
 * Comprehensive file analysis pipeline with session tracking, event debouncing, and storage integration.
 * Provides real-time complexity analysis, productivity insights, and performance monitoring.
 */

// ------------ IMPORTS
import * as vscode from 'vscode';
import * as path from 'path';
import { CodeComplexityAnalyzer, ComplexityMetrics } from './complexity';
import { ConfigManager } from '../utils/config-manager';
import { MetricsStorage } from './storage';
import { performance } from 'perf_hooks';
import { MetricCache } from '../utils/cache';
import { MetricsChartGenerator } from '../views/charts';

// ------------ INTERFACES
/**
 * File metadata structure for tracking analyzed files
 */
export interface FileMetadata {
  path: string;
  language: string;
  lines: number;
  complexity: ComplexityMetrics;
  lastModified: Date;
}

/**
 * Session data structure for tracking coding sessions
 */
export interface SessionData {
  startTime: number;
  endTime?: number;
  idleTime: number;
  activeTime: number;
  fileChanges: string[];
}

/**
 * File history structure for tracking complexity changes over time
 */
export interface FileHistory {
  timestamp: number;
  metrics: ComplexityMetrics;
}

// ------------ CLASS
/**
 * Comprehensive metrics tracking system for code analysis and productivity monitoring
 */
export class MetricsTracker {
  /**
   * VS Code extension context for storage and resources
   */
  private context: vscode.ExtensionContext;

  /**
   * Configuration manager instance
   */
  private config: ConfigManager;

  /**
   * Metrics storage handler
   */
  private storage: MetricsStorage;

  /**
   * Chart generator for dashboard visualization
   */
  private chartGenerator: MetricsChartGenerator;

  /**
   * Cache for tracked file metadata
   */
  private trackedFiles = new MetricCache<FileMetadata>();

  /**
   * Output channel for complexity insights
   */
  private outputChannel: vscode.OutputChannel | null = null;

  /**
   * Collection of disposable event listeners
   */
  private disposables: vscode.Disposable[] = [];

  /**
   * Historical complexity data for files
   */
  private fileHistory: Map<string, FileHistory[]> = new Map();

  /**
   * Session tracking data
   */
  private sessionsLog: SessionData[] = [];
  private lastActivityTime: number = Date.now();
  private idleThreshold: number = 5 * 60 * 1000;
  private analysisQueue: Set<string> = new Set();
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 500;

  /**
   * Performance monitoring metrics
   */
  private performanceMetrics: {
    analysisTime: number[];
    memoryUsage: number[];
    timestamp: number[];
  } = {
    analysisTime: [],
    memoryUsage: [],
    timestamp: []
  };

  /**
   * Initializes tracking system and restores previous state
   * This constructor sets up the metrics tracker by:
   * 1. Loading persisted data from storage
   * 2. Starting a new session
   * 3. Initializing event listeners for tracking file changes and user activity
   * @param context Extension context for storage and resources
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.config = ConfigManager.getInstance();
    this.storage = new MetricsStorage(context);
    this.chartGenerator = new MetricsChartGenerator(context);

    // Start session immediately to avoid blocking activation
    this.startSession();
    this.initializeTracking();

    // Load persisted data asynchronously to avoid blocking activation
    setTimeout(() => this.loadPersistedData(), 100);
  }

  /**
   * Initialize tracking event listeners for file changes and user activity
   * Monitors VS Code window events, document changes, and file saves
   * @private
   */
  private initializeTracking() {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(this.handleEditorChange.bind(this)),
      vscode.workspace.onDidChangeTextDocument(this.handleDocumentChange.bind(this)),
      vscode.workspace.onDidSaveTextDocument(this.handleFileSave.bind(this))
    );

    // Check idle time
    setInterval(() => this.checkIdleTime(), 60 * 1000);
  }

  /**
   * Load persisted data from storage and validate file metadata
   * @private
   */
  private loadPersistedData() {
    try {
      const storedMetrics = this.storage.loadMetrics();
      Object.entries(storedMetrics.fileMetrics).forEach(([path, metadata]) => {
        if (this.isFileInWorkspace(path) && this.isValidFileMetadata(metadata)) {
          this.trackedFiles.set(path, metadata);
        }
      });

      // Clean up any corrupted entries that might have been loaded
      this.clearCorruptedEntries();
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  }

  /**
   * Validate file metadata structure for data integrity
   * @param metadata Metadata object to validate
   * @returns True if metadata is valid
   * @private
   */
  private isValidFileMetadata(metadata: any): metadata is FileMetadata {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    // Check basic properties
    if (typeof metadata.path !== 'string' ||
        typeof metadata.language !== 'string' ||
        typeof metadata.lines !== 'number') {
      return false;
    }

    // Check complexity object
    if (!metadata.complexity ||
        typeof metadata.complexity !== 'object' ||
        typeof metadata.complexity.cyclomaticComplexity !== 'number') {
      return false;
    }

    // Convert lastModified to Date if it's a string
    if (typeof metadata.lastModified === 'string') {
      metadata.lastModified = new Date(metadata.lastModified);
    }

    // Check if lastModified is a valid Date
    if (!(metadata.lastModified instanceof Date) || isNaN(metadata.lastModified.getTime())) {
      metadata.lastModified = new Date(); // Fallback to current date
    }

    return true;
  }

  /**
   * Helper function that determines if the file/folder still exists in workspace
   * @param filePath Path to check for workspace membership
   * @returns True if file is in current workspace
   * @private
   */
  private isFileInWorkspace(filePath: string): boolean {
    return !!vscode.workspace.workspaceFolders?.some(folder =>
      filePath.startsWith(folder.uri.fsPath)
    );
  }

  /**
   * Show productivity dashboard with charts and insights
   */
  public showProductivityDashboard(): void {
    this.generateDailyReport();

    const panel = vscode.window.createWebviewPanel(
      'productivityDashboard',
      'Productivity Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    panel.webview.html = this.chartGenerator.generateDashboardHTML();
  }

  /**
   * Generate daily report and update stored metrics
   * @private
   */
  private generateDailyReport(): void {
    const today = new Date().toISOString().split('T')[0];
    const sessionInsights = this.getSessionInsights();

    const storedMetrics = this.storage.loadMetrics();
    let todayMetrics = storedMetrics.dailyMetrics.find(m => m.date === today);

    if (!todayMetrics) {
      storedMetrics.dailyMetrics.push({
        date: today,
        totalCodingTime: sessionInsights.activeTime,
        filesEdited: sessionInsights.filesTracked,
        languages: sessionInsights.languageBreakdown
      });
    } else {
      todayMetrics.totalCodingTime += sessionInsights.activeTime;
      todayMetrics.filesEdited = Math.max(todayMetrics.filesEdited, sessionInsights.filesTracked);
      Object.entries(sessionInsights.languageBreakdown).forEach(([lang, count]) => {
        todayMetrics!.languages[lang] = (todayMetrics!.languages[lang] || 0) + count;
      });
    }

    this.storage.saveMetrics(storedMetrics);
    this.startSession();
  }

  /**
   * Handle editor change events for file tracking
   * @param editor Optional text editor instance
   * @private
   */
  private handleEditorChange(editor?: vscode.TextEditor) {
    if (!editor || !this.shouldTrackDocument(editor.document)) {
      return;
    }

    this.trackFileChange(editor.document.fileName);
  }

  /**
   * Handles document change events with debounced analysis
   * @param event VSCode document change event
   * @private
   */
  private handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
    if (!this.shouldTrackDocument(event.document)) {
      return;
    }

    // Debounced analysis queue
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

  /**
   * Processes queued files for analysis
   * Implements parallel-safe processing with error handling
   * @private
   */
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

  /**
   * Handle file save events for full complexity analysis
   * @param document Text document that was saved
   * @private
   */
  private handleFileSave(document: vscode.TextDocument) {
    if (this.shouldTrackDocument(document)) {
      this.analyzeDocument(document, true); // Full analysis on save
      this.trackFileChange(document.fileName);
    }
  }

  /**
   * Determine if a document should be tracked based on configuration
   * @param document Text document to evaluate
   * @returns True if document should be tracked
   * @private
   */
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

  /**
   * Start a new coding session for tracking
   * @private
   */
  private startSession() {
    this.sessionsLog.push({
      startTime: performance.now(),
      idleTime: 0,
      activeTime: 0,
      fileChanges: []
    });
  }

  /**
   * Track file changes and update session data
   * @param filePath Path of the changed file
   * @private
   */
  private trackFileChange(filePath: string) {
    const currentSession = this.sessionsLog[this.sessionsLog.length - 1];
    if (!currentSession.fileChanges.includes(filePath)) {
      currentSession.fileChanges.push(filePath);
    }
    this.lastActivityTime = Date.now();
  }

  /**
   * Check for idle time and update session metrics
   * @private
   */
  private checkIdleTime() {
    const currentTime = Date.now();
    const idleDuration = currentTime - this.lastActivityTime;

    if (idleDuration > this.idleThreshold) {
      const currentSession = this.sessionsLog[this.sessionsLog.length - 1];
      currentSession.idleTime += idleDuration;
      this.lastActivityTime = currentTime; // Prevent duplicate counting
    }
  }

  /**
   * Performs complexity analysis with mode selection
   * @param document Document to analyze
   * @param isSaved Flag for full vs light analysis
   * @private
   */
  private async analyzeDocument(document: vscode.TextDocument, isSaved: boolean = false) {
    const startTime = performance.now();
    try {
      const filePath = document.fileName;

      // Skip if we're doing a light analysis and we already have this file cached
      if (!isSaved && await this.trackedFiles.get(filePath)) {
        return;
      }

      const fileExtension = path.extname(filePath).slice(1).toLowerCase();
      const content = document.getText();

      // Only do full complexity analysis on save or for small files
      let complexity: ComplexityMetrics;
      try {
        if (isSaved || content.length < 50000) {
          complexity = await CodeComplexityAnalyzer.analyzeComplexity(content, fileExtension);
        } else {
          // For large files during typing, use a simpler analysis
          complexity = CodeComplexityAnalyzer.quickAnalyze(content, fileExtension);
        }

        // Ensure complexity object has required properties
        if (!complexity || typeof complexity.cyclomaticComplexity !== 'number') {
          complexity = this.getDefaultComplexityMetrics();
        }
      } catch (error) {
        console.warn(`Failed to analyze complexity for ${filePath}:`, error);
        complexity = this.getDefaultComplexityMetrics();
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

      // Update file history
      this.updateMetrics(filePath, complexity);

      // Only show insights on save if enabled
      if (isSaved && this.config.getConfig().enableDetailedLogging) {
        const recommendations = CodeComplexityAnalyzer.getComplexityRecommendations(complexity);
        this.logComplexityInsights(fileMetadata, recommendations);
      }
    } catch (error) {
      console.error(`Error analyzing document: ${document.fileName}`, error);
    } finally {
      this.recordPerformanceMetrics('documentAnalysis', performance.now() - startTime);
    }
  }

  /**
   * Get historical complexity data for a specific file
   * @param filePath Path of the file to get history for
   * @returns Array of historical complexity data points
   */
  public getFileHistory(filePath: string): FileHistory[] {
    return this.fileHistory.get(filePath) || [];
  }

  /**
   * Update metrics history for a specific file
   * @param filePath Path of the file to update
   * @param metrics Complexity metrics to add to history
   */
  public updateMetrics(filePath: string, metrics: ComplexityMetrics): void {
    const history = this.getFileHistory(filePath);
    history.push({
      timestamp: Date.now(),
      metrics
    });
    this.fileHistory.set(filePath, history);
  }

  /**
   * Record performance metrics for analysis operations
   * @param _operation Operation name (currently unused)
   * @param duration Duration of the operation in milliseconds
   * @private
   */
  private recordPerformanceMetrics(_operation: string, duration: number) {
    this.performanceMetrics.analysisTime.push(duration);
    this.performanceMetrics.memoryUsage.push(process.memoryUsage().heapUsed);
    this.performanceMetrics.timestamp.push(Date.now());

    // Trim old metrics
    if (this.performanceMetrics.analysisTime.length > 1000) {
      this.performanceMetrics.analysisTime.shift();
      this.performanceMetrics.memoryUsage.shift();
      this.performanceMetrics.timestamp.shift();
    }
  }

  /**
   * Get default complexity metrics for fallback scenarios
   * @returns Default complexity metrics object
   * @private
   */
  private getDefaultComplexityMetrics(): ComplexityMetrics {
    return {
      totalComplexity: 1,
      cyclomaticComplexity: 1,
      maintainabilityIndex: 100,
      halsteadMetrics: {
        difficulty: 1,
        volume: 1,
        effort: 1
      }
    };
  }

  /**
   * Log complexity insights to VS Code output channel
   * @param file File metadata with complexity information
   * @param recommendations Array of improvement recommendations
   * @private
   */
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

  /**
   * Persist metrics to storage with daily aggregation
   */
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
        fileMetrics: updatedFileMetrics,
        sessions: []
      });

      // Reset session after persisting
      this.startSession();
    } catch (error) {
      console.error('Error persisting metrics:', error);
    }
  }

  /**
   * Get stored metrics for dashboard
   * @returns Stored metrics from storage
   */
  public getStoredMetrics() {
    return this.storage.loadMetrics();
  }

  /**
   * Calculates session insights with outlier filtering
   * @returns Current session metrics with statistical normalization
   */
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

  /**
   * Get breakdown of tracked files by programming language
   * @returns Object mapping languages to file counts
   * @private
   */
  private getLanguageBreakdown() {
    const breakdown: Record<string, number> = {};
    this.trackedFiles.forEach((file: FileMetadata) => {
      breakdown[file.language] = (breakdown[file.language] || 0) + 1;
    });
    return breakdown;
  }

  /**
   * Calculate average complexity across all tracked files with outlier filtering
   * @returns Average complexity value
   * @private
   */
  private calculateAverageComplexity() {
    const complexities: number[] = [];
    this.trackedFiles.forEach((file: FileMetadata) => {
      // Add null checks to prevent runtime errors
      if (file && file.complexity && typeof file.complexity.cyclomaticComplexity === 'number') {
        complexities.push(file.complexity.cyclomaticComplexity);
      }
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

  /**
   * Clear corrupted cache entries and rebuild with valid data
   */
  public clearCorruptedEntries() {
    const validEntries: Array<{path: string, metadata: FileMetadata}> = [];

    this.trackedFiles.forEach((metadata, path) => {
      if (this.isValidFileMetadata(metadata)) {
        validEntries.push({path, metadata});
      } else {
        console.warn(`Removing corrupted cache entry for: ${path}`);
      }
    });

    // Create a new cache instance to replace the old one
    this.trackedFiles = new MetricCache<FileMetadata>();

    // Re-add valid entries
    validEntries.forEach(({path, metadata}) => {
      this.trackedFiles.set(path, metadata);
    });
  }

  /**
   * Dispose of the tracker and clean up resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.persistMetrics();
  }
}