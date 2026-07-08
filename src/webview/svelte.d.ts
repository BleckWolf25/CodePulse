/**
 * @file svelte.d.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary TypeScript declarations for Svelte component imports.
 *
 * @description
 * Provides TypeScript module declarations for importing .svelte files
 * as Svelte components.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
declare module '*.svelte' {
    import type { SvelteComponent } from 'svelte';
    const component: typeof SvelteComponent;
    export default component;
}
