import * as vscode from 'vscode';

export class StorageManager {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async set(key: string, value: any): Promise<void> {
        await this.context.globalState.update(key, value);
    }

    async get(key: string): Promise<any> {
        return this.context.globalState.get(key);
    }

    async remove(key: string): Promise<void> {
        await this.context.globalState.update(key, undefined);
    }

    has(key: string): boolean {
        const value = this.context.globalState.get(key);
        return value !== undefined && value !== null;
    }

    async clear(): Promise<void> {
        const keys = this.context.globalState.keys();
        for (const key of keys) {
            await this.context.globalState.update(key, undefined);
        }
    }
}
