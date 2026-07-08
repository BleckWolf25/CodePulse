/**
 * @file complexityAnalyzer.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Implementation of Cyclomatic Complexity, Cognitive Complexity, and SLOC calculation.
 *
 * @description
 * Calculates Cyclomatic Complexity, Cognitive Complexity, and SLOC (Source Lines of Code)
 * using tree-sitter AST nodes. Provides language-specific decision point detection and
 * per-function complexity metrics with refactoring suggestions.
 *
 * # Cyclomatic Complexity
 * Counts every decision point that creates a new execution path:
 * - `if_statement`, `else_clause`, `elif_clause`
 * - `for_statement`, `for_in_statement`, `while_statement`, `do_statement`
 * - `switch_case`
 * - `catch_clause`, `except_clause`, `try_statement`
 * - `conditional_expression` (ternary `?:`)
 * - Logical binary expressions (`&&`, `||`), each adds 1.
 *
 * # Cognitive Complexity
 * Each nesting level adds extra weight. When we enter a nesting
 * structure we increment a depth counter; the *additional* weight
 * contributed is the current depth. This rewards flat code and
 * penalises deep nesting.
 *
 * # SLOC
 * Simple physical line count (non-blank lines).
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import type { FunctionMetric } from '../types.js';

// ---------- NODE-TYPE SETS
// Decision-point node types for JS/TS.
const JS_CYCLOMATIC_NODES: ReadonlySet<string> = new Set([
    'if_statement',
    'else_clause',
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
    'switch_case',
    'catch_clause',
    'conditional_expression',
]);

// Decision-point node types for Python.
const PY_CYCLOMATIC_NODES: ReadonlySet<string> = new Set([
    'if_statement',
    'elif_clause',
    'for_statement',
    'while_statement',
    'try_statement',
    'except_clause',
    'conditional_expression',
]);

// Decision-point node types for Go.
const GO_CYCLOMATIC_NODES: ReadonlySet<string> = new Set([
    'if_statement',
    'for_statement',
    'expression_case',
    'type_case',
    'communication_case',
]);

// Decision-point node types for Java.
const JAVA_CYCLOMATIC_NODES: ReadonlySet<string> = new Set([
    'if_statement',
    'for_statement',
    'enhanced_for_statement',
    'while_statement',
    'do_statement',
    'switch_label',
    'catch_clause',
    'ternary_expression',
]);

// Decision-point node types for C/C++.
const C_CPP_CYCLOMATIC_NODES: ReadonlySet<string> = new Set([
    'if_statement',
    'for_statement',
    'while_statement',
    'do_statement',
    'case_statement',
    'conditional_expression',
    'catch_clause',
]);

// Decision-point node types for Rust.
const RUST_CYCLOMATIC_NODES: ReadonlySet<string> = new Set([
    'if_expression',
    'for_expression',
    'while_expression',
    'loop_expression',
    'match_arm',
]);

// Node types that introduce an extra nesting level across all supported languages.
const NESTING_NODES: ReadonlySet<string> = new Set([
    // JS/TS/General C-like
    'if_statement',
    'else_clause',
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
    'switch_case',
    'catch_clause',
    'try_statement',
    'except_clause',
    'function_declaration',
    'function_definition',
    'method_definition',
    'arrow_function',
    'class_declaration',
    'class_definition',

    // Java
    'enhanced_for_statement',
    'constructor_declaration',
    'lambda_expression',

    // Go
    'func_literal',
    'expression_switch_statement',
    'type_switch_statement',
    'select_statement',

    // Rust
    'if_expression',
    'for_expression',
    'while_expression',
    'loop_expression',
    'match_expression',
    'function_item',
    'closure_expression',
]);

// ---------- PUBLIC HELPERS
/**
 * Check whether `node` is a logical-expression binary node (`&&` or `||`)
 * by inspecting its text for the operator symbol.
 */
function isLogicalExpression(nodeType: string, text: string): boolean {
    if (nodeType !== 'binary_expression') {
        return false;
    }
    const m = /&&|\|\|/.exec(text);
    return m !== null && (m[0] === '&&' || m[0] === '||');
}

