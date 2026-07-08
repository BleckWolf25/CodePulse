/**
 * @file eventProcessor.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Debounced event processor for VS Code document events.
 *
 * @description
 * Listens to file-save and text-change events, applies glob-based exclusion,
 * debounces on-type triggers, and writes results to the database.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
//------ IMPORTS
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import { TreeSitterManager } from './parser.js';
import { DatabaseManager } from '../database/database.js';
import type { AnalysisResult } from '../types.js';

//------ CLASS: EventProcessor
/**
 * Listens to file-save and text-change events, applies glob-based exclusion,
 * debounces on-type triggers, and writes results to the database.
 */
export class EventProcessor {
    private readonly _disposables: vscode.Disposable[] = [];
    private _debounceTimer: ReturnType<typeof setTimeout> | undefined;
    private _pendingAnalysis = new Map<
        string,
        { document: vscode.TextDocument; trigger: string }
    >();

    /**
     * Start listening to editor events.
     */
    activate(): void {
        // onSave
        this._disposables.push(
            vscode.workspace.onDidSaveTextDocument((doc) => {
                if (this._shouldSkip(doc)) {
                    return;
                }
                this._processDocument(doc, 'onSave');
            }),
        );

        // onType
        this._disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (this._shouldSkip(event.document)) {
                    return;
                }
                this._scheduleDebounced(event.document);
            }),
        );

        // onOpen
        this._disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                if (this._shouldSkip(doc)) {
                    return;
                }
                this._processDocument(doc, 'onOpen');
            }),
        );

        void this._scanWorkspaceDocuments();
    }

    /**
     * Stop listening and clean up.
     */
    deactivate(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables.length = 0;
        if (this._debounceTimer !== undefined) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = undefined;
        }
        this._pendingAnalysis.clear();
    }

    //------ PRIVATE HELPERS
    /** Set of VS Code language IDs that we support. */
    private static readonly _supportedLanguages = new Set([
        'typescript',
        'javascript',
        'typescriptreact',
        'python',
        'go',
        'java',
        'c',
        'cpp',
        'rust',
    ]);

    /**
     * Returns `true` if the document should be skipped based on:
     * - Language not supported by tree-sitter
     * - File path matches an exclusion glob or is an emitted build file
     * - Trigger setting is `manual`
     */
    private _shouldSkip(doc: vscode.TextDocument): boolean {
        const config = vscode.workspace.getConfiguration('codepulse');
        const trigger = config.get<string>('trigger', 'onSave');

        if (trigger === 'manual') {
            return true;
        }

        // Check language support
        if (!EventProcessor._supportedLanguages.has(doc.languageId)) {
            return true;
        }

        const normalizedPath = doc.uri.fsPath.replace(/\\/g, '/');

        // Built-in exclusions for emitted, minified, definition, and build directories
        if (
            normalizedPath.endsWith('.d.ts') ||
            normalizedPath.endsWith('.min.js') ||
            /\/node_modules\/|\/dist\/|\/build\/|\/out\/|\/\.next\/|\/coverage\/|\/\.git\//i.test(normalizedPath)
        ) {
            return true;
        }

        // Smart Source-over-Emit check: ignore emitted JS files when a corresponding TS source or map file exists
        if (doc.languageId === 'javascript' || /\.(js|jsx)$/i.test(doc.uri.fsPath)) {
            const tsPath = doc.uri.fsPath.replace(/\.jsx?$/i, '.ts');
            const tsxPath = doc.uri.fsPath.replace(/\.jsx?$/i, '.tsx');
            const mapPath = `${doc.uri.fsPath}.map`;
            if (fs.existsSync(tsPath) || fs.existsSync(tsxPath) || fs.existsSync(mapPath)) {
                return true;
            }
        }

        // Check exclusion globs
        const excludePatterns = config.get<string[]>('exclude', []);
        if (excludePatterns.length > 0) {
            const filePath = doc.uri.fsPath;
            for (const pattern of excludePatterns) {
                const regex = this._globToRegex(pattern);
                if (regex.test(filePath)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Schedule a debounced analysis for onType triggers.
     */
    private _scheduleDebounced(document: vscode.TextDocument): void {
        const config = vscode.workspace.getConfiguration('codepulse');
        const trigger = config.get<string>('trigger', 'onSave');
        const debounceDelay = config.get<number>('debounceDelay', 2000);

        if (trigger !== 'onType') {
            return;
        }

        // Cancel any pending timer
        if (this._debounceTimer !== undefined) {
            clearTimeout(this._debounceTimer);
        }

        // Mark document as pending
        this._pendingAnalysis.set(document.uri.toString(), { document, trigger: 'onType' });

        this._debounceTimer = setTimeout(() => {
            this._flushPending();
        }, debounceDelay);
    }

    private _getGitTrackedFiles(workspaceRoot: string): Promise<string[] | null> {
        return new Promise((resolve) => {
            cp.execFile(
                'git',
                ['ls-files'],
                { cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024 },
                (err, stdout) => {
                    if (err) {
                        resolve(null);
                        return;
                    }
                    const files = stdout
                        .split(/\r?\n/)
                        .map((f) => f.trim())
                        .filter((f) => f.length > 0 && /\.(ts|tsx|js|jsx|py|go|java|c|h|cpp|hpp|cc|rs)$/i.test(f))
                        .map((f) => path.join(workspaceRoot, f));
                    resolve(files);
                },
            );
        });
    }

    /**
     * Scan the currently open documents and workspace files once at activation.
     */
    private async _scanWorkspaceDocuments(): Promise<void> {
        const startMem = process.memoryUsage().heapUsed;
        const startTime = Date.now();

        for (const document of vscode.workspace.textDocuments) {
            if (!this._shouldSkip(document)) {
                this._processDocument(document, 'workspaceScan');
            }
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const gitTrackedFiles = await this._getGitTrackedFiles(workspaceFolder.uri.fsPath);
        const fileUris: vscode.Uri[] =
            gitTrackedFiles !== null
                ? gitTrackedFiles.map((f) => vscode.Uri.file(f))
                : await vscode.workspace.findFiles(
                      '**/*.{ts,tsx,js,jsx,py,go,java,c,h,cpp,hpp,cc,rs}',
                      '**/{node_modules,dist,build,out,.next,coverage,.git,.venv,__pycache__}/**',
                  );

        for (const fileUri of fileUris) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                if (!this._shouldSkip(document)) {
                    this._processDocument(document, 'workspaceScan');
                }
            } catch (err) {
                console.error('[CodePulse] Failed to read workspace file for analysis:', err);
            }
        }

        const endMem = process.memoryUsage().heapUsed;
        const duration = Date.now() - startTime;
        const diffMb = ((endMem - startMem) / 1024 / 1024).toFixed(2);
        console.log(`[CodePulse] Workspace scan completed in ${duration.toString()}ms. Memory delta: ${diffMb} MB. Heap used: ${(endMem / 1024 / 1024).toFixed(2)} MB`);
    }

    /**
     * Process all pending documents (triggered after debounce delay).
     */
    private _flushPending(): void {
        const pending = [...this._pendingAnalysis.values()];
        this._pendingAnalysis.clear();

        for (const { document } of pending) {
            this._processDocument(document, 'onType');
        }
    }

    /**
     * Run tree-sitter analysis on a document and persist the result.
     */
    private _processDocument(document: vscode.TextDocument, _trigger: string): void {
        const tsManager = TreeSitterManager.getInstance();
        const sourceText = document.getText();

        const scores = tsManager.analyze(document.languageId, sourceText);
        if (scores === null) {
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceName = workspaceFolder?.name ?? 'untitled';
        const workspaceRoot = workspaceFolder?.uri.fsPath ?? '';

        const result: AnalysisResult = {
            filePath: document.uri.fsPath,
            language: (document.languageId === 'typescriptreact' ? 'tsx' : document.languageId) as AnalysisResult['language'],
            cyclomaticComplexity: scores.cyclomaticComplexity,
            cognitiveComplexity: scores.cognitiveComplexity,
            sloc: scores.sloc,
            timestamp: new Date(),
        };

        try {
            const db = DatabaseManager.getInstance();
            db.ensureWorkspace(workspaceName, workspaceRoot);
            db.insertMetrics(result, workspaceName);
        } catch (err) {
            console.error('[CodePulse] Failed to persist analysis result:', err);
        }
    }

    /**
     * Convert a simple glob pattern to a RegExp.
     * Supports `**`, `*`, and `?` wildcards.
     */
    private _globToRegex(pattern: string): RegExp {
        let regexStr = '';
        for (let i = 0; i < pattern.length; i++) {
            const ch = pattern[i];
            if (ch === '*') {
                if (i + 1 < pattern.length && pattern[i + 1] === '*') {
                    // ** matches everything
                    regexStr += '.*';
                    i++; // skip next *
                } else {
                    // * matches anything except path separators
                    regexStr += '[^/]*';
                }
            } else if (ch === '?') {
                regexStr += '[^/]';
            } else if (ch === '.') {
                regexStr += '\\.';
            } else if (ch === '/') {
                regexStr += '[/\\\\]';
            } else {
                regexStr += ch;
            }
        }
        return new RegExp(`^${regexStr}$`);
    }
}
