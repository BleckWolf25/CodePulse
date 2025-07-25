/**
 * Scheduled Reports Manager
 * 
 * Manages automatic report generation, scheduling, and distribution
 * with support for multiple frequencies and delivery methods.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ReportGenerator, ReportConfig, ScheduleConfig, GeneratedReport } from './report-generator';
import { ErrorHandler } from '../utils/error-handler';

// ------------ INTERFACES

export interface ScheduledReportJob {
  id: string;
  configId: string;
  schedule: ScheduleConfig;
  lastRun?: number;
  nextRun: number;
  status: 'active' | 'paused' | 'error' | 'completed';
  errorMessage?: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ReportDistribution {
  method: 'email' | 'file' | 'webhook' | 'vscode_notification';
  config: {
    recipients?: string[];
    webhookUrl?: string;
    filePath?: string;
    notificationLevel?: 'info' | 'warning' | 'error';
  };
}

export interface SchedulerStats {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  errorJobs: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunTime?: number;
  nextRunTime?: number;
}

// ------------ MAIN CLASS

export class ScheduledReportsManager {
  private reportGenerator: ReportGenerator;
  private errorHandler = ErrorHandler.getInstance();
  private scheduledJobs = new Map<string, ScheduledReportJob>();
  private schedulerTimer?: NodeJS.Timeout;
  private isRunning = false;
  
  // Scheduler configuration
  private readonly CHECK_INTERVAL = 60000; // Check every minute
  private readonly MAX_CONCURRENT_JOBS = 3;
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 300000; // 5 minutes

  constructor(
    private context: vscode.ExtensionContext,
    reportGenerator: ReportGenerator
  ) {
    this.reportGenerator = reportGenerator;
    this.loadScheduledJobs();
  }

  /**
   * Start the scheduler
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.schedulerTimer = setInterval(() => {
      this.processScheduledJobs();
    }, this.CHECK_INTERVAL);

    console.log('Scheduled reports manager started');
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = undefined;
    }
    this.isRunning = false;
    console.log('Scheduled reports manager stopped');
  }

  /**
   * Schedule a new report
   */
  public async scheduleReport(
    configId: string,
    schedule: ScheduleConfig,
    distribution?: ReportDistribution[]
  ): Promise<string> {
    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const job: ScheduledReportJob = {
        id: jobId,
        configId,
        schedule: {
          ...schedule,
          nextRun: this.calculateNextRun(schedule)
        },
        nextRun: this.calculateNextRun(schedule),
        status: 'active',
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.scheduledJobs.set(jobId, job);
      await this.saveScheduledJobs();

      // Store distribution config if provided
      if (distribution && distribution.length > 0) {
        await this.saveDistributionConfig(jobId, distribution);
      }

      return jobId;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Update scheduled report
   */
  public async updateScheduledReport(
    jobId: string,
    updates: Partial<ScheduledReportJob>
  ): Promise<void> {
    const job = this.scheduledJobs.get(jobId);
    if (!job) {
      throw new Error(`Scheduled job not found: ${jobId}`);
    }

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: Date.now()
    };

    // Recalculate next run if schedule changed
    if (updates.schedule) {
      updatedJob.nextRun = this.calculateNextRun(updatedJob.schedule);
    }

    this.scheduledJobs.set(jobId, updatedJob);
    await this.saveScheduledJobs();
  }

  /**
   * Delete scheduled report
   */
  public async deleteScheduledReport(jobId: string): Promise<void> {
    this.scheduledJobs.delete(jobId);
    await this.saveScheduledJobs();
    
    // Clean up distribution config
    await this.deleteDistributionConfig(jobId);
  }

  /**
   * Get all scheduled jobs
   */
  public getScheduledJobs(): ScheduledReportJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  /**
   * Get scheduled job by ID
   */
  public getScheduledJob(jobId: string): ScheduledReportJob | undefined {
    return this.scheduledJobs.get(jobId);
  }

  /**
   * Pause scheduled job
   */
  public async pauseJob(jobId: string): Promise<void> {
    await this.updateScheduledReport(jobId, { status: 'paused' });
  }

  /**
   * Resume scheduled job
   */
  public async resumeJob(jobId: string): Promise<void> {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      await this.updateScheduledReport(jobId, {
        status: 'active',
        nextRun: this.calculateNextRun(job.schedule)
      });
    }
  }

  /**
   * Run job immediately
   */
  public async runJobNow(jobId: string): Promise<GeneratedReport> {
    const job = this.scheduledJobs.get(jobId);
    if (!job) {
      throw new Error(`Scheduled job not found: ${jobId}`);
    }

    return this.executeJob(job);
  }

  /**
   * Get scheduler statistics
   */
  public getSchedulerStats(): SchedulerStats {
    const jobs = Array.from(this.scheduledJobs.values());
    
    const stats: SchedulerStats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'active').length,
      pausedJobs: jobs.filter(j => j.status === 'paused').length,
      errorJobs: jobs.filter(j => j.status === 'error').length,
      totalRuns: jobs.reduce((sum, j) => sum + j.runCount, 0),
      successfulRuns: jobs.reduce((sum, j) => sum + j.successCount, 0),
      failedRuns: jobs.reduce((sum, j) => sum + j.failureCount, 0)
    };

    // Find next run time
    const activeJobs = jobs.filter(j => j.status === 'active');
    if (activeJobs.length > 0) {
      stats.nextRunTime = Math.min(...activeJobs.map(j => j.nextRun));
    }

    // Find last run time
    const jobsWithRuns = jobs.filter(j => j.lastRun);
    if (jobsWithRuns.length > 0) {
      stats.lastRunTime = Math.max(...jobsWithRuns.map(j => j.lastRun!));
    }

    return stats;
  }

  /**
   * Process scheduled jobs
   */
  private async processScheduledJobs(): Promise<void> {
    const now = Date.now();
    const dueJobs = Array.from(this.scheduledJobs.values())
      .filter(job => 
        job.status === 'active' && 
        job.nextRun <= now
      )
      .sort((a, b) => a.nextRun - b.nextRun)
      .slice(0, this.MAX_CONCURRENT_JOBS);

    if (dueJobs.length === 0) {
      return;
    }

    console.log(`Processing ${dueJobs.length} scheduled report jobs`);

    // Process jobs concurrently
    const jobPromises = dueJobs.map(job => this.processJob(job));
    await Promise.allSettled(jobPromises);

    // Save updated job states
    await this.saveScheduledJobs();
  }

  /**
   * Process individual job
   */
  private async processJob(job: ScheduledReportJob): Promise<void> {
    try {
      console.log(`Executing scheduled job: ${job.id}`);
      
      // Update job status
      job.runCount++;
      job.lastRun = Date.now();
      job.updatedAt = Date.now();

      // Execute the job
      const report = await this.executeJob(job);

      // Distribute the report
      await this.distributeReport(job.id, report);

      // Update success metrics
      job.successCount++;
      job.nextRun = this.calculateNextRun(job.schedule);
      job.status = 'active';
      job.errorMessage = undefined;

      console.log(`Successfully executed job: ${job.id}`);

    } catch (error) {
      console.error(`Failed to execute job ${job.id}:`, error);
      
      // Update failure metrics
      job.failureCount++;
      job.status = 'error';
      job.errorMessage = error.message;
      
      // Schedule retry if within retry limit
      if (job.failureCount <= this.RETRY_ATTEMPTS) {
        job.nextRun = Date.now() + this.RETRY_DELAY;
        job.status = 'active';
      }
    }
  }

  /**
   * Execute job and generate report
   */
  private async executeJob(job: ScheduledReportJob): Promise<GeneratedReport> {
    try {
      const report = await this.reportGenerator.generateReport(job.configId);
      return report;
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Distribute generated report
   */
  private async distributeReport(jobId: string, report: GeneratedReport): Promise<void> {
    try {
      const distributionConfig = await this.loadDistributionConfig(jobId);
      if (!distributionConfig || distributionConfig.length === 0) {
        // Default to VS Code notification
        vscode.window.showInformationMessage(
          `Report "${report.metadata.title}" has been generated successfully.`,
          'Open Report'
        ).then(selection => {
          if (selection === 'Open Report') {
            vscode.env.openExternal(vscode.Uri.file(report.filePath));
          }
        });
        return;
      }

      // Process each distribution method
      for (const distribution of distributionConfig) {
        await this.executeDistribution(distribution, report);
      }
    } catch (error) {
      console.error('Failed to distribute report:', error);
      // Don't throw here - report generation was successful
    }
  }

  /**
   * Execute individual distribution method
   */
  private async executeDistribution(
    distribution: ReportDistribution,
    report: GeneratedReport
  ): Promise<void> {
    switch (distribution.method) {
      case 'vscode_notification':
        vscode.window.showInformationMessage(
          `Report "${report.metadata.title}" has been generated.`,
          'Open Report'
        ).then(selection => {
          if (selection === 'Open Report') {
            vscode.env.openExternal(vscode.Uri.file(report.filePath));
          }
        });
        break;

      case 'file':
        if (distribution.config.filePath) {
          const targetPath = path.resolve(distribution.config.filePath);
          fs.copyFileSync(report.filePath, targetPath);
        }
        break;

      case 'webhook':
        if (distribution.config.webhookUrl) {
          // In a real implementation, you would make an HTTP request
          console.log(`Would send webhook to: ${distribution.config.webhookUrl}`);
        }
        break;

      case 'email':
        // In a real implementation, you would integrate with an email service
        console.log(`Would send email to: ${distribution.config.recipients?.join(', ')}`);
        break;

      default:
        console.warn(`Unknown distribution method: ${distribution.method}`);
    }
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(schedule: ScheduleConfig): number {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, move to next occurrence
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
        case 'quarterly':
          nextRun.setMonth(nextRun.getMonth() + 3);
          break;
      }
    }

    // Adjust for specific day requirements
    if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== undefined) {
      const targetDay = schedule.dayOfWeek;
      const currentDay = nextRun.getDay();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd > 0 || (daysToAdd === 0 && nextRun <= now)) {
        nextRun.setDate(nextRun.getDate() + (daysToAdd || 7));
      }
    }

    if (schedule.frequency === 'monthly' && schedule.dayOfMonth !== undefined) {
      nextRun.setDate(schedule.dayOfMonth);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(schedule.dayOfMonth);
      }
    }

    return nextRun.getTime();
  }

  /**
   * Load scheduled jobs from storage
   */
  private async loadScheduledJobs(): Promise<void> {
    try {
      const jobsPath = path.join(this.context.globalStorageUri.fsPath, 'scheduled-jobs.json');
      if (fs.existsSync(jobsPath)) {
        const jobsData = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
        this.scheduledJobs.clear();
        jobsData.forEach((job: ScheduledReportJob) => {
          this.scheduledJobs.set(job.id, job);
        });
      }
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    }
  }

  /**
   * Save scheduled jobs to storage
   */
  private async saveScheduledJobs(): Promise<void> {
    try {
      const jobsPath = path.join(this.context.globalStorageUri.fsPath, 'scheduled-jobs.json');
      const jobsData = Array.from(this.scheduledJobs.values());
      
      // Ensure directory exists
      const dir = path.dirname(jobsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(jobsPath, JSON.stringify(jobsData, null, 2));
    } catch (error) {
      console.error('Failed to save scheduled jobs:', error);
    }
  }

  /**
   * Save distribution configuration
   */
  private async saveDistributionConfig(jobId: string, distribution: ReportDistribution[]): Promise<void> {
    try {
      const configPath = path.join(this.context.globalStorageUri.fsPath, 'distributions', `${jobId}.json`);
      
      // Ensure directory exists
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(configPath, JSON.stringify(distribution, null, 2));
    } catch (error) {
      console.error('Failed to save distribution config:', error);
    }
  }

  /**
   * Load distribution configuration
   */
  private async loadDistributionConfig(jobId: string): Promise<ReportDistribution[] | null> {
    try {
      const configPath = path.join(this.context.globalStorageUri.fsPath, 'distributions', `${jobId}.json`);
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to load distribution config:', error);
    }
    return null;
  }

  /**
   * Delete distribution configuration
   */
  private async deleteDistributionConfig(jobId: string): Promise<void> {
    try {
      const configPath = path.join(this.context.globalStorageUri.fsPath, 'distributions', `${jobId}.json`);
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    } catch (error) {
      console.error('Failed to delete distribution config:', error);
    }
  }
}
