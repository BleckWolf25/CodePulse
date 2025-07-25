/**
 * @file ADVANCED-ANALYTICS.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Advanced Analytics Dashboard JavaScript
 * Handles the advanced analytics dashboard functionality including
 * real-time updates, chart management, and user interactions.
 */


// ------------ MAIN
class AdvancedAnalyticsDashboard {
  constructor() {
    this.charts = {};
    this.currentData = {};
    this.isLoading = false;
    
    this.init();
  }

  /**
   * Initialize the dashboard
   */
  init() {
    this.setupEventListeners();
    this.initializeCharts();
    this.loadInitialData();
    this.setupRealTimeUpdates();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      this.refreshData();
    });

    // Export button
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportReport();
    });

    // Theme toggle if available
    document.addEventListener('themeChanged', (event) => {
      this.updateChartsTheme(event.detail.theme);
    });
  }

  /**
   * Initialize all charts
   */
  initializeCharts() {
    this.initializeTrendsChart();
    this.initializePerformanceChart();
    this.initializeTeamChart();
    this.initializeCodeHealthChart();
  }

  /**
   * Initialize trends chart
   */
  initializeTrendsChart() {
    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;

    this.charts.trends = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Velocity Trend',
          data: [],
          borderColor: '#4299e1',
          backgroundColor: 'rgba(66, 153, 225, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0aec0'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0aec0'
            }
          }
        }
      }
    });
  }

  /**
   * Initialize performance chart
   */
  initializePerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;

    this.charts.performance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Execution Time', 'Memory Usage', 'Async Ops'],
        datasets: [{
          label: 'Performance Metrics',
          data: [0, 0, 0],
          backgroundColor: [
            'rgba(245, 101, 101, 0.8)',
            'rgba(246, 173, 85, 0.8)',
            'rgba(72, 187, 120, 0.8)'
          ],
          borderColor: [
            '#f56565',
            '#f6ad55',
            '#48bb78'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0aec0'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0aec0'
            }
          }
        }
      }
    });
  }

  /**
   * Initialize team chart
   */
  initializeTeamChart() {
    const ctx = document.getElementById('teamChart');
    if (!ctx) return;

    this.charts.team = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Code Ownership', 'Collaboration', 'Knowledge Sharing'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: [
            '#9f7aea',
            '#4299e1',
            '#38a169'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#a0aec0',
              padding: 20
            }
          }
        }
      }
    });
  }

  /**
   * Initialize code health chart
   */
  initializeCodeHealthChart() {
    const ctx = document.getElementById('codeHealthChart');
    if (!ctx) return;

    this.charts.codeHealth = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Test Coverage', 'Documentation', 'Code Quality', 'Maintainability', 'Security'],
        datasets: [{
          label: 'Code Health',
          data: [0, 0, 0, 0, 0],
          borderColor: '#38a169',
          backgroundColor: 'rgba(56, 161, 105, 0.2)',
          pointBackgroundColor: '#38a169',
          pointBorderColor: '#38a169',
          pointHoverBackgroundColor: '#38a169',
          pointHoverBorderColor: '#38a169'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            pointLabels: {
              color: '#a0aec0'
            },
            ticks: {
              color: '#a0aec0',
              backdropColor: 'transparent'
            }
          }
        }
      }
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    this.setLoading(true);
    
    try {
      // Request initial data through WebSocket or fallback
      if (window.realTimeData && window.realTimeData.isUsingWebSocket()) {
        window.realTimeData.sendMessage('requestAdvancedAnalytics');
      } else {
        // Fallback to VS Code messaging
        this.requestDataFromExtension();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showError('Failed to load analytics data');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Setup real-time updates
   */
  setupRealTimeUpdates() {
    // Listen for real-time data updates
    if (window.realTimeData) {
      // Override update methods to handle advanced analytics
      const originalUpdateAdvancedAnalytics = window.realTimeData.updateAdvancedAnalytics;
      window.realTimeData.updateAdvancedAnalytics = (data) => {
        this.updateDashboard(data);
        if (originalUpdateAdvancedAnalytics) {
          originalUpdateAdvancedAnalytics.call(window.realTimeData, data);
        }
      };
    }
  }

  /**
   * Update dashboard with new data
   */
  updateDashboard(data) {
    this.currentData = { ...this.currentData, ...data };
    
    // Update overall score
    this.updateOverallScore(data);
    
    // Update individual panels
    this.updateTrendsPanel(data.trends);
    this.updatePerformancePanel(data.performance);
    this.updateTeamPanel(data.teamMetrics);
    this.updateCodeHealthPanel(data.codeQuality);
    
    // Update recommendations
    this.updateRecommendations(data.recommendations);
  }

  /**
   * Update overall productivity score
   */
  updateOverallScore(data) {
    if (data.productivityScore) {
      const scoreElement = document.getElementById('overallScore');
      const score = data.productivityScore.score;
      
      if (scoreElement) {
        scoreElement.textContent = score;
        
        // Update score color based on value
        scoreElement.className = 'score-circle ' + this.getScoreClass(score);
      }
      
      // Update breakdown scores
      const breakdown = data.productivityScore.breakdown;
      if (breakdown) {
        this.updateMetricValue('code-quality-score', `${breakdown.codeQuality}%`);
        this.updateMetricValue('performance-score', `${breakdown.performance}%`);
        this.updateMetricValue('team-score', `${breakdown.teamCollaboration}%`);
        this.updateMetricValue('trends-score', `${breakdown.trends}%`);
      }
    }
  }

  /**
   * Update trends panel
   */
  updateTrendsPanel(trends) {
    if (!trends) return;
    
    // Update velocity prediction
    if (trends.velocityPrediction) {
      this.updateMetricValue('velocity-prediction', 
        `${trends.velocityPrediction.nextWeek.toFixed(1)} hrs/week`);
      this.updateMetricValue('prediction-confidence', 
        `${(trends.velocityPrediction.confidence * 100).toFixed(1)}%`);
    }
    
    // Update trend direction
    if (trends.seasonalPatterns) {
      const direction = this.calculateTrendDirection(trends.seasonalPatterns);
      const element = document.querySelector('[data-metric="trend-direction"]');
      if (element) {
        element.textContent = direction.charAt(0).toUpperCase() + direction.slice(1);
        element.className = `trend-indicator ${direction}`;
      }
    }
    
    // Update trends chart
    this.updateTrendsChart(trends);
  }

  /**
   * Update performance panel
   */
  updatePerformancePanel(performance) {
    if (!performance) return;
    
    this.updateMetricValue('hotspots-count', performance.executionHotspots?.length || 0);
    this.updateMetricValue('memory-usage', 
      `${((performance.memoryProfile?.allocation || 0) / 1024 / 1024).toFixed(1)} MB`);
    this.updateMetricValue('async-operations', performance.asyncOperations?.pending || 0);
    
    // Update performance chart
    this.updatePerformanceChart(performance);
  }

  /**
   * Update team panel
   */
  updateTeamPanel(teamMetrics) {
    if (!teamMetrics) return;
    
    this.updateMetricValue('contributors', teamMetrics.contributorCount || 0);
    this.updateMetricValue('collaboration-score', 
      `${(teamMetrics.collaborationScore || 0).toFixed(1)}%`);
    this.updateMetricValue('knowledge-distribution', 
      `${(teamMetrics.knowledgeDistribution || 0).toFixed(1)}%`);
    
    // Update team chart
    this.updateTeamChart(teamMetrics);
  }

  /**
   * Update code health panel
   */
  updateCodeHealthPanel(codeQuality) {
    if (!codeQuality) return;
    
    this.updateMetricValue('duplication', 
      `${(codeQuality.duplicationType?.percentage || 0).toFixed(1)}%`);
    this.updateMetricValue('test-coverage', 
      `${(codeQuality.testCoverage?.percentage || 0).toFixed(1)}%`);
    this.updateMetricValue('documentation-coverage', 
      `${(codeQuality.documentation?.coverage || 0).toFixed(1)}%`);
    
    // Update code health chart
    this.updateCodeHealthChart(codeQuality);
  }

  /**
   * Update recommendations list
   */
  updateRecommendations(recommendations) {
    const container = document.getElementById('recommendationsList');
    if (!container || !recommendations) return;
    
    container.innerHTML = '';
    
    if (recommendations.length === 0) {
      container.innerHTML = `
        <li class="recommendation-item">
          <div class="recommendation-icon">✅</div>
          <div class="recommendation-content">
            <div class="recommendation-title">Great job!</div>
            <div class="recommendation-description">No immediate recommendations. Keep up the good work!</div>
          </div>
        </li>
      `;
      return;
    }
    
    recommendations.forEach((rec, index) => {
      const item = document.createElement('li');
      item.className = 'recommendation-item';
      item.innerHTML = `
        <div class="recommendation-icon">${this.getRecommendationIcon(index)}</div>
        <div class="recommendation-content">
          <div class="recommendation-title">Recommendation ${index + 1}</div>
          <div class="recommendation-description">${rec}</div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Helper methods
   */
  updateMetricValue(metric, value) {
    const element = document.querySelector(`[data-metric="${metric}"]`);
    if (element) {
      element.textContent = value;
    }
  }

  getScoreClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 75) return 'score-good';
    if (score >= 60) return 'score-fair';
    return 'score-poor';
  }

  getRecommendationIcon(index) {
    const icons = ['💡', '⚡', '🔧', '📊', '🎯', '🚀', '🔍', '📈'];
    return icons[index % icons.length];
  }

  calculateTrendDirection(patterns) {
    if (!patterns.monthlyTrends || patterns.monthlyTrends.length < 2) {
      return 'stable';
    }
    
    const recent = patterns.monthlyTrends.slice(-2);
    const change = recent[1].value - recent[0].value;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  setLoading(loading) {
    this.isLoading = loading;
    const spinner = document.querySelector('.loading-spinner');
    const refreshBtn = document.getElementById('refreshBtn');
    
    if (spinner) {
      spinner.style.display = loading ? 'inline-block' : 'none';
    }
    
    if (refreshBtn) {
      refreshBtn.disabled = loading;
    }
  }

  showError(message) {
    // You can implement a toast notification system here
    console.error(message);
  }

  async refreshData() {
    await this.loadInitialData();
  }

  requestDataFromExtension() {
    if (typeof acquireVsCodeApi !== 'undefined') {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({ command: 'getAdvancedAnalytics' });
    }
  }

  exportReport() {
    try {
      const reportData = {
        timestamp: new Date().toISOString(),
        data: this.currentData,
        summary: this.generateReportSummary(),
        advancedAnalytics: this.generateAdvancedAnalyticsSummary()
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `advanced-analytics-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('Advanced analytics report exported successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed', 'error');
    }
  }

  /**
   * Generate report summary
   */
  generateReportSummary() {
    const summary = {
      overallScore: this.calculateOverallScore(),
      keyMetrics: {
        codeQuality: this.currentData.codeQuality ? this.calculateCodeQualityScore() : 0,
        performance: this.currentData.performance ? this.calculatePerformanceScore() : 0,
        teamCollaboration: this.currentData.teamMetrics ? this.calculateTeamScore() : 0,
        trends: this.currentData.trends ? this.calculateTrendsScore() : 0
      },
      timestamp: new Date().toISOString()
    };

    return summary;
  }

  /**
   * Generate advanced analytics summary for export
   */
  generateAdvancedAnalyticsSummary() {
    const summary = {
      trendAnalysis: {
        hasProductivityRegression: this.currentData.trends?.productivityRegression?.hasRegression || false,
        velocityTrend: this.currentData.trends?.advancedVelocityTrends?.velocityTrend || 'stable',
        forecastAccuracy: this.currentData.trends?.advancedVelocityTrends?.forecastAccuracy || 0,
        seasonalFactors: this.currentData.trends?.advancedVelocityTrends?.seasonalFactors || {}
      },
      performanceAnalysis: {
        hasPerformanceRegression: this.currentData.performance?.regressionAnalysis?.hasRegression || false,
        regressionScore: this.currentData.performance?.regressionAnalysis?.regressionScore || 0,
        industryPercentile: this.currentData.performance?.benchmarkComparison?.industryPercentile || 0,
        overallPerformanceScore: this.currentData.performance?.benchmarkComparison?.overallScore || 0,
        affectedFiles: this.currentData.performance?.regressionAnalysis?.affectedFiles || []
      },
      teamAnalysis: {
        communicationScore: this.currentData.teamMetrics?.communicationPatterns?.communicationScore || 0,
        collaborationFrequency: this.currentData.teamMetrics?.communicationPatterns?.collaborationFrequency || 0,
        burnoutRisk: this.currentData.teamMetrics?.productivityPatterns?.burnoutRisk || 'low',
        teamCohesion: this.currentData.teamMetrics?.communicationPatterns?.teamCohesion || 0,
        workloadDistribution: this.currentData.teamMetrics?.productivityPatterns?.workloadDistribution || 0
      },
      codeHealthAnalysis: {
        technicalDebtScore: this.currentData.codeQuality?.technicalDebt?.totalDebtScore || 0,
        maintainabilityIndex: this.currentData.codeQuality?.maintainabilityIndex?.overallIndex || 0,
        estimatedRefactoringTime: this.currentData.codeQuality?.technicalDebt?.estimatedRefactoringTime || 0,
        priorityFiles: this.currentData.codeQuality?.technicalDebt?.priorityFiles || [],
        debtByCategory: this.currentData.codeQuality?.technicalDebt?.debtByCategory || {}
      },
      recommendations: {
        trend: this.currentData.trends?.productivityRegression?.recommendations || [],
        performance: this.currentData.performance?.regressionAnalysis?.recommendations || [],
        team: this.currentData.teamMetrics?.productivityPatterns?.recommendations || [],
        codeHealth: this.currentData.codeQuality?.technicalDebt?.recommendations || []
      }
    };

    return summary;
  }

  /**
   * Calculate overall score
   */
  calculateOverallScore() {
    const scores = {
      codeQuality: this.calculateCodeQualityScore(),
      performance: this.calculatePerformanceScore(),
      teamCollaboration: this.calculateTeamScore(),
      trends: this.calculateTrendsScore()
    };

    const weights = {
      codeQuality: 0.3,
      performance: 0.25,
      teamCollaboration: 0.25,
      trends: 0.2
    };

    return Math.round(
      (scores.codeQuality * weights.codeQuality) +
      (scores.performance * weights.performance) +
      (scores.teamCollaboration * weights.teamCollaboration) +
      (scores.trends * weights.trends)
    );
  }

  /**
   * Calculate code quality score
   */
  calculateCodeQualityScore() {
    if (!this.currentData.codeQuality) return 0;

    let score = 100;
    const cq = this.currentData.codeQuality;

    // Deduct for duplication
    if (cq.duplicationType) {
      score -= cq.duplicationType.percentage * 0.5;
    }

    // Deduct for poor test coverage
    if (cq.testCoverage) {
      score -= (100 - cq.testCoverage.percentage) * 0.3;
    }

    // Deduct for poor documentation
    if (cq.documentation) {
      score -= (100 - cq.documentation.coverage) * 0.2;
    }

    // Deduct for technical debt
    if (cq.technicalDebt) {
      score -= cq.technicalDebt.totalDebtScore * 0.3;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore() {
    if (!this.currentData.performance) return 0;

    let score = 100;
    const perf = this.currentData.performance;

    // Deduct for execution hotspots
    if (perf.executionHotspots) {
      score -= perf.executionHotspots.length * 2;
    }

    // Deduct for memory leaks
    if (perf.memoryProfile?.leaks) {
      score -= perf.memoryProfile.leaks.length * 5;
    }

    // Deduct for performance regression
    if (perf.regressionAnalysis?.hasRegression) {
      score -= perf.regressionAnalysis.regressionScore * 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate team score
   */
  calculateTeamScore() {
    if (!this.currentData.teamMetrics) return 0;

    let score = this.currentData.teamMetrics.collaborationScore || 0;

    // Bonus for good knowledge distribution
    if (this.currentData.teamMetrics.knowledgeDistribution) {
      score += this.currentData.teamMetrics.knowledgeDistribution * 0.2;
    }

    // Bonus for good communication
    if (this.currentData.teamMetrics.communicationPatterns?.communicationScore) {
      score += this.currentData.teamMetrics.communicationPatterns.communicationScore * 0.3;
    }

    // Penalty for burnout risk
    if (this.currentData.teamMetrics.productivityPatterns?.burnoutRisk === 'high') {
      score -= 20;
    } else if (this.currentData.teamMetrics.productivityPatterns?.burnoutRisk === 'medium') {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate trends score
   */
  calculateTrendsScore() {
    if (!this.currentData.trends) return 50;

    let score = 50; // Base score

    // Bonus for positive velocity prediction
    if (this.currentData.trends.velocityPrediction?.nextWeek > 0) {
      score += 25;
    }

    // Bonus for high confidence predictions
    if (this.currentData.trends.velocityPrediction?.confidence) {
      score += this.currentData.trends.velocityPrediction.confidence * 25;
    }

    // Penalty for productivity regression
    if (this.currentData.trends.productivityRegression?.hasRegression) {
      const severity = this.currentData.trends.productivityRegression.severity;
      if (severity === 'high') score -= 30;
      else if (severity === 'medium') score -= 20;
      else score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update trends chart
   */
  updateTrendsChart(trends) {
    if (!this.charts.trends || !trends.seasonalPatterns?.monthlyTrends) return;

    const monthlyTrends = trends.seasonalPatterns.monthlyTrends;
    const labels = monthlyTrends.map(trend =>
      new Date(trend.timestamp).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    );
    const data = monthlyTrends.map(trend => trend.value);

    this.charts.trends.data.labels = labels;
    this.charts.trends.data.datasets[0].data = data;
    this.charts.trends.update();
  }

  /**
   * Update performance chart
   */
  updatePerformanceChart(performance) {
    if (!this.charts.performance) return;

    const data = [
      performance.executionHotspots?.length || 0,
      (performance.memoryProfile?.allocation || 0) / 1024 / 1024, // Convert to MB
      performance.asyncOperations?.pending || 0
    ];

    this.charts.performance.data.datasets[0].data = data;
    this.charts.performance.update();
  }

  /**
   * Update team chart
   */
  updateTeamChart(teamMetrics) {
    if (!this.charts.team) return;

    const data = [
      teamMetrics.knowledgeDistribution || 0,
      teamMetrics.collaborationScore || 0,
      Math.min(100, (teamMetrics.contributorCount || 0) * 20) // Scale contributors to 0-100
    ];

    this.charts.team.data.datasets[0].data = data;
    this.charts.team.update();
  }

  /**
   * Update code health chart
   */
  updateCodeHealthChart(codeQuality) {
    if (!this.charts.codeHealth) return;

    const data = [
      codeQuality.testCoverage?.percentage || 0,
      codeQuality.documentation?.coverage || 0,
      Math.max(0, 100 - (codeQuality.duplicationType?.percentage || 0)), // Invert duplication
      codeQuality.documentation?.quality || 0,
      80 // Security placeholder - would need actual security metrics
    ];

    this.charts.codeHealth.data.datasets[0].data = data;
    this.charts.codeHealth.update();
  }

  /**
   * Update charts theme
   */
  updateChartsTheme(theme) {
    const textColor = theme === 'dark' ? '#a0aec0' : '#4a5568';
    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    Object.values(this.charts).forEach(chart => {
      if (chart.options.scales) {
        // Update axis colors
        Object.values(chart.options.scales).forEach(scale => {
          if (scale.grid) scale.grid.color = gridColor;
          if (scale.ticks) scale.ticks.color = textColor;
          if (scale.pointLabels) scale.pointLabels.color = textColor;
        });
      }

      // Update legend colors
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = textColor;
      }

      chart.update();
    });
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.advancedAnalyticsDashboard = new AdvancedAnalyticsDashboard();
});
