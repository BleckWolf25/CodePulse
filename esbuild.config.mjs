/**
 * @file esbuild.config.mjs
 *
 * @version 2.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary esbuild configuration for bundling the VS Code extension.
 *
 * @description
 * Bundles the extension code, but keeps runtime dependencies (web-tree-sitter,
 * tree-sitter languages, sql.js, jspdf) as external modules since they need
 * their WASM files to be available at runtime.
 *
 * Runtime dependencies are shipped in the `deps/` directory (not node_modules)
 * because pnpm's symlinked node_modules are incompatible with vsce packaging.
 * The depsRewrite plugin rewrites bare imports of these packages to resolve
 * from `../deps/<package>` relative to the output file in `out/`.
 *
 * @since 09/07/2026
 * @updated 09/07/2026
 */
// ---------- IMPORTS
import esbuild from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- CONFIGURATION
const isProduction = process.argv.includes('--production');

/**
 * Runtime dependencies that live in deps/ instead of node_modules.
 * These are marked external and their imports are rewritten to ../deps/<pkg>.
 */
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
];

/**
 * esbuild plugin that rewrites bare imports of runtime dependencies
 * to resolve from the deps/ directory instead of node_modules/.
 *
 * At build time, the source code uses normal bare imports (e.g. `import 'web-tree-sitter'`).
 * This plugin intercepts those and resolves them to the actual node_modules location
 * for type checking, but emits a relative path (../deps/<pkg>) in the output bundle
 * so that at runtime the packaged deps/ directory is used.
 */
const depsRewritePlugin = {
    name: 'deps-rewrite',
    setup(build) {
        // Match any of the runtime dep package names or their subpaths
        const filter = new RegExp(`^(${RUNTIME_DEPS.map(d => d.replace('.', '\\.')).join('|')})(/.*)?$`);

        build.onResolve({ filter }, (args) => {
            // Resolve to the real node_modules path for correctness during build,
            // but mark as external with a rewritten path for the output bundle.
            // The output is in out/, so ../deps/<pkg> reaches the deps/ directory.
            return {
                path: `../deps/${args.path}`,
                external: true,
            };
        });
    },
};

const config = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'out/extension.cjs',
    // vscode is the only truly external dependency (provided by the host)
    external: ['vscode'],
    plugins: [depsRewritePlugin],
    format: 'cjs',
    platform: 'node',
    target: 'node24',
    sourcemap: isProduction ? false : 'inline',
    minify: isProduction,
    logLevel: 'info',
};

// ---------- BUILD
async function build() {
    console.log('[CodePulse] Building extension with esbuild...');
    await esbuild.build(config);
    console.log('[CodePulse] Extension built successfully');
}

// ---------- ERROR HANDLING
build().catch((error) => {
    console.error('[CodePulse] Build failed:', error);
    process.exit(1);
});