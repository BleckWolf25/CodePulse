/**
 * @file vite.config.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Vite configuration for the Svelte webview bundle.
 *
 * @description
 * Configures Vite to build the Svelte webview application with the Svelte plugin,
 * outputting to the extension's out/webview directory.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- DIRECTORY RESOLUTION
const currentDir = fileURLToPath(new URL('.', import.meta.url));

// ---------- CONFIGURATION
export default defineConfig({
    root: currentDir,
    base: './',
    plugins: [svelte()],
    build: {
        outDir: '../../out/webview',
        emptyOutDir: false,
        rollupOptions: {
            input: resolve(currentDir, 'index.html'),
            output: {
                entryFileNames: 'webview.js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
            },
        },
        // Ensure the bundle is under 2MB as per requirements (NFR-1.2)
        chunkSizeWarningLimit: 2048,
    },
    server: {
        // Prevent port conflicts during development
        port: 5173,
    },
});
