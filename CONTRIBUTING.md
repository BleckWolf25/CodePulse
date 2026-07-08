# Contributing to CodePulse

First off, thank you for taking the time to contribute! Contributions from the community help make CodePulse more comprehensive, accurate, and helpful for everyone.

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Table of Contents

- [Contributing to CodePulse](#contributing-to-codepulse)
  - [Table of Contents](#table-of-contents)
  - [How Can I Contribute?](#how-can-i-contribute)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting Enhancements](#suggesting-enhancements)
    - [Pull Requests](#pull-requests)
  - [Development Setup](#development-setup)
    - [Prerequisites](#prerequisites)
    - [Setting Up Your Workspace](#setting-up-your-workspace)
    - [Development Commands](#development-commands)
  - [Style \& Code Guidelines](#style--code-guidelines)
    - [TypeScript Coding Style](#typescript-coding-style)
    - [VS Code Extension Best Practices](#vs-code-extension-best-practices)
    - [Commit Messages](#commit-messages)
  - [Testing](#testing)
    - [Writing Unit Tests](#writing-unit-tests)
  - [Security Vulnerabilities](#security-vulnerabilities)

---

## How Can I Contribute?

### Reporting Bugs

We use structured GitHub Issues to track bug reports. Before submitting a bug report, please:

1. Check the existing issues to ensure it hasn't been reported or resolved already.
2. Test on a clean environment without conflicting extensions.
3. Open a bug report including:
   - Extension version
   - VS Code version and OS details
   - Step-by-step instructions to reproduce
   - Error logs from the VS Code Developer Tools console (`Help > Toggle Developer Tools`)

### Suggesting Enhancements

If you have ideas for new metrics, features, or UI improvements:

1. Search the issues to verify your suggestion hasn't been discussed before.
2. Open a Feature Request describing the functionality, the problem it solves, and how it might be implemented.

### Pull Requests

To submit code changes:

1. **Fork** the repository and create your branch from `main` (e.g., `feat/your-feature-name` or `fix/issue-description`).
2. Make your changes, keeping them focused. Avoid unrelated changes.
3. Write clean, readable code following our guidelines.
4. Ensure your changes compile and pass all tests and linting checks locally.
5. Submit a Pull Request (PR) with a clear description of the changes and references to any related issues.

---

## Development Setup

This project is built as a VS Code Extension using **TypeScript**, **Svelte** (for the webview dashboard), and **Vite** (for building the webview).

### Prerequisites

- **Node.js** 20 or higher
- **pnpm** 9.0.0 or higher
- **Git**

### Setting Up Your Workspace

1. **Clone the repository:**

   ```bash
   git clone https://github.com/BleckWolf25/CodePulse.git
   cd CodePulse
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Compile the extension and webview:**

   ```bash
   pnpm run compile
   ```

4. Press `F5` in VS Code to run the extension inside a Development Host window.

### Development Commands

Use the following pnpm commands in your project root:

- **Compile extension and build webview:**

  ```bash
  pnpm run compile
  ```

- **Compile and watch for backend changes:**

  ```bash
  pnpm run watch
  ```

- **Run linter:**

  ```bash
  pnpm run lint
  ```

- **Run unit tests:**

  ```bash
  pnpm run test
  ```

---

## Style & Code Guidelines

### TypeScript Coding Style

To keep the codebase uniform and easy to read:

- **Indentation:** Use 4 spaces for indentation. Do not use tabs.
- **Naming Conventions:**
  - Classes and Interfaces: `PascalCase`
  - Functions and Variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `camelCase` or `kebab-case` for backend, `PascalCase` for Svelte components.
  - Private Members: Prefix with an underscore `_` (e.g., `private _db`).
- **Braces:** Use standard Egyptian brackets style:

  ```typescript
  export function exampleFunction(): void {
      if (condition) {
          // code
      } else {
          // code
      }
  }
  ```

- **Type Safety:** Always use TypeScript types explicitly. Avoid `any` at all costs.

### VS Code Extension Best Practices

- **Resource Disposal**: Always push disposable items (like EventEmitters, Command registrations, and panel hooks) to the `context.subscriptions` array to prevent memory leaks.
- **Database Operations**: Perform database write operations asynchronously where possible, and avoid blocking the main extension host thread.

### Commit Messages

Use prefix tags for commits, such as:

- `feat: ...` for a new feature
- `fix: ...` for a bug fix
- `docs: ...` for documentation changes
- `refactor: ...` for code style or internal design changes
- `test: ...` for adding or updating tests
- `chore: ...` for configuration/build updates

Example:

```text
feat: add CodeLens and Hover complexity indicators
```

---

## Testing

This project uses Mocha and the `@vscode/test-cli` to run integration tests inside a headless VS Code instance.

### Writing Unit Tests

- Add tests under the `src/test/` directory.
- Test parsing and complexity analyzer metrics against mock files placed in `src/test/mocks/`.

---

## Security Vulnerabilities

Please do not report security vulnerabilities in public issues. Refer to our [Security Policy](SECURITY.md) for instructions on how to report security issues privately.
