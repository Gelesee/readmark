import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { diff } from 'util';

export class ReadMarkManager {
    private readFiles: Set<string>;

    constructor(private context: vscode.ExtensionContext) {
        const stored = this.context.globalState.get<string[]>('readFiles', []);
        this.readFiles = new Set(stored);
        console.log("已加载的 readFiles: ", this.readFiles);
    }

    public toggle(uri: vscode.Uri) {
        const key = uri.toString();
        const isCurrentlyRead = this.readFiles.has(key);
        const oldreadFiles = new Set(this.readFiles); // 记录当前状态以便调试
        if (isCurrentlyRead) {
            // --- 执行取消逻辑 ---
            this.unmarkRecursive(uri);
            this.unmarkParents(uri);
            vscode.window.showInformationMessage("❌ remove marked read");
        } else {
            this.markRecursive(uri);
            this.markParents(uri);
            vscode.window.showInformationMessage('✅ add marked read');
        }
        const addList = Array.from(this.readFiles).filter(x => !oldreadFiles.has(x));
        const removeList = Array.from(oldreadFiles).filter(x => !this.readFiles.has(x));
        const differenceList = addList.concat(removeList);
        // 最后把更新后的 Set 存回 globalState
        this.context.globalState.update('readFiles', Array.from(this.readFiles));
        return differenceList.map(str => vscode.Uri.parse(str));
    }

    // --- 内部逻辑：向下递归 (Recursive Down) ---

    private unmarkRecursive(uri: vscode.Uri) {
        const key = uri.toString();
        const fsPath = uri.fsPath;
        this.readFiles.delete(key);
        if (fs.existsSync(fsPath) && fs.statSync(fsPath).isDirectory()) {
            const children = fs.readdirSync(fsPath);
            for (const childName of children) {
                const childPath = path.join(fsPath, childName);
                const childUri = vscode.Uri.file(childPath);
                this.unmarkRecursive(childUri);
            }
        }
    }

    private markRecursive(uri: vscode.Uri) {
        const key = uri.toString();
        const fsPath = uri.fsPath;
        this.readFiles.add(key);
        if (fs.existsSync(fsPath) && fs.statSync(fsPath).isDirectory()) {
            const children = fs.readdirSync(fsPath);
            for (const childName of children) {
                const childPath = path.join(fsPath, childName);
                const childUri = vscode.Uri.file(childPath);
                this.markRecursive(childUri);
            }
        }
    }

    // --- 内部逻辑：向上联动 (Link Up) ---

    private markParents(uri: vscode.Uri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) return;

        const rootPath = workspaceFolder.uri.fsPath;
        let currentPath = path.dirname(uri.fsPath); // 从父目录开始检查
        this.readFiles.add(uri.toString());
        // 只要还在工作区范围内，就向上迭代
        while (currentPath.startsWith(rootPath) && currentPath !== rootPath) {
            const currentUri = vscode.Uri.file(currentPath);
            if (this.checkAllChildrenMarked(currentUri)) {
                // 如果全满了，标记当前文件夹
                this.readFiles.add(currentUri.toString());
                const nextParent = path.dirname(currentPath);
                if (nextParent === currentPath) break;
                currentPath = nextParent;
            } else {
                // 只要遇到一个文件夹没满，就停止向上冒泡
                break;
            }
        }
    }

    private unmarkParents(uri: vscode.Uri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) return;
        const rootPath = workspaceFolder.uri.fsPath;
        let currentPath = uri.fsPath;
        this.readFiles.delete(uri.toString());
        // 2. 循环向上查找父目录
        while (true) {
            // 获取当前路径的父目录
            const parentPath = path.dirname(currentPath);
            if (!parentPath.startsWith(rootPath) || parentPath === currentPath) {
                break;
            }
            const parentUri = vscode.Uri.file(parentPath);
            const parentKey = parentUri.toString();

            if (this.readFiles.has(parentKey)) {
                this.readFiles.delete(parentKey);
            }
            currentPath = parentPath;
        }
    }

    private checkAllChildrenMarked(folderUri: vscode.Uri): boolean {
        const folderPath = folderUri.fsPath;
        if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
            return false;
        }
        try {
            const childrenNames = fs.readdirSync(folderPath);
            if (childrenNames.length === 0) return true;
            return childrenNames.every(name => {
                const childUri = vscode.Uri.file(path.join(folderPath, name));
                return this.readFiles.has(childUri.toString());
            });
        } catch (e) {
            console.error('检查子项时出错:', e);
            return false;
        }
    }
    // 供 Provider 查询
    public isRead(uri: vscode.Uri): boolean {
        return this.readFiles.has(uri.toString());
    }
}