/**
 * @file scripts/copy-deps.mjs
 *
 * @summary Copies runtime dependencies (dereferencing pnpm symlinks) into deps/
 *          so that `vsce package` includes them in the VSIX.
 *
 * pnpm stores packages in a content-addressable store and symlinks them into
 * node_modules/. `vsce package` ignores symlinked directories and the
 * .vscodeignore negation pattern (e.g. !node_modules/x/**) does not work
 * reliably with pnpm. This script copies the real files into a deps/
 * directory that vsce can include without issues.
 */
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const nodeModules = resolve(root, 'node_modules');
const depsDir = resolve(root, 'deps');

/** Runtime packages that must ship inside the VSIX. */
const RUNTIME_DEPS = [
    'web-tree-sitter',
    'tree-sitter-c',
    'tree-sitter-cpp',
    'tree-sitter-go',
    'tree-sitter-java',
    'tree-sitter-javascript',
    'tree-sitter-python',
    'tree-sitter-rust',
    'tree-sitter-typescript',
    'sql.js',
    'jspdf',
];

// Clean and recreate deps/
rmSync(depsDir, { recursive: true, force: true });
mkdirSync(depsDir, { recursive: true });

console.log('[copy-deps] Copying runtime dependencies to deps/ ...');

for (const pkg of RUNTIME_DEPS) {
    const src = resolve(nodeModules, pkg);
    const dest = resolve(depsDir, pkg);
    try {
        // dereference: true follows pnpm symlinks and copies real files
        cpSync(src, dest, { recursive: true, dereference: true });
        console.log(`  ✓ ${pkg}`);
    } catch (err) {
        console.error(`  ✗ ${pkg}: ${err.message}`);
        process.exit(1);
    }
}

console.log('[copy-deps] Done.');
