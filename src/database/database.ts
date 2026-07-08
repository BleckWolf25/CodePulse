/**
 * @file database.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary SQLite database layer using sql.js (WASM-based SQLite).
 *
 * @description
 * Manages the SQLite database lifecycle using sql.js WASM runtime. The database is loaded into
 * memory on activation from the binary file at `codepulse.db` inside the extension's global storage
 * directory. All reads and writes happen against the in-memory copy. A periodic sync daemon
 * serialises the in-memory buffer back to disk so that data survives VS Code restarts.
 *
 * # Design
 * - The database is loaded into memory on activation from the binary file at
 *   `codepulse.db` inside the extension's global storage directory.
 * - All reads and writes happen against the in-memory copy.
 * - A periodic sync daemon (and a shutdown guard) serialise the in-memory
 *   buffer back to disk so that data survives VS Code restarts.
 *
 * # Schema (see also docs/design.md)
 * ```sql
 * CREATE TABLE workspaces (
 *   id              INTEGER PRIMARY KEY AUTOINCREMENT,
 *   name            TEXT UNIQUE NOT NULL,
 *   root_path       TEXT NOT NULL
 * );
 * CREATE TABLE file_metrics (
 *   id                    INTEGER PRIMARY KEY AUTOINCREMENT,
 *   timestamp             DATETIME DEFAULT CURRENT_TIMESTAMP,
 *   workspace_id          INTEGER,
 *   file_path             TEXT NOT NULL,
 *   language              TEXT NOT NULL,
 *   cyclomatic_complexity INTEGER NOT NULL,
 *   cognitive_complexity  INTEGER NOT NULL,
 *   sloc                  INTEGER NOT NULL,
 *   FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
 * );
 * CREATE INDEX idx_metrics_timestamp ON file_metrics(timestamp);
 * CREATE INDEX idx_metrics_file_path ON file_metrics(file_path);
 * ```
 *
 * # Durability
 * The binary database file is written to disk:
 * - Every `SYNC_INTERVAL_MS` milliseconds via a background interval.
 * - When the extension deactivates (`deactivate` hook).
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import type { AnalysisResult } from '../types.js';

/**
 * How often (ms) to flush the in-memory DB to disk.
 */
const SYNC_INTERVAL_MS = 30_000;

/**
 * Name of the binary database file inside the storage directory.
 */
const DB_FILE_NAME = 'codepulse.db';

// ---------- SCHEMA MIGRATION SQL
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    root_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    workspace_id INTEGER,
    file_path TEXT NOT NULL,
    language TEXT NOT NULL,
    cyclomatic_complexity INTEGER NOT NULL,
    cognitive_complexity INTEGER NOT NULL,
    sloc INTEGER NOT NULL,
    function_metrics TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON file_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_file_path ON file_metrics(file_path);
