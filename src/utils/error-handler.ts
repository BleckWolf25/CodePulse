// src/utils/error-handler.ts
import * as vscode from 'vscode';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private outputChannel: vscode.OutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Productivity Dashboard Errors');
  }

  public static getInstance(): ErrorHandler {
    return this.instance || (this.instance = new ErrorHandler());
  }

  public log(message: string, type: 'info' | 'warn' | 'error' = 'error') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;

    switch (type) {
      case 'info':
        console.log(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        vscode.window.showWarningMessage(message);
        this.outputChannel.appendLine(`WARNING: ${formattedMessage}`);
        break;
      case 'error':
        console.error(formattedMessage);
        vscode.window.showErrorMessage(message);
        this.outputChannel.appendLine(`ERROR: ${formattedMessage}`);
        break;
    }
  }
}