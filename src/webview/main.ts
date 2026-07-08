/**
 * @file main.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Entry point for the Svelte webview application.
 *
 * @description
 * Mounts the Svelte App component to the DOM element with id 'app'.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import { mount } from 'svelte';
import App from './App.svelte';

// ---------- ENTRY POINT
const target = document.getElementById('app');

if (!target) {
    throw new Error('Missing #app mount element');
}

// ---------- MOUNT SVELTE APP
/**
 * Mounts the Svelte App component to the DOM.
 */
mount(App, {
    target,
});
