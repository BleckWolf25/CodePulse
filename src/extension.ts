/**
 * @file extension.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Main entry point for the CodePulse VS Code extension.
 *
 * @description
 * Activates the extension, initializes tree-sitter parsers and the database,
 * registers commands and providers, and manages the webview dashboard for
 * displaying complexity metrics.
 *
 * @since 07/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import { TreeSitterManager } from './parser/parser.js';
import { DatabaseManager } from './database/database.js';
import { EventProcessor } from './parser/eventProcessor.js';
import { CodePulseCodeLensProvider } from './editor/codeLensProvider.js';
import { CodePulseHoverProvider } from './editor/hoverProvider.js';

// ---------- STATE
let panel: vscode.WebviewPanel | undefined;

// ---------- HELPERS
/**
 * Generates the HTML content for the CodePulse dashboard webview.
 *
 * @param panel - The webview panel to generate content for.
 * @param context - The extension context for resolving URIs.
 * @returns The HTML string for the webview.
 */
function getWebviewContent(panel: vscode.WebviewPanel, context: vscode.ExtensionContext): string {
    const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'webview.js'),
    );
    const styleUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'index.css'),
    );
    const cspSource = panel.webview.cspSource;

    return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${cspSource}; script-src 'unsafe-inline' ${cspSource}; img-src data: ${cspSource}; font-src ${cspSource};" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>CodePulse Dashboard</title>
                    <link rel="stylesheet" href="${styleUri.toString()}" />
                </head>
                <body>
                    <div id="app"></div>
                    <script>
                        window.addEventListener('error', function(e) {
                            console.error('Webview Error:', e.error || e.message);
                            var app = document.getElementById('app');
                            if (app && !app.innerHTML.trim()) {
                                app.innerHTML = '<div style="padding: 24px; color: #f87171; font-family: sans-serif;">' +
                                    '<h3>Dashboard Error</h3><p>' + (e.message || e.error || 'Unknown error') + '</p></div>';
                            }
                        });
                    </script>
                    <script type="module" src="${scriptUri.toString()}"></script>
                </body>
            </html>`;
}

function showDashboard(context: vscode.ExtensionContext): void {
    const sendDashboardData = (): void => {
        if (!panel) {
            return;
        }
        const db = DatabaseManager.getInstance();
        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'untitled';
        const metrics = db.queryAllMetrics();
        panel.webview.postMessage({
            workspaceName,
            metrics: metrics.map((row: Record<string, unknown>) => {
                let parsedFuncs: unknown[] = [];
                try {
                    const rawVal = row.function_metrics ?? row.functionMetrics;
                    if (typeof rawVal === 'string') {
                        parsedFuncs = JSON.parse(rawVal) as unknown[];
                    } else if (Array.isArray(rawVal)) {
                        parsedFuncs = rawVal;
                    }
                } catch {
                    // Ignore malformed JSON
                }

                return {
                    timestamp: typeof row.timestamp === 'string' ? row.timestamp : new Date().toISOString(),
                    filePath:
                        typeof row.file_path === 'string'
                            ? row.file_path
                            : typeof row.filePath === 'string'
                              ? row.filePath
                              : 'unknown',
                    language: typeof row.language === 'string' ? row.language : 'unknown',
                    cyclomaticComplexity: Number(row.cyclomatic_complexity ?? row.cyclomaticComplexity ?? 0),
                    cognitiveComplexity: Number(row.cognitive_complexity ?? row.cognitiveComplexity ?? 0),
                    sloc: Number(row.sloc ?? 0),
                    functionMetrics: parsedFuncs,
                };
            }),
        });
    };

    if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        sendDashboardData();
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'codepulse.dashboard',
        'CodePulse Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'out', 'webview')],
        },
    );

    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');

    panel.webview.html = getWebviewContent(panel, context);

    const metricsSubscription = DatabaseManager.getInstance().onDidChangeMetrics(() => {
        sendDashboardData();
    });

    panel.webview.onDidReceiveMessage(async (message: { command?: string; data?: string; filename?: string }) => {
        const command = message.command;
        if (command === 'getDashboardData') {
            sendDashboardData();
        } else if (command === 'savePdf') {
            const dataBase64 = message.data;
            if (!dataBase64) {
                return;
            }
            const pdfFilters: Record<string, string[]> = {};
            pdfFilters['PDF Files'] = ['pdf'];
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(message.filename ?? 'codepulse-report.pdf'),
                filters: pdfFilters
            });
            if (uri) {
                try {
                    const buffer = Buffer.from(dataBase64, 'base64');
                    await fs.writeFile(uri.fsPath, buffer);
                    vscode.window.showInformationMessage('PDF report successfully saved!');
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to save PDF report: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }
    });

    setTimeout(sendDashboardData, 500);

    panel.onDidDispose(() => {
        metricsSubscription.dispose();
        panel = undefined;
    });
}

// ---------- DATABASE RESOLUTION
/**
 * Resolves the local database file path inside the extension's global storage directory.
 * VS Code automatically chooses the correct OS-specific location:
 *   - Windows: %APPDATA%/User/globalStorage/<extension-id>/codepulse.db
 *   - macOS:   ~/Library/Application Support/User/globalStorage/<extension-id>/codepulse.db
 *   - Linux:   ~/.config/User/globalStorage/<extension-id>/codepulse.db
 */
async function getStorageDir(context: vscode.ExtensionContext): Promise<string> {
    const storageUri = context.globalStorageUri;
    const dbPath = storageUri.fsPath;

    // Ensure the storage directory exists
    try {
        await vscode.workspace.fs.createDirectory(storageUri);
    } catch (err) {
        console.error('[CodePulse] Failed to create storage directory:', err);
    }

    return dbPath;
}

// ---------- EXTENSION LIFECYCLE
export async function activate(context: vscode.ExtensionContext) {
    console.log('[CodePulse] Activating extension...');

    // 1. Resolve storage directory
    const storageDir = await getStorageDir(context);
    console.log(`[CodePulse] Storage directory: ${storageDir}`);

    // 2. Initialise tree-sitter WASM runtime and language parsers
    const tsManager = TreeSitterManager.getInstance();
    await tsManager.initialize(context);

    // 3. Initialise the SQLite database (load from disk or create)
    const db = DatabaseManager.getInstance();
    await db.initialize(storageDir);

    // 4. Start the event processor (listens to file save/change events)
    const eventProcessor = new EventProcessor();
    eventProcessor.activate();

    // 5. Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('codepulse.openDashboard', () => {
            showDashboard(context);
        }),
        vscode.commands.registerCommand('codepulse.exportJson', () => {
            void exportJson();
        }),
        vscode.commands.registerCommand('codepulse.exportCsv', () => {
            void exportCsv();
        }),
        vscode.commands.registerCommand('codepulse.purgeLogs', () => {
            void purgeLogs();
        }),
    );

    // 6. Register CodeLens and Hover providers
    const selector: vscode.DocumentSelector = [
        'typescript',
        'javascript',
        'typescriptreact',
        'python',
        'go',
        'java',
        'c',
        'cpp',
        'rust',
    ];
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(selector, new CodePulseCodeLensProvider()),
        vscode.languages.registerHoverProvider(selector, new CodePulseHoverProvider()),
    );

    // 7. Push dispose handlers for clean deactivation
    context.subscriptions.push({
        dispose(): void {
            eventProcessor.deactivate();
        },
    });

    console.log('[CodePulse] Extension activated successfully');

    showDashboard(context);
}

export async function deactivate(): Promise<void> {
    console.log('[CodePulse] Deactivating extension...');

    try {
        const db = DatabaseManager.getInstance();
        await db.dispose();
    } catch {
        // Ignore, may not have been initialised
    }

    try {
        const tsManager = TreeSitterManager.getInstance();
        tsManager.dispose();
    } catch {
        // Ignore
    }
}

async function exportJson() {
    const db = DatabaseManager.getInstance();
    const metrics = db.queryAllMetrics();
    const jsonFilters: Record<string, string[]> = {};
    jsonFilters['JSON Files'] = ['json'];
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('codepulse-metrics.json'),
        filters: jsonFilters
    });
    if (uri) {
        try {
            await fs.writeFile(uri.fsPath, JSON.stringify(metrics, null, 2), 'utf8');
            vscode.window.showInformationMessage('Metrics successfully exported as JSON!');
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to export JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

/**
 * Exports all metrics to a CSV file.
 */
async function exportCsv() {
    const db = DatabaseManager.getInstance();
    const metrics = db.queryAllMetrics();
    if (metrics.length === 0) {
        vscode.window.showInformationMessage('No metrics available to export.');
        return;
    }
    const headers = Object.keys(metrics[0]);
    const csvLines = [headers.join(',')];
    for (const row of metrics) {
        const line = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            const valStr = typeof val === 'string'
                ? val
                : (typeof val === 'number' || typeof val === 'boolean'
                    ? val.toString()
                    : (val instanceof Date ? val.toISOString() : JSON.stringify(val)));
            return valStr.includes(',') || valStr.includes('\n') || valStr.includes('"') ? `"${valStr.replace(/"/g, '""')}"` : valStr;
        }).join(',');
        csvLines.push(line);
    }
    const csvFilters: Record<string, string[]> = {};
    csvFilters['CSV Files'] = ['csv'];
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('codepulse-metrics.csv'),
        filters: csvFilters
    });
    if (uri) {
        try {
            await fs.writeFile(uri.fsPath, csvLines.join('\n'), 'utf8');
            vscode.window.showInformationMessage('Metrics successfully exported as CSV!');
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to export CSV: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

/**
 * Purges historical metrics older than the configured retention period.
 */
async function purgeLogs() {
    const config = vscode.workspace.getConfiguration('codepulse');
    const days = config.get<number>('retentionDays', 30);
    const db = DatabaseManager.getInstance();
    try {
        const count = await db.purgeOldLogs(days);
        vscode.window.showInformationMessage(`Purged ${count.toString()} historical metrics entries older than ${days.toString()} days.`);
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to purge old logs: ${err instanceof Error ? err.message : String(err)}`);
    }
}
