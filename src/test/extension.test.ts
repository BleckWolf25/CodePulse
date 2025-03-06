// src/test/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { MetricsTracker } from '../metrics/tracker';
import { CodeComplexityAnalyzer } from '../metrics/complexity';
import { MetricCache } from '../utils/cache';
import { AdvancedConfigManager } from '../utils/advanced-config';

// Mock extension context definition
const mockExtensionContext: vscode.ExtensionContext = {
    globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
        setKeysForSync: () => { }
    },
    workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
        setKeysForSync: () => { }
    },
    subscriptions: [],
    extensionPath: '',
    storagePath: '',
    globalStoragePath: '',
    logPath: '',
    extensionUri: vscode.Uri.parse('file:///mock'),
    environmentVariableCollection: {
        persistent: false,
        replace: () => { },
        append: () => { },
        prepend: () => { },
        get: () => undefined,
        forEach: () => { },
        delete: () => { },
        clear: () => { }
    },
    extensionMode: vscode.ExtensionMode.Test,
    secrets: {
        get: () => Promise.resolve(undefined),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        onDidChange: () => ({ dispose: () => { } })
    }
} as unknown as vscode.ExtensionContext;

suite('Extension Test Suite', () => {
    let testDocument: vscode.TextDocument;
    const testContent = `
        function test() {
            if (true) {
                console.log('test');
            }
        }
    `;

    suiteSetup(async () => {
        testDocument = await vscode.workspace.openTextDocument({
            content: testContent,
            language: 'typescript'
        });
    });

    test('Complexity Analysis', () => {
        const metrics = CodeComplexityAnalyzer.analyzeComplexity(testContent, 'typescript');

        assert.ok(metrics.cyclomaticComplexity > 0, 'Should detect complexity');
        assert.ok(metrics.maintainabilityIndex > 0, 'Should calculate maintainability');
    });

    test('MetricCache Functionality', () => {
        const cache = new MetricCache<number>();

        cache.set('test', 42);
        assert.strictEqual(cache.get('test'), 42, 'Should retrieve cached value');

        // Test expiration
        const expiredCache = new MetricCache<number>();
        expiredCache['CACHE_EXPIRY'] = 1; // Override expiry for test
        expiredCache.set('temp', 100);
        setTimeout(() => {
            assert.strictEqual(expiredCache.get('temp'), undefined, 'Should expire entries');
        }, 2);
    });

    test('Configuration Management', () => {
        const configManager = new AdvancedConfigManager();

        assert.strictEqual(configManager.getComplexityThreshold('typescript'), 10, 'Should return default threshold');
        configManager.setLanguageComplexityThreshold('typescript', 15);
        assert.strictEqual(configManager.getComplexityThreshold('typescript'), 15, 'Should update threshold');
    });

    test('Complexity Recommendations', () => {
        const testMetrics = {
            cyclomaticComplexity: 15,
            maintainabilityIndex: 40,
            halsteadMetrics: { difficulty: 25 }
        } as any;

        const recommendations = CodeComplexityAnalyzer.getComplexityRecommendations(testMetrics);
        assert.strictEqual(recommendations.length, 3, 'Should generate recommendations for problematic metrics');
    });

    test('MetricsTracker Initialization', () => {
        const tracker = new MetricsTracker(mockExtensionContext);
        assert.ok(tracker, 'MetricsTracker should initialize');
        assert.strictEqual(tracker.getSessionInsights().filesTracked, 0, 'Should start with 0 tracked files');
    });

    test('Session Tracking', () => {
        const tracker = new MetricsTracker(mockExtensionContext);
        const initialSession = tracker.getSessionInsights();
        assert.ok(initialSession.duration >= 0, 'Should track session duration');
        assert.strictEqual(initialSession.fileChanges, 0, 'Should start with 0 file changes');
    });

    test('File Analysis Workflow', async () => {
        const tracker = new MetricsTracker(mockExtensionContext);
        // Simulate document opening instead of calling private method
        await vscode.window.showTextDocument(testDocument);
        // Wait for analysis to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        const insights = tracker.getSessionInsights();
        assert.ok(insights.filesTracked > 0, 'Should track analyzed files');
        assert.ok(insights.averageComplexity > 0, 'Should calculate average complexity');
    });
});