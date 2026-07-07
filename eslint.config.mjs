/**
 *
 * @file eslint.config.mjs
 *
 * @version 1.0.0
 * @author Bleckwolf25
 * @license MIT
 *
 * @summary Eslint configuration for Typescript Projects.
 *
 * @description
 * This file contains the configuration for Eslint in Typescript projects.
 * It extends the recommended rules from Eslint and Typescript Eslint,
 * and adds some custom rules for naming conventions, unused variables, and other best practices.
 * It also includes a separate configuration for test files, relaxing some rules that may not be applicable in testing scenarios.
 * It integrates Prettier to ensure consistent code formatting across the project.
 *
 * @since 05/07/2026
 * @updated 07/07/2026
 */
// ---------- IMPORTS
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

// ---------- CONFIGURATION
export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            "@typescript-eslint/naming-convention": [
                "error",
                { selector: "default", format: ["camelCase"] },
                { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
                { selector: "parameter", format: ["camelCase"], leadingUnderscore: "allow" },
                { selector: "memberLike", modifiers: ["private"], format: ["camelCase"], leadingUnderscore: "require" },
                { selector: "typeLike", format: ["PascalCase"] },
                { selector: "import", format: ["camelCase", "PascalCase"] }
            ],
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "curly": ["error", "all"],
            "eqeqeq": ["error", "always"],
            "no-throw-literal": "error"
        }
    },
    {
        // Relax specific rules for test files
        files: ["**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/unbound-method": "off"
        }
    },
    // Prettier config must be the last item in the array to override conflicting rules
    eslintConfigPrettier
);
