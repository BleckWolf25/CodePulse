/**
 * PDF Report Generator
 * 
 * Generates professional PDF reports with charts, tables, and custom branding
 * using HTML-to-PDF conversion with comprehensive styling and layout.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GeneratedReport, GeneratedSection, ChartData, TableData, BrandingConfig } from './report-generator';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES

export interface PDFOptions {
  format: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  headerFooter: boolean;
  displayHeaderFooter: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground: boolean;
  scale: number;
}

export interface PDFTemplate {
  name: string;
  htmlTemplate: string;
  cssStyles: string;
  sections: {
    [key: string]: string;
  };
}

// ------------ MAIN CLASS

export class PDFGenerator {
  private errorHandler = ErrorHandler.getInstance();
  private templates = new Map<string, PDFTemplate>();

  constructor(private context: vscode.ExtensionContext) {
    this.loadPDFTemplates();
  }

  /**
   * Generate PDF from report data
   */
  public async generatePDF(
    report: GeneratedReport,
    templateName: string = 'default',
    options?: Partial<PDFOptions>
  ): Promise<string> {
    try {
      const template = this.templates.get(templateName);
      if (!template) {
        throw new Error(`PDF template not found: ${templateName}`);
      }

      const pdfOptions = this.getDefaultPDFOptions(options);
      
      // Generate HTML content
      const htmlContent = await this.generateHTMLContent(report, template);
      
      // Convert HTML to PDF
      const pdfPath = await this.convertHTMLToPDF(htmlContent, pdfOptions, report.metadata.title);
      
      return pdfPath;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Generate HTML content for PDF
   */
  private async generateHTMLContent(report: GeneratedReport, template: PDFTemplate): Promise<string> {
    let html = template.htmlTemplate;

    // Replace template variables
    html = html.replace(/\{\{title\}\}/g, report.metadata.title || 'Analytics Report');
    html = html.replace(/\{\{subtitle\}\}/g, report.metadata.subtitle || '');
    html = html.replace(/\{\{author\}\}/g, report.metadata.author || 'CodePulse Analytics');
    html = html.replace(/\{\{date\}\}/g, new Date(report.generatedAt).toLocaleDateString());
    html = html.replace(/\{\{dateRange\}\}/g, this.formatDateRange(report.metadata.dateRange));

    // Generate sections content
    const sectionsHTML = await this.generateSectionsHTML(report.sections, template);
    html = html.replace(/\{\{sections\}\}/g, sectionsHTML);

    // Add CSS styles
    const cssStyles = this.generateCSSStyles(template);
    html = html.replace(/\{\{styles\}\}/g, cssStyles);

    // Add summary if available
    if (report.summary) {
      const summaryHTML = this.generateSummaryHTML(report.summary);
      html = html.replace(/\{\{summary\}\}/g, summaryHTML);
    }

    return html;
  }

  /**
   * Generate sections HTML
   */
  private async generateSectionsHTML(sections: GeneratedSection[], template: PDFTemplate): Promise<string> {
    let sectionsHTML = '';

    for (const section of sections) {
      const sectionHTML = await this.generateSectionHTML(section, template);
      sectionsHTML += sectionHTML;
    }

    return sectionsHTML;
  }

  /**
   * Generate individual section HTML
   */
  private async generateSectionHTML(section: GeneratedSection, template: PDFTemplate): Promise<string> {
    const sectionTemplate = template.sections[section.type] || template.sections['default'];
    let sectionHTML = sectionTemplate;

    // Replace section variables
    sectionHTML = sectionHTML.replace(/\{\{sectionTitle\}\}/g, section.title);
    sectionHTML = sectionHTML.replace(/\{\{sectionId\}\}/g, section.id);

    // Generate content based on section type
    let contentHTML = '';
    
    switch (section.type) {
      case 'summary':
        contentHTML = this.generateSummaryContentHTML(section.content);
        break;
      case 'metrics':
        contentHTML = await this.generateMetricsContentHTML(section);
        break;
      case 'trends':
        contentHTML = await this.generateTrendsContentHTML(section);
        break;
      case 'insights':
        contentHTML = this.generateInsightsContentHTML(section.content);
        break;
      case 'recommendations':
        contentHTML = this.generateRecommendationsContentHTML(section.content);
        break;
      case 'table':
        contentHTML = this.generateTablesHTML(section.tables || []);
        break;
      case 'text':
        contentHTML = `<div class="text-content">${section.content.text || ''}</div>`;
        break;
      default:
        contentHTML = '<div class="content-placeholder">Content not available</div>';
    }

    sectionHTML = sectionHTML.replace(/\{\{sectionContent\}\}/g, contentHTML);

    return sectionHTML;
  }

  /**
   * Generate summary content HTML
   */
  private generateSummaryContentHTML(content: any): string {
    let html = '<div class="summary-content">';

    if (content.reportPeriod) {
      html += `<div class="summary-item">
        <span class="summary-label">Report Period:</span>
        <span class="summary-value">${content.reportPeriod}</span>
      </div>`;
    }

    if (content.totalMetrics !== undefined) {
      html += `<div class="summary-item">
        <span class="summary-label">Total Files Analyzed:</span>
        <span class="summary-value">${content.totalMetrics}</span>
      </div>`;
    }

    if (content.activeDays !== undefined) {
      html += `<div class="summary-item">
        <span class="summary-label">Active Days:</span>
        <span class="summary-value">${content.activeDays}</span>
      </div>`;
    }

    if (content.healthScore !== undefined) {
      html += `<div class="summary-item">
        <span class="summary-label">Health Score:</span>
        <span class="summary-value health-score-${this.getHealthScoreClass(content.healthScore)}">${content.healthScore}/100</span>
      </div>`;
    }

    if (content.overallTrend) {
      html += `<div class="summary-item">
        <span class="summary-label">Overall Trend:</span>
        <span class="summary-value trend-${content.overallTrend}">${content.overallTrend}</span>
      </div>`;
    }

    if (content.keyMetrics) {
      html += '<div class="key-metrics-grid">';
      Object.entries(content.keyMetrics).forEach(([metric, data]: [string, any]) => {
        html += `<div class="metric-card">
          <h4>${metric.charAt(0).toUpperCase() + metric.slice(1)}</h4>
          <div class="metric-value">${data.current?.toFixed(2) || 'N/A'}</div>
          <div class="metric-change ${data.change >= 0 ? 'positive' : 'negative'}">
            ${data.change >= 0 ? '↗' : '↘'} ${Math.abs(data.change || 0).toFixed(1)}%
          </div>
          <div class="metric-trend">${data.trend || 'stable'}</div>
        </div>`;
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate metrics content HTML
   */
  private async generateMetricsContentHTML(section: GeneratedSection): Promise<string> {
    let html = '<div class="metrics-content">';

    // Add charts
    if (section.charts && section.charts.length > 0) {
      html += '<div class="charts-container">';
      for (const chart of section.charts) {
        const chartHTML = await this.generateChartHTML(chart);
        html += chartHTML;
      }
      html += '</div>';
    }

    // Add tables
    if (section.tables && section.tables.length > 0) {
      html += this.generateTablesHTML(section.tables);
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate trends content HTML
   */
  private async generateTrendsContentHTML(section: GeneratedSection): Promise<string> {
    let html = '<div class="trends-content">';

    if (section.content.trends) {
      html += '<div class="trends-summary">';
      section.content.trends.forEach((trend: any) => {
        html += `<div class="trend-item">
          <h4>${trend.metric.charAt(0).toUpperCase() + trend.metric.slice(1)}</h4>
          <div class="trend-direction ${trend.direction}">${trend.direction}</div>
          <div class="trend-confidence">Confidence: ${(trend.confidence * 100).toFixed(1)}%</div>
          <div class="trend-description">${trend.description}</div>
        </div>`;
      });
      html += '</div>';
    }

    // Add trend charts
    if (section.charts && section.charts.length > 0) {
      html += '<div class="trend-charts">';
      for (const chart of section.charts) {
        const chartHTML = await this.generateChartHTML(chart);
        html += chartHTML;
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate insights content HTML
   */
  private generateInsightsContentHTML(content: any): string {
    let html = '<div class="insights-content">';

    if (content.insights && content.insights.length > 0) {
      html += '<div class="insights-list">';
      content.insights.forEach((insight: any, _index: number) => {
        html += `<div class="insight-item impact-${insight.impact}">
          <div class="insight-header">
            <h4 class="insight-title">${insight.title}</h4>
            <span class="insight-impact">${insight.impact} impact</span>
          </div>
          <div class="insight-description">${insight.description}</div>
          <div class="insight-meta">
            <span class="insight-category">${insight.category}</span>
            <span class="insight-confidence">Confidence: ${(insight.confidence * 100).toFixed(1)}%</span>
            <span class="insight-timeframe">${insight.timeframe}</span>
          </div>
          ${insight.evidence && insight.evidence.length > 0 ? `
            <div class="insight-evidence">
              <strong>Evidence:</strong>
              <ul>
                ${insight.evidence.map((e: string) => `<li>${e}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>`;
      });
      html += '</div>';
    } else {
      html += '<div class="no-insights">No insights available for this period.</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate recommendations content HTML
   */
  private generateRecommendationsContentHTML(content: any): string {
    let html = '<div class="recommendations-content">';

    if (content.recommendations && content.recommendations.length > 0) {
      html += '<div class="recommendations-list">';
      content.recommendations.forEach((rec: any, _index: number) => {
        html += `<div class="recommendation-item priority-${rec.priority}">
          <div class="recommendation-header">
            <h4 class="recommendation-title">${rec.title}</h4>
            <span class="recommendation-priority">${rec.priority} priority</span>
          </div>
          <div class="recommendation-description">${rec.description}</div>
          <div class="recommendation-meta">
            <span class="recommendation-category">${rec.category}</span>
            <span class="recommendation-effort">Effort: ${rec.effort}</span>
            <span class="recommendation-timeline">${rec.timeline}</span>
          </div>
          <div class="recommendation-impact">
            <strong>Expected Impact:</strong> ${rec.expectedImpact}
          </div>
          ${rec.actionItems && rec.actionItems.length > 0 ? `
            <div class="recommendation-actions">
              <strong>Action Items:</strong>
              <ul>
                ${rec.actionItems.map((item: string) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${rec.successMetrics && rec.successMetrics.length > 0 ? `
            <div class="recommendation-metrics">
              <strong>Success Metrics:</strong>
              <ul>
                ${rec.successMetrics.map((metric: string) => `<li>${metric}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>`;
      });
      html += '</div>';
    } else {
      html += '<div class="no-recommendations">No recommendations available.</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate chart HTML
   */
  private async generateChartHTML(chart: ChartData): Promise<string> {
    // For PDF generation, we'll create a simple HTML representation
    // In a real implementation, you might use a chart library that can generate images
    
    let html = `<div class="chart-container" id="${chart.id}">
      <h4 class="chart-title">${chart.title}</h4>`;

    if (chart.type === 'line' || chart.type === 'area') {
      html += this.generateLineChartHTML(chart);
    } else if (chart.type === 'bar') {
      html += this.generateBarChartHTML(chart);
    } else if (chart.type === 'pie') {
      html += this.generatePieChartHTML(chart);
    } else {
      html += '<div class="chart-placeholder">Chart visualization not available in PDF</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate line chart HTML representation
   */
  private generateLineChartHTML(chart: ChartData): string {
    const data = chart.data;
    if (!data.labels || !data.datasets || data.datasets.length === 0) {
      return '<div class="chart-error">No data available</div>';
    }

    const dataset = data.datasets[0];
    const values = dataset.data;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    let html = '<div class="line-chart">';
    html += '<div class="chart-data">';
    
    // Create a simple table representation
    html += '<table class="chart-table">';
    html += '<thead><tr><th>Date</th><th>Value</th></tr></thead>';
    html += '<tbody>';
    
    data.labels.forEach((label: string, index: number) => {
      const value = values[index];
      const percentage = ((value - min) / range) * 100;
      html += `<tr>
        <td>${label}</td>
        <td>
          <div class="value-bar">
            <div class="value-fill" style="width: ${percentage}%"></div>
            <span class="value-text">${value.toFixed(2)}</span>
          </div>
        </td>
      </tr>`;
    });
    
    html += '</tbody></table>';
    html += '</div></div>';
    
    return html;
  }

  /**
   * Generate bar chart HTML representation
   */
  private generateBarChartHTML(chart: ChartData): string {
    // Similar implementation to line chart but with different styling
    return this.generateLineChartHTML(chart);
  }

  /**
   * Generate pie chart HTML representation
   */
  private generatePieChartHTML(chart: ChartData): string {
    const data = chart.data;
    if (!data.labels || !data.datasets || data.datasets.length === 0) {
      return '<div class="chart-error">No data available</div>';
    }

    const dataset = data.datasets[0];
    const values = dataset.data;
    const total = values.reduce((sum: number, val: number) => sum + val, 0);

    let html = '<div class="pie-chart">';
    html += '<div class="pie-legend">';
    
    data.labels.forEach((label: string, index: number) => {
      const value = values[index];
      const percentage = ((value / total) * 100).toFixed(1);
      html += `<div class="legend-item">
        <span class="legend-color" style="background-color: ${this.getChartColor(index)}"></span>
        <span class="legend-label">${label}</span>
        <span class="legend-value">${percentage}%</span>
      </div>`;
    });
    
    html += '</div></div>';
    return html;
  }

  /**
   * Generate tables HTML
   */
  private generateTablesHTML(tables: TableData[]): string {
    let html = '<div class="tables-container">';

    tables.forEach(table => {
      html += `<div class="table-wrapper">
        <h4 class="table-title">${table.title}</h4>
        <table class="data-table ${table.formatting?.borders ? 'bordered' : ''}">`;

      // Headers
      if (table.headers && table.headers.length > 0) {
        html += '<thead><tr>';
        table.headers.forEach(header => {
          html += `<th>${header}</th>`;
        });
        html += '</tr></thead>';
      }

      // Rows
      html += '<tbody>';
      table.rows.forEach((row, rowIndex) => {
        const isAlternate = table.formatting?.alternateRowColor && rowIndex % 2 === 1;
        html += `<tr${isAlternate ? ' class="alternate"' : ''}>`;
        row.forEach(cell => {
          html += `<td>${cell}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody>';

      html += '</table></div>';
    });

    html += '</div>';
    return html;
  }

  /**
   * Generate summary HTML for report summary
   */
  private generateSummaryHTML(summary: any): string {
    return `<div class="report-summary">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-label">Total Metrics:</span>
          <span class="stat-value">${summary.totalMetrics || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Key Insights:</span>
          <span class="stat-value">${summary.keyInsights?.length || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Critical Alerts:</span>
          <span class="stat-value">${summary.criticalAlerts || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Health Score:</span>
          <span class="stat-value health-score-${this.getHealthScoreClass(summary.healthScore)}">${summary.healthScore || 0}/100</span>
        </div>
      </div>
    </div>`;
  }

  /**
   * Generate CSS styles for PDF
   */
  private generateCSSStyles(template: PDFTemplate): string {
    return `
      <style>
        ${template.cssStyles}

        /* Additional PDF-specific styles */
        @media print {
          .page-break { page-break-before: always; }
          .no-print { display: none; }
        }

        /* Chart styles */
        .chart-container {
          margin: 20px 0;
          page-break-inside: avoid;
        }

        .chart-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #333;
        }

        .line-chart, .bar-chart {
          width: 100%;
        }

        .chart-table {
          width: 100%;
          border-collapse: collapse;
        }

        .chart-table th,
        .chart-table td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }

        .value-bar {
          position: relative;
          background: #f0f0f0;
          height: 20px;
          border-radius: 3px;
          overflow: hidden;
        }

        .value-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          transition: width 0.3s ease;
        }

        .value-text {
          position: absolute;
          top: 50%;
          right: 5px;
          transform: translateY(-50%);
          font-size: 12px;
          font-weight: bold;
          color: #333;
        }

        /* Pie chart styles */
        .pie-legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 2px;
        }

        .legend-label {
          flex: 1;
        }

        .legend-value {
          font-weight: bold;
        }

        /* Health score styles */
        .health-score-excellent { color: #10b981; }
        .health-score-good { color: #3b82f6; }
        .health-score-fair { color: #f59e0b; }
        .health-score-poor { color: #ef4444; }

        /* Trend styles */
        .trend-improving { color: #10b981; }
        .trend-stable { color: #6b7280; }
        .trend-declining { color: #ef4444; }

        /* Metric change styles */
        .metric-change.positive { color: #10b981; }
        .metric-change.negative { color: #ef4444; }

        /* Impact styles */
        .impact-high { border-left: 4px solid #ef4444; }
        .impact-medium { border-left: 4px solid #f59e0b; }
        .impact-low { border-left: 4px solid #10b981; }

        /* Priority styles */
        .priority-critical { border-left: 4px solid #dc2626; }
        .priority-high { border-left: 4px solid #ea580c; }
        .priority-medium { border-left: 4px solid #ca8a04; }
        .priority-low { border-left: 4px solid #16a34a; }
      </style>
    `;
  }

  /**
   * Convert HTML to PDF
   */
  private async convertHTMLToPDF(html: string, _options: PDFOptions, title: string): Promise<string> {
    try {
      // Create output directory
      const outputDir = path.join(this.context.globalStorageUri.fsPath, 'reports');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
      const outputPath = path.join(outputDir, filename);

      // TODO: For now, save as HTML (in a real implementation, you'd use puppeteer or similar)
      // This is a fallback implementation
      const htmlPath = outputPath.replace('.pdf', '.html');
      fs.writeFileSync(htmlPath, html, 'utf8');

      // TODO: In a real implementation, you would use a library like puppeteer:
      // const browser = await puppeteer.launch();
      // const page = await browser.newPage();
      // await page.setContent(html);
      // await page.pdf({ path: outputPath, ...options });
      // await browser.close();

      // TODO: For now, return the HTML path as a placeholder
      return htmlPath;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Get default PDF options
   */
  private getDefaultPDFOptions(overrides?: Partial<PDFOptions>): PDFOptions {
    const defaults: PDFOptions = {
      format: 'A4',
      orientation: 'portrait',
      margins: {
        top: '1in',
        right: '0.75in',
        bottom: '1in',
        left: '0.75in'
      },
      headerFooter: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">{{title}}</div>',
      footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      printBackground: true,
      scale: 1
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Load PDF templates
   */
  private loadPDFTemplates(): void {
    // Default template
    this.templates.set('default', {
      name: 'Default Report Template',
      htmlTemplate: this.getDefaultHTMLTemplate(),
      cssStyles: this.getDefaultCSSStyles(),
      sections: {
        default: '<div class="section" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>',
        summary: '<div class="section summary-section" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>',
        metrics: '<div class="section metrics-section" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>',
        trends: '<div class="section trends-section" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>',
        insights: '<div class="section insights-section" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>',
        recommendations: '<div class="section recommendations-section" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>'
      }
    });

    // Team summary template
    this.templates.set('team-summary', {
      name: 'Team Summary Template',
      htmlTemplate: this.getTeamSummaryHTMLTemplate(),
      cssStyles: this.getTeamSummaryCSSStyles(),
      sections: {
        default: '<div class="team-section" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>',
        summary: '<div class="team-section team-overview" id="{{sectionId}}"><h2>{{sectionTitle}}</h2><div class="section-content">{{sectionContent}}</div></div>'
      }
    });

    // CI/CD template
    this.templates.set('cicd-integration', {
      name: 'CI/CD Integration Template',
      htmlTemplate: this.getCICDHTMLTemplate(),
      cssStyles: this.getCICDCSSStyles(),
      sections: {
        default: '<div class="cicd-section" id="{{sectionId}}"><h3>{{sectionTitle}}</h3><div class="section-content">{{sectionContent}}</div></div>'
      }
    });
  }

  /**
   * Get default HTML template
   */
  private getDefaultHTMLTemplate(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{title}}</title>
        {{styles}}
      </head>
      <body>
        <div class="report-container">
          <header class="report-header">
            <h1 class="report-title">{{title}}</h1>
            <div class="report-subtitle">{{subtitle}}</div>
            <div class="report-meta">
              <span class="report-author">{{author}}</span>
              <span class="report-date">{{date}}</span>
              <span class="report-period">{{dateRange}}</span>
            </div>
          </header>

          <div class="report-summary">
            {{summary}}
          </div>

          <main class="report-content">
            {{sections}}
          </main>

          <footer class="report-footer">
            <div class="footer-content">
              <p>Generated by CodePulse Analytics on {{date}}</p>
            </div>
          </footer>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get default CSS styles
   */
  private getDefaultCSSStyles(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #fff;
      }

      .report-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }

      .report-header {
        text-align: center;
        margin-bottom: 40px;
        padding-bottom: 20px;
        border-bottom: 2px solid #e5e7eb;
      }

      .report-title {
        font-size: 28px;
        font-weight: bold;
        color: #1f2937;
        margin-bottom: 10px;
      }

      .report-subtitle {
        font-size: 16px;
        color: #6b7280;
        margin-bottom: 15px;
      }

      .report-meta {
        display: flex;
        justify-content: center;
        gap: 20px;
        font-size: 14px;
        color: #9ca3af;
      }

      .section {
        margin-bottom: 40px;
        page-break-inside: avoid;
      }

      .section h2 {
        font-size: 20px;
        font-weight: bold;
        color: #1f2937;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #e5e7eb;
      }

      .section-content {
        padding: 0 10px;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }

      .data-table th,
      .data-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }

      .data-table th {
        background-color: #f9fafb;
        font-weight: bold;
        color: #374151;
      }

      .data-table.bordered {
        border: 1px solid #e5e7eb;
      }

      .data-table.bordered th,
      .data-table.bordered td {
        border: 1px solid #e5e7eb;
      }

      .data-table tr.alternate {
        background-color: #f9fafb;
      }

      .report-footer {
        margin-top: 60px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        color: #6b7280;
        font-size: 12px;
      }
    `;
  }

  /**
   * Get team summary HTML template
   */
  private getTeamSummaryHTMLTemplate(): string {
    // Similar to default but with team-specific styling
    return this.getDefaultHTMLTemplate().replace('report-container', 'report-container team-report');
  }

  /**
   * Get team summary CSS styles
   */
  private getTeamSummaryCSSStyles(): string {
    return this.getDefaultCSSStyles() + `
      .team-report .report-title::before {
        content: "👥 ";
      }

      .team-section {
        background: #f8fafc;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
      }
    `;
  }

  /**
   * Get CI/CD HTML template
   */
  private getCICDHTMLTemplate(): string {
    return this.getDefaultHTMLTemplate().replace('report-container', 'report-container cicd-report');
  }

  /**
   * Get CI/CD CSS styles
   */
  private getCICDCSSStyles(): string {
    return this.getDefaultCSSStyles() + `
      .cicd-report .report-title::before {
        content: "🔧 ";
      }

      .cicd-section {
        border-left: 4px solid #3b82f6;
        padding-left: 20px;
        margin-bottom: 25px;
      }
    `;
  }

  /**
   * Get health score CSS class
   */
  private getHealthScoreClass(score: number): string {
    if (score >= 80) {return 'excellent';}
    if (score >= 60) {return 'good';}
    if (score >= 40) {return 'fair';}
    return 'poor';
  }

  /**
   * Get chart color by index
   */
  private getChartColor(index: number): string {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
    ];
    return colors[index % colors.length];
  }

  /**
   * Format date range
   */
  private formatDateRange(dateRange: { start: number; end: number }): string {
    const start = new Date(dateRange.start).toLocaleDateString();
    const end = new Date(dateRange.end).toLocaleDateString();
    return `${start} - ${end}`;
  }
}
