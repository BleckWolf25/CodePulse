# Code Pulse - Developer Productivity Dashboard (DPD) VS Code Extension

## 🎯 Project Vision

Code Pulse is a TypeScript-based VS Code extension that provides comprehensive coding metrics, visualizations, and insights to help developers understand their coding patterns, complexity, and productivity.

## 📊 Features

- Multi-language code complexity analysis
- Persistent metrics tracking
- Interactive dashboard with charts
- Configurable tracking options
- Exportable metrics
- Performance-conscious design

## 📦 Project Structure

```zsh
code-pulse/
│
├── src/
│   ├── extension.ts                # Main extension entry point
│   ├── metrics/
│   │   ├── complexity-alerts.ts    # Complexity Alerts
│   │   ├── complexity.ts           # Complexity Metrics logic
│   │   ├── debounce-tracker.ts     # Debounce tracker system
│   │   ├── storage.ts              # Persistent storage management
│   │   └── tracker.ts              # Core metrics logic
│   │
│   ├── test/
│   │   └── extension.test.ts       # Extension test logic
│   │
│   ├── utils/
│   │   ├── advanced-config.ts      # Multi-language support
│   │   ├── cache.ts                # Caching system
│   │   ├── config-export.ts        # Export metrics
│   │   ├── config.ts               # Extension configuration management
│   │   └── error-handler.ts        # Error handler system
│   │
│   └── views/
│       ├── dashboard.ts            # Webview dashboard logic
│       └── charts.ts               # Chart rendering logic
│   
│
├── package.json                    # Extension manifest
├── tsconfig.json                   # TypeScript configuration
├── esbuild.js                      # Build configuration
├── .vscodeignore                   # VS Code extension ignore file
│
├── resources/
│   ├── icons/                      # Extension icons
│   └── templates/                  # Dashboard HTML templates (soon)
│
└── dist/                           # Compiled extension
```

## 🧩 Modules and Their Responsibilities

### Complexity Analysis (`complexity.ts`)

- Performs deep code complexity analysis
- Calculates multiple complexity metrics:
  - Cyclomatic Complexity
  - Maintainability Index
  - Halstead Complexity Measures
- Generates actionable code improvement recommendations

### Metrics Tracking (`tracker.ts`)

- Tracks coding activities across files and languages
- Collects detailed file and session metrics
- Manages tracking configuration
- Provides session insights and aggregation

### Persistent Storage (`storage.ts`)

- Manages long-term storage of coding metrics
- Handles file system interactions
- Implements data retention and pruning strategies

### Configuration Management (`config.ts`)

- Provides centralized configuration handling
- Supports dynamic configuration updates
- Manages extension-wide settings

### Dashboard and Visualization (`dashboard.ts` & `charts.ts`)

- Generates interactive web-based dashboards
- Creates visualizations using Chart.js
- Supports metrics export and refreshing

## 🛠 Configuration Files

### `package.json`

- Defines extension metadata
- Specifies configuration options
- Lists dependencies and scripts
- Configures activation events and commands

### `tsconfig.json`

- Configures TypeScript compilation
- Enables strict type checking
- Defines module resolution and target

### `esbuild.js`

- Manages build process
- Supports development and production builds
- Generates build insights
- Handles external dependencies

## 🔧 Extension Settings

This extension contributes the following settings:

- `productivityDashboard.enableMetricTracking`: Enable or disable metric tracking.
- `productivityDashboard.complexityThresholds`: Define complexity thresholds per language.
- `productivityDashboard.complexityThreshold`: Set general complexity threshold.
- `productivityDashboard.trackingInterval`: Configure tracking intervals in minutes.
- `productivityDashboard.excludedLanguages`: Exclude specific languages from tracking.
- `productivityDashboard.enableDetailedLogging`: Enable or disable detailed logging.
- `productivityDashboard.retentionPeriod`: Configure data retention in days.

## 🖼 Screenshots

Soon, I'll realease screenshots

## 📌 Requirements

- VS Code `^1.98.0`
- Node.js `>=16.0.0`

Download VS Code: <https://code.visualstudio.com/download>
Download Node.js: <https://nodejs.org/en>

## 🚀 Future Enhancements

- Machine learning-based complexity prediction
- More advanced visualizations
- Language-specific deep analysis
- Integration with external code quality tools

## 🧪 Potential Testing

- Unit tests for complexity calculations
- Integration tests for tracking logic
- Mock VS Code extension context
- Performance benchmarking

## 🛠 Technologies Used

- TypeScript
- VS Code Extension API
- Chart.js
- esbuild
- Node.js APIs
- ESLint
- Mocha

## 🛠 Design Principles

- Modular architecture
- Loose coupling
- Extensibility
- Performance optimization
- Comprehensive type safety

## 🐞 Known Issues

List any known issues and potential fixes.

## 📜 Release Notes

Check [here](./CHANGELOG.md) for more information about Release Notes.

**Enjoy productivity on another level!**
