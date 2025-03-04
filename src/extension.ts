import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

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
  private fileMetricsCache: Map<string, CodeMetrics> = new Map();
  private startTime: number | null = null;
  private activeEditor: vscode.TextEditor | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initializeListeners();
  }

  private initializeListeners() {
    // Track active text editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      this.activeEditor = editor;
      if (editor) {
        this.analyzeFile(editor.document);
      }
    });

    // Track file save events
    vscode.workspace.onDidSaveTextDocument(document => {
      this.analyzeFile(document);
    });

    // Track coding session start
    this.startCodingSession();
  }

  private startCodingSession() {
    this.startTime = performance.now();
  }

  private analyzeFile(document: vscode.TextDocument) {
    const filePath = document.fileName;
    const fileExtension = path.extname(filePath).slice(1);
    
    const content = document.getText();
    const lines = content.split('\n');
    const commentLines = lines.filter(line => 
      line.trim().startsWith('//') || 
      line.trim().startsWith('/*') || 
      line.trim().startsWith('*')
    ).length;

    const metrics: CodeMetrics = {
      totalLines: lines.length,
      commentRatio: commentLines / lines.length,
      complexity: this.calculateComplexity(content),
      languageType: fileExtension,
      fileSize: Buffer.byteLength(content),
      lastModified: new Date(fs.statSync(filePath).mtime)
    };

    this.fileMetricsCache.set(filePath, metrics);
  }

  private calculateComplexity(content: string): number {
    // Simple complexity calculation based on control flow structures
    const complexityFactors = [
      /\b(if|else|switch|case|for|while|do)\b/g,
      /\&\&|\|\|/g  // Logical operators
    ];

    return complexityFactors.reduce((complexity, regex) => {
      const matches = content.match(regex);
      return complexity + (matches ? matches.length : 0);
    }, 0);
  }

  private generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const endTime = performance.now();
    
    if (!this.startTime) {return;}

    const dailyMetric: DailyMetrics = {
      date: today,
      totalCodingTime: (endTime - this.startTime) / 60000, // Convert to minutes
      filesEdited: this.fileMetricsCache.size,
      languages: this.aggregateLanguageUsage()
    };

    this.metrics.push(dailyMetric);
    this.startCodingSession(); // Reset session
  }

  private aggregateLanguageUsage() {
    const languageUsage: Record<string, number> = {};
    
    this.fileMetricsCache.forEach((metrics) => {
      languageUsage[metrics.languageType] = 
        (languageUsage[metrics.languageType] || 0) + 1;
    });

    return languageUsage;
  }

  public showProductivityDashboard() {
    const panel = vscode.window.createWebviewPanel(
      'productivityDashboard',
      'Productivity Dashboard',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    // Generate HTML dashboard with metrics
    panel.webview.html = this.generateDashboardHTML();
  }

  private generateDashboardHTML(): string {
    // Simplified HTML generation - in real-world, use more robust templating
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Developer Productivity Dashboard</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        <body>
          <h1>Your Coding Insights</h1>
          <canvas id="languageChart"></canvas>
          <script>
            const languageData = ${JSON.stringify(this.aggregateLanguageUsage())};
            // Chart.js rendering logic would go here
          </script>
        </body>
      </html>
    `;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const tracker = new ProductivityTracker(context);

  // Register command to open dashboard
  let disposable = vscode.commands.registerCommand('productivityDashboard.show', () => {
    tracker.showProductivityDashboard();
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}