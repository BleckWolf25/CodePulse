/**
 * @file JAVASCRIPT-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * JavaScript Complexity Analyzer
 * Analyzes JavaScript source code and calculates complexity metrics.
 */

// ------------ IMPORTS
import { ILanguageAnalyzer } from './analyzer.interface';
import { ComplexityMetrics, LanguageConfig } from '../complexity';
import { ErrorHandler } from '../../utils/error-handler';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

// ------------ CLASS
export class JavaScriptAnalyzer implements ILanguageAnalyzer {
  private readonly SUPPORTED_LANGUAGES = ['javascript', 'js', 'jsx', 'mjs'];
  private errorHandler = ErrorHandler.getInstance();

  public getLanguageName(): string {
    return 'javascript';
  }

  public supportsLanguage(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  public analyze(sourceCode: string, config: LanguageConfig): ComplexityMetrics {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;

    const parser = acorn.Parser;
    const ast = parser.parse(sourceCode, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true
    });

    const state = {
      cyclomaticComplexity: 1,
      functionDepth: 0,
      scopeDepth: 0,
      operatorCount: 0,
      operandCount: 0,
      uniqueOperators: new Set<string>(),
      uniqueOperands: new Set<string>(),
      asyncCount: 0,
      classFeatures: new Set(),
      moduleFeatures: new Set()
    };

    // Walk AST and analyze nodes
    walk.simple(ast, {
      IfStatement: () => {
        state.cyclomaticComplexity += config.complexityWeights.conditionals;
      },
      WhileStatement: () => {
        state.cyclomaticComplexity += config.complexityWeights.loops;
      },
      ForStatement: () => {
        state.cyclomaticComplexity += config.complexityWeights.loops;
      },
      FunctionDeclaration: () => {
        state.functionDepth++;
        state.cyclomaticComplexity += config.complexityWeights.functions;
      },
      ClassDeclaration: () => {
        state.cyclomaticComplexity += config.complexityWeights.classes;
      },
      LogicalExpression: () => {
        state.cyclomaticComplexity += 0.5;
        state.operatorCount++;
      },
      Identifier: (node: any) => {
        state.uniqueOperands.add(node.name);
        state.operandCount++;
      },
      ArrowFunctionExpression: (node: any) => {
        state.cyclomaticComplexity += config.complexityWeights.functions * 0.7;
        if (node.async) {
          state.asyncCount++;
        }
      },
      ImportExpression: () => {
        state.moduleFeatures.add('dynamic-import');
      },
      ExportNamedDeclaration: () => {
        state.moduleFeatures.add('named-export');
      }
    });

    // Adjust complexity based on modern features
    state.cyclomaticComplexity +=
      (state.asyncCount * 0.3) +
      (state.classFeatures.size * 0.2) +
      (state.moduleFeatures.size * 0.1);

    // Calculate metrics
    const lineCount = sourceCode.split('\n').length;
    const halsteadVolume = state.operatorCount * Math.log2(state.uniqueOperators.size || 1);
    const maintainabilityIndex = Math.max(0, Math.min(100,
      171 -
      (5.2 * Math.log(halsteadVolume)) -
      (0.23 * state.cyclomaticComplexity) -
      (16.2 * Math.log(lineCount))
    ));

    return {
      totalComplexity: state.cyclomaticComplexity,
      cyclomaticComplexity: Math.min(state.cyclomaticComplexity, config.thresholds.cyclomatic),
      maintainabilityIndex,
      halsteadMetrics: {
        difficulty: (state.uniqueOperators.size / 2) * (state.operandCount / (state.uniqueOperands.size || 1)),
        volume: halsteadVolume,
        effort: halsteadVolume * state.cyclomaticComplexity
      },
      performance: {
        analysisTime: performance.now() - startTime,
        memoryUsage: process.memoryUsage().heapUsed - initialMemory,
        nodeCount: this.countNodes(ast)
      }
    };
  }

  countNodes(ast: acorn.Program): number {
    let count = 1; // Count the root node
    
    // Node visitor with scope tracking
    const visitNode = (node: any): void => {
      // Count all properties that are nodes or arrays of nodes
      for (const key in node) {
        const prop = node[key];
        
        // Skip non-object properties and metadata
        if (!prop || typeof prop !== 'object' || key === 'parent' || key === 'sourceFile') {
          continue;
        }

        // Handle arrays of nodes
        if (Array.isArray(prop)) {
          prop.forEach(item => {
            if (item && typeof item === 'object' && 'type' in item) {
              count++;
              visitNode(item);
            }
          });
        }
        // Handle single nodes
        else if ('type' in prop) {
          count++;
          visitNode(prop);
        }
      }
    };

    // Start traversal from root
    visitNode(ast);
    return count;
  }



  catch(error: Error) {
    return this.errorHandler.handleAnalysisError(
      'JavaScript',
      error as Error,
      'analyze'
    );
  }
}
