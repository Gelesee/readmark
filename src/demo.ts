import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('ReadMark extension activated');

    // ==========================
    // 1. 读取已读文件列表（从全局状态存储获取）
    // ==========================
    const stored = context.globalState.get<string[]>('readFiles', []);
    const readFiles = new Set<string>(stored);
    console.log('已加载已读文件:', Array.from(readFiles));

    // ==========================
    // 2. 文件装饰（Decoration）提供者
    //    - 根据 readFiles 给文件加徽章
    // ==========================
    const decorationProvider = new class implements vscode.FileDecorationProvider {
        private emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
        readonly onDidChangeFileDecorations = this.emitter.event;

        // 手动刷新装饰
        refresh(uri?: vscode.Uri) {
            console.log('刷新文件装饰:', uri?.toString() || '全部文件');
            this.emitter.fire(uri);
        }

        // VS Code 调用这个方法来获取文件的装饰
        provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
            if (readFiles.has(uri.toString())) {
                console.log('提供装饰给文件:', uri.toString());
                return {
                    badge: '✓', // 徽章
                    color: new vscode.ThemeColor('testing.iconPassed'), // 颜色
                    tooltip: '已阅读完毕' // 鼠标悬浮提示
                };
            }
            return;
        }
    };

    // ==========================
    // 3. 切换已读状态的命令
    //    - 注册一个命令 readmark.toggleRead
    // ==========================
    const toggleCommand = vscode.commands.registerCommand('readmark.toggleRead', (uri: vscode.Uri) => {
        console.log('命令触发:', uri?.toString());

        // 如果没有传入 URI，就用当前编辑器的文件
        let targetUri = uri;
        if (!targetUri && vscode.window.activeTextEditor) {
            targetUri = vscode.window.activeTextEditor.document.uri;
        }

        if (!targetUri) {
            console.log('没有目标文件，命令退出');
            return;
        }

        const key = targetUri.toString();

        // 切换已读状态
        if (readFiles.has(key)) {
            readFiles.delete(key);
            vscode.window.showInformationMessage('取消标记');
            console.log('文件取消已读:', key);
        } else {
            readFiles.add(key);
            vscode.window.showInformationMessage('标记已读');
            console.log('文件标记为已读:', key);
        }

        // ==========================
        // 持久化到全局状态
        // ==========================
        context.globalState.update('readFiles', Array.from(readFiles));
        console.log('全局状态更新完成');

        // 刷新 UI（刷新全部文件更稳妥）
        decorationProvider.refresh(undefined);
    });

    // ==========================
    // 4. 文件打开时刷新装饰
    // ==========================
    const openListener = vscode.workspace.onDidOpenTextDocument(doc => {
        console.log('文件打开:', doc.uri.toString());
        decorationProvider.refresh(doc.uri);
    });

    // ==========================
    // 5. 注册命令和监听器
    // ==========================
    context.subscriptions.push(
        toggleCommand,
        openListener,
        vscode.window.registerFileDecorationProvider(decorationProvider)
    );
}

export function deactivate() {
    console.log('ReadMark extension deactivated');
}