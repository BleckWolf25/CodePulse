/**
 * @file codeLensProvider.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary VS Code CodeLens provider for displaying complexity metrics.
 *
 * @description
 * Provides CodeLens decorations that display cyclomatic and cognitive complexity
 * metrics directly above function definitions in the editor, helping developers
 * identify complex code at a glance.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import * as vscode from 'vscode';
import { TreeSitterManager } from '../parser/parser.js';

// ---------- CLASS: CodePulseCodeLensProvider
export class CodePulseCodeLensProvider implements vscode.CodeLensProvider {
    private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    constructor() {
        vscode.workspace.onDidChangeTextDocument(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    /**
     * Provides CodeLens decorations for functions with complexity metrics.
     *
     * @param document - The text document to analyze.
     * @returns An array of CodeLens objects with complexity information.
     */
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];

        try {
            const tsManager = TreeSitterManager.getInstance();
            const sourceText = document.getText();
            const scores = tsManager.analyze(document.languageId, sourceText);

            if (scores?.functionMetrics) {
                for (const func of scores.functionMetrics) {
                    const position = new vscode.Position(func.startLine - 1, 0);
                    const range = new vscode.Range(position, position);

                    const isHealthy = func.cyclomaticComplexity < 10 && func.cognitiveComplexity < 8;
                    const statusText = isHealthy ? 'Healthy' : 'Refactor Risk';
                    const title = `Complexity: ${func.cyclomaticComplexity.toString()}/${func.cognitiveComplexity.toString()} (${statusText})`;
                    const tooltip = `Cyclomatic Complexity: ${func.cyclomaticComplexity.toString()}\nCognitive Complexity: ${func.cognitiveComplexity.toString()}`;

                    lenses.push(new vscode.CodeLens(range, {
                        title,
                        command: '',
                        tooltip,
                    }));
                }
            }
        } catch (err) {
            console.error('[CodePulse] Failed to compute CodeLenses:', err);
        }

        return lenses;
    }
}
