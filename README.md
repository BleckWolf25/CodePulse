# CodePulse

> Local code complexity tracking and analytics VS Code extension

CodePulse is a VS Code extension that tracks cyclomatic and cognitive complexity in real-time as you write and save code. It parses your files locally using Tree-sitter WASM and stores historical trends in a lightweight SQLite database, offering actionable refactoring suggestions and interactive visual dashboards.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 24 or higher
- **pnpm** 9.0.0 or higher
- **VS Code** 1.125.0 or higher

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/BleckWolf25/CodePulse.git
   cd CodePulse
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the compilation/build process:

   ```bash
   pnpm run compile
   ```

4. Launch the extension in VS Code:
   - Open the project in VS Code: `code .`
   - Press `F5` to open a Development Host window with the extension loaded.

## 📝 Available Scripts

- `pnpm compile` - Compile TypeScript and build the Svelte webview using Vite
- `pnpm watch` - Start TypeScript compiler in watch mode
- `pnpm lint` - Run ESLint on the codebase
- `pnpm test` - Run automated VS Code integration and unit tests

## 🏗️ Project Structure

```zsh
CodePulse/
├── .vscode-test/        # Compiled tests (generated)
├── out/                 # Compiled files (generated)
├── src/
│   ├── database/        # SQLite/sql.js local storage manager
│   ├── editor/          # CodeLens and Hover providers
│   ├── parser/          # Tree-sitter WASM runtime, AST walking & complexity analyzer
│   ├── webview/         # Svelte-based real-time analytics dashboard
│   ├── extension.ts     # Extension lifecycle activation & message broker
│   └── types.ts         # Shared Type definitions
├── .editorconfig        # EditorConfig configuration
├── .gitignore           # gitignore configuration
├── .npmrc               # node configuration
├── .prettierrc          # prettier configuration
├── .vscode-test.mjs     # vscode tests configuration
├── .vscodeignore        # vscode ignore configuration
├── package.json
├── tsconfig.json        # Typescript configuration
└── eslint.config.mjs    # ESLint configuration
```

## 🧪 Testing

The project uses VS Code test harnesses to run unit and integration tests.

### Run Unit Tests

```bash
pnpm test
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔒 Security

For security concerns, please review our [Security Policy](SECURITY.md).

## 📧 Contact

For questions or support, please open an issue on GitHub or contact [joao.coutinho08@icloud.com](mailto:joao.coutinho08@icloud.com).

---

Built with ❤️ using Svelte, Vite, TypeScript, and Tree-sitter
