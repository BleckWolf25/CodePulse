/**
 * @file parser.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary High-level parser module for tree-sitter WASM integration.
 *
 * @description
 * Initialises tree-sitter WASM, loads language grammars, parses source code,
 * and returns complexity scores. Manages the singleton TreeSitterManager instance.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import type * as TreeSitterNamespace from 'web-tree-sitter';
import { copyWasmBinaries, getTreeSitterWasmPath } from './wasmHelper.js';
import { computeComplexity, type ComplexityScores } from './complexityAnalyzer.js';
import type { SupportedLanguage } from '../types.js';
import * as vscode from 'vscode';

declare const require: (id: string) => unknown;
let treeSitterModule: typeof TreeSitterNamespace | undefined;

// ---------- LANGUAGE MAPPING
/**
 * Maps a VS Code language identifier to our internal language name and
 * the corresponding WASM file name (without extension).
 */
const LANGUAGE_WASM_MAP: Record<string, { language: SupportedLanguage; wasmFile: string }> = {
    typescript: { language: 'typescript', wasmFile: 'tree-sitter-typescript' },
    javascript: { language: 'javascript', wasmFile: 'tree-sitter-javascript' },
    typescriptreact: { language: 'tsx', wasmFile: 'tree-sitter-tsx' },
    python: { language: 'python', wasmFile: 'tree-sitter-python' },
    go: { language: 'go', wasmFile: 'tree-sitter-go' },
    java: { language: 'java', wasmFile: 'tree-sitter-java' },
    c: { language: 'c', wasmFile: 'tree-sitter-c' },
    cpp: { language: 'cpp', wasmFile: 'tree-sitter-cpp' },
    rust: { language: 'rust', wasmFile: 'tree-sitter-rust' },
};

// ---------- CLASS: TreeSitterManager
/**
 * Singleton that manages the tree-sitter WASM runtime and language instances.
 */
export class TreeSitterManager {
    private static _instance: TreeSitterManager | undefined;
    private readonly _parsers = new Map<string, TreeSitterNamespace.Parser>();
    private _initialized = false;

    private constructor() {
        // Singleton, use getInstance()
    }

    // Get or create the singleton instance.
    static getInstance(): TreeSitterManager {
        TreeSitterManager._instance ??= new TreeSitterManager();
        return TreeSitterManager._instance;
    }

    /**
     * Initialise the tree-sitter WASM runtime and load all language grammars.
     * Must be called once during extension activation.
     */
    async initialize(context: vscode.ExtensionContext): Promise<void> {
        if (this._initialized) {
            return;
        }

        // 1. Copy WASM binaries to global storage
        const wasmPaths = await copyWasmBinaries(context);

        // 2. Lazy-load and initialise the web-tree-sitter runtime.
        try {
            treeSitterModule ??= require('web-tree-sitter/web-tree-sitter.cjs') as typeof TreeSitterNamespace;
        } catch (err) {
            const msg =
                'The dependency "web-tree-sitter" is not available. If you installed this extension from a VSIX or the Marketplace, ensure the publisher packaged runtime dependencies. For development, run the extension from the workspace (F5) after running `pnpm install`).';
            void vscode.window.showErrorMessage(`[CodePulse] ${msg}`);
            throw err;
        }

        const tsWasmPath = getTreeSitterWasmPath(context);
        await treeSitterModule.Parser.init({
            locateFile(): string {
                return tsWasmPath;
            },
        });

        // 3. Load each language grammar and create a dedicated parser
        for (const [vscodeLang, info] of Object.entries(LANGUAGE_WASM_MAP)) {
            const wasmPath = wasmPaths.get(info.language);
            if (!wasmPath) {
                console.warn(`[CodePulse] No WASM path for language "${info.language}"`);
                continue;
            }

            try {
                const language = await treeSitterModule.Language.load(wasmPath);
                const parser = new treeSitterModule.Parser();
                parser.setLanguage(language);
                this._parsers.set(vscodeLang, parser);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[CodePulse] Failed to load language "${vscodeLang}": ${message}`);
            }
        }

        this._initialized = true;
        const langCount = String(this._parsers.size);
        const langs = [...this._parsers.keys()].join(', ');
        console.log(`[CodePulse] Tree-sitter initialised with ${langCount} language(s): ${langs}`);
    }

    /**
     * Parse source code and compute complexity scores.
     *
     * @param vscodeLanguageId - The VS Code language identifier (e.g. `'typescript'`).
     * @param sourceText - The full source code text.
     * @returns Complexity scores, or `null` if the language is unsupported.
     */
    analyze(vscodeLanguageId: string, sourceText: string): ComplexityScores | null {
        const info = LANGUAGE_WASM_MAP[vscodeLanguageId];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!info) {
            return null;
        }

        const parser = this._parsers.get(vscodeLanguageId);
        if (!parser) {
            return null;
        }

        // tree-sitter parse() may return null if no language is set (documented).
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const tree = parser.parse(sourceText)!;
        const cursor = tree.walk();
        const result = computeComplexity(cursor, info.language, sourceText);
        cursor.delete();
        tree.delete();

        return result;
    }

    // Dispose all parsers and reset the singleton.
    dispose(): void {
        for (const parser of this._parsers.values()) {
            parser.delete();
        }
        this._parsers.clear();
        this._initialized = false;
        TreeSitterManager._instance = undefined;
    }
}
