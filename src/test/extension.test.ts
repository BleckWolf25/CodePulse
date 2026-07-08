/**
 * @file extension.test.ts
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @license MIT
 *
 * @summary Extension integration tests for CodePulse.
 *
 * @description
 * Tests the CodePulse extension's singleton instantiation and command registration.
 *
 * @since 08/07/2026
 * @updated 08/07/2026
 */
// ---------- IMPORTS
import * as assert from 'assert';
import * as vscode from 'vscode';
import { DatabaseManager } from '../database/database.js';

// ---------- TEST SUITE

suite('CodePulse Extension Test Suite', () => {
    vscode.window.showInformationMessage('Running CodePulse Extension Tests...');

    test('DatabaseManager Singleton instantiation', () => {
        const db1 = DatabaseManager.getInstance();
        const db2 = DatabaseManager.getInstance();
        assert.strictEqual(db1, db2, 'DatabaseManager should be a singleton');
    });

    test('Extension registered commands list', async () => {
        const commands = await vscode.commands.getCommands(true);
        const codePulseCommands = commands.filter((c) => c.startsWith('codepulse.'));

        assert.ok(codePulseCommands.includes('codepulse.openDashboard'), 'codepulse.openDashboard should be registered');
        assert.ok(codePulseCommands.includes('codepulse.exportJson'), 'codepulse.exportJson should be registered');
        assert.ok(codePulseCommands.includes('codepulse.exportCsv'), 'codepulse.exportCsv should be registered');
        assert.ok(codePulseCommands.includes('codepulse.purgeLogs'), 'codepulse.purgeLogs should be registered');
    });
});