function getCyclomaticSet(language: string): ReadonlySet<string> {
    switch (language) {
        case 'python':
            return PY_CYCLOMATIC_NODES;
        case 'go':
            return GO_CYCLOMATIC_NODES;
        case 'java':
            return JAVA_CYCLOMATIC_NODES;
        case 'c':
        case 'cpp':
            return C_CPP_CYCLOMATIC_NODES;
        case 'rust':
            return RUST_CYCLOMATIC_NODES;
        default:
            return JS_CYCLOMATIC_NODES;
    }
}

/**
 * Number of cyclomatic-complexity points contributed by a single node.
 */
function cyclomaticDelta(nodeType: string, text: string, language: string): number {
    const set = getCyclomaticSet(language);
    if (set.has(nodeType)) {
        return 1;
    }
    return isLogicalExpression(nodeType, text) ? 1 : 0;
}

// ---------- PUBLIC TYPES & INTERFACES
export interface ComplexityScores {
    readonly cyclomaticComplexity: number;
    readonly cognitiveComplexity: number;
    readonly sloc: number;
    readonly functionMetrics?: FunctionMetric[];
}

/**
 * Minimal interface for the cursor fields we need, so that the function
 * is decoupled from the full web-tree-sitter types at compile time.
 */
export interface TreeCursorLike {
    readonly nodeType: string;
    readonly nodeText: string;
    readonly startPosition: { row: number; column: number };
    readonly endPosition: { row: number; column: number };
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
    gotoParent(): boolean;
}

const FUNCTION_NODES = new Set([
    'function_declaration',
    'function_definition',
    'method_declaration',
    'method_definition',
    'constructor_declaration',
    'function_item',
    'func_literal',
    'arrow_function',
    'function_expression',
]);

