// src/views/charts.ts
import * as vscode from 'vscode';
import { MetricsStorage } from '../metrics/storage';
import { ComplexityMetrics } from '../metrics/complexity';

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ChartDataset {
  labels: string[];
  datasets: Array<{
    label?: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    hoverOffset?: number;
  }>;
}

export class MetricsChartGenerator {
  private storage: MetricsStorage;
  private readonly CHART_COLORS = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
    '#9966FF', '#FF9F40', '#66B3FF', '#99FF99'
  ];

  constructor(context: vscode.ExtensionContext) {
    this.storage = new MetricsStorage(context);
  }

  /**
   * Generates a comprehensive HTML dashboard with Chart.js visualizations
   */
  public generateDashboardHTML(): string {
    const currentDate = new Date().toLocaleString();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Developer Productivity Dashboard</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          ${this.getDashboardStyles()}
        </style>
      </head>
      <body>
        <div class="container">
          <header class="dashboard-header">
            <h1 class="dashboard-title">Developer Productivity Dashboard</h1>
            <div id="timestamp">Last Updated: ${currentDate}</div>
          </header>

          <section class="insights-section">
            <div class="insights-grid">
              ${this.generateInsightCards()}
            </div>
          </section>

          <section class="chart-grid">
            ${this.generateChartContainers()}
          </section>
          
          <section class="insights-section">
            <h2 class="section-title">Development Focus</h2>
            <div class="insights-grid">
              ${this.generateFocusInsights()}
            </div>
          </section>
        </div>
        
        <script>
          ${this.generateChartScripts()}
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generate CSS styles for the dashboard
   */
  private getDashboardStyles(): string {
    return `
      :root {
        --bg-primary: #f4f7f6;
        --bg-secondary: #ffffff;
        --text-primary: #2c3e50;
        --accent-color: #3498db;
        --shadow-soft: 0 4px 6px rgba(0,0,0,0.1);
        --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: var(--font-primary);
        background-color: var(--bg-primary);
        color: var(--text-primary);
        line-height: 1.6;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        background-color: var(--bg-secondary);
        padding: 1rem;
        border-radius: 12px;
        box-shadow: var(--shadow-soft);
      }

      .dashboard-title {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--accent-color);
      }

      .section-title {
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 1rem;
      }

      .chart-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .chart-container {
        background-color: var(--bg-secondary);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: var(--shadow-soft);
        transition: transform 0.3s ease;
      }

      .chart-container:hover {
        transform: translateY(-5px);
      }

      .chart-title {
        text-align: center;
        margin-bottom: 1rem;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      canvas {
        max-height: 300px;
        width: 100% !important;
      }

      .insights-section {
        margin-top: 2rem;
        background-color: var(--bg-secondary);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: var(--shadow-soft);
        margin-bottom: 2rem;
      }

      .insights-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .insight-card {
        background-color: var(--bg-primary);
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
        transition: background-color 0.3s ease;
      }

      .insight-card:hover {
        background-color: #e6edf0;
      }

      .insight-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--accent-color);
      }

      .insight-label {
        font-size: 0.9rem;
        color: var(--text-primary);
        opacity: 0.7;
      }
      
      @media (max-width: 768px) {
        .container {
          padding: 1rem;
        }
        
        .chart-grid {
          grid-template-columns: 1fr;
        }
        
        .insights-grid {
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
      }
    `;
  }

  /**
   * Generate HTML for chart containers
   */
  private generateChartContainers(): string {
    return `
      <div class="chart-container">
        <h2 class="chart-title">Language Distribution</h2>
        <canvas id="languageChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2 class="chart-title">Code Complexity Trend</h2>
        <canvas id="complexityChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2 class="chart-title">Coding Activity Timeline</h2>
        <canvas id="activityChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2 class="chart-title">File Size Distribution</h2>
        <canvas id="fileSizeChart"></canvas>
      </div>
    `;
  }

  /**
   * Generate JavaScript to initialize charts
   */
  private generateChartScripts(): string {
    return `
      // Language Distribution Chart
      new Chart(document.getElementById('languageChart'), {
        type: 'doughnut',
        data: ${JSON.stringify(this.prepareLanguageDistributionData())},
        options: {
          responsive: true,
          plugins: {
            legend: { 
              position: 'bottom',
              labels: {
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  return \`\${label}: \${value} (\${percentage}%)\`;
                }
              }
            }
          }
        }
      });

      // Complexity Trend Chart
      new Chart(document.getElementById('complexityChart'), {
        type: 'bar',
        data: ${JSON.stringify(this.prepareComplexityTrendData())},
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Complexity Score'
              }
            },
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 45
              }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
      
      // Activity Timeline Chart
      new Chart(document.getElementById('activityChart'), {
        type: 'line',
        data: ${JSON.stringify(this.prepareActivityTimelineData())},
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Files Modified'
              }
            }
          },
          plugins: {
            tooltip: {
              mode: 'index',
              intersect: false
            }
          }
        }
      });
      
      // File Size Distribution Chart
      new Chart(document.getElementById('fileSizeChart'), {
        type: 'polarArea',
        data: ${JSON.stringify(this.prepareFileSizeDistributionData())},
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right'
            }
          }
        }
      });
    `;
  }

  /**
   * Generate insight cards with key metrics
   */
  private generateInsightCards(): string {
    const metrics = this.storage.loadMetrics();
    const languageCount = this.getLanguageCount();
    const totalFiles = Object.keys(metrics.fileMetrics).length;
    const avgComplexity = this.calculateAverageComplexity();
    const totalLinesOfCode = this.calculateTotalLinesOfCode();

    const insightCards = [
      { 
        label: 'Total Files', 
        value: totalFiles.toString() 
      },
      { 
        label: 'Lines of Code', 
        value: this.formatNumber(totalLinesOfCode)
      },
      { 
        label: 'Languages Used', 
        value: Object.keys(languageCount).length.toString() 
      },
      { 
        label: 'Avg Complexity', 
        value: avgComplexity.toFixed(1) 
      },
      { 
        label: 'Most Used Language', 
        value: this.getMostUsedLanguage() 
      },
      { 
        label: 'Comment Ratio', 
        value: `${this.calculateAverageCommentRatio().toFixed(0)}%` 
      }
    ];

    return insightCards.map(card => `
      <div class="insight-card">
        <div class="insight-value">${card.value}</div>
        <div class="insight-label">${card.label}</div>
      </div>
    `).join('');
  }

  /**
   * Generate additional focus insights based on metrics
   */
  private generateFocusInsights(): string {
    const recentActivity = this.getMostRecentActivity();
    const complexityTrend = this.getComplexityTrend();
    const commentRatio = this.calculateAverageCommentRatio();
    
    let focusMessage = '';
    if (commentRatio < 10) {
      focusMessage = 'Consider adding more comments to improve code maintainability';
    } else if (commentRatio > 30) {
      focusMessage = 'Good documentation habits detected';
    } else {
      focusMessage = 'Balanced code-to-comment ratio';
    }

    // Define insights using an array
    const insights = [
      {
        label: 'Recent Focus',
        value: recentActivity || 'No recent activity'
      },
      {
        label: 'Complexity Trend',
        value: complexityTrend
      },
      {
        label: 'Code Quality Tip',
        value: focusMessage
      }
    ];

    return insights.map(insight => `
      <div class="insight-card">
        <div class="insight-label">${insight.label}</div>
        <div class="insight-value" style="font-size: 1rem;">${insight.value}</div>
      </div>
    `).join('');
  }

  /**
   * Format large numbers with commas
   */
  private formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /**
   * Calculate total lines of code across all files
   */
  private calculateTotalLinesOfCode(): number {
    const metrics = this.storage.loadMetrics();
    return Object.values(metrics.fileMetrics)
      .reduce((total, file) => total + file.lines, 0);
  }

  /**
   * Get language count from stored metrics
   */
  private getLanguageCount(): Record<string, number> {
    const metrics = this.storage.loadMetrics();
    const languageCount: Record<string, number> = {};

    Object.values(metrics.fileMetrics).forEach(file => {
      if (file.language) {
        languageCount[file.language] = (languageCount[file.language] || 0) + 1;
      }
    });

    return languageCount;
  }

  /**
   * Get the most used programming language
   */
  private getMostUsedLanguage(): string {
    const languageCount = this.getLanguageCount();
    if (Object.keys(languageCount).length === 0) {
      return 'None';
    }
    
    return Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1])[0][0]
      .toUpperCase();
  }

  /**
   * Get the most recent active language
   */
  private getMostRecentActivity(): string | null {
    const metrics = this.storage.loadMetrics();
    if (Object.keys(metrics.fileMetrics).length === 0) {
      return null;
    }
    
    // Find the most recently modified file
    const mostRecentFile = Object.values(metrics.fileMetrics)
      .sort((a, b) => {
        const dateA = new Date(a.lastModified).getTime();
        const dateB = new Date(b.lastModified).getTime();
        return dateB - dateA;
      })[0];
      
    if (!mostRecentFile) {
      return null;
    }
    
    return mostRecentFile.language.toUpperCase();
  }

  /**
   * Calculate average complexity of tracked files
   */
  private calculateAverageComplexity(): number {
    const metrics = this.storage.loadMetrics();
    const complexities = Object.values(metrics.fileMetrics)
      .map(file => file.complexity.cyclomaticComplexity);

    return complexities.length 
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length 
      : 0;
  }

  /**
   * Calculate average comment ratio as a percentage
   */
  private calculateAverageCommentRatio(): number {
    const metrics = this.storage.loadMetrics();
    const ratios = Object.values(metrics.fileMetrics)
      .map(file => file.lines * 100);

    return ratios.length 
      ? ratios.reduce((a, b) => a + b, 0) / ratios.length 
      : 0;
  }

  /**
   * Get a description of the complexity trend
   */
  private getComplexityTrend(): string {
    const metrics = this.storage.loadMetrics();
    const fileCount = Object.keys(metrics.fileMetrics).length;
    
    if (fileCount === 0) {
      return 'No data available';
    }
    
    const avgComplexity = this.calculateAverageComplexity();
    
    if (avgComplexity < 5) {
      return 'Low complexity codebase';
    } else if (avgComplexity < 10) {
      return 'Moderate complexity';
    } else if (avgComplexity < 20) {
      return 'High complexity - consider refactoring';
    } else {
      return 'Very high complexity - refactoring needed';
    }
  }

  /**
   * Prepare language distribution data for Chart.js
   */
  private prepareLanguageDistributionData(): ChartDataset {
    const languageCount = this.getLanguageCount();
    const sortedLanguages = Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1]);
    
    const topLanguages = sortedLanguages.slice(0, 7);
    
    // Combine remaining languages as 'Other' if there are more than 7
    if (sortedLanguages.length > 7) {
      const otherCount = sortedLanguages
        .slice(7)
        .reduce((sum, [, count]) => sum + count, 0);
      
      topLanguages.push(['Other', otherCount]);
    }

    return {
      labels: topLanguages.map(([lang]) => lang.toUpperCase()),
      datasets: [{
        data: topLanguages.map(([, count]) => count),
        backgroundColor: this.CHART_COLORS.slice(0, topLanguages.length),
        hoverOffset: 4
      }]
    };
  }

  /**
   * Prepare complexity trend data for Chart.js
   */
  private prepareComplexityTrendData(): ChartDataset {
    const metrics = this.storage.loadMetrics();
    
    const complexityTrend = Object.values(metrics.fileMetrics)
      .map(file => ({
        label: this.getShortFileName(file.path), 
        value: file.complexity.cyclomaticComplexity
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);  // Top 10 most complex files

    return {
      labels: complexityTrend.map(item => item.label),
      datasets: [{
        label: 'Cyclomatic Complexity',
        data: complexityTrend.map(item => item.value),
        backgroundColor: '#3498db',
        borderColor: '#2980b9',
        borderWidth: 1
      }]
    };
  }

  /**
   * Prepare activity timeline data for Chart.js
   */
  private prepareActivityTimelineData(): ChartDataset {
    const metrics = this.storage.loadMetrics();
    
    // Group files by date
    const activityByDate: Record<string, { count: number, languages: Record<string, number> }> = {};
    
    Object.values(metrics.fileMetrics).forEach(file => {
      const date = new Date(file.lastModified).toISOString().split('T')[0];
      
      if (!activityByDate[date]) {
        activityByDate[date] = { count: 0, languages: {} };
      }
      
      activityByDate[date].count++;
      
      if (file.language) {
        activityByDate[date].languages[file.language] = 
          (activityByDate[date].languages[file.language] || 0) + 1;
      }
    });
    
    // Get last 7 days (or less if not enough data)
    const dates = Object.keys(activityByDate).sort();
    const recentDates = dates.slice(-7);
    
    // Get top 3 languages
    const languageCounts: Record<string, number> = {};
    Object.values(activityByDate).forEach(day => {
      Object.entries(day.languages).forEach(([lang, count]) => {
        languageCounts[lang] = (languageCounts[lang] || 0) + count;
      });
    });
    
    const topLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);
    
    // Prepare datasets
    const datasets = [
      {
        label: 'Total Files',
        data: recentDates.map(date => activityByDate[date].count),
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        borderColor: 'rgba(52, 152, 219, 1)',
        borderWidth: 2
      }
    ];
    
    // Add datasets for top languages
    topLanguages.forEach((lang, index) => {
      datasets.push({
        label: lang.toUpperCase(),
        data: recentDates.map(date => 
          activityByDate[date].languages[lang] || 0
        ),
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: this.CHART_COLORS[index],
        borderWidth: 2
      });
    });
    
    return {
      labels: recentDates.map(date => {
        const [year, month, day] = date.split('-');
        return `${month}/${day}`;
      }),
      datasets
    };
  }

  /**
   * Prepare file size distribution data for Chart.js
   */
  private prepareFileSizeDistributionData(): ChartDataset {
    const metrics = this.storage.loadMetrics();
    const sizeBuckets = [
      { label: 'Small (0-100)', max: 100 },
      { label: 'Medium (100-500)', max: 500 },
      { label: 'Large (500-1000)', max: 1000 },
      { label: 'X-Large (1000+)', max: Infinity }
    ];

    const counts = new Array(sizeBuckets.length).fill(0);
    
    Object.values(metrics.fileMetrics).forEach(file => {
      const size = file.lines;
      for (let i = 0; i < sizeBuckets.length; i++) {
        if (size <= sizeBuckets[i].max) {
          counts[i]++;
          break;
        }
      }
    });

    return {
      labels: sizeBuckets.map(b => b.label),
      datasets: [{
        label: 'Files',
        data: counts,
        backgroundColor: this.CHART_COLORS.slice(0, sizeBuckets.length),
        borderColor: '#ffffff',
        borderWidth: 1
      }]
    };
  }

  /**
   * Get shortened filename for display
   */
  private getShortFileName(path: string): string {
    const parts = path.split(/[\\/]/);
    return parts.length > 1 
      ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
      : path;
  }
}