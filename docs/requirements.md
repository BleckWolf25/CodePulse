# requirements.md

## 1. Document Scope

This document outlines the functional, non-functional, and technical requirements for the **CodePulse** VS Code extension.

---

## 2. Functional Requirements (FR)

### FR-1: Syntax Parsing & Code Complexity

* **FR-1.1:** The extension must analyze code complexity using lightweight WebAssembly (WASM) Tree-sitter parsers.
* **FR-1.2:** The initial release must support the following languages:
  * TypeScript / JavaScript
  * Python
* **FR-1.3:** The parsing engine must calculate:
  * **Cyclomatic Complexity:** Number of linearly independent paths through the code.
  * **Cognitive Complexity:** Level of nesting and control flow structural difficulty.
  * **Sloc:** Source Lines of Code (logical vs. physical).

### FR-2: Local Database & Storage

* **FR-2.1:** The extension must persist historical data in a local **WASM SQLite database** stored within the extension’s global storage directory.
* **FR-2.2:** The database must track:
  * File path and project/workspace name.
  * Language identifier.
  * Metric values (cyclomatic complexity, cognitive complexity, lines of code).
  * Timestamp of the analysis event.
* **FR-2.3:** Data storage must operate entirely offline with zero external cloud sync dependencies.

### FR-3: Interactive Dashboard (Webview)

* **FR-3.1:** The extension must provide a dashboard UI built with **Svelte** and styled using VS Code’s native theme variables (CSS variables).
* **FR-3.2:** The dashboard must display charts powered by **Chart.js**:
  * *Complexity Trend:* Line chart showing average complexity over days/weeks.
  * *Language Mix:* Doughnut chart showing lines of code per language.
  * *Hotspots:* Scatter plot or bar chart identifying files with high complexity and high edit frequency.

### FR-4: Metrics Export

* **FR-4.1:** Users must be able to export their accumulated data via the command palette or dashboard buttons.
* **FR-4.2:** Supported export formats:
  * **JSON:** Complete database dump for custom scripting.
  * **CSV:** Tabular format of historical records for spreadsheet processing.
  * **PDF:** A structured, print-friendly report containing key charts (converted to images) and summary statistics.

### FR-5: User Configuration

* **FR-5.1:** Users must be able to configure:
  * Files/folders to ignore (glob patterns like `**/node_modules/**`, `**/dist/**`).
  * Analysis trigger (e.g., `onSave`, `onType` with a 2-second debounce, or `manual`).

---

## 3. Non-Functional Requirements (NFR)

### NFR-1: Performance & UX

* **NFR-1.1:** Parsing and database insertions must run asynchronously. They must not introduce typing latency or block the main VS Code Extension Host thread.
* **NFR-1.2:** Webview bundle size must be optimized (under 2MB total assets) using Vite to ensure the dashboard loads in under 500ms.
* **NFR-1.3:** Database footprint must be capped. The extension must implement an optional retention policy (e.g., auto-purge records older than 180 days).

### NFR-2: Portability & Compatibility

* **NFR-2.1:** The SQLite implementation must run in WASM mode (`sql.js`) to guarantee cross-platform compatibility (Windows, macOS, Linux) without needing native C++ compiler toolchains during installation.
* **NFR-2.2:** PDF generation must occur entirely in-memory using a pure-JS library (e.g., `jspdf`) without requiring system-level dependencies like Pandoc or wkhtmltopdf.