function extractFunctionName(nodeType: string, nodeText: string): string {
    const firstLine = nodeText.split('\n')[0].trim();

    if (nodeType === 'function_definition' || nodeType === 'function_declaration' || nodeType === 'function_item') {
        const match = /(?:def|function|fn)\s+([a-zA-Z0-9_$]+)/.exec(firstLine);
        if (match) {
            return match[1];
        }
    }

    if (nodeType === 'method_declaration' || nodeType === 'method_definition') {
        const match = /(?:[a-zA-Z0-9_$<>@]+\s+)+([a-zA-Z0-9_$]+)\s*\(/.exec(firstLine);
        if (match) {
            return match[1];
        }
        const matchSimple = /([a-zA-Z0-9_$]+)\s*\(/.exec(firstLine);
        if (matchSimple) {
            return matchSimple[1];
        }
    }

    if (nodeType === 'arrow_function' || nodeType === 'function_expression') {
        const match = /([a-zA-Z0-9_$]+)\s*(?:=|:)/.exec(firstLine);
        if (match) {
            return match[1];
        }
    }

    const genericMatch = genericNameExtract(firstLine);
    if (genericMatch) {
        return genericMatch;
    }

    return 'anonymous';
}

// ---------- HELPER FUNCTIONS
function genericNameExtract(firstLine: string): string | null {
    const genericMatch = /([a-zA-Z0-9_$]+)\s*\(/.exec(firstLine);
    return genericMatch ? genericMatch[1] : null;
}

function generateSuggestions(active: {
    metric: FunctionMetric;
    maxNestingDepth: number;
}): void {
    const { metric, maxNestingDepth } = active;
    if (metric.cognitiveComplexity > 8) {
        metric.suggestions.push(`High cognitive complexity (${metric.cognitiveComplexity.toString()}). Consider splitting the function into smaller helpers.`);
    }
    if (metric.cyclomaticComplexity > 10) {
        metric.suggestions.push(`High cyclomatic complexity (${metric.cyclomaticComplexity.toString()}). Simplify conditional branches or switch statements.`);
    }
    if (maxNestingDepth > 2) {
        metric.suggestions.push(`Deep nesting level (${maxNestingDepth.toString()}) detected. Extract inner loops or nested if statements.`);
    }
}

/**
 * Walk a tree-sitter **TreeCursor** (starting at the root) and accumulate
 * complexity metrics.  Using a cursor avoids materialising the full
 * `Node#children` array at every level.
 *
 * @param cursor - A cursor positioned at the root of a parsed tree.
 * @param language - Language identifier (`'typescript'`, `'javascript'`, `'python'`).
 * @param sourceText - Raw source text (used for SLOC).
 */
export function computeComplexity(
    cursor: TreeCursorLike,
    language: string,
    sourceText: string,
): ComplexityScores {
    let cyclomatic = 0;
    let cognitive = 0;
    let depth = 0;

    interface ActiveFunction {
        metric: FunctionMetric;
        startDepth: number;
        maxNestingDepth: number;
    }

    const activeFunctions: ActiveFunction[] = [];
    const completedFunctions: FunctionMetric[] = [];

    // Pre-order DFS via cursor.
    // The standard tree-sitter cursor walk pattern:
    //   1. Process current node.
    //   2. Try to go to first child. If success, repeat from 1.
    //   3. Try to go to next sibling. If success, repeat from 1.
    //   4. Ascend via gotoParent until we find a node with a next sibling.
    //      If we ascend past the root, we're done.

    let hasMore = true;
    while (hasMore) {
        // ---- Process current node ----
        const nodeType = cursor.nodeType;
        const nodeText = cursor.nodeText;
        const startRow = cursor.startPosition.row + 1;

        // Finish any functions that have been exited
        while (activeFunctions.length > 0 && activeFunctions[activeFunctions.length - 1].metric.endLine < startRow) {
            const finished = activeFunctions.pop();
            if (finished) {
                generateSuggestions(finished);
                completedFunctions.push(finished.metric);
            }
        }

        const cycloDelta = cyclomaticDelta(nodeType, nodeText, language);
        cyclomatic += cycloDelta;

        const isNesting = NESTING_NODES.has(nodeType);
        if (isNesting) {
            depth += 1;
            cognitive += depth;
        }

        // If it's a function node, push to active stack
        if (FUNCTION_NODES.has(nodeType)) {
            const funcMetric: FunctionMetric = {
                name: extractFunctionName(nodeType, nodeText),
                startLine: cursor.startPosition.row + 1,
                endLine: cursor.endPosition.row + 1,
                cyclomaticComplexity: 1, // base 1
                cognitiveComplexity: 0,
                suggestions: [],
            };
            activeFunctions.push({
                metric: funcMetric,
                startDepth: depth,
                maxNestingDepth: 0,
            });
        }

        // Update active functions
        for (const active of activeFunctions) {
            active.metric.cyclomaticComplexity += cycloDelta;
            if (isNesting) {
                const relDepth = depth - active.startDepth;
                active.metric.cognitiveComplexity += relDepth;
                if (relDepth > active.maxNestingDepth) {
                    active.maxNestingDepth = relDepth;
                }
            }
        }

        // Try to descend
        if (cursor.gotoFirstChild()) {
            continue;
        }

        // Try next sibling
        if (cursor.gotoNextSibling()) {
            continue;
        }

        // Ascend
        let ascendedToSibling = false;
        while (cursor.gotoParent()) {
            // Restore depth when leaving a nesting node
            if (NESTING_NODES.has(cursor.nodeType)) {
                depth -= 1;
            }
            if (cursor.gotoNextSibling()) {
                ascendedToSibling = true;
                break;
            }
        }

        if (!ascendedToSibling) {
            hasMore = false;
        }
    }

    // Clean up any remaining functions on stack
    while (activeFunctions.length > 0) {
        const finished = activeFunctions.pop();
        if (finished) {
            generateSuggestions(finished);
            completedFunctions.push(finished.metric);
        }
    }

    return {
        cyclomaticComplexity: cyclomatic,
        cognitiveComplexity: cognitive,
        sloc: computeSloc(sourceText),
        functionMetrics: completedFunctions,
    };
}

/**
 * Count physical source lines of code (non-blank lines).
 */
function computeSloc(sourceText: string): number {
    let count = 0;
    for (const line of sourceText.split('\n')) {
        if (line.trim().length > 0) {
            count++;
        }
    }
    return count;
}
