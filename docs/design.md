# design.md

## 1. System Architecture

CodePulse is structured into three main layers running inside the VS Code Extension Host process.

```mermaid
+-----------------------------------------------------------------------------------+
|                                 VS Code Desktop                                   |
+-----------------------------------------------------------------------------------+
       |                                                                     |
       | (Editor Events)                                                     | (Webview IPC)
       v                                                                     v
+----------------------------------+                        +-----------------------+
|        Extension Host            |                        |   Dashboard Webview   |
|                                  |                        |                       |
|  +----------------------------+  |                        |  +-----------------+  |
|  |  Event Listener & Router   |  |                        |  | Svelte UI Shell |  |
|  +----------------------------+  |                        |  +-----------------+  |
|               |                  |                        |          |            |
|               v                  |                        |          v            |
|  +----------------------------+  |  State Sync (JSON IPC) |  +-----------------+  |
|  | WASM Parser (Tree-sitter)  |  |<======================>|  |  Chart.js Core  |  |
|  +----------------------------+  |                        |  +-----------------+  |
|               |                  |                        +-----------------------+
|               v                  |
|  +----------------------------+  |
|  | SQLite WASM Engine         |  |
|  | (In-memory + FS Sync)      |  |
|  +----------------------------+  |
+----------------------------------+
                |
                v (FS Write)
+----------------------------------+
|      Local File System           |
|      (codepulse.db)              |
+----------------------------------+
```

---

## 2. Core Components

### 2.1 Extension Host & Event Router

* **Responsibility:** Manages the life cycle of the extension. It listens to file save events (`workspace.onDidSaveTextDocument`) or debounced change events.
* **Routing:** It filters events using glob patterns defined in user settings, ignoring generated directories (`node_modules`, `dist`, etc.) before passing the file content to the parser.

### 2.2 WASM Parser (Tree-sitter)

* **Responsibility:** Evaluates code structure to calculate Cyclomatic and Cognitive complexity.
* **Mechanism:** Loads language-specific WASM binaries (e.g., `tree-sitter-typescript.wasm`, `tree-sitter-python.wasm`) at startup. It traverses the generated Concrete Syntax Tree (CST) to count branching points, loops, and logical structures.

### 2.3 Storage Layer (`sql.js`)

* **Responsibility:** Manages persistent metrics.
* **Mechanism:** Since native C++ SQLite engines break across VS Code platforms, CodePulse uses `sql.js` (SQLite compiled to WebAssembly).
  * **Data Durability:** The database is loaded into virtual memory on activation. Modifications are executed in memory, and the raw database buffer is serialized and written to the extension’s global storage path on the local disk (`codepulse.db`) asynchronously on changes or deactivate.

### 2.4 Dashboard (Svelte + Chart.js Webview)

* **Responsibility:** Displays trends, language breakdowns, and hotspots.
* **Mechanism:** Runs inside an isolated iframe Webview. It communicates with the Extension Host via the VS Code standard messaging channel (`postMessage` API).

---

## 3. Database Schema

The SQLite schema consists of two highly-indexed tables optimized for time-series aggregation.

```sql
CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    root_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    workspace_id INTEGER,
    file_path TEXT NOT NULL,
    language TEXT NOT NULL,
    cyclomatic_complexity INTEGER NOT NULL,
    cognitive_complexity INTEGER NOT NULL,
    sloc INTEGER NOT NULL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON file_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_file_path ON file_metrics(file_path);
```

---

## 4. Key Workflows

### 4.1 Real-time Analysis & Serialization Flow

```md
[User Saves File] 
       │
       ▼
[Event Router Checks Glob Settings] ───(Matches Exclude?)───► [Abort]
       │ (No)
       ▼
[Asynchronously Parse AST using Tree-sitter]
       │
       ▼
[Calculate Cyclomatic & Cognitive Complexity Scores]
       │
       ▼
[Insert Metrics into In-Memory SQLite]
       │
       ▼
[Serialize WASM DB State -> Write to Local disk (codepulse.db)]
```

### 4.2 Webview Communication Protocol (IPC)

The extension uses a strict JSON-RPC-like message format to communicate with the Webview.

```typescript
interface WebviewMessage {
    command: 'getDashboardData' | 'exportData' | 'settingsChanged';
    payload?: any;
}

interface HostResponse {
    command: 'renderDashboard' | 'exportSuccess' | 'exportFailure';
    payload: any;
}
```

* **Render Pipeline:**
    1. User opens Dashboard.
    2. Webview sends `getDashboardData` request to Extension Host.
    3. Extension Host runs aggregated SQLite queries (e.g., average daily complexity).
    4. Extension Host responds with `renderDashboard` payload.
    5. Svelte UI updates state and triggers Chart.js to redraw charts.

---

## 5. Export Architecture

* **CSV/JSON:** Handled on the Extension Host side. It queries raw table rows, formats them (using standard string joining for CSV or `JSON.stringify`), and saves them using VS Code’s Save Dialog.
* **PDF:** Handled in-memory via `jspdf` on the Webview side.
    1. Webview captures Chart.js canvases as high-resolution base64 PNG images.
    2. `jspdf` formats a layout containing the project name, statistics summary tables, and embeds the PNG chart images.
    3. The generated PDF data is sent to the Host, which prompts the user to save the file.
