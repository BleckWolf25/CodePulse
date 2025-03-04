// src/views/charts.ts
import * as vscode from 'vscode';
import { MetricsStorage } from '../metrics/storage';
import { ComplexityMetrics } from '../metrics/complexity';

interface ChartDataPoint {
  label: string;
  value: number;
}

export class MetricsChartGenerator {
  private storage: MetricsStorage;

  constructor(context: vscode.ExtensionContext) {
    this.storage = new MetricsStorage(context);
  }

  /**
   * Generates a comprehensive HTML dashboard with Chart.js visualizations
   */
  public generateDashboardHTML(): string {
    const metrics = this.storage.loadMetrics();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Developer Productivity Dashboard</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f4f4f4;
          }
          .chart-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="chart-container">
          <h2>Language Distribution</h2>
          <canvas id="languageChart"></canvas>
        </div>
        
        <div class="chart-container">
          <h2>Code Complexity Over Time</h2>
          <canvas id="complexityChart"></canvas>
        </div>
        
        <script>
          // Language Distribution Chart
          new Chart(document.getElementById('languageChart'), {
            type: 'pie',
            data: ${this.prepareLanguageDistributionData()},
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'top' }
              }
            }
          });

          // Complexity Trend Chart
          new Chart(document.getElementById('complexityChart'), {
            type: 'line',
            data: ${this.prepareComplexityTrendData()},
            options: {
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Complexity Score'
                  }
                }
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Prepare language distribution data for Chart.js
   */
  private prepareLanguageDistributionData(): string {
    const metrics = this.storage.loadMetrics();
    const languageCount: { [key: string]: number } = {};

    // Aggregate language usage from stored file metrics
    Object.values(metrics.fileMetrics).forEach(file => {
      languageCount[file.language] = (languageCount[file.language] || 0) + 1;
    });

    return JSON.stringify({
      labels: Object.keys(languageCount),
      datasets: [{
        data: Object.values(languageCount),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
          '#9966FF', '#FF9F40'
        ]
      }]
    });
  }

  /**
   * Prepare complexity trend data for Chart.js
   */
  private prepareComplexityTrendData(): string {
    const metrics = this.storage.loadMetrics();
    
    // Group complexity by timestamp or date
    const complexityTrend: ChartDataPoint[] = 
      Object.values(metrics.fileMetrics)
        .map(file => ({
          label: file.language, 
          value: file.complexity.cyclomaticComplexity
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);  // Top 10 most complex files

    return JSON.stringify({
      labels: complexityTrend.map(item => item.label),
      datasets: [{
        label: 'Cyclomatic Complexity',
        data: complexityTrend.map(item => item.value),
        borderColor: '#36A2EB',
        tension: 0.1
      }]
    });
  }
}