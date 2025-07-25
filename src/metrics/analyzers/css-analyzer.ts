/**
 * @file CSS-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * CSS Complexity Analyzer
 * Analyzes CSS source code and calculates complexity metrics.
 */

// ------------ IMPORTS
import { ILanguageAnalyzer } from './analyzer.interface';
import { ComplexityMetrics, LanguageConfig } from '../complexity';
import { ErrorHandler } from '../../utils/error-handler';

// ------------ CLASS
export class CSSAnalyzer implements ILanguageAnalyzer {
  private readonly SUPPORTED_LANGUAGES = ['css', 'scss', 'less', 'sass', 'stylus'];
  private readonly PREPROCESSOR_FEATURES = {
    scss: new Set(['@mixin', '@include', '@extend', '@if', '@else', '@each', '@for', '@while', '$']),
    less: new Set(['@variable', '.mixin', '.extend', 'when', '@import']),
    sass: new Set(['@mixin', '@include', '@extend', '@if', '@else', '@each', '@for', '@while', '$']),
    stylus: new Set(['$', '@extend', '@import', '@media', '@font-face', '@keyframes'])
  };
  private errorHandler = ErrorHandler.getInstance();

  public getLanguageName(): string {
    return 'css';
  }

  public supportsLanguage(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  public analyze(sourceCode: string, config: LanguageConfig): ComplexityMetrics {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;

    try {
      const state = {
        selectors: new Set<string>(),
        nestedDepth: 0,
        maxNestingDepth: 0,
        mediaQueries: 0,
        uniqueProperties: new Set<string>(),
        propertyCount: 0,
        mixins: 0
      };

      // Split into rules
      const rules = this.parseRules(sourceCode);
      
      // Analyze each rule
      rules.forEach(rule => {
        this.analyzeRule(rule, state);
      });

      // Calculate complexity based on CSS-specific metrics
      const complexity = this.calculateComplexity(state, config);
      
      return {
        totalComplexity: complexity,
        cyclomaticComplexity: Math.min(complexity, config.thresholds.cyclomatic),
        maintainabilityIndex: this.calculateMaintainabilityIndex(state, sourceCode),
        halsteadMetrics: {
          difficulty: state.maxNestingDepth * (state.mediaQueries + 1),
          volume: state.propertyCount * Math.log2(state.uniqueProperties.size || 1),
          effort: state.propertyCount * state.maxNestingDepth
        },
        performance: {
          analysisTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed - initialMemory,
          nodeCount: rules.length
        }
      };
    } catch (error) {
      return this.errorHandler.handleAnalysisError(
        'CSS',
        error as Error,
        'analyze'
      );
    }
  }

  private parseRules(sourceCode: string): string[] {
    return sourceCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .split('}')
      .filter(rule => rule.trim().length > 0);
  }

  private analyzeRule(rule: string, state: any): void {
    // Track preprocessor-specific features
    const language = this.detectPreprocessorLanguage(rule);
    if (language) {
      this.analyzePreprocessorFeatures(rule, language, state);
    }

    // Nesting depth calculation
    const nestingLevel = this.calculateNestingDepth(rule);
    state.nestedDepth += nestingLevel;
    state.maxNestingDepth = Math.max(state.maxNestingDepth, state.nestedDepth);

    // Track advanced selectors
    this.analyzeSelectors(rule.split('{')[0], state);

    // Track properties and values with vendor prefixes
    this.analyzeProperties(rule, state);

    // Track advanced features
    this.analyzeAdvancedFeatures(rule, state);
  }

  private detectPreprocessorLanguage(rule: string): keyof typeof this.PREPROCESSOR_FEATURES | null {
    if (/@mixin|@include|@extend/.test(rule)) {return 'scss';}
    if (/\.[\w-]+\s*\(|@\{/.test(rule)) {return 'less';}
    if (/\$[\w-]+\s*=/.test(rule)) {return 'sass';}
    if (/^\s*[\w-]+\s*=/.test(rule)) {return 'stylus';}
    return null;
  }

  private analyzePreprocessorFeatures(rule: string, language: keyof typeof this.PREPROCESSOR_FEATURES, state: any): void {
    const features = this.PREPROCESSOR_FEATURES[language];
    const preprocessorState = {
      mixinUsage: 0,
      variableUsage: 0,
      conditionals: 0,
      imports: 0,
      extends: 0,
      nestedOperators: 0
    };

    features.forEach((feature: string) => {
      if (rule.includes(feature)) {
        state.preprocessorFeatures = state.preprocessorFeatures || new Set();
        state.preprocessorFeatures.add(feature);
        
        // Track specific preprocessor features
        if (feature.includes('mixin')) {
          preprocessorState.mixinUsage++;
        } else if (feature.startsWith('$') || feature.startsWith('@variable')) {
          preprocessorState.variableUsage++;
        } else if (feature.includes('if') || feature.includes('when')) {
          preprocessorState.conditionals++;
        } else if (feature.includes('extend')) {
          preprocessorState.extends++;
        } else if (feature.includes('import')) {
          preprocessorState.imports++;
        }

        // Track nested operators
        if (rule.includes('&')) {
          preprocessorState.nestedOperators++;
        }
      }
    });

    // Update complexity based on preprocessor usage
    state.preprocessorComplexity = 
      (preprocessorState.mixinUsage * 0.5) +
      (preprocessorState.variableUsage * 0.3) +
      (preprocessorState.conditionals * 0.8) +
      (preprocessorState.extends * 0.4) +
      (preprocessorState.nestedOperators * 0.2);

    state.cyclomaticComplexity += state.preprocessorComplexity;
  }

  private calculateNestingDepth(rule: string): number {
    let depth = 0;
    let currentDepth = 0;
    
    for (const char of rule) {
      if (char === '{') {currentDepth++;}
      if (char === '}') {currentDepth--;}
      depth = Math.max(depth, currentDepth);
    }
    
    return depth;
  }

  private analyzeSelectors(selectorGroup: string, state: any): void {
    const selectors = selectorGroup.split(',').map(s => s.trim());
    
    selectors.forEach(selector => {
      if (!selector) {return;}
      
      // Track selector specificity
      const specificity = this.calculateSpecificity(selector);
      state.maxSpecificity = Math.max(state.maxSpecificity || 0, specificity);
      
      // Track pseudo-classes and pseudo-elements
      if (/:/.test(selector)) {
        state.pseudoSelectors = (state.pseudoSelectors || 0) + 1;
      }
      
      // Track attribute selectors
      if (/\[.*\]/.test(selector)) {
        state.attributeSelectors = (state.attributeSelectors || 0) + 1;
      }
    });
  }

  private calculateSpecificity(selector: string): number {
    const id = (selector.match(/#/g) || []).length * 100;
    const className = (selector.match(/\./g) || []).length * 10;
    const element = (selector.match(/[a-z]+/gi) || []).length;
    const pseudo = (selector.match(/:/g) || []).length;
    
    return id + className + element + pseudo;
  }

  private analyzeProperties(rule: string, state: any): void {
    const properties = rule.match(/[a-z-]+(?=:)/g) || [];
    
    properties.forEach(prop => {
      state.uniqueProperties.add(prop);
      state.propertyCount++;
      
      // Track vendor prefixes
      if (/^-(?:webkit|moz|ms|o)-/.test(prop)) {
        state.vendorPrefixes = (state.vendorPrefixes || 0) + 1;
      }
    });
  }

  private analyzeAdvancedFeatures(rule: string, state: any): void {
    // Custom properties
    if (/--[\w-]+:/.test(rule)) {
      state.customProperties = (state.customProperties || 0) + 1;
    }
    
    // Grid/Flexbox
    if (/display:\s*(?:grid|flex)/.test(rule)) {
      state.modernLayouts = (state.modernLayouts || 0) + 1;
    }
    
    // Animations and transitions
    if (/@(?:keyframes|animation|transition)/.test(rule)) {
      state.animations = (state.animations || 0) + 1;
    }
  }

  private calculateComplexity(state: any, config: LanguageConfig): number {
    const baseComplexity = (
      (state.selectors.size * config.complexityWeights.classes) +
      (state.maxNestingDepth * config.complexityWeights.functions) +
      (state.mediaQueries * config.complexityWeights.conditionals)
    );

    // Add preprocessor complexity
    const preprocessorComplexity = state.preprocessorFeatures ? 
      state.preprocessorFeatures.size * config.complexityWeights.functions * 0.5 : 0;

    // Add modern feature complexity
    const modernFeatureComplexity = 
      (state.customProperties || 0) * 0.3 +
      (state.modernLayouts || 0) * 0.5 +
      (state.animations || 0) * 0.7;

    return baseComplexity + preprocessorComplexity + modernFeatureComplexity;
  }

  private calculateMaintainabilityIndex(state: any, sourceCode: string): number {
    const lineCount = sourceCode.split('\n').length;
    return Math.max(0, Math.min(100,
      100 -
      (state.maxNestingDepth * 2) -
      (state.mediaQueries * 1.5) -
      (Math.log(lineCount) * 10)
    ));
  }
}
