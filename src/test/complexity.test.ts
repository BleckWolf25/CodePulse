/**
 * @file complexity.test.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Unit tests for complexity analysis across multiple languages.
 *
 * @description
 * Tests the complexity analyzer's ability to correctly calculate cyclomatic
 * and cognitive complexity for JavaScript, Python, Go, and Java code samples.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import * as assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TreeSitterManager } from '../parser/parser.js';

// ---------- TEST SUITE
suite('Complexity Analyzer Unit Tests', () => {
    let tsManager: TreeSitterManager;
    const mockDir = path.join(__dirname, '..', '..', 'src', 'test', 'mocks');

    suiteSetup(() => {
        tsManager = TreeSitterManager.getInstance();
    });

    test('JavaScript Complexity Analysis', () => {
        const codePath = path.join(mockDir, 'sample.js');
        const code = fs.readFileSync(codePath, 'utf8');
        const scores = tsManager.analyze('javascript', code);
        assert.ok(scores);
        // Base is 1. One 'if_statement', one 'for_statement'. Cyclomatic = 3.
        assert.strictEqual(scores.cyclomaticComplexity, 3);
        // 'if_statement' (+1 at nest 0)
        // 'for_statement' (+2 at nest 1)
        // Total cognitive = 3.
        assert.strictEqual(scores.cognitiveComplexity, 3);
        assert.ok(scores.sloc > 0);
        assert.ok(scores.functionMetrics);
        assert.strictEqual(scores.functionMetrics.length, 1);
        assert.strictEqual(scores.functionMetrics[0].name, 'calculate');
        assert.strictEqual(scores.functionMetrics[0].cyclomaticComplexity, 3);
        assert.strictEqual(scores.functionMetrics[0].cognitiveComplexity, 3);
    });

    test('Python Complexity Analysis', () => {
        const codePath = path.join(mockDir, 'sample.py');
        const code = fs.readFileSync(codePath, 'utf8');
        const scores = tsManager.analyze('python', code);
        assert.ok(scores);
        assert.strictEqual(scores.cyclomaticComplexity, 3);
        assert.strictEqual(scores.cognitiveComplexity, 3);
        assert.ok(scores.sloc > 0);
        assert.ok(scores.functionMetrics);
        assert.strictEqual(scores.functionMetrics.length, 1);
        assert.strictEqual(scores.functionMetrics[0].name, 'calculate');
        assert.strictEqual(scores.functionMetrics[0].cyclomaticComplexity, 3);
        assert.strictEqual(scores.functionMetrics[0].cognitiveComplexity, 3);
    });

    test('Go Complexity Analysis', () => {
        const code = `
          package main
          func calculate(a, b int) int {
            result := 0
            if a > b {
              for i := 0; i < a; i++ {
                result += i
              }
            } else {
              result = b
            }
            return result
          }
        `;
        const scores = tsManager.analyze('go', code);
        assert.ok(scores);
        assert.strictEqual(scores.cyclomaticComplexity, 3);
        assert.strictEqual(scores.cognitiveComplexity, 3);
        assert.ok(scores.sloc > 0);
    });

    test('Java Complexity Analysis', () => {
        const code = `
          public class Calculator {
              public int calculate(int a, int b) {
                  int result = 0;
                  if (a > b) {
                      for (int i = 0; i < a; i++) {
                          result += i;
                      }
                  } else {
                      result = b;
                  }
                  return result;
              }
          }
        `;
        const scores = tsManager.analyze('java', code);
        assert.ok(scores);
        assert.strictEqual(scores.cyclomaticComplexity, 3);
        assert.strictEqual(scores.cognitiveComplexity, 3);
        assert.ok(scores.sloc > 0);
    });
});
