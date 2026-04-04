import * as vscode from 'vscode';
import { ReadMarkManager } from './readMarkManager';

export class ReadMarkDecorationProvider implements vscode.FileDecorationProvider {
    private emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this.emitter.event;

    constructor(private manager: ReadMarkManager) {}

    refresh(uriList?: vscode.Uri[]) {
        // 传入 undefined 表示通知 VS Code 刷新所有当前可见的装饰
        this.emitter.fire(uriList);
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        // console.log("Checking decoration for: " + uri.toString());
        if (this.manager.isRead(uri)) {
            console.log("Decorating: " + uri.toString());
            return {
                badge: '✅',
                color: new vscode.ThemeColor('testing.iconPassed')
            };
        }
        return undefined;
    }
}