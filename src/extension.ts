import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    // 1. 读取已读文件
    const stored = context.globalState.get<string[]>('readFiles', []);
    const readFiles = new Set<string>(stored);

    // 2. decoration provider
    const decorationProvider = new class implements vscode.FileDecorationProvider {
        private emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
        readonly onDidChangeFileDecorations = this.emitter.event;

        refresh(uri?: vscode.Uri) {
            this.emitter.fire(uri);
        }

        provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
            if (readFiles.has(uri.toString())) {
                return {
                    badge: '✓',
                    color: new vscode.ThemeColor('testing.iconPassed'),
                    tooltip: '已阅读完毕'
                };
            }
            return;
        }
    };

    // 3. 切换已读状态
    const toggleCommand = vscode.commands.registerCommand('readmark.toggleRead', (uri: vscode.Uri) => {

        let targetUri = uri;

        if (!targetUri && vscode.window.activeTextEditor) {
            targetUri = vscode.window.activeTextEditor.document.uri;
        }

        if (!targetUri) return;

        const key = targetUri.toString();

        if (readFiles.has(key)) {
            readFiles.delete(key);
            vscode.window.showInformationMessage('取消标记');
        } else {
            readFiles.add(key);
            vscode.window.showInformationMessage('标记已读');
        }

        // 持久化
        context.globalState.update('readFiles', Array.from(readFiles));

        // 刷新 UI（全部刷新更稳）
        decorationProvider.refresh(undefined);
    });

    // 4. 文件打开时刷新
    const openListener = vscode.workspace.onDidOpenTextDocument(doc => {
        decorationProvider.refresh(doc.uri);
    });

    // 5. 注册
    context.subscriptions.push(
        toggleCommand,
        openListener,
        vscode.window.registerFileDecorationProvider(decorationProvider)
    );
}

export function deactivate() {}