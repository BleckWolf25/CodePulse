# tasks.md

## Phase 1: Project Scaffolding & Configuration Setup

*Focus: Establish the repository structure, build scripts, and configuration schemas.*

- [~] **Task 1.1:** Generate VS Code Extension template using `yo code` (select TypeScript, Webpack or Vite for bundler).
- [ ] **Task 1.2:** Configure `package.json` with configuration properties:
  - `codepulse.exclude`: Array of glob patterns (defaulting to standard build/dep folders).
  - `codepulse.trigger`: Enum values (`onSave`, `onType`, `manual`).
  - `codepulse.debounceDelay`: Number (milliseconds for type-trigger debounce).
- [ ] **Task 1.3:** Setup Workspace storage configuration in `src/extension.ts` to locate and resolve the local database path safely on different OS targets.

---

## Phase 2: Tree-sitter Parser Integration (WASM)

*Focus: Build an async analyzer module capable of calculating complexity scores.*

- [ ] **Task 2.1:** Install npm package `web-tree-sitter` and download target language WASM files (`tree-sitter-typescript.wasm`, `tree-sitter-python.wasm`).
- [ ] **Task 2.2:** Build a helper class to copy WASM binaries from the extension’s install folder to the global execution context at runtime.
- [ ] **Task 2.3:** Implement AST traversal functions in TypeScript to compute:
  - **Cyclomatic Complexity:** Sum of control flow keywords (`if`, `for`, `while`, `catch`, logical operators).
  - **Cognitive Complexity:** Standard recursive count adding weights for deeper nesting structures.
- [ ] **Task 2.4:** Build a debounced event processor to run these parser calculations asynchronously, ensuring typing is never blocked.

---

## Phase 3: Database & State Storage

*Focus: Load, query, and periodically flush SQLite database transactions safely.*

- [ ] **Task 3.1:** Install and configure the WASM-based SQLite driver (`sql.js`).
- [ ] **Task 3.2:** Implement database helper functions to:
  - Load existing binary file (`codepulse.db`) into `sql.js` memory.
  - Run initial schema migration query (creates tables and indices).
- [ ] **Task 3.3:** Create database write methods to insert and update file complexity logs.
- [ ] **Task 3.4:** Write the filesystem sync daemon that periodically flushes the memory state of `sql.js` to disk (or triggers on VS Code close/deactivate).

---

## Phase 4: Svelte Dashboard Webview & IPC Bridge

*Focus: Establish the dashboard view layer and bridge host-to-view communication.*

- [ ] **Task 4.1:** Set up a Vite configuration folder (`/src/webview`) to bundle a single Svelte app target.
- [ ] **Task 4.2:** Establish the VS Code Webview panel in the Extension Host:
  - Load Svelte script tags.
  - Implement the mandatory Content Security Policy (CSP) to restrict external scripts.
- [ ] **Task 4.3:** Set up bidirectional communication bridge (`postMessage` handler) to coordinate UI requests with database query executions.
- [ ] **Task 4.4:** Integrate Chart.js inside the Svelte app to render:
  - A historical line chart of average complexity.
  - A language usage doughnut chart.

---

## Phase 5: Exporting & PDF Generation

*Focus: Generate client-facing reports and data dumps.*

- [ ] **Task 5.1:** Add Command Palette commands for `CodePulse: Export Metrics as JSON` and `CodePulse: Export Metrics as CSV`.
- [ ] **Task 5.2:** Implement JSON/CSV generators querying the SQLite raw database on the Extension Host side.
- [ ] **Task 5.3:** Integrate `jspdf` inside the Webview to:
  - Extract canvas visual state from Chart.js as base64 images.
  - Dynamically format a paginated vector PDF with project headers and tables.
  - Pipe the generated raw file array back to the Host for file saving.

---

## Phase 6: Optimization & Quality Assurance

*Focus: Prevent memory leaks, limit database bloat, and verify low runtime overhead.*

- [ ] **Task 6.1:** Build automated unit tests validating AST complexity scores against mock JS/Python files.
- [ ] **Task 6.2:** Profile memory usage during large-workspace loads to verify that tree-sitter references are garbage-collected quickly.
- [ ] **Task 6.3:** Implement a manual cleanup setting option (e.g., "Purge Old Logs") to shrink database sizes.
