import * as vscode from 'vscode';
import { ReadMarkManager } from './readMarkManager';
import { ReadMarkDecorationProvider } from './decorationProvider';

export function activate(context: vscode.ExtensionContext) {
    const manager = new ReadMarkManager(context);
    const decorationProvider = new ReadMarkDecorationProvider(manager);
    const toggleCommand = vscode.commands.registerCommand('readmark.toggleRead', (uri: vscode.Uri) => {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!targetUri) return;

        // 执行连锁逻辑
        manager.toggle(targetUri);
        
        // 全量刷新 UI
        decorationProvider.refresh();
    });

    context.subscriptions.push(
        toggleCommand,
        vscode.window.registerFileDecorationProvider(decorationProvider)
    );
}