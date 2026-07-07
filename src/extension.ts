import * as vscode from 'vscode';
import * as path from 'node:path';

/**
 * Resolves the local database file path inside the extension's global storage directory.
 * VS Code automatically chooses the correct OS-specific location:
 *   - Windows: %APPDATA%/Code/User/globalStorage/<extension-id>/codepulse.db
 *   - macOS:   ~/Library/Application Support/Code/User/globalStorage/<extension-id>/codepulse.db
 *   - Linux:   ~/.config/Code/User/globalStorage/<extension-id>/codepulse.db
 */
async function getDatabasePath(context: vscode.ExtensionContext): Promise<string> {
	const storageUri = context.globalStorageUri;
	const dbPath = path.join(storageUri.fsPath, 'codepulse.db');

	// Ensure the storage directory exists
	try {
		await vscode.workspace.fs.createDirectory(storageUri);
	} catch (err) {
		console.error('[CodePulse] Failed to create storage directory:', err);
	}

	return dbPath;
}

export async function activate(context: vscode.ExtensionContext) {
	console.log('[CodePulse] Activating extension...');

	// Resolve database path for cross-platform storage
	const dbPath = await getDatabasePath(context);
	console.log(`[CodePulse] Database path resolved: ${dbPath}`);

	// Store the database path in subscriptions for later use
	context.subscriptions.push(
		vscode.commands.registerCommand('codepulse.helloWorld', () => {
			vscode.window.showInformationMessage(`CodePulse is active! Database location: ${dbPath}`);
		}),
	);
}

export function deactivate() {
	console.log('[CodePulse] Deactivating extension...');
}