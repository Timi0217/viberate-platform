import * as vscode from 'vscode';

type IdleCallback = () => void;

export class IdleDetector {
    private lastActivityTime: number = Date.now();
    private idleCallbacks: Map<number, IdleCallback> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;
    private activityListeners: vscode.Disposable[] = [];

    constructor() {
        this.setupActivityListeners();
    }

    private setupActivityListeners(): void {
        // Listen for text document changes
        this.activityListeners.push(
            vscode.workspace.onDidChangeTextDocument(() => {
                this.resetIdleTimer();
            })
        );

        // Listen for active text editor changes
        this.activityListeners.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                this.resetIdleTimer();
            })
        );

        // Listen for terminal activity
        this.activityListeners.push(
            vscode.window.onDidChangeActiveTerminal(() => {
                this.resetIdleTimer();
            })
        );

        // Listen for text selection changes
        this.activityListeners.push(
            vscode.window.onDidChangeTextEditorSelection(() => {
                this.resetIdleTimer();
            })
        );
    }

    private resetIdleTimer(): void {
        this.lastActivityTime = Date.now();
    }

    onIdle(seconds: number, callback: IdleCallback): void {
        this.idleCallbacks.set(seconds, callback);
    }

    start(): void {
        if (this.checkInterval) {
            return; // Already started
        }

        // Check idle state every second
        this.checkInterval = setInterval(() => {
            const idleTimeSeconds = (Date.now() - this.lastActivityTime) / 1000;

            // Check all registered idle callbacks
            for (const [threshold, callback] of this.idleCallbacks.entries()) {
                if (idleTimeSeconds >= threshold) {
                    callback();
                    // Reset timer after triggering to avoid repeated calls
                    this.resetIdleTimer();
                }
            }
        }, 1000);
    }

    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    dispose(): void {
        this.stop();
        this.activityListeners.forEach(listener => listener.dispose());
        this.activityListeners = [];
    }
}
