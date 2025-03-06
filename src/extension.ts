import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { MetricCache } from './utils/cache';
import { MetricsChartGenerator } from './views/charts';

interface CodeMetrics {
  totalLines: number;
  commentRatio: number;
  complexity: number;
  languageType: string;
  fileSize: number;
  lastModified: Date;
}

interface DailyMetrics {
  date: string;
  totalCodingTime: number;
  filesEdited: number;
  languages: Record<string, number>;
}

class ProductivityTracker {
  private context: vscode.ExtensionContext;
  private metrics: DailyMetrics[] = [];
  private fileMetricsCache = new MetricCache<CodeMetrics>();
  private startTime: number | null = null;
  private chartGenerator: MetricsChartGenerator;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.chartGenerator = new MetricsChartGenerator(context);
    this.initializeListeners();
    this.startCodingSession();
  }

  private initializeListeners(): void {
    // Track active text editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.analyzeFile(editor.document);
        }
      })
    );

    // Track file save events
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(document => {
        this.analyzeFile(document);
      })
    );
  }

  private startCodingSession(): void {
    this.startTime = performance.now();
  }

  private analyzeFile(document: vscode.TextDocument): void {
    const filePath = document.fileName;
    
    // Skip non-file documents
    if (document.uri.scheme !== 'file') {
      return;
    }
    
    // Skip already cached files
    if (this.fileMetricsCache.get(filePath)) { 
      return;
    }

    const fileExtension = path.extname(filePath).slice(1).toLowerCase();
    
    // Skip files without extensions or non-code files
    if (!fileExtension || !this.isCodeFile(fileExtension)) {
      return;
    }

    const content = document.getText();
    const lines = content.split('\n');
    const commentLines = this.countCommentLines(lines, fileExtension);

    const metrics: CodeMetrics = {
      totalLines: lines.length,
      commentRatio: lines.length > 0 ? commentLines / lines.length : 0,
      complexity: this.calculateComplexity(content, fileExtension),
      languageType: fileExtension,
      fileSize: Buffer.byteLength(content),
      lastModified: new Date()
    };

    // Only try to get file stats if the file actually exists on disk
    try {
      const stats = fs.statSync(filePath);
      metrics.lastModified = new Date(stats.mtime);
    } catch (error) {
      // File might be unsaved or inaccessible
    }

    this.fileMetricsCache.set(filePath, metrics);
  }

  private isCodeFile(extension: string): boolean {
    const codeExtensions = [
      'ts', 'js', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 
      'php', 'swift', 'kt', 'dart', 'rs', 'lua', 'html', 'css'
    ];
    return codeExtensions.includes(extension);
  }

  private countCommentLines(lines: string[], fileExtension: string): number {
    // Simplified pattern matching for comments
    const commentPatterns: Record<string, RegExp[]> = {
      default: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/],
      py: [/^\s*#/],
      rb: [/^\s*#/],
      lua: [/^\s*--/],
      html: [/^\s*<!--/]
    };

    const patterns = commentPatterns[fileExtension] || commentPatterns.default;
    return lines.filter(line => 
      patterns.some(pattern => pattern.test(line.trim()))
    ).length;
  }

  private calculateComplexity(content: string, fileExtension: string): number {
    // Language-specific complexity calculations
    const complexityPatterns: Record<string, RegExp[]> = {
      default: [
        /\b(if|else|switch|case|for|while|do|catch|try)\b/g,
        /\&\&|\|\|/g,  // Logical operators
        /\?.*:/g       // Ternary operators
      ],
      py: [
        /\b(if|elif|else|for|while|try|except|with)\b/g,
        /\s+and\s+|\s+or\s+/g
      ],
      lua: [
        /\b(if|elseif|else|for|while|repeat|until)\b/g,
        /\s+and\s+|\s+or\s+/g
      ]
    };

    const patterns = complexityPatterns[fileExtension] || complexityPatterns.default;
    return patterns.reduce((complexity, regex) => {
      const matches = content.match(regex);
      return complexity + (matches ? matches.length : 0);
    }, 0);
  }

  public generateDailyReport(): void {
    const today = new Date().toISOString().split('T')[0];
    const endTime = performance.now();
    
    if (!this.startTime) { return; }

    const dailyMetric: DailyMetrics = {
      date: today,
      totalCodingTime: (endTime - this.startTime) / 60000, // Convert to minutes
      filesEdited: this.fileMetricsCache.size,
      languages: this.aggregateLanguageUsage()
    };

    this.metrics.push(dailyMetric);
    this.startCodingSession(); // Reset session
  }

  private aggregateLanguageUsage(): Record<string, number> {
    const languageUsage: Record<string, number> = {};
    
    this.fileMetricsCache.forEach((metrics) => {
      if (metrics.languageType) {
        languageUsage[metrics.languageType] = 
          (languageUsage[metrics.languageType] || 0) + 1;
      }
    });

    return languageUsage;
  }

  public showProductivityDashboard(): void {
    // Generate daily report before showing dashboard
    this.generateDailyReport();
    
    const panel = vscode.window.createWebviewPanel(
      'productivityDashboard',
      'Productivity Dashboard',
      vscode.ViewColumn.One,
      { 
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media')
        ]
      }
    );

    // Use the chart generator to create the dashboard
    panel.webview.html = this.chartGenerator.generateDashboardHTML();
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

// Singleton instance
let productivityTracker: ProductivityTracker | null = null;

export function activate(context: vscode.ExtensionContext): void {
  console.log('🟢 Code Pulse ACTIVATED');
  
  // Status bar creation
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right, 
    1000
  );
  statusBar.text = '$(pulse) Code Pulse';
  statusBar.tooltip = 'Show Developer Productivity Dashboard';
  statusBar.command = 'codePulse.showDashboard';
  statusBar.show();
  
  // Create the tracker instance
  productivityTracker = new ProductivityTracker(context);
  
  // Register command
  const showDashboardCommand = vscode.commands.registerCommand(
    'codePulse.showDashboard', 
    () => {
      productivityTracker?.showProductivityDashboard();
    }
  );

  // Register disposables
  context.subscriptions.push(
    statusBar,
    showDashboardCommand
  );
  
  // Show first-run notification only on initial install
  const hasShownFirstRun = context.globalState.get('codePulse.hasShownFirstRun');
  if (!hasShownFirstRun) {
    vscode.window.showInformationMessage(
      'Code Pulse activated! Click the $(pulse) icon in the status bar to see your productivity metrics.'
    );
    context.globalState.update('codePulse.hasShownFirstRun', true);
  }
}

export function deactivate(): void {
  console.log('🔴 Code Pulse DEACTIVATED');
  if (productivityTracker) {
    productivityTracker.dispose();
    productivityTracker = null;
  }
}