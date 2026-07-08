/**
 * @file sql.js.d.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Minimal type declarations for sql.js (WASM SQLite).
 *
 * @description
 * The official package does not ship its own `.d.ts` files,
 * so we provide the subset needed by CodePulse.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- MODULE DECLARATIONS
declare module 'sql.js' {
    export interface SqlJsStatic {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
    }

    export interface Database {
        run(sql: string, params?: unknown[]): void;
        exec(sql: string, params?: unknown[]): QueryExecResult[];
        prepare(sql: string): Statement;
        export(): Uint8Array;
        close(): void;
    }

    export interface Statement {
        bind(params: unknown[]): boolean;
        step(): boolean;
        getAsObject(): Record<string, unknown>;
        free(): void;
    }

    export interface QueryExecResult {
        columns: string[];
        values: unknown[][];
    }

    export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}
