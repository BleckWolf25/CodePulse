/**
 * @file hoverProvider.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary VS Code hover provider for displaying detailed complexity metrics.
 *
 * @description
 * Provides hover tooltips that show detailed complexity metrics and refactoring
 * suggestions when hovering over function definitions, helping developers understand
 * code complexity and receive actionable improvement suggestions.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import * as vscode from 'vscode';
import { TreeSitterManager } from '../parser/parser.js';

// ---------- CLASS: CodePulseHoverProvider
export class CodePulseHoverProvider implements vscode.HoverProvider {
    /**
     * Provides hover tooltips with detailed complexity metrics for functions.
     *
     * @param document - The text document to analyze.
     * @param position - The position in the document where hover occurred.
     * @returns A Hover object with complexity details, or null if not applicable.
     */
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
        try {
            const tsManager = TreeSitterManager.getInstance();
            const sourceText = document.getText();
            const scores = tsManager.analyze(document.languageId, sourceText);

            if (scores?.functionMetrics) {
                const line = position.line + 1; // 1-indexed
                const func = scores.functionMetrics.find(f => line >= f.startLine && line <= f.endLine);

                if (func && position.line === func.startLine - 1) {
                    const isHealthy = func.cyclomaticComplexity < 10 && func.cognitiveComplexity < 8;
                    const status = isHealthy ? '$(check) Healthy' : '$(warning) Refactor Risk';

                    const md = new vscode.MarkdownString();
                    md.supportHtml = true;
                    md.isTrusted = true;

                    md.appendMarkdown(`### CodePulse Complexity: \`${func.name}\`\n\n`);
                    md.appendMarkdown(`* **Status**: ${status}\n`);
                    md.appendMarkdown(`* **Cyclomatic Complexity**: \`${func.cyclomaticComplexity.toString()}\` (Target: < 10)\n`);
                    md.appendMarkdown(`* **Cognitive Complexity**: \`${func.cognitiveComplexity.toString()}\` (Target: < 8)\n\n`);

                    if (func.suggestions.length > 0) {
                        md.appendMarkdown(`#### Suggested Refactors:\n`);
                        for (const suggestion of func.suggestions) {
                            md.appendMarkdown(`- ${suggestion}\n`);
                        }
                    } else {
                        md.appendMarkdown(`$(check) Code is clean and easy to maintain.`);
                    }

                    return new vscode.Hover(md);
                }
            }
        } catch (err) {
            console.error('[CodePulse] Failed to compute Hover:', err);
        }
        return null;
    }
}
