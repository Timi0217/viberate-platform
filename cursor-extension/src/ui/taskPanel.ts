import * as vscode from 'vscode';
import { AuthManager } from '../api/auth';
import { TaskManager, Task, TaskAssignment } from '../api/tasks';
import { getNonce } from '../utils/getNonce';

export class TaskPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'viberate.taskPanel';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly authManager: AuthManager,
        private readonly taskManager: TaskManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'claim-task':
                    await this.handleClaimTask(data.taskId);
                    break;
                case 'start-assignment':
                    await this.handleStartAssignment(data.assignmentId);
                    break;
                case 'submit-assignment':
                    await this.handleSubmitAssignment(data.assignmentId, data.result);
                    break;
                case 'cancel-assignment':
                    await this.handleCancelAssignment(data.assignmentId);
                    break;
                case 'refresh':
                    await this.refresh();
                    break;
                case 'login':
                    vscode.commands.executeCommand('viberate.login');
                    break;
                case 'register':
                    vscode.commands.executeCommand('viberate.register');
                    break;
                case 'logout':
                    vscode.commands.executeCommand('viberate.logout');
                    break;
                case 'connect-wallet':
                    vscode.commands.executeCommand('viberate.connectWallet');
                    break;
                case 'get-data':
                    await this.sendDataToWebview();
                    break;
                default:
                    // Unknown message type
                    break;
            }
        });
    }

    public async refresh() {
        await this.taskManager.refreshTasks();
        await this.sendDataToWebview();
    }

    private async sendDataToWebview() {
        if (!this._view) {
            return;
        }

        const isAuthenticated = this.authManager.isAuthenticated();
        const user = await this.authManager.getUser();
        const availableTasks = isAuthenticated ? await this.taskManager.getAvailableTasks() : [];
        const myAssignments = isAuthenticated ? await this.taskManager.getMyAssignments() : [];

        this._view.webview.postMessage({
            type: 'update',
            data: {
                isAuthenticated,
                user,
                availableTasks,
                myAssignments
            }
        });
    }

    private async handleClaimTask(taskId: number) {
        try {
            // Claim the task
            const assignment = await this.taskManager.claimTask(taskId);

            // Automatically start the assignment so the annotation form appears immediately
            await this.taskManager.startAssignment(assignment.id);

            vscode.window.showInformationMessage('Task claimed! You can now complete the annotation.');
            await this.refresh();
        } catch (error: any) {
            // Handle common errors with better messages
            if (error.response?.status === 400) {
                vscode.window.showErrorMessage('This task is no longer available. Please refresh and try another task.');
            } else if (error.response?.status === 403) {
                vscode.window.showErrorMessage('You do not have permission to claim this task.');
            } else {
                vscode.window.showErrorMessage(`Failed to claim task: ${error.message}`);
            }
            await this.refresh(); // Refresh to update the task list
        }
    }

    private async handleStartAssignment(assignmentId: number) {
        try {
            await this.taskManager.startAssignment(assignmentId);
            vscode.window.showInformationMessage('Started working on task!');
            await this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to start task: ${error.message}`);
        }
    }

    private async handleSubmitAssignment(assignmentId: number, result: any) {
        try {
            await this.taskManager.submitAssignment(assignmentId, result);
            vscode.window.showInformationMessage('Task submitted successfully! You will be paid once the researcher approves it.');
            await this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to submit task: ${error.message}`);
        }
    }

    private async handleCancelAssignment(assignmentId: number) {
        try {
            await this.taskManager.cancelAssignment(assignmentId);
            vscode.window.showInformationMessage('Assignment cancelled. Task is now available for others.');
            await this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to cancel assignment: ${error.message}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <title>Viberate Annotator</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        padding: 12px;
                        color: var(--vscode-foreground);
                        font-size: var(--vscode-font-size);
                        font-family: var(--vscode-font-family);
                        margin: 0;
                    }
                    .container {
                        margin-bottom: 16px;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 10px 16px;
                        cursor: pointer;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 500;
                        width: 100%;
                        margin-bottom: 8px;
                        transition: all 0.15s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                    }
                    button:hover:not(:disabled) {
                        background-color: var(--vscode-button-hoverBackground);
                        transform: translateY(-1px);
                    }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    button.secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    button.secondary:hover:not(:disabled) {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    .task-card {
                        border: 1px solid var(--vscode-panel-border);
                        padding: 14px;
                        margin-bottom: 12px;
                        border-radius: 8px;
                        background-color: var(--vscode-editor-background);
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        transition: all 0.2s ease;
                    }
                    .task-card:hover {
                        border-color: var(--vscode-focusBorder);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    }
                    .task-card h3 {
                        margin: 0 0 10px 0;
                        font-size: 14px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .task-card p {
                        margin: 6px 0;
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        line-height: 1.4;
                    }
                    .badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                        margin: 4px 0;
                    }
                    .badge.available { background-color: #2ea043; color: white; }
                    .badge.in_progress { background-color: #bf8700; color: white; }
                    .badge.submitted { background-color: #1f6feb; color: white; }
                    .badge.approved { background-color: #8250df; color: white; }
                    .empty-state {
                        text-align: center;
                        padding: 48px 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .empty-state-icon {
                        font-size: 48px;
                        margin-bottom: 12px;
                        opacity: 0.6;
                    }
                    .empty-state h3 {
                        font-size: 15px;
                        font-weight: 600;
                        margin: 0 0 6px 0;
                        color: var(--vscode-foreground);
                    }
                    .empty-state p {
                        font-size: 13px;
                        margin: 0;
                        color: var(--vscode-descriptionForeground);
                    }
                    .annotation-form {
                        margin-top: 14px;
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 12px;
                        border-radius: 6px;
                    }
                    .annotation-form textarea,
                    .annotation-form input,
                    .annotation-form select {
                        width: 100%;
                        margin-bottom: 10px;
                        padding: 8px 10px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        font-family: var(--vscode-font-family);
                        font-size: 13px;
                    }
                    .annotation-form textarea:focus,
                    .annotation-form input:focus,
                    .annotation-form select:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                        border-color: var(--vscode-focusBorder);
                    }
                    .balance {
                        background: linear-gradient(135deg, rgba(46, 160, 67, 0.15) 0%, rgba(46, 160, 67, 0.05) 100%);
                        border: 1px solid rgba(46, 160, 67, 0.3);
                        padding: 16px;
                        margin-bottom: 16px;
                        border-radius: 8px;
                        text-align: center;
                    }
                    .balance-label {
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 6px;
                    }
                    .balance-amount {
                        font-size: 28px;
                        font-weight: 700;
                        color: #2ea043;
                        letter-spacing: -0.5px;
                    }
                    .task-data {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        margin: 10px 0;
                        border-radius: 6px;
                        font-family: 'Consolas', 'Monaco', monospace;
                        font-size: 11px;
                        max-height: 200px;
                        overflow-y: auto;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .task-data::-webkit-scrollbar {
                        width: 8px;
                    }
                    .task-data::-webkit-scrollbar-thumb {
                        background-color: var(--vscode-scrollbarSlider-background);
                        border-radius: 4px;
                    }
                    h2 {
                        font-size: 15px;
                        font-weight: 600;
                        margin: 20px 0 12px 0;
                        color: var(--vscode-foreground);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    h2::before {
                        content: '';
                        width: 3px;
                        height: 16px;
                        background-color: var(--vscode-focusBorder);
                        border-radius: 2px;
                    }
                    .section-divider {
                        height: 1px;
                        background-color: var(--vscode-panel-border);
                        margin: 16px 0;
                    }
                </style>
            </head>
            <body>
                <div id="app">
                    <div class="empty-state">
                        <p>Loading...</p>
                    </div>
                </div>
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    let currentData = null;

                    // Wait for DOM to be ready
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initWebview);
                    } else {
                        initWebview();
                    }

                    function initWebview() {
                        // Request initial data
                        vscode.postMessage({ type: 'get-data' });
                    }

                    // Listen for messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            currentData = message.data;
                            renderUI();
                        }
                    });

                    // Escape HTML to prevent XSS
                    function escapeHtml(unsafe) {
                        if (typeof unsafe !== 'string') {
                            unsafe = String(unsafe);
                        }
                        return unsafe
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/"/g, "&quot;")
                            .replace(/'/g, "&#039;");
                    }

                    function renderUI() {
                        const app = document.getElementById('app');

                        if (!currentData) {
                            app.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
                            return;
                        }

                        if (!currentData.isAuthenticated) {
                            app.innerHTML = \`
                                <div class="container">
                                    <div class="empty-state">
                                        <div class="empty-state-icon">💰</div>
                                        <h3>Earn USDC While You Code</h3>
                                        <p style="margin: 8px 0 24px;">Complete annotation tasks and get paid in cryptocurrency while waiting for your prompts to run</p>
                                        <button id="login-btn">Login</button>
                                        <button id="register-btn" class="secondary">Create Account</button>
                                    </div>
                                </div>
                            \`;
                            // Attach event listeners
                            document.getElementById('login-btn').addEventListener('click', login);
                            document.getElementById('register-btn').addEventListener('click', register);
                            return;
                        }

                        const { user, availableTasks, myAssignments } = currentData;

                        let walletSection = '';
                        if (user.base_wallet_address) {
                            const shortAddress = user.base_wallet_address.substring(0, 6) + '...' + user.base_wallet_address.substring(38);
                            walletSection = \`
                                <div style="margin: 12px 0; padding: 8px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; font-size: 12px;">
                                    <div style="color: var(--vscode-descriptionForeground); margin-bottom: 4px;">Wallet Connected</div>
                                    <div style="font-family: monospace; color: #2ea043;">\${shortAddress}</div>
                                </div>
                            \`;
                        } else {
                            walletSection = \`
                                <div style="margin: 12px 0; padding: 12px; background-color: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); border-radius: 4px; font-size: 12px;">
                                    <div style="margin-bottom: 8px; color: var(--vscode-foreground);">⚠️ Connect your wallet to receive payouts</div>
                                    <button id="connect-wallet-btn" style="width: 100%; padding: 6px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer;">Connect Wallet</button>
                                </div>
                            \`;
                        }

                        let html = \`
                            <div class="container">
                                <div class="balance">
                                    <div class="balance-label">💰 YOUR EARNINGS</div>
                                    <div class="balance-amount">$\${parseFloat(user.usdc_balance || '0').toFixed(2)}</div>
                                    <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">USDC</div>
                                </div>
                                \${walletSection}
                                <button id="refresh-btn" class="secondary">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                                    </svg>
                                    Refresh Tasks
                                </button>
                                <button id="logout-btn" style="margin-top: 0; background-color: #DC2626; color: white;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                                    </svg>
                                    Logout
                                </button>
                            </div>
                        \`;

                        // My assignments section
                        if (myAssignments && myAssignments.length > 0) {
                            html += '<h2>My Assignments</h2>';
                            myAssignments.forEach(assignment => {
                                html += renderAssignmentCard(assignment);
                            });
                        }

                        // Available tasks section
                        html += '<h2>Available Tasks</h2>';
                        if (availableTasks && availableTasks.length > 0) {
                            availableTasks.forEach(task => {
                                html += renderTaskCard(task);
                            });
                        } else {
                            html += \`
                                <div class="empty-state">
                                    <div class="empty-state-icon">📋</div>
                                    <h3>No Tasks Available</h3>
                                    <p>Check back later for new annotation tasks!</p>
                                </div>
                            \`;
                        }

                        app.innerHTML = html;

                        // Attach event listeners using delegation
                        const refreshBtn = document.getElementById('refresh-btn');
                        if (refreshBtn) {
                            refreshBtn.addEventListener('click', refresh);
                        }

                        const logoutBtn = document.getElementById('logout-btn');
                        if (logoutBtn) {
                            logoutBtn.addEventListener('click', logout);
                        }

                        const connectWalletBtn = document.getElementById('connect-wallet-btn');
                        if (connectWalletBtn) {
                            connectWalletBtn.addEventListener('click', connectWallet);
                        }

                        // Event delegation for task and assignment actions
                        app.addEventListener('click', (e) => {
                            let target = e.target;
                            // Walk up the DOM tree to find the button with data-action
                            while (target && target !== app) {
                                if (target.dataset && target.dataset.action) {
                                    const action = target.dataset.action;
                                    if (action === 'claim-task') {
                                        claimTask(parseInt(target.dataset.taskId));
                                        return;
                                    } else if (action === 'start-assignment') {
                                        startAssignment(parseInt(target.dataset.assignmentId));
                                        return;
                                    } else if (action === 'submit-assignment') {
                                        submitAssignment(parseInt(target.dataset.assignmentId));
                                        return;
                                    } else if (action === 'submit-simple-annotation') {
                                        submitSimpleAnnotation(parseInt(target.dataset.assignmentId));
                                        return;
                                    } else if (action === 'cancel-assignment') {
                                        cancelAssignment(parseInt(target.dataset.assignmentId));
                                        return;
                                    } else if (action === 'validate-json') {
                                        validateJSON(parseInt(target.dataset.assignmentId));
                                        return;
                                    }
                                }
                                target = target.parentElement;
                            }
                        });
                    }

                    function renderTaskCard(task) {
                        const taskData = task.data || {};
                        const pricePerTask = task.price_per_task ? parseFloat(task.price_per_task).toFixed(2) : '0.00';
                        const projectTitle = task.project_title || 'Unknown Project';

                        // Extract and display media (images/videos)
                        let mediaHtml = '';
                        const imageUrl = taskData.image || taskData.img || taskData.url || taskData.image_url;
                        if (imageUrl) {
                            mediaHtml = \`
                                <div style="margin: 12px 0;">
                                    <img src="\${escapeHtml(imageUrl)}" style="max-width: 100%; border-radius: 4px; border: 1px solid var(--vscode-input-border);" alt="Task image" />
                                </div>
                            \`;
                        }

                        // Extract text content
                        let textContent = '';
                        const text = taskData.text || taskData.mt || taskData.source || taskData.content;
                        if (text) {
                            textContent = \`
                                <div style="margin: 12px 0; padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; border-left: 3px solid #2ea043;">
                                    <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 6px;">TEXT TO ANNOTATE:</div>
                                    <div style="font-size: 13px; line-height: 1.5;">\${escapeHtml(text)}</div>
                                </div>
                            \`;
                        }

                        return \`
                            <div class="task-card">
                                <h3>Task #\${task.id}</h3>
                                <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">
                                    Project: \${escapeHtml(projectTitle)}
                                </div>
                                <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                                    <span class="badge available">Available</span>
                                    <span style="font-size: 13px; font-weight: 600; color: #2ea043;">$\${pricePerTask} USDC</span>
                                </div>
                                \${mediaHtml}
                                \${textContent}
                                <button data-action="claim-task" data-task-id="\${task.id}">Claim Task</button>
                            </div>
                        \`;
                    }

                    function renderAssignmentCard(assignment) {
                        const task = assignment.task_data || assignment.task || {};
                        const status = assignment.status;
                        const taskData = task.data || {};

                        // Extract and display media (images/videos)
                        let mediaHtml = '';
                        const imageUrl = taskData.image || taskData.img || taskData.url || taskData.image_url;
                        if (imageUrl) {
                            mediaHtml = \`
                                <div style="margin: 12px 0;">
                                    <img src="\${escapeHtml(imageUrl)}" style="max-width: 100%; border-radius: 4px; border: 1px solid var(--vscode-input-border);" alt="Task image" />
                                </div>
                            \`;
                        }

                        let actionButton = '';
                        let annotationForm = '';
                        let cancelButton = '';

                        // Show cancel button for assignments that can be cancelled
                        if (['assigned', 'accepted', 'in_progress'].includes(status)) {
                            cancelButton = \`<button data-action="cancel-assignment" data-assignment-id="\${assignment.id}" class="secondary" style="margin-top: 8px;">Cancel Assignment</button>\`;
                        }

                        if (status === 'assigned' || status === 'accepted') {
                            actionButton = \`<button data-action="start-assignment" data-assignment-id="\${assignment.id}">Start Task</button>\`;
                        } else if (status === 'in_progress') {
                            annotationForm = renderAnnotationForm(assignment);
                        } else if (status === 'submitted') {
                            actionButton = '<p style="color: #bf8700;">⏳ Waiting for researcher approval...</p>';
                        } else if (status === 'approved') {
                            const paymentAmount = escapeHtml(assignment.payment_amount);
                            actionButton = \`<p style="color: #2ea043;">✓ Approved! Payment: $\${paymentAmount} USDC</p>\`;
                        }

                        const projectTitle = task.project_title || 'Unknown Project';
                        const pricePerTask = task.price_per_task ? parseFloat(task.price_per_task).toFixed(2) : '0.00';

                        return \`
                            <div class="task-card">
                                <h3>Assignment #\${assignment.id}</h3>
                                <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">
                                    Project: \${escapeHtml(projectTitle)}
                                </div>
                                <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                                    <span class="badge \${status}">\${escapeHtml(status)}</span>
                                    <span style="font-size: 13px; font-weight: 600; color: #2ea043;">$\${pricePerTask} USDC</span>
                                </div>
                                \${mediaHtml}
                                \${annotationForm}
                                \${actionButton}
                                \${cancelButton}
                            </div>
                        \`;
                    }

                    function renderAnnotationForm(assignment) {
                        const task = assignment.task_data || assignment.task || {};
                        const taskData = task.data || {};

                        // Get task text if available (common in translation/text annotation tasks)
                        const taskText = taskData.text || taskData.mt || taskData.source || '';

                        return \`
                            <div class="annotation-form">
                                <h4 style="margin-bottom: 12px;">Complete Annotation</h4>

                                \${taskText ? \`
                                    <div style="margin-bottom: 16px; padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; border-left: 3px solid #2ea043;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 6px;">TASK TEXT:</div>
                                        <div style="font-size: 13px; line-height: 1.5;">\${escapeHtml(taskText)}</div>
                                    </div>
                                \` : ''}

                                <div style="background-color: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 12px;">Label/Classification:</label>
                                    <input
                                        type="text"
                                        id="label-\${assignment.id}"
                                        placeholder="e.g., positive, negative, correct, incorrect"
                                        style="width: 100%; padding: 8px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; font-size: 13px;"
                                    />

                                    <label style="display: block; margin: 12px 0 8px 0; font-weight: 600; font-size: 12px;">Notes/Comments (optional):</label>
                                    <textarea
                                        id="notes-\${assignment.id}"
                                        rows="3"
                                        placeholder="Add any notes or observations about this annotation..."
                                        style="width: 100%; padding: 8px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; font-size: 13px; resize: vertical;"
                                    ></textarea>
                                </div>

                                <details style="margin-bottom: 12px;">
                                    <summary style="cursor: pointer; padding: 8px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; font-size: 12px;">
                                        Advanced: Custom JSON (optional)
                                    </summary>
                                    <div style="margin-top: 8px;">
                                        <p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                                            If you need to provide a custom JSON structure, enter it below. This will override the simple form above.
                                        </p>
                                        <textarea
                                            id="custom-json-\${assignment.id}"
                                            rows="6"
                                            placeholder='{"label": "your_label", "custom_field": "value"}'
                                            style="width: 100%; padding: 8px; font-family: 'Courier New', monospace; font-size: 11px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px;"
                                        ></textarea>
                                    </div>
                                </details>

                                <button data-action="submit-simple-annotation" data-assignment-id="\${assignment.id}" style="width: 100%;">
                                    Submit Annotation
                                </button>
                            </div>
                        \`;
                    }

                    function login() {
                        try {
                            vscode.postMessage({ type: 'login' });
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }

                    function register() {
                        try {
                            vscode.postMessage({ type: 'register' });
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }

                    function refresh() {
                        vscode.postMessage({ type: 'refresh' });
                    }

                    function logout() {
                        vscode.postMessage({ type: 'logout' });
                    }

                    function connectWallet() {
                        vscode.postMessage({ type: 'connect-wallet' });
                    }

                    function validateJSON(assignmentId) {
                        const textarea = document.getElementById('result-' + assignmentId);
                        if (!textarea) {
                            alert('Could not find annotation textarea');
                            return;
                        }

                        try {
                            const result = JSON.parse(textarea.value);
                            alert('✓ Valid JSON!\\n\\nParsed:\\n' + JSON.stringify(result, null, 2));
                        } catch (error) {
                            alert('✗ Invalid JSON!\\n\\nError: ' + error.message + '\\n\\nPlease fix the JSON format before submitting.');
                        }
                    }

                    let isClaimingTask = false;

                    function claimTask(taskId) {
                        // Prevent duplicate claims
                        if (isClaimingTask) {
                            return;
                        }

                        isClaimingTask = true;

                        // Find and disable the claim button
                        const claimBtn = document.querySelector(\`[data-action="claim-task"][data-task-id="\${taskId}"]\`);
                        if (claimBtn) {
                            claimBtn.disabled = true;
                            claimBtn.textContent = 'Claiming...';
                        }

                        vscode.postMessage({ type: 'claim-task', taskId });

                        // Reset after a timeout (in case the response is slow)
                        setTimeout(() => {
                            isClaimingTask = false;
                        }, 3000);
                    }

                    function startAssignment(assignmentId) {
                        vscode.postMessage({ type: 'start-assignment', assignmentId });
                    }

                    function cancelAssignment(assignmentId) {
                        if (confirm('Are you sure you want to cancel this assignment? The task will become available for others.')) {
                            vscode.postMessage({ type: 'cancel-assignment', assignmentId });
                        }
                    }

                    function submitSimpleAnnotation(assignmentId) {
                        // Check if custom JSON is provided
                        const customJsonTextarea = document.getElementById('custom-json-' + assignmentId);
                        const customJson = customJsonTextarea ? customJsonTextarea.value.trim() : '';

                        let result;

                        if (customJson) {
                            // Use custom JSON if provided
                            try {
                                result = JSON.parse(customJson);
                            } catch (error) {
                                alert('Invalid custom JSON format. Please check your JSON or leave it empty to use the simple form.');
                                return;
                            }
                        } else {
                            // Build JSON from simple form fields
                            const labelInput = document.getElementById('label-' + assignmentId);
                            const notesTextarea = document.getElementById('notes-' + assignmentId);

                            const label = labelInput ? labelInput.value.trim() : '';
                            const notes = notesTextarea ? notesTextarea.value.trim() : '';

                            if (!label) {
                                alert('Please enter a label/classification for this annotation.');
                                return;
                            }

                            // Construct annotation result
                            result = {
                                label: label,
                                notes: notes || undefined,
                                timestamp: new Date().toISOString()
                            };

                            // Remove undefined fields
                            result = JSON.parse(JSON.stringify(result));
                        }

                        // Submit the annotation
                        vscode.postMessage({
                            type: 'submit-assignment',
                            assignmentId,
                            result
                        });
                    }

                    function submitAssignment(assignmentId) {
                        const textarea = document.getElementById('result-' + assignmentId);
                        if (!textarea) {
                            alert('Could not find annotation textarea');
                            return;
                        }
                        try {
                            const result = JSON.parse(textarea.value);
                            vscode.postMessage({
                                type: 'submit-assignment',
                                assignmentId,
                                result
                            });
                        } catch (error) {
                            alert('Invalid JSON format. Please check your annotation result.');
                        }
                    }
                </script>
            </body>
            </html>`;
    }
}
