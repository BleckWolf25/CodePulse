/**
 * @file wasmHelper.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Helper functions for managing tree-sitter WASM binaries.
 *
 * @description
 * Copies tree-sitter WASM binaries bundled with the extension into the
 * extension's global storage directory so the Parser.init can load them.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

// ---------- INTERFACES
/**
 * Language-specific WASM binary metadata.
 */
interface WasmArtifact {
    readonly languageName: string;
    readonly sourceRelPath: string;
    readonly targetFileName: string;
}

/**
 * Maps each supported language to its WASM binary location inside the
 * installed npm package and the name we save it as in global storage.
 */
const WASM_ARTIFACTS: readonly WasmArtifact[] = [
    {
        languageName: 'typescript',
        sourceRelPath: 'tree-sitter-typescript/tree-sitter-typescript.wasm',
        targetFileName: 'tree-sitter-typescript.wasm',
    },
    {
        languageName: 'tsx',
        sourceRelPath: 'tree-sitter-typescript/tree-sitter-tsx.wasm',
        targetFileName: 'tree-sitter-tsx.wasm',
    },
    {
        languageName: 'python',
        sourceRelPath: 'tree-sitter-python/tree-sitter-python.wasm',
        targetFileName: 'tree-sitter-python.wasm',
    },
    {
        languageName: 'javascript',
        sourceRelPath: 'tree-sitter-javascript/tree-sitter-javascript.wasm',
        targetFileName: 'tree-sitter-javascript.wasm',
    },
    {
        languageName: 'go',
        sourceRelPath: 'tree-sitter-go/tree-sitter-go.wasm',
        targetFileName: 'tree-sitter-go.wasm',
    },
    {
        languageName: 'java',
        sourceRelPath: 'tree-sitter-java/tree-sitter-java.wasm',
        targetFileName: 'tree-sitter-java.wasm',
    },
    {
        languageName: 'c',
        sourceRelPath: 'tree-sitter-c/tree-sitter-c.wasm',
        targetFileName: 'tree-sitter-c.wasm',
    },
    {
        languageName: 'cpp',
        sourceRelPath: 'tree-sitter-cpp/tree-sitter-cpp.wasm',
        targetFileName: 'tree-sitter-cpp.wasm',
    },
    {
        languageName: 'rust',
        sourceRelPath: 'tree-sitter-rust/tree-sitter-rust.wasm',
        targetFileName: 'tree-sitter-rust.wasm',
    },
];

// ---------- EXPORTED FUNCTIONS
/**
 * Copies the tree-sitter WASM binaries bundled with the extension into the
 * extension's global storage directory so {@link Parser.init} can load them.
 *
 * @param context - The extension context used to resolve storage paths.
 * @returns A map of language names to absolute WASM file paths.
 */
export async function copyWasmBinaries(
    context: vscode.ExtensionContext,
): Promise<Map<string, string>> {
    const storageDir = context.globalStorageUri.fsPath;
    const wasmDir = path.join(storageDir, 'wasm');

    // Ensure the WASM directory exists
    await fs.promises.mkdir(wasmDir, { recursive: true });

    const wasmPaths = new Map<string, string>();

    for (const artifact of WASM_ARTIFACTS) {
        // Source is inside the extension's node_modules
        const extensionPath = context.extensionUri.fsPath;
        const sourcePath = path.join(extensionPath, 'node_modules', artifact.sourceRelPath);
        const targetPath = path.join(wasmDir, artifact.targetFileName);

        try {
            await fs.promises.copyFile(sourcePath, targetPath);
        } catch {
            // File may already exist from a previous activation, that's fine
            if (!fs.existsSync(targetPath)) {
                throw new Error(
                    `[CodePulse] Failed to copy WASM binary: ${artifact.targetFileName} from ${sourcePath}`,
                );
            }
        }

        if (!wasmPaths.has(artifact.languageName)) {
            wasmPaths.set(artifact.languageName, targetPath);
        }
    }

    return wasmPaths;
}

/**
 * Returns the absolute path to the {@code web-tree-sitter.wasm} file shipped
 * with the web-tree-sitter npm package.
 */
export function getTreeSitterWasmPath(context: vscode.ExtensionContext): string {
    return path.join(
        context.extensionUri.fsPath,
        'node_modules',
        'web-tree-sitter',
        'web-tree-sitter.wasm',
    );
}
