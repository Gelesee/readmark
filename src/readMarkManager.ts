import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
        console.log("isCurrentlyRead: " + isCurrentlyRead);
        if (isCurrentlyRead) {
            // --- 执行取消逻辑 ---
            this.unmarkRecursive(uri);
            this.unmarkParents(uri);
        } else {
            this.markRecursive(uri);
            this.markParents(uri);
        }

        // 最后把更新后的 Set 存回 globalState
        this.context.globalState.update('readFiles', Array.from(this.readFiles));
    }

    // --- 内部逻辑：向下递归 (Recursive Down) ---

    private unmarkRecursive(uri: vscode.Uri) {
        const key = uri.toString();
        const fsPath = uri.fsPath;
        this.readFiles.delete(key);
        console.log("取消标记: " + key);
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
        console.log("标记: " + key);
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
                console.log(`[AutoMark] 文件夹已全满，标记父级: ${currentPath}`);
                const nextParent = path.dirname(currentPath);
                if (nextParent === currentPath) break;
                currentPath = nextParent;
            } else {
                // 只要遇到一个文件夹没满，就停止向上冒泡
                console.log(`[Stop] 文件夹未全满，停止向上标记: ${currentPath}`);
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
            console.log("parentPath: " + parentPath);
            if (!parentPath.startsWith(rootPath) || parentPath === currentPath) {
                break;
            }
            const parentUri = vscode.Uri.file(parentPath);
            const parentKey = parentUri.toString();

            if (this.readFiles.has(parentKey)) {
                this.readFiles.delete(parentKey);
                console.log(`[UnmarkParent] 已取消父文件夹标记: ${parentPath}`);
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