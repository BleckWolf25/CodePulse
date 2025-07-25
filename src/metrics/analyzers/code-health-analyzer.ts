/**
 * @file CODE-HEALTH-ANALYZER.TS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description 
 * Analyzes code quality metrics including duplication detection,
 * test coverage analysis, documentation coverage, and technical debt assessment.
 */

// ------------ IMPORTS
import { StoredMetrics, CodeMetrics } from '../storage';
import { CodeHealthMetrics, Location } from '../types';
import { ErrorHandler } from '../../utils/error-handler';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ------------ CLASS
export class CodeHealthAnalyzer {
  private errorHandler = ErrorHandler.getInstance();
  private duplicateCache = new Map<string, string>();
  
  /**
   * Analyze code duplication across the codebase
   */
  public async analyzeDuplication(data: StoredMetrics): Promise<CodeHealthMetrics['duplicationType']> {
    try {
      const duplicateBlocks: Location[] = [];
      const fileContents = new Map<string, string>();
      
      // Read all file contents
      for (const filePath of Object.keys(data.fileMetrics)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          fileContents.set(filePath, content);
        } catch (error) {
          continue; // Skip files that can't be read
        }
      }
      
      // Analyze duplication
      const duplicates = await this.findDuplicateBlocks(fileContents);
      duplicateBlocks.push(...duplicates);
      
      // Calculate duplication percentage
      const totalLines = Array.from(fileContents.values())
        .reduce((sum, content) => sum + content.split('\n').length, 0);
      
      const duplicateLines = duplicateBlocks.reduce((sum, block) => 
        sum + (block.endLine - block.startLine + 1), 0);
      
      const percentage = totalLines > 0 ? (duplicateLines / totalLines) * 100 : 0;
      
      // Determine severity
      let severity: 'low' | 'medium' | 'high' = 'low';
      if (percentage > 20) {severity = 'high';}
      else if (percentage > 10) {severity = 'medium';}
      
      return {
        percentage,
        locations: duplicateBlocks,
        severity
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        percentage: 0,
        locations: [],
        severity: 'low'
      };
    }
  }

  /**
   * Analyze test coverage
   */
  public async analyzeTestCoverage(data: StoredMetrics): Promise<CodeHealthMetrics['testCoverage']> {
    try {
      const sourceFiles: string[] = [];
      const testFiles: string[] = [];
      const uncoveredPaths: string[] = [];
      const criticalPaths: string[] = [];
      
      // Categorize files
      for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
        if (this.isTestFile(filePath)) {
          testFiles.push(filePath);
        } else if (this.isSourceFile(filePath)) {
          sourceFiles.push(filePath);
          
          // Check if source file has corresponding test
          if (!this.hasCorrespondingTest(filePath, testFiles)) {
            uncoveredPaths.push(filePath);
            
            // Mark as critical if high complexity
            if (metrics.complexity.totalComplexity > 15) {
              criticalPaths.push(filePath);
            }
          }
        }
      }
      
      // Calculate coverage percentage
      const coveredFiles = sourceFiles.length - uncoveredPaths.length;
      const percentage = sourceFiles.length > 0 ? (coveredFiles / sourceFiles.length) * 100 : 0;
      
      return {
        percentage,
        uncoveredPaths,
        criticalPaths
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        percentage: 0,
        uncoveredPaths: [],
        criticalPaths: []
      };
    }
  }

  /**
   * Analyze documentation coverage
   */
  public async analyzeDocumentation(data: StoredMetrics): Promise<CodeHealthMetrics['documentation']> {
    try {
      let totalFunctions = 0;
      let documentedFunctions = 0;
      let qualityScore = 0;
      const missingDocs: string[] = [];
      
      for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const analysis = await this.analyzeFileDocumentation(filePath, content, metrics.language);
          
          totalFunctions += analysis.totalFunctions;
          documentedFunctions += analysis.documentedFunctions;
          qualityScore += analysis.qualityScore;
          
          if (analysis.missingDocs.length > 0) {
            missingDocs.push(...analysis.missingDocs);
          }
        } catch (error) {
          continue;
        }
      }
      
      const coverage = totalFunctions > 0 ? (documentedFunctions / totalFunctions) * 100 : 0;
      const quality = totalFunctions > 0 ? qualityScore / totalFunctions : 0;
      
      return {
        coverage,
        quality,
        missingDocs
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        coverage: 0,
        quality: 0,
        missingDocs: []
      };
    }
  }

  /**
   * Find duplicate code blocks
   */
  private async findDuplicateBlocks(fileContents: Map<string, string>): Promise<Location[]> {
    const duplicates: Location[] = [];
    const blockHashes = new Map<string, Location[]>();
    const minBlockSize = 5; // Minimum lines for duplication detection
    
    for (const [filePath, content] of fileContents) {
      const lines = content.split('\n');
      
      // Create sliding window of code blocks
      for (let i = 0; i <= lines.length - minBlockSize; i++) {
        const block = lines.slice(i, i + minBlockSize);
        const normalizedBlock = this.normalizeCodeBlock(block);
        const hash = crypto.createHash('md5').update(normalizedBlock).digest('hex');
        
        const location: Location = {
          filePath,
          startLine: i + 1,
          endLine: i + minBlockSize,
          startColumn: 0,
          endColumn: 0
        };
        
        if (blockHashes.has(hash)) {
          blockHashes.get(hash)!.push(location);
        } else {
          blockHashes.set(hash, [location]);
        }
      }
    }
    
    // Find actual duplicates (blocks that appear more than once)
    for (const [hash, locations] of blockHashes) {
      if (locations.length > 1) {
        duplicates.push(...locations);
      }
    }
    
    return duplicates;
  }

  /**
   * Normalize code block for comparison
   */
  private normalizeCodeBlock(lines: string[]): string {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('/*'))
      .join('\n')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, ''); // Remove line comments
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /test\//,
      /tests\//,
      /__tests__\//,
      /\.test$/,
      /\.spec$/
    ];
    
    return testPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if file is a source file
   */
  private isSourceFile(filePath: string): boolean {
    const sourceExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.cpp', '.c'];
    const ext = path.extname(filePath);
    return sourceExtensions.includes(ext) && !this.isTestFile(filePath);
  }

  /**
   * Check if source file has corresponding test
   */
  private hasCorrespondingTest(sourceFile: string, testFiles: string[]): boolean {
    const baseName = path.basename(sourceFile, path.extname(sourceFile));
    const dirName = path.dirname(sourceFile);
    
    return testFiles.some(testFile => {
      const testBaseName = path.basename(testFile).replace(/\.(test|spec)\./, '.');
      const testDirName = path.dirname(testFile);
      
      // Check for same name in same directory or test directory
      return (testBaseName.includes(baseName) || baseName.includes(testBaseName.split('.')[0])) &&
             (testDirName === dirName || testDirName.includes('test') || testDirName.includes('spec'));
    });
  }

  /**
   * Analyze documentation in a specific file
   */
  private async analyzeFileDocumentation(filePath: string, content: string, language: string): Promise<{
    totalFunctions: number;
    documentedFunctions: number;
    qualityScore: number;
    missingDocs: string[];
  }> {
    const functions = this.extractFunctions(content, language);
    const missingDocs: string[] = [];
    let documentedCount = 0;
    let totalQuality = 0;
    
    for (const func of functions) {
      const docAnalysis = this.analyzeFunctionDocumentation(func.content, func.name, language);
      
      if (docAnalysis.hasDocumentation) {
        documentedCount++;
        totalQuality += docAnalysis.quality;
      } else {
        missingDocs.push(`${filePath}:${func.startLine} - ${func.name}`);
      }
    }
    
    return {
      totalFunctions: functions.length,
      documentedFunctions: documentedCount,
      qualityScore: totalQuality,
      missingDocs
    };
  }

  /**
   * Extract functions from content
   */
  private extractFunctions(content: string, language: string): Array<{
    name: string;
    content: string;
    startLine: number;
  }> {
    const functions: Array<{ name: string; content: string; startLine: number }> = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (this.isFunctionDeclaration(line, language)) {
        const name = this.extractFunctionName(line, language);
        functions.push({
          name,
          content: line,
          startLine: index + 1
        });
      }
    });
    
    return functions;
  }

  /**
   * Check if line is a function declaration
   */
  private isFunctionDeclaration(line: string, language: string): boolean {
    const patterns = {
      typescript: /^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*(export\s+)?(async\s+)?\w+\s*\(/,
      javascript: /^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*(export\s+)?(async\s+)?\w+\s*\(/,
      python: /^\s*def\s+\w+\s*\(/,
      java: /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/,
      csharp: /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/
    };
    
    const pattern = patterns[language as keyof typeof patterns];
    return pattern ? pattern.test(line) : false;
  }

  /**
   * Extract function name from declaration
   */
  private extractFunctionName(line: string, _language: string): string {
    const match = line.match(/function\s+(\w+)|(\w+)\s*\(|def\s+(\w+)/);
    return match ? (match[1] || match[2] || match[3] || 'anonymous') : 'anonymous';
  }

  /**
   * Analyze documentation quality for a specific function
   */
  private analyzeFunctionDocumentation(content: string, _functionName: string, language: string): {
    hasDocumentation: boolean;
    quality: number;
  } {
    const docPatterns = {
      typescript: /\/\*\*[\s\S]*?\*\/|\/\/.*$/gm,
      javascript: /\/\*\*[\s\S]*?\*\/|\/\/.*$/gm,
      python: /"""[\s\S]*?"""|'''[\s\S]*?'''|#.*$/gm,
      java: /\/\*\*[\s\S]*?\*\/|\/\/.*$/gm,
      csharp: /\/\*\*[\s\S]*?\*\/|\/\/.*$/gm
    };

    const pattern = docPatterns[language as keyof typeof docPatterns];
    if (!pattern) {return { hasDocumentation: false, quality: 0 };}

    const docs = content.match(pattern);
    if (!docs || docs.length === 0) {
      return { hasDocumentation: false, quality: 0 };
    }

    // Calculate quality based on documentation content
    const docText = docs.join(' ');
    let quality = 0;

    // Basic documentation exists
    quality += 20;

    // Has parameter documentation
    if (/@param|:param|Parameters:/i.test(docText)) {quality += 20;}

    // Has return documentation
    if (/@return|:return|Returns:/i.test(docText)) {quality += 20;}

    // Has examples
    if (/@example|Example:|```/i.test(docText)) {quality += 20;}

    // Has description (more than just param/return)
    const descriptionLength = docText.replace(/@\w+.*$/gm, '').trim().length;
    if (descriptionLength > 50) {quality += 20;}

    return { hasDocumentation: true, quality };
  }

  /**
   * Calculate technical debt score
   */
  public async calculateTechnicalDebt(data: StoredMetrics): Promise<{
    totalDebtScore: number;
    debtByCategory: {
      complexity: number;
      duplication: number;
      testCoverage: number;
      documentation: number;
      codeSmells: number;
    };
    estimatedRefactoringTime: number;
    priorityFiles: Array<{
      filePath: string;
      debtScore: number;
      issues: string[];
    }>;
    recommendations: string[];
  }> {
    try {
      const debtByCategory = {
        complexity: 0,
        duplication: 0,
        testCoverage: 0,
        documentation: 0,
        codeSmells: 0
      };

      const priorityFiles: Array<{
        filePath: string;
        debtScore: number;
        issues: string[];
      }> = [];

      let totalFiles = 0;

      // Analyze each file for technical debt
      for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
        const fileDebt = await this.calculateFileDebt(filePath, metrics);

        debtByCategory.complexity += fileDebt.complexity;
        debtByCategory.duplication += fileDebt.duplication;
        debtByCategory.testCoverage += fileDebt.testCoverage;
        debtByCategory.documentation += fileDebt.documentation;
        debtByCategory.codeSmells += fileDebt.codeSmells;

        const totalFileDebt = Object.values(fileDebt).reduce((sum, debt) => sum + debt, 0);

        if (totalFileDebt > 50) { // High debt threshold
          priorityFiles.push({
            filePath,
            debtScore: totalFileDebt,
            issues: this.identifyFileIssues(fileDebt)
          });
        }

        totalFiles++;
      }

      // Calculate averages
      if (totalFiles > 0) {
        Object.keys(debtByCategory).forEach(key => {
          debtByCategory[key as keyof typeof debtByCategory] /= totalFiles;
        });
      }

      const totalDebtScore = Object.values(debtByCategory).reduce((sum, debt) => sum + debt, 0);

      // Sort priority files by debt score
      priorityFiles.sort((a, b) => b.debtScore - a.debtScore);

      // Estimate refactoring time (hours)
      const estimatedRefactoringTime = this.estimateRefactoringTime(totalDebtScore, priorityFiles.length);

      // Generate recommendations
      const recommendations = this.generateDebtRecommendations(debtByCategory, priorityFiles);

      return {
        totalDebtScore,
        debtByCategory,
        estimatedRefactoringTime,
        priorityFiles: priorityFiles.slice(0, 10), // Top 10 priority files
        recommendations
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        totalDebtScore: 0,
        debtByCategory: {
          complexity: 0,
          duplication: 0,
          testCoverage: 0,
          documentation: 0,
          codeSmells: 0
        },
        estimatedRefactoringTime: 0,
        priorityFiles: [],
        recommendations: []
      };
    }
  }

  /**
   * Calculate technical debt for a specific file
   */
  private async calculateFileDebt(filePath: string, metrics: CodeMetrics): Promise<{
    complexity: number;
    duplication: number;
    testCoverage: number;
    documentation: number;
    codeSmells: number;
  }> {
    const debt = {
      complexity: 0,
      duplication: 0,
      testCoverage: 0,
      documentation: 0,
      codeSmells: 0
    };

    // Complexity debt
    if (metrics.complexity.totalComplexity > 50) {
      debt.complexity = Math.min(100, metrics.complexity.totalComplexity);
    }

    // File size debt (large files are harder to maintain)
    if (metrics.lines > 500) {
      debt.complexity += Math.min(50, (metrics.lines - 500) / 10);
    }

    // Test coverage debt (assume no test if not a test file)
    if (!this.isTestFile(filePath) && this.isSourceFile(filePath)) {
      debt.testCoverage = 30; // Base penalty for no test
    }

    // Documentation debt
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const docAnalysis = await this.analyzeFileDocumentation(filePath, content, metrics.language);

      if (docAnalysis.totalFunctions > 0) {
        const docCoverage = docAnalysis.documentedFunctions / docAnalysis.totalFunctions;
        debt.documentation = Math.max(0, (1 - docCoverage) * 50);
      }

      // Code smells debt
      debt.codeSmells = await this.detectCodeSmells(content, metrics.language);
    } catch (error) {
      // If we can't read the file, assume moderate debt
      debt.documentation = 25;
      debt.codeSmells = 25;
    }

    return debt;
  }

  /**
   * Detect code smells in file content
   */
  private async detectCodeSmells(content: string, language: string): Promise<number> {
    let smellScore = 0;

    // Long parameter lists
    const longParameterLists = content.match(/\([^)]{50,}\)/g);
    if (longParameterLists) {
      smellScore += longParameterLists.length * 5;
    }

    // Deep nesting
    const deepNesting = content.match(/\s{12,}/g); // 3+ levels of indentation
    if (deepNesting) {
      smellScore += Math.min(20, deepNesting.length * 2);
    }

    // Magic numbers
    const magicNumbers = content.match(/\b\d{2,}\b/g);
    if (magicNumbers) {
      smellScore += Math.min(15, magicNumbers.length);
    }

    // Long method names (might indicate unclear responsibility)
    const longMethodNames = content.match(/function\s+\w{30,}|def\s+\w{30,}/g);
    if (longMethodNames) {
      smellScore += longMethodNames.length * 3;
    }

    // Code TODO/FIXME comments (technical debt markers)
    const todoComments = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi);
    if (todoComments) {
      smellScore += todoComments.length * 5;
    }

    // Commented out code
    const commentedCode = content.match(/\/\/\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=\(]/g);
    if (commentedCode) {
      smellScore += commentedCode.length * 3;
    }

    // Language-specific smells
    if (language === 'javascript' || language === 'typescript') {
      // Console.log statements (should be removed in production)
      const consoleLogs = content.match(/console\.(log|warn|error)/g);
      if (consoleLogs) {
        smellScore += consoleLogs.length * 2;
      }

      // Var usage (prefer let/const)
      const varUsage = content.match(/\bvar\s+/g);
      if (varUsage) {
        smellScore += varUsage.length * 2;
      }
    }

    return Math.min(100, smellScore);
  }

  /**
   * Identify specific issues for a file based on debt scores
   */
  private identifyFileIssues(debt: {
    complexity: number;
    duplication: number;
    testCoverage: number;
    documentation: number;
    codeSmells: number;
  }): string[] {
    const issues: string[] = [];

    if (debt.complexity > 30) {
      issues.push('High complexity - consider refactoring');
    }

    if (debt.duplication > 20) {
      issues.push('Code duplication detected');
    }

    if (debt.testCoverage > 20) {
      issues.push('Missing or insufficient test coverage');
    }

    if (debt.documentation > 30) {
      issues.push('Poor documentation coverage');
    }

    if (debt.codeSmells > 25) {
      issues.push('Multiple code smells detected');
    }

    return issues;
  }

  /**
   * Estimate refactoring time based on debt score
   */
  private estimateRefactoringTime(totalDebtScore: number, priorityFileCount: number): number {
    // Base time calculation: 1 hour per 10 debt points
    let baseTime = totalDebtScore / 10;

    // Additional time for priority files
    baseTime += priorityFileCount * 2;

    // Minimum 1 hour, maximum 200 hours
    return Math.max(1, Math.min(200, baseTime));
  }

  /**
   * Generate debt reduction recommendations
   */
  private generateDebtRecommendations(
    debtByCategory: {
      complexity: number;
      duplication: number;
      testCoverage: number;
      documentation: number;
      codeSmells: number;
    },
    priorityFiles: Array<{ filePath: string; debtScore: number; issues: string[] }>
  ): string[] {
    const recommendations: string[] = [];

    // Category-specific recommendations
    if (debtByCategory.complexity > 30) {
      recommendations.push('Focus on reducing code complexity through refactoring');
      recommendations.push('Break down large functions into smaller, focused ones');
    }

    if (debtByCategory.duplication > 20) {
      recommendations.push('Eliminate code duplication by extracting common functionality');
      recommendations.push('Consider implementing shared utilities or base classes');
    }

    if (debtByCategory.testCoverage > 25) {
      recommendations.push('Increase test coverage for critical functionality');
      recommendations.push('Implement unit tests for high-complexity functions');
    }

    if (debtByCategory.documentation > 30) {
      recommendations.push('Improve code documentation, especially for public APIs');
      recommendations.push('Add inline comments for complex business logic');
    }

    if (debtByCategory.codeSmells > 25) {
      recommendations.push('Address code smells to improve maintainability');
      recommendations.push('Remove commented-out code and TODO markers');
    }

    // Priority file recommendations
    if (priorityFiles.length > 0) {
      recommendations.push(`Focus refactoring efforts on ${priorityFiles.length} high-debt files`);

      if (priorityFiles.length > 5) {
        recommendations.push('Consider breaking down large files into smaller modules');
      }
    }

    // General recommendations
    if (recommendations.length > 3) {
      recommendations.push('Implement regular code review processes to prevent debt accumulation');
      recommendations.push('Set up automated code quality checks in CI/CD pipeline');
    }

    return recommendations;
  }

  /**
   * Analyze code maintainability index
   */
  public async calculateMaintainabilityIndex(data: StoredMetrics): Promise<{
    overallIndex: number;
    fileIndices: Array<{
      filePath: string;
      index: number;
      rating: 'excellent' | 'good' | 'moderate' | 'difficult' | 'unmaintainable';
    }>;
    averageByLanguage: Record<string, number>;
    trendDirection: 'improving' | 'stable' | 'declining';
  }> {
    try {
      const fileIndices: Array<{
        filePath: string;
        index: number;
        rating: 'excellent' | 'good' | 'moderate' | 'difficult' | 'unmaintainable';
      }> = [];

      const languageIndices: Record<string, number[]> = {};

      // Calculate maintainability index for each file
      for (const [filePath, metrics] of Object.entries(data.fileMetrics)) {
        const index = await this.calculateFileMaintainabilityIndex(filePath, metrics);
        const rating = this.rateMaintainability(index);

        fileIndices.push({ filePath, index, rating });

        // Group by language
        if (!languageIndices[metrics.language]) {
          languageIndices[metrics.language] = [];
        }
        languageIndices[metrics.language].push(index);
      }

      // Calculate overall index
      const overallIndex = fileIndices.length > 0
        ? fileIndices.reduce((sum, file) => sum + file.index, 0) / fileIndices.length
        : 0;

      // Calculate average by language
      const averageByLanguage: Record<string, number> = {};
      Object.entries(languageIndices).forEach(([language, indices]) => {
        averageByLanguage[language] = indices.reduce((sum, index) => sum + index, 0) / indices.length;
      });

      // Determine trend (simplified - would need historical data for accurate trend)
      const trendDirection = this.determineMaintainabilityTrend(overallIndex);

      return {
        overallIndex,
        fileIndices: fileIndices.sort((a, b) => a.index - b.index), // Sort by index (worst first)
        averageByLanguage,
        trendDirection
      };
    } catch (error) {
      this.errorHandler.handleError(error as Error);
      return {
        overallIndex: 0,
        fileIndices: [],
        averageByLanguage: {},
        trendDirection: 'stable'
      };
    }
  }

  /**
   * Calculate maintainability index for a specific file
   */
  private async calculateFileMaintainabilityIndex(filePath: string, metrics: CodeMetrics): Promise<number> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Microsoft's Maintainability Index formula (simplified)
      // MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)

      const linesOfCode = metrics.lines;
      const cyclomaticComplexity = metrics.complexity.totalComplexity;

      // Simplified Halstead volume calculation
      const halsteadVolume = this.calculateSimplifiedHalsteadVolume(content);

      let maintainabilityIndex = 171
        - 5.2 * Math.log(halsteadVolume)
        - 0.23 * cyclomaticComplexity
        - 16.2 * Math.log(linesOfCode);

      // Adjust for documentation
      const docAnalysis = await this.analyzeFileDocumentation(filePath, content, metrics.language);
      if (docAnalysis.totalFunctions > 0) {
        const docCoverage = docAnalysis.documentedFunctions / docAnalysis.totalFunctions;
        maintainabilityIndex += docCoverage * 10; // Bonus for documentation
      }

      // Ensure index is between 0 and 100
      return Math.max(0, Math.min(100, maintainabilityIndex));
    } catch (error) {
      return 50; // Default moderate maintainability if analysis fails
    }
  }

  /**
   * Calculate simplified Halstead volume
   */
  private calculateSimplifiedHalsteadVolume(content: string): number {
    // Simplified calculation based on unique operators and operands
    const operators = content.match(/[+\-*/=<>!&|^%~?:;,(){}[\]]/g) || [];
    const operands = content.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];

    const uniqueOperators = new Set(operators).size;
    const uniqueOperands = new Set(operands).size;
    const totalOperators = operators.length;
    const totalOperands = operands.length;

    const vocabulary = uniqueOperators + uniqueOperands;
    const length = totalOperators + totalOperands;

    // Halstead Volume = Length * log2(Vocabulary)
    return length * Math.log2(Math.max(1, vocabulary));
  }

  /**
   * Rate maintainability based on index
   */
  private rateMaintainability(index: number): 'excellent' | 'good' | 'moderate' | 'difficult' | 'unmaintainable' {
    if (index >= 85) {return 'excellent';}
    if (index >= 70) {return 'good';}
    if (index >= 50) {return 'moderate';}
    if (index >= 25) {return 'difficult';}
    return 'unmaintainable';
  }

  /**
   * Determine maintainability trend
   */
  private determineMaintainabilityTrend(overallIndex: number): 'improving' | 'stable' | 'declining' {
    // Simplified trend determination based on current index
    // In a real implementation, this would compare with historical data
    if (overallIndex >= 70) {return 'improving';}
    if (overallIndex >= 50) {return 'stable';}
    return 'declining';
  }
}
