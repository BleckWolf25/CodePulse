/**
 * @file .vscode-test.mjs
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Testing configuration for the CodePulse extension.
 *
 * @description
 * This file defines the testing configuration for the CodePulse extension using the @vscode/test-cli package.
 * It specifies the test files to be executed during testing.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import { defineConfig } from '@vscode/test-cli';

// ---------- CONFIGURATION
export default defineConfig({
    files: 'out/test/**/*.test.js',
});
