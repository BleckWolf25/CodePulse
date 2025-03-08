/**
 * src/utils/error-handler.ts
 * 
 * Centralized Error Handling System
 * 
 * Implements singleton pattern for consistent error handling across components
 * Provides multi-level logging with user notifications
 */

// -------------------- IMPORTS -------------------- \\

import * as vscode from 'vscode';

// -------------------- MAIN EXPORT -------------------- \\

export class ErrorHandler {
  private static instance: ErrorHandler;
  private outputChannel: vscode.OutputChannel;

  /**
   * Private constructor for singleton pattern
   * @remarks
   * - Creates dedicated output channel for errors
   * - Ensures single instance through static access
   */
  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Productivity Dashboard Errors');
  }

  /**
   * Singleton accessor
   * @returns Single instance of ErrorHandler
   */
  public static getInstance(): ErrorHandler {
    return this.instance || (this.instance = new ErrorHandler());
  }

  /**
   * Unified logging method with tiered handling
   * @param message - Descriptive error message
   * @param type - Severity level (info|warn|error)
   * @remarks
   * - INFO: Silent console/output logging
   * - WARN: Console + user warning notification
   * - ERROR: Console + user error notification + output channel
   */
  public log(message: string, type: 'info' | 'warn' | 'error' = 'error') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;

    switch (type) {
      case 'info':

        // Silent logging for diagnostics
        console.log(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
        break;
      case 'warn':

        // Non-critical issues with user alert
        console.warn(formattedMessage);
        vscode.window.showWarningMessage(message);
        this.outputChannel.appendLine(`WARNING: ${formattedMessage}`);
        break;
      case 'error':

        // Critical errors with user notification
        console.error(formattedMessage);
        vscode.window.showErrorMessage(message);
        this.outputChannel.appendLine(`ERROR: ${formattedMessage}`);
        break;
    }
  }
}