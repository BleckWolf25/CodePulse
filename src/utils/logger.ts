/**
 * Comprehensive Logging System
 * 
 * Advanced logging with multiple outputs, log rotation, filtering,
 * structured logging, and performance-optimized async operations.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorContext } from './advanced-error-handler';

// ------------ INTERFACES

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  component?: string;
  operation?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  correlationId?: string;
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  performanceMarks?: Record<string, number>;
}

export interface LoggerConfig {
  level: LogLevel;
  outputs: LogOutput[];
  maxFileSize: number;
  maxFiles: number;
  bufferSize: number;
  flushInterval: number;
  enablePerformanceLogging: boolean;
  enableMemoryLogging: boolean;
  enableStackTrace: boolean;
  enableCorrelation: boolean;
  sensitiveFields: string[];
}

export interface LogOutput {
  type: 'file' | 'console' | 'vscode' | 'remote';
  enabled: boolean;
  level: LogLevel;
  format: 'json' | 'text' | 'structured';
  config?: Record<string, any>;
}

export interface LogFilter {
  component?: string;
  operation?: string;
  level?: LogLevel;
  timeRange?: { start: number; end: number };
  searchTerm?: string;
  correlationId?: string;
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByComponent: Record<string, number>;
  averageLogSize: number;
  oldestLog: number;
  newestLog: number;
  errorRate: number;
  warningRate: number;
}

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  CRITICAL = 5
}

// ------------ MAIN CLASS

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private correlationCounter = 0;
  private currentCorrelationId?: string;
  private performanceMarks = new Map<string, number>();
  
  // File handles for different log levels
  private logFiles = new Map<LogLevel, string>();
  private logStreams = new Map<LogLevel, fs.WriteStream>();

  constructor(private context: vscode.ExtensionContext) {
    this.config = this.getDefaultConfig();
    this.loadConfiguration();
    this.initializeLogFiles();
    this.startFlushTimer();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(context?: vscode.ExtensionContext): Logger {
    if (!Logger.instance && context) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  /**
   * Log trace message
   */
  public async logTrace(message: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.TRACE, message, metadata);
  }

  /**
   * Log debug message
   */
  public async logDebug(message: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  public async logInfo(message: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  public async logWarn(message: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  public async logError(error: Error, context?: Partial<ErrorContext>): Promise<void> {
    const metadata = {
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      ...context?.metadata
    };

    return this.log(LogLevel.ERROR, error.message, metadata, {
      component: context?.component,
      operation: context?.operation,
      stackTrace: error.stack
    });
  }

  /**
   * Log critical message
   */
  public async logCritical(message: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.CRITICAL, message, metadata);
  }

  /**
   * Start performance measurement
   */
  public startPerformanceMeasurement(operation: string): string {
    const correlationId = this.generateCorrelationId();
    this.currentCorrelationId = correlationId;
    this.performanceMarks.set(`${operation}_start`, Date.now());
    
    if (this.config.enablePerformanceLogging) {
      this.logDebug(`Performance measurement started: ${operation}`, {
        operation,
        correlationId
      });
    }
    
    return correlationId;
  }

  /**
   * End performance measurement
   */
  public async endPerformanceMeasurement(
    operation: string,
    correlationId?: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    const endTime = Date.now();
    const startTime = this.performanceMarks.get(`${operation}_start`);
    
    if (!startTime) {
      await this.logWarn(`Performance measurement end called without start: ${operation}`);
      return 0;
    }
    
    const duration = endTime - startTime;
    this.performanceMarks.delete(`${operation}_start`);
    
    if (this.config.enablePerformanceLogging) {
      await this.logInfo(`Performance measurement completed: ${operation}`, {
        operation,
        duration,
        correlationId: correlationId || this.currentCorrelationId,
        ...metadata
      });
    }
    
    return duration;
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    options?: {
      component?: string;
      operation?: string;
      stackTrace?: string;
      correlationId?: string;
    }
  ): Promise<void> {
    // Check if logging level is enabled
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: this.sanitizeMessage(message),
      component: options?.component,
      operation: options?.operation,
      sessionId: this.getSessionId(),
      correlationId: options?.correlationId || this.currentCorrelationId,
      metadata: this.sanitizeMetadata(metadata),
      stackTrace: this.config.enableStackTrace ? options?.stackTrace : undefined,
      memoryUsage: this.config.enableMemoryLogging ? process.memoryUsage() : undefined,
      performanceMarks: this.config.enablePerformanceLogging ? 
        Object.fromEntries(this.performanceMarks) : undefined
    };

    // Add to buffer
    this.logBuffer.push(entry);

    // Immediate flush for critical errors
    if (level >= LogLevel.ERROR) {
      await this.flushBuffer();
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.bufferSize) {
      await this.flushBuffer();
    }
  }

  /**
   * Flush log buffer to outputs
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    // Process each output
    for (const output of this.config.outputs.filter(o => o.enabled)) {
      try {
        await this.writeToOutput(output, entries);
      } catch (error) {
        // Fallback to console if output fails
        console.error('Failed to write to log output:', error);
        console.log('Failed log entries:', entries.slice(0, 5)); // Log first 5 entries
      }
    }
  }

  /**
   * Write entries to specific output
   */
  private async writeToOutput(output: LogOutput, entries: LogEntry[]): Promise<void> {
    const filteredEntries = entries.filter(entry => entry.level >= output.level);
    
    if (filteredEntries.length === 0) {
      return;
    }

    switch (output.type) {
      case 'file':
        await this.writeToFile(output, filteredEntries);
        break;
      case 'console':
        this.writeToConsole(output, filteredEntries);
        break;
      case 'vscode':
        this.writeToVSCode(output, filteredEntries);
        break;
      case 'remote':
        await this.writeToRemote(output, filteredEntries);
        break;
    }
  }

  /**
   * Write to file output
   */
  private async writeToFile(output: LogOutput, entries: LogEntry[]): Promise<void> {
    for (const entry of entries) {
      const logFile = this.getLogFileForLevel(entry.level);
      const formattedEntry = this.formatEntry(entry, output.format);
      
      try {
        // Check file size and rotate if necessary
        await this.checkAndRotateLog(logFile);
        
        // Write to file
        await fs.promises.appendFile(logFile, formattedEntry + '\n', 'utf8');
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  /**
   * Write to console output
   */
  private writeToConsole(output: LogOutput, entries: LogEntry[]): void {
    for (const entry of entries) {
      const formattedEntry = this.formatEntry(entry, output.format);
      
      switch (entry.level) {
        case LogLevel.TRACE:
        case LogLevel.DEBUG:
          console.debug(formattedEntry);
          break;
        case LogLevel.INFO:
          console.info(formattedEntry);
          break;
        case LogLevel.WARN:
          console.warn(formattedEntry);
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          console.error(formattedEntry);
          break;
      }
    }
  }

  /**
   * Write to VS Code output
   */
  private writeToVSCode(_output: LogOutput, entries: LogEntry[]): void {
    const outputChannel = vscode.window.createOutputChannel('CodePulse Logs');
    
    for (const entry of entries) {
      const formattedEntry = this.formatEntry(entry, 'text');
      outputChannel.appendLine(formattedEntry);
    }
  }

  /**
   * Write to remote output (webhook, API, etc.)
   */
  private async writeToRemote(output: LogOutput, entries: LogEntry[]): Promise<void> {
    if (!output.config?.endpoint) {
      return;
    }

    try {
      const payload = {
        timestamp: Date.now(),
        source: 'codepulse-extension',
        entries: entries.map(entry => this.formatEntry(entry, 'json'))
      };

      // In a real implementation, you would make an HTTP request
      console.log('Would send to remote endpoint:', output.config.endpoint, payload);
    } catch (error) {
      console.error('Failed to send logs to remote endpoint:', error);
    }
  }

  /**
   * Format log entry based on format type
   */
  private formatEntry(entry: LogEntry, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(entry);
      
      case 'structured':
        return this.formatStructured(entry);
      
      case 'text':
      default:
        return this.formatText(entry);
    }
  }

  /**
   * Format entry as text
   */
  private formatText(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level].padEnd(8);
    const component = entry.component ? `[${entry.component}]` : '';
    const operation = entry.operation ? `(${entry.operation})` : '';
    const correlation = entry.correlationId ? `{${entry.correlationId}}` : '';
    
    let formatted = `${timestamp} ${level} ${component}${operation}${correlation} ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      formatted += ` | ${JSON.stringify(entry.metadata)}`;
    }
    
    if (entry.duration) {
      formatted += ` | Duration: ${entry.duration}ms`;
    }
    
    return formatted;
  }

  /**
   * Format entry as structured text
   */
  private formatStructured(entry: LogEntry): string {
    const lines = [
      `[${new Date(entry.timestamp).toISOString()}] ${LogLevel[entry.level]} ${entry.message}`
    ];
    
    if (entry.component) {lines.push(`  Component: ${entry.component}`);}
    if (entry.operation) {lines.push(`  Operation: ${entry.operation}`);}
    if (entry.correlationId) {lines.push(`  Correlation: ${entry.correlationId}`);}
    if (entry.duration) {lines.push(`  Duration: ${entry.duration}ms`);}
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      lines.push('  Metadata:');
      Object.entries(entry.metadata).forEach(([key, value]) => {
        lines.push(`    ${key}: ${JSON.stringify(value)}`);
      });
    }
    
    if (entry.memoryUsage) {
      lines.push(`  Memory: RSS=${Math.round(entry.memoryUsage.rss / 1024 / 1024)}MB`);
    }
    
    if (entry.stackTrace) {
      lines.push('  Stack Trace:');
      entry.stackTrace.split('\n').forEach(line => {
        lines.push(`    ${line}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Get log file path for specific level
   */
  private getLogFileForLevel(level: LogLevel): string {
    if (!this.logFiles.has(level)) {
      const levelName = LogLevel[level].toLowerCase();
      const logDir = path.join(this.context.globalStorageUri.fsPath, 'logs');
      const logFile = path.join(logDir, `${levelName}.log`);
      this.logFiles.set(level, logFile);
    }
    
    return this.logFiles.get(level)!;
  }

  /**
   * Check and rotate log file if necessary
   */
  private async checkAndRotateLog(logFile: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(logFile);
      
      if (stats.size > this.config.maxFileSize) {
        await this.rotateLogFile(logFile);
      }
    } catch (error) {
      // File doesn't exist, create directory
      const dir = path.dirname(logFile);
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(logFile: string): Promise<void> {
    const dir = path.dirname(logFile);
    const basename = path.basename(logFile, '.log');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = path.join(dir, `${basename}-${timestamp}.log`);
    
    try {
      await fs.promises.rename(logFile, rotatedFile);
      
      // Clean up old log files
      await this.cleanupOldLogs(dir, basename);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(dir: string, basename: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(dir);
      const logFiles = files
        .filter(file => file.startsWith(basename) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          stat: fs.statSync(path.join(dir, file))
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
      
      // Keep only the most recent files
      const filesToDelete = logFiles.slice(this.config.maxFiles);
      
      for (const file of filesToDelete) {
        await fs.promises.unlink(file.path);
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Search logs with filters
   */
  public async searchLogs(filter: LogFilter, limit: number = 1000): Promise<LogEntry[]> {
    const results: LogEntry[] = [];

    try {
      // Read from all log files
      for (const [level, logFile] of this.logFiles) {
        if (filter.level !== undefined && level < filter.level) {
          continue;
        }

        if (fs.existsSync(logFile)) {
          const content = await fs.promises.readFile(logFile, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry: LogEntry = JSON.parse(line);

              if (this.matchesFilter(entry, filter)) {
                results.push(entry);

                if (results.length >= limit) {
                  break;
                }
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }

        if (results.length >= limit) {
          break;
        }
      }
    } catch (error) {
      console.error('Failed to search logs:', error);
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get log statistics
   */
  public async getLogStats(): Promise<LogStats> {
    const stats: LogStats = {
      totalLogs: 0,
      logsByLevel: Object.values(LogLevel).reduce((acc, level) => {
        if (typeof level === 'number') {
          acc[level] = 0;
        }
        return acc;
      }, {} as Record<LogLevel, number>),
      logsByComponent: {},
      averageLogSize: 0,
      oldestLog: Date.now(),
      newestLog: 0,
      errorRate: 0,
      warningRate: 0
    };

    try {
      let totalSize = 0;
      let errorCount = 0;
      let warningCount = 0;

      for (const [level, logFile] of this.logFiles) {
        if (fs.existsSync(logFile)) {
          const content = await fs.promises.readFile(logFile, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry: LogEntry = JSON.parse(line);
              stats.totalLogs++;
              stats.logsByLevel[entry.level]++;

              if (entry.component) {
                stats.logsByComponent[entry.component] =
                  (stats.logsByComponent[entry.component] || 0) + 1;
              }

              totalSize += line.length;

              if (entry.timestamp < stats.oldestLog) {
                stats.oldestLog = entry.timestamp;
              }
              if (entry.timestamp > stats.newestLog) {
                stats.newestLog = entry.timestamp;
              }

              if (entry.level >= LogLevel.ERROR) {
                errorCount++;
              }
              if (entry.level === LogLevel.WARN) {
                warningCount++;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      stats.averageLogSize = stats.totalLogs > 0 ? totalSize / stats.totalLogs : 0;
      stats.errorRate = stats.totalLogs > 0 ? (errorCount / stats.totalLogs) * 100 : 0;
      stats.warningRate = stats.totalLogs > 0 ? (warningCount / stats.totalLogs) * 100 : 0;
    } catch (error) {
      console.error('Failed to calculate log stats:', error);
    }

    return stats;
  }

  /**
   * Clear all logs
   */
  public async clearLogs(): Promise<void> {
    try {
      for (const [level, logFile] of this.logFiles) {
        if (fs.existsSync(logFile)) {
          await fs.promises.unlink(logFile);
        }
      }

      this.logBuffer = [];
      await this.logInfo('All logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * Export logs to file
   */
  public async exportLogs(
    outputPath: string,
    filter?: LogFilter,
    format: 'json' | 'text' | 'csv' = 'json'
  ): Promise<void> {
    try {
      const logs = await this.searchLogs(filter || {}, 10000);
      let content = '';

      switch (format) {
        case 'json':
          content = JSON.stringify(logs, null, 2);
          break;
        case 'csv':
          content = this.formatLogsAsCSV(logs);
          break;
        case 'text':
        default:
          content = logs.map(log => this.formatText(log)).join('\n');
          break;
      }

      await fs.promises.writeFile(outputPath, content, 'utf8');
      await this.logInfo(`Logs exported to ${outputPath}`, {
        format,
        logCount: logs.length
      });
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  /**
   * Update logger configuration
   */
  public updateConfiguration(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();

    // Restart flush timer if interval changed
    if (newConfig.flushInterval) {
      this.stopFlushTimer();
      this.startFlushTimer();
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Check if filter matches entry
   */
  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    if (filter.component && entry.component !== filter.component) {
      return false;
    }

    if (filter.operation && entry.operation !== filter.operation) {
      return false;
    }

    if (filter.level !== undefined && entry.level < filter.level) {
      return false;
    }

    if (filter.correlationId && entry.correlationId !== filter.correlationId) {
      return false;
    }

    if (filter.timeRange) {
      if (entry.timestamp < filter.timeRange.start || entry.timestamp > filter.timeRange.end) {
        return false;
      }
    }

    if (filter.searchTerm) {
      const searchTerm = filter.searchTerm.toLowerCase();
      const searchableText = [
        entry.message,
        entry.component,
        entry.operation,
        JSON.stringify(entry.metadata)
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Format logs as CSV
   */
  private formatLogsAsCSV(logs: LogEntry[]): string {
    const headers = [
      'timestamp',
      'level',
      'message',
      'component',
      'operation',
      'correlationId',
      'duration',
      'metadata'
    ];

    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      LogLevel[log.level],
      log.message,
      log.component || '',
      log.operation || '',
      log.correlationId || '',
      log.duration?.toString() || '',
      JSON.stringify(log.metadata || {})
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  /**
   * Sanitize message to remove sensitive information
   */
  private sanitizeMessage(message: string): string {
    let sanitized = message;

    for (const field of this.config.sensitiveFields) {
      const regex = new RegExp(`${field}[\\s]*[:=][\\s]*[\\S]+`, 'gi');
      sanitized = sanitized.replace(regex, `${field}: [REDACTED]`);
    }

    return sanitized;
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) {return undefined;}

    const sanitized = { ...metadata };

    for (const field of this.config.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${++this.correlationCounter}`;
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    return this.context.globalState.get('sessionId') || 'unknown';
  }

  /**
   * Initialize log files
   */
  private initializeLogFiles(): void {
    const logDir = path.join(this.context.globalStorageUri.fsPath, 'logs');

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer().catch(error => {
        console.error('Failed to flush log buffer:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): LoggerConfig {
    return {
      level: LogLevel.INFO,
      outputs: [
        {
          type: 'file',
          enabled: true,
          level: LogLevel.DEBUG,
          format: 'json'
        },
        {
          type: 'console',
          enabled: true,
          level: LogLevel.WARN,
          format: 'text'
        },
        {
          type: 'vscode',
          enabled: true,
          level: LogLevel.INFO,
          format: 'text'
        }
      ],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      bufferSize: 100,
      flushInterval: 5000, // 5 seconds
      enablePerformanceLogging: true,
      enableMemoryLogging: true,
      enableStackTrace: true,
      enableCorrelation: true,
      sensitiveFields: ['password', 'token', 'key', 'secret', 'auth']
    };
  }

  /**
   * Load configuration from storage
   */
  private loadConfiguration(): void {
    try {
      const stored = this.context.globalState.get<Partial<LoggerConfig>>('loggerConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      console.error('Failed to load logger configuration:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private saveConfiguration(): void {
    try {
      this.context.globalState.update('loggerConfig', this.config);
    } catch (error) {
      console.error('Failed to save logger configuration:', error);
    }
  }

  /**
   * Dispose logger and cleanup resources
   */
  public async dispose(): Promise<void> {
    this.stopFlushTimer();
    await this.flushBuffer();

    // Close file streams
    for (const stream of this.logStreams.values()) {
      stream.end();
    }

    this.logStreams.clear();
    this.logFiles.clear();
    this.logBuffer = [];
    this.performanceMarks.clear();
  }
}
