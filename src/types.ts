/**
 * @file types.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Type definitions for CodePulse complexity analysis.
 *
 * @description
 * Defines the core TypeScript types and interfaces used throughout the CodePulse extension,
 * including supported languages, function metrics, analysis results, and database row structures.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- TYPES
/**
 * Supported language identifiers for tree-sitter parsing.
 */
export type SupportedLanguage =
    | 'typescript'
    | 'tsx'
    | 'javascript'
    | 'python'
    | 'go'
    | 'java'
    | 'c'
    | 'cpp'
    | 'rust';

export interface FunctionMetric {
    name: string;
    startLine: number;
    endLine: number;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    suggestions: string[];
}

/**
 * Result of a complexity analysis pass on a single file.
 */
export interface AnalysisResult {
    filePath: string;
    language: SupportedLanguage;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    sloc: number;
    timestamp: Date;
    functionMetrics?: FunctionMetric[];
}

/**
 * A row from the file_metrics database table.
 */
export interface FileMetricsRow {
    id: number;
    timestamp: string;
    workspaceId: number;
    filePath: string;
    language: string;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    sloc: number;
    functionMetrics?: FunctionMetric[];
}

/**
 * A row from the workspaces database table.
 */
export interface WorkspaceRow {
    id: number;
    name: string;
    rootPath: string;
}