`;

// ---------- SINGLETON CLASS: DatabaseManager
export class DatabaseManager {
    private static _instance: DatabaseManager | undefined;

    private _sqlJs: Awaited<ReturnType<typeof initSqlJs>> | undefined;
    private _db: SqlJsDatabase | undefined;
    private _dbPath = '';
    private _syncTimer: ReturnType<typeof setInterval> | undefined;
    private _dirty = false;
    private readonly _onDidChangeMetrics = new vscode.EventEmitter<void>();
    readonly onDidChangeMetrics = this._onDidChangeMetrics.event;

    private constructor() {
        // Singleton, use getInstance()
    }

    // Get or create the singleton instance.
    static getInstance(): DatabaseManager {
        DatabaseManager._instance ??= new DatabaseManager();
        return DatabaseManager._instance;
    }

    // ---------- LIFECYCLE

    /**
     * Initialise the WASM SQLite engine, load an existing database file (or
     * create a new one), and run schema migrations.
     *
     * @param storageDir - Absolute path to the extension's global storage dir.
     */
    async initialize(storageDir: string): Promise<void> {
        if (this._db) {
            return;
        }

        this._dbPath = path.join(storageDir, DB_FILE_NAME);

        // 1. Initialise sql.js WASM runtime
        this._sqlJs = await initSqlJs();

        // 2. Load existing DB or create fresh one
        let buffer: Buffer | undefined;
        try {
            buffer = await fs.promises.readFile(this._dbPath);
        } catch {
            // File does not exist yet, will start with an empty DB
        }

        if (buffer && buffer.byteLength > 0) {
            this._db = new this._sqlJs.Database(new Uint8Array(buffer));
        } else {
            this._db = new this._sqlJs.Database();
        }

        // 3. Run schema migration
        this._db.run(SCHEMA_SQL);
        try {
            this._db.run('ALTER TABLE file_metrics ADD COLUMN function_metrics TEXT');
        } catch {
            // Fine if it already exists
        }
        this._dirty = true;

        // 4. Start periodic sync daemon
        this._startSyncDaemon();

        console.log('[CodePulse] Database initialised');
    }

    /**
     * Flush the in-memory database to disk and stop the sync daemon.
     * Must be called during extension deactivation.
     */
    async dispose(): Promise<void> {
        this._stopSyncDaemon();
        await this.syncToDisk();
        if (this._db) {
            this._db.close();
            this._db = undefined;
        }
        DatabaseManager._instance = undefined;
    }

    // ---------- PUBLIC HELPERS
    /**
     * Ensure a workspace row exists. Creates it if necessary.
     *
     * @returns The workspace's primary key.
     */
    ensureWorkspace(name: string, rootPath: string): number {
        const db = this._ensureOpen();

        const existing = db.exec('SELECT id FROM workspaces WHERE name = ?', [name]);

        if (existing.length > 0 && existing[0].values.length > 0) {
            return existing[0].values[0][0] as number;
        }

        db.run('INSERT INTO workspaces (name, root_path) VALUES (?, ?)', [name, rootPath]);
        this._dirty = true;

        const inserted = db.exec('SELECT last_insert_rowid()');
        return inserted[0].values[0][0] as number;
    }

    /**
     * Insert a new metrics row.
     *
     * @param result - The analysis result.
     * @param workspaceName - The workspace name (must already exist via ensureWorkspace).
     */
    insertMetrics(result: AnalysisResult, workspaceName: string): void {
        const db = this._ensureOpen();

        // Look up workspace id by name
        const workspaceRows = db.exec('SELECT id FROM workspaces WHERE name = ?', [workspaceName]);
        if (workspaceRows.length === 0 || workspaceRows[0].values.length === 0) {
            console.error(
                '[CodePulse] No workspace found for metrics insert. Call ensureWorkspace first.',
            );
            return;
        }

        const workspaceId = workspaceRows[0].values[0][0] as number;
        const timestamp = result.timestamp.toISOString();

        const functionMetricsJson = result.functionMetrics ? JSON.stringify(result.functionMetrics) : null;
        db.run(
            `INSERT INTO file_metrics
				(timestamp, workspace_id, file_path, language, cyclomatic_complexity, cognitive_complexity, sloc, function_metrics)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                timestamp,
                workspaceId,
                result.filePath,
                result.language,
                result.cyclomaticComplexity,
                result.cognitiveComplexity,
                result.sloc,
                functionMetricsJson,
            ],
        );

        this._dirty = true;
        this._onDidChangeMetrics.fire();
    }

    /**
     * Query latest metrics for each file in a given workspace, ordered by timestamp descending.
     */
    queryMetrics(workspaceName: string): Record<string, unknown>[] {
        const db = this._ensureOpen();

        const stmt = db.prepare(`
			SELECT fm.*
			FROM file_metrics fm
			JOIN workspaces w ON w.id = fm.workspace_id
			WHERE w.name = ?
              AND fm.id IN (
                  SELECT MAX(id)
                  FROM file_metrics
                  GROUP BY file_path
              )
			ORDER BY fm.timestamp DESC
		`);
        stmt.bind([workspaceName]);

        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        return rows;
    }

    /**
     * Query latest stored metrics for each file across every workspace, ordered by timestamp descending.
     */
    queryAllMetrics(): Record<string, unknown>[] {
        const db = this._ensureOpen();

        const stmt = db.prepare(`
			SELECT *
			FROM file_metrics
			WHERE id IN (
			    SELECT MAX(id)
			    FROM file_metrics
			    GROUP BY file_path
			)
			ORDER BY timestamp DESC
		`);

        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();

        return rows;
    }

    /**
     * Persist the current in-memory database buffer to disk.
     */
    async syncToDisk(): Promise<void> {
        if (!this._dirty || !this._db) {
            return;
        }

        try {
            const data = this._db.export();
            await fs.promises.writeFile(this._dbPath, Buffer.from(data));
            this._dirty = false;
        } catch (err) {
            console.error('[CodePulse] Failed to sync database to disk:', err);
        }
    }

    /**
     * Purge historical metrics older than the specified number of days.
     */
    async purgeOldLogs(days: number): Promise<number> {
        const db = this._ensureOpen();
        db.run("DELETE FROM file_metrics WHERE datetime(timestamp) < datetime('now', ?)", [`-${days.toString()} days`]);
        const res = db.exec('SELECT changes()');
        const rowsAffected = (res[0]?.values[0]?.[0] ?? 0) as number;

        this._dirty = true;
        this._onDidChangeMetrics.fire();
        await this.syncToDisk();

        return rowsAffected;
    }

    // ---------- PRIVATE HELPERS
    private _ensureOpen(): SqlJsDatabase {
        if (!this._db) {
            throw new Error('[CodePulse] Database not initialised. Call initialize() first.');
        }
        return this._db;
    }

    private _startSyncDaemon(): void {
        if (this._syncTimer) {
            return;
        }
        this._syncTimer = setInterval(() => {
            void this.syncToDisk();
        }, SYNC_INTERVAL_MS);
    }

    private _stopSyncDaemon(): void {
        if (this._syncTimer !== undefined) {
            clearInterval(this._syncTimer);
            this._syncTimer = undefined;
        }
    }
}
