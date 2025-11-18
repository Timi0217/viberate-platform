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
                case 'claim-task-from-project':
                    await this.handleClaimTaskFromProject(data.projectId);
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
            console.error('[TaskPanel] No view available');
            return;
        }

        try {
            console.log('[TaskPanel] Starting sendDataToWebview');
            const isAuthenticated = this.authManager.isAuthenticated();
            console.log('[TaskPanel] isAuthenticated:', isAuthenticated);

            const user = await this.authManager.getUser();
            console.log('[TaskPanel] User fetched:', user);

            const availableProjects = isAuthenticated ? await this.taskManager.getAvailableProjects() : [];
            console.log('[TaskPanel] Projects fetched:', availableProjects.length);

            const myAssignments = isAuthenticated ? await this.taskManager.getMyAssignments() : [];
            console.log('[TaskPanel] Assignments fetched:', myAssignments.length);

            console.log('[TaskPanel] Sending data to webview:', {
                isAuthenticated,
                availableProjectsCount: availableProjects.length,
                myAssignmentsCount: myAssignments.length,
                myAssignments,
                availableProjects
            });

            this._view.webview.postMessage({
                type: 'update',
                data: {
                    isAuthenticated,
                    user,
                    availableProjects,
                    myAssignments
                }
            });
            console.log('[TaskPanel] Message posted successfully');
        } catch (error) {
            console.error('[TaskPanel] Error in sendDataToWebview:', error);
            // Still try to send something to unblock the webview
            this._view.webview.postMessage({
                type: 'update',
                data: {
                    isAuthenticated: false,
                    user: null,
                    availableProjects: [],
                    myAssignments: []
                }
            });
        }
    }

    private async handleClaimTask(taskId: number) {
        try {
            // Claim the task (backend automatically starts it)
            console.log('Claiming task:', taskId);
            const assignment = await this.taskManager.claimTask(taskId);
            console.log('Claim response:', assignment);

            if (!assignment || !assignment.id) {
                throw new Error('Assignment was not created properly');
            }

            // Wait a bit for backend to fully process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Force refresh to show the assignment with annotation form
            console.log('Refreshing tasks after claim...');
            await this.refresh();

            vscode.window.showInformationMessage('✅ Task claimed! Look for the green "My Assignments" section above. You can cancel anytime.');
        } catch (error: any) {
            console.error('Claim error:', error);
            // Handle common errors with better messages
            if (error.response?.status === 400) {
                vscode.window.showErrorMessage('This task is no longer available. Please refresh and try another task.');
            } else if (error.response?.status === 403) {
                vscode.window.showErrorMessage('You do not have permission to claim this task.');
            } else if (error.response?.status === 404) {
                vscode.window.showErrorMessage('Task not found. It may have been claimed by another user.');
            } else {
                vscode.window.showErrorMessage(`Failed to claim task: ${error.message}`);
            }
            await this.refresh(); // Refresh to update the task list
        }
    }

    private async handleClaimTaskFromProject(projectId: number) {
        try {
            // Claim a task from this project (backend will find an available one)
            console.log('Claiming task from project:', projectId);
            const assignment = await this.taskManager.claimTaskFromProject(projectId);
            console.log('Claim response:', assignment);

            if (!assignment || !assignment.id) {
                throw new Error('Assignment was not created properly');
            }

            // Wait a bit for backend to fully process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Force refresh to show the assignment with annotation form
            console.log('Refreshing tasks after claim...');
            await this.refresh();

            vscode.window.showInformationMessage('✅ Task claimed! Look for the green "My Assignments" section above. You can cancel anytime.');
        } catch (error: any) {
            console.error('Claim error:', error);
            // Handle common errors with better messages
            if (error.response?.status === 400) {
                vscode.window.showErrorMessage('No tasks are available in this project. Please try another project.');
            } else if (error.response?.status === 403) {
                vscode.window.showErrorMessage('You do not have permission to claim tasks from this project.');
            } else if (error.response?.status === 404) {
                vscode.window.showErrorMessage('Project not found or has no available tasks.');
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
            console.log('[handleSubmitAssignment] Submitting assignment:', assignmentId, 'with result:', result);
            await this.taskManager.submitAssignment(assignmentId, result);
            vscode.window.showInformationMessage('Task submitted successfully! You will be paid once the researcher approves it.');
            await this.refresh();
        } catch (error: any) {
            console.error('[handleSubmitAssignment] Error:', error);
            console.error('[handleSubmitAssignment] Error response:', error.response?.data);

            // Provide specific error messages based on status code
            if (error.response?.status === 400) {
                const errorDetail = error.response.data?.annotation_result?.[0] || error.response.data?.detail || 'Invalid annotation format';
                vscode.window.showErrorMessage(`Submission failed: ${errorDetail}`);
            } else if (error.response?.status === 403) {
                vscode.window.showErrorMessage('You do not have permission to submit this assignment.');
            } else if (error.response?.status === 404) {
                vscode.window.showErrorMessage('Assignment not found. It may have been cancelled.');
            } else {
                vscode.window.showErrorMessage(`Failed to submit task: ${error.message}`);
            }

            // Refresh to update UI
            await this.refresh();
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
                        min-width: 520px;
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
                        padding: 0;
                        margin-bottom: 10px;
                        border-radius: 8px;
                        background-color: var(--vscode-editor-background);
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                        transition: all 0.2s ease;
                        overflow: hidden;
                    }
                    .task-card:hover {
                        border-color: var(--vscode-focusBorder);
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
                    }
                    .task-card.expanded .task-details {
                        max-height: 2000px !important;
                    }
                    .task-card.expanded svg {
                        transform: rotate(180deg);
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
                        justify-content: center;
                        gap: 4px;
                        padding: 6px 12px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                        line-height: 1;
                        min-width: 110px;
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
                    /* Modern choice option styling */
                    .choice-option {
                        position: relative;
                        overflow: hidden;
                    }
                    .choice-option:hover {
                        border-color: var(--vscode-focusBorder) !important;
                        background-color: var(--vscode-list-hoverBackground) !important;
                        transform: translateY(-1px);
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
                    }
                    .choice-option:active {
                        transform: translateY(0);
                    }
                    .choice-option:has(input:checked) {
                        border-color: var(--vscode-focusBorder) !important;
                        background-color: var(--vscode-list-activeSelectionBackground) !important;
                        font-weight: 600;
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
                    .assignment-collapsible .assignment-details {
                        max-height: 0;
                        overflow: hidden;
                        padding: 0 !important;
                        transition: max-height 0.3s ease-out, padding 0.3s ease-out;
                    }
                    .assignment-collapsible.expanded .assignment-details {
                        max-height: 5000px;
                        padding: 0 16px 16px 16px !important;
                    }
                    .assignment-collapsible.expanded .chevron {
                        transform: rotate(0deg);
                        transition: transform 0.2s ease;
                    }
                    .assignment-collapsible:not(.expanded) .chevron {
                        transform: rotate(-90deg);
                        transition: transform 0.2s ease;
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
                        console.log('Webview received message:', message);
                        if (message.type === 'update') {
                            currentData = message.data;
                            console.log('Updated currentData:', {
                                myAssignmentsCount: currentData.myAssignments?.length,
                                myAssignments: currentData.myAssignments
                            });
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

                        const { user, availableProjects, myAssignments } = currentData;

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
                        console.log('Rendering UI - myAssignments:', myAssignments);
                        if (myAssignments && myAssignments.length > 0) {
                            console.log('Rendering MY ASSIGNMENTS section with', myAssignments.length, 'assignments');
                            html += \`
                                <div id="my-assignments-section" style="background: linear-gradient(135deg, rgba(46, 160, 67, 0.1) 0%, rgba(46, 160, 67, 0.05) 100%); border: 2px solid #2ea043; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                                    <h2 style="margin: 0 0 12px 0;">My Tasks</h2>
                                    <div id="my-tasks-scrollable" style="max-height: 150px; overflow-y: auto; overflow-x: hidden; transition: max-height 0.3s ease-out;">
                            \`;
                            myAssignments.forEach(assignment => {
                                console.log('Rendering assignment:', assignment);
                                html += renderAssignmentCard(assignment);
                            });
                            html += '</div></div>'; // Close both the scrollable div and my-assignments-section
                        } else {
                            console.log('NO ASSIGNMENTS TO RENDER - myAssignments:', myAssignments);
                        }

                        // Available projects section
                        html += '<div class="section-divider"></div>';
                        html += '<h2>Available Tasks</h2>';
                        html += '<div style="max-height: 400px; overflow-y: auto; overflow-x: hidden;">';
                        if (availableProjects && availableProjects.length > 0) {
                            console.log('Available projects received:', availableProjects.length, availableProjects);

                            // Render project cards directly
                            availableProjects.forEach(project => {
                                html += renderProjectCard(project);
                            });
                        } else {
                            html += \`
                                <div class="empty-state">
                                    <div class="empty-state-icon">📋</div>
                                    <h3>No Projects Available</h3>
                                    <p>Check back later for new annotation projects!</p>
                                </div>
                            \`;
                        }
                        html += '</div>';

                        app.innerHTML = html;

                        // Auto-scroll to My Assignments section if it exists
                        const myAssignmentsSection = document.getElementById('my-assignments-section');
                        if (myAssignmentsSection) {
                            console.log('Scrolling to My Assignments section');
                            myAssignmentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }

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
                            console.log('[Event] Click detected on:', target);

                            // Handle star rating clicks
                            if (target.classList && target.classList.contains('star')) {
                                const radioInput = target.previousElementSibling;
                                if (radioInput && radioInput.type === 'radio') {
                                    radioInput.checked = true;
                                    // Update all stars in this rating group to show selection
                                    const ratingContainer = target.closest('div[style*="display: flex"]');
                                    if (ratingContainer) {
                                        const allStars = ratingContainer.querySelectorAll('.star');
                                        const selectedValue = parseInt(target.dataset.value);
                                        allStars.forEach(star => {
                                            const starValue = parseInt(star.dataset.value);
                                            if (starValue <= selectedValue) {
                                                star.style.color = '#ffd700';  // gold
                                            } else {
                                                star.style.color = '#ccc';  // gray
                                            }
                                        });
                                    }
                                }
                                return;
                            }

                            // Walk up the DOM tree to find the button with data-action
                            // Handle SVG elements specially (they might not have dataset)
                            while (target && target !== app) {
                                // For SVG elements, check the parent
                                const tagName = target.tagName ? target.tagName.toLowerCase() : '';
                                const elementToCheck = (tagName === 'svg' || tagName === 'path') ? target.parentElement : target;

                                if (elementToCheck && elementToCheck.dataset && elementToCheck.dataset.action) {
                                    const action = elementToCheck.dataset.action;
                                    console.log('[Event] Action clicked:', action, 'Target:', elementToCheck);
                                    if (action === 'claim-task') {
                                        claimTask(parseInt(elementToCheck.dataset.taskId));
                                        return;
                                    } else if (action === 'claim-task-from-project') {
                                        claimTaskFromProject(parseInt(elementToCheck.dataset.projectId));
                                        return;
                                    } else if (action === 'start-assignment') {
                                        startAssignment(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'submit-assignment') {
                                        submitAssignment(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'submit-mt-evaluation') {
                                        submitMTEvaluation(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'submit-generic-annotation') {
                                        submitGenericAnnotation(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'submit-dynamic') {
                                        submitDynamic(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'submit-classification') {
                                        submitClassification(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'cancel-assignment') {
                                        cancelAssignment(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'validate-json') {
                                        validateJSON(parseInt(elementToCheck.dataset.assignmentId));
                                        return;
                                    } else if (action === 'toggle-task') {
                                        // Find the task card (parent element)
                                        const taskCard = elementToCheck.closest('.task-card');
                                        if (taskCard) {
                                            taskCard.classList.toggle('expanded');
                                        }
                                        return;
                                    } else if (action === 'toggle-assignment') {
                                        console.log('[Event] Toggling assignment');
                                        // Find the assignment card (parent element)
                                        const assignmentCard = elementToCheck.closest('.assignment-collapsible');
                                        console.log('[Event] Found assignment card:', assignmentCard);
                                        if (assignmentCard) {
                                            console.log('[Event] Current classes:', assignmentCard.className);
                                            assignmentCard.classList.toggle('expanded');
                                            console.log('[Event] New classes:', assignmentCard.className);

                                            // Adjust My Tasks container height based on expanded state
                                            const scrollableContainer = document.getElementById('my-tasks-scrollable');
                                            if (scrollableContainer) {
                                                const hasExpandedTasks = document.querySelector('.assignment-collapsible.expanded') !== null;
                                                // If any task is expanded, increase max-height; otherwise restore default
                                                scrollableContainer.style.maxHeight = hasExpandedTasks ? '800px' : '150px';
                                            }
                                        }
                                        return;
                                    }
                                }
                                target = target.parentElement;
                            }
                        });
                    }

                    function renderProjectCard(project) {
                        const pricePerTask = parseFloat(project.price_per_task).toFixed(2);
                        const taskCount = project.available_tasks_count || 0;

                        return \`
                            <div class="task-card" style="overflow: visible;">
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                                    <button data-action="claim-task-from-project" data-project-id="\${project.id}" style="flex: 0 0 auto; width: 200px; margin: 0; padding: 10px 16px; height: auto; min-height: 40px; display: flex; align-items: center; justify-content: center;">Claim Task</button>
                                    <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; margin-left: auto; padding-left: 12px; gap: 2px;">
                                        <div style="font-size: 16px; font-weight: 600; color: #2ea043; white-space: nowrap; line-height: 1;">$\${pricePerTask}</div>
                                        <div style="font-size: 11px; font-weight: 500; color: var(--vscode-descriptionForeground); white-space: nowrap; line-height: 1;">x \${taskCount}</div>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }

                    function renderTaskCard(task) {
                        const taskData = task.data || {};
                        const pricePerTask = task.price_per_task ? parseFloat(task.price_per_task).toFixed(2) : '0.00';
                        const projectTitle = task.project_title || 'Unknown Project';

                        // Don't display media at the top - it will be shown in the form
                        // This prevents duplicate image display
                        let mediaHtml = '';

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
                            <div class="task-card" style="overflow: hidden;">
                                <div
                                    class="task-header"
                                    data-action="toggle-task"
                                    data-task-id="\${task.id}"
                                    style="display: flex; gap: 8px; align-items: center; cursor: pointer; padding: 8px 0; user-select: none;"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style="transition: transform 0.2s; flex-shrink: 0;">
                                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <span style="font-size: 14px; font-weight: 600; color: #2ea043;">$\${pricePerTask} USDC</span>
                                </div>
                                <div class="task-details" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
                                    <div style="padding-top: 8px;">
                                        \${mediaHtml}
                                        \${textContent}
                                        <button data-action="claim-task" data-task-id="\${task.id}" style="margin-top: 12px;">Claim Task</button>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }

                    function renderAssignmentCard(assignment) {
                        const task = assignment.task_data || assignment.task || {};
                        const status = assignment.status;
                        const taskData = task.data || {};

                        // Don't display media at the top - it will be shown in the form
                        // This prevents duplicate image display
                        let mediaHtml = '';

                        let actionButton = '';
                        let annotationForm = '';
                        let cancelButton = '';

                        // Show cancel button for assignments that can be cancelled
                        if (['assigned', 'accepted', 'in_progress'].includes(status)) {
                            cancelButton = \`<button data-action="cancel-assignment" data-assignment-id="\${assignment.id}" class="secondary" style="margin-top: 8px;">Cancel Assignment</button>\`;
                        }

                        const isInProgress = status === 'assigned' || status === 'accepted' || status === 'in_progress';

                        if (isInProgress) {
                            // All newly claimed tasks are automatically started (in_progress status)
                            annotationForm = renderAnnotationForm(assignment);
                        } else if (status === 'submitted') {
                            // No text - just icon and badge for uniformity
                            actionButton = '';
                        } else if (status === 'approved') {
                            // No message needed for approved - badge says it all
                            actionButton = '';
                        } else if (status === 'rejected') {
                            const feedback = assignment.feedback || 'No feedback provided';
                            actionButton = \`<p style="margin: 0; font-size: 12px; color: #d73a49; line-height: 1.4;">❌ Rejected: \${escapeHtml(feedback)}</p>\`;
                        }

                        const projectTitle = task.project_title || 'Unknown Project';
                        const pricePerTask = task.price_per_task ? parseFloat(task.price_per_task).toFixed(2) : '0.00';

                        // For in_progress assignments, make them collapsible (default collapsed)
                        if (isInProgress) {
                            return \`
                                <div class="task-card assignment-collapsible" data-assignment-id="\${assignment.id}">
                                    <div
                                        data-action="toggle-assignment"
                                        data-assignment-id="\${assignment.id}"
                                        style="cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px;"
                                    >
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" class="chevron" style="flex-shrink: 0;">
                                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                            <span class="badge \${status}" style="margin: 0;">\${escapeHtml(status)}</span>
                                        </div>
                                        <span style="font-size: 16px; font-weight: 600; color: #2ea043; line-height: 1;">$\${pricePerTask}</span>
                                    </div>
                                    <div class="assignment-details">
                                        \${mediaHtml}
                                        \${annotationForm}
                                        \${cancelButton}
                                    </div>
                                </div>
                            \`;
                        }

                        // For other statuses, render minimal compact format
                        // Add icon for each status to maintain alignment
                        let statusIcon;
                        if (status === 'approved') {
                            statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; color: #2ea043;"><path d="M20 6L9 17l-5-5"/></svg>';
                        } else if (status === 'submitted') {
                            statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; color: #bf8700;"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
                        } else {
                            statusIcon = '<div style="width: 14px; flex-shrink: 0;"></div>';
                        }

                        return \`
                            <div class="task-card">
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        \${statusIcon}
                                        <span class="badge \${status}" style="margin: 0;">\${escapeHtml(status)}</span>
                                    </div>
                                    <span style="font-size: 16px; font-weight: 600; color: #2ea043; line-height: 1;">$\${pricePerTask}</span>
                                </div>
                                \${actionButton ? \`<div style="padding: 0 16px 12px 16px;">\${actionButton}</div>\` : ''}
                                \${mediaHtml}
                                \${cancelButton ? \`<div style="padding: 0 16px 12px 16px;">\${cancelButton}</div>\` : ''}
                            </div>
                        \`;
                    }

                    function renderAnnotationForm(assignment) {
                        try {
                            console.log('[renderAnnotationForm] Starting with assignment:', assignment);

                            const task = assignment.task_data || assignment.task || {};
                            console.log('[renderAnnotationForm] Task:', task);

                            const taskData = task.data || {};
                            const labelConfig = task.label_config || null;

                            console.log('[renderAnnotationForm] Task data:', taskData);
                            console.log('[renderAnnotationForm] Label config:', labelConfig);

                            // Detect form type and use appropriate renderer
                            const controls = parseLabelConfig(labelConfig);
                            console.log('[renderAnnotationForm] Controls:', controls);

                            // ALWAYS use dynamic form - it can handle all task types
                            console.log('[renderAnnotationForm] Using universal dynamic form');

                            // If no label_config at all, show a generic annotation form
                            if (!labelConfig || (controls.choices.length === 0 && controls.textAreas.length === 0 && controls.ratings.length === 0 && controls.labels.length === 0)) {
                                console.warn('[renderAnnotationForm] No label config or controls, using generic form');
                                return renderGenericAnnotationForm(assignment, task, taskData);
                            }

                            return renderDynamicForm(assignment, task, taskData, labelConfig, controls);
                        } catch (error) {
                            console.error('[renderAnnotationForm] Error:', error);
                            // Return a simple error form
                            return \`
                                <div class="annotation-form">
                                    <p style="color: #d73a49;">Error loading annotation form. Please try refreshing.</p>
                                    <button data-action="cancel-assignment" data-assignment-id="\${assignment.id}">
                                        Cancel Assignment
                                    </button>
                                </div>
                            \`;
                        }
                    }

                    function parseLabelConfig(labelConfig) {
                        try {
                            // Handle null/undefined
                            if (!labelConfig) {
                                console.warn('[parseLabelConfig] No label config provided');
                                return {
                                    choices: [],
                                    textAreas: [],
                                    ratings: [],
                                    labels: [],
                                    header: null,
                                    hasImage: false,
                                    hasText: false,
                                    hasSourceMT: false
                                };
                            }

                            console.log('[parseLabelConfig] Raw labelConfig type:', typeof labelConfig);
                            console.log('[parseLabelConfig] Raw labelConfig:', labelConfig);

                            // Parse Label Studio XML config to extract controls
                            // Label Studio API returns label_config as an XML string
                            // But Django's JSONField might serialize it differently
                            let configStr;
                            try {
                                if (typeof labelConfig === 'string') {
                                    // Already a string - use directly
                                    configStr = labelConfig;
                                } else if (typeof labelConfig === 'object') {
                                    // If it's an object, it might have the XML as a property
                                    // Or it might be a parsed JSON that we need to stringify
                                    if (labelConfig.xml || labelConfig.config || labelConfig.value) {
                                        configStr = labelConfig.xml || labelConfig.config || labelConfig.value;
                                    } else {
                                        // Just stringify the whole object
                                        configStr = JSON.stringify(labelConfig);
                                    }
                                } else {
                                    configStr = String(labelConfig);
                                }

                                console.log('[parseLabelConfig] Converted to string, length:', configStr.length);
                                console.log('[parseLabelConfig] Config string preview:', configStr.substring(0, 500));
                            } catch (e) {
                                console.error('[parseLabelConfig] Failed to convert label config to string:', e);
                                configStr = '';
                            }

                            const controls = {
                                choices: [],
                                textAreas: [],
                                ratings: [],
                                labels: [],
                                header: null,  // Will store Header value
                                hasImage: configStr.indexOf('<Image') !== -1,
                                // Check for <Text (with space or >) to avoid matching <TextArea>
                                hasText: (configStr.indexOf('<Text ') !== -1 || configStr.indexOf('<Text>') !== -1) && configStr.indexOf('name="source"') === -1 && configStr.indexOf('name="mt"') === -1,
                                hasSourceMT: configStr.indexOf('name="source"') !== -1 && configStr.indexOf('name="mt"') !== -1
                            };

                            // Extract Header value
                            try {
                                const headerMatch = configStr.match(/<Header[^>]*value="([^"]+)"/);
                                if (headerMatch && headerMatch[1]) {
                                    controls.header = headerMatch[1];
                                }
                            } catch (e) {
                                console.warn('[parseLabelConfig] Failed to parse Header:', e);
                            }

                            // Extract Choices elements
                            try {
                                let searchPos = 0;
                                while (true) {
                                    const choicesStart = configStr.indexOf('<Choices', searchPos);
                                    if (choicesStart === -1) break;

                                    const choicesEnd = configStr.indexOf('</Choices>', choicesStart);
                                    if (choicesEnd === -1) {
                                        // Self-closing or no choices inside
                                        searchPos = choicesStart + 8;
                                        continue;
                                    }

                                    const choicesTag = configStr.substring(choicesStart, choicesEnd + 10);

                                    // Extract attributes
                                    const nameMatch = choicesTag.match(/name="([^"]*)"/);
                                    const choiceMatch = choicesTag.match(/choice="([^"]*)"/);

                                    const name = nameMatch ? nameMatch[1] : 'choice';
                                    const choiceType = choiceMatch ? choiceMatch[1] : 'single';

                                    // Extract Choice options
                                    const options = [];
                                    let optionPos = 0;
                                    while (true) {
                                        const choiceStart = choicesTag.indexOf('<Choice', optionPos);
                                        if (choiceStart === -1) break;

                                        const choiceEnd = choicesTag.indexOf('/>', choiceStart);
                                        if (choiceEnd === -1) break;

                                        const choiceTagStr = choicesTag.substring(choiceStart, choiceEnd + 2);
                                        const valueMatch = choiceTagStr.match(/value="([^"]*)"/);

                                        if (valueMatch) {
                                            options.push(valueMatch[1]);
                                        }

                                        optionPos = choiceEnd + 2;
                                    }

                                    if (options.length > 0) {
                                        controls.choices.push({
                                            name: name,
                                            options: options,
                                            multiple: choiceType === 'multiple'
                                        });
                                    }

                                    searchPos = choicesEnd + 10;
                                }
                            } catch (e) {
                                console.error('[parseLabelConfig] Error parsing choices:', e);
                            }

                            // Extract TextArea elements
                            try {
                                let searchPos = 0;
                                while (true) {
                                    const textAreaStart = configStr.indexOf('<TextArea', searchPos);
                                    if (textAreaStart === -1) break;

                                    const textAreaEnd = configStr.indexOf('/>', textAreaStart);
                                    if (textAreaEnd === -1) {
                                        searchPos = textAreaStart + 9;
                                        continue;
                                    }

                                    const textAreaTag = configStr.substring(textAreaStart, textAreaEnd + 2);

                                    const nameMatch = textAreaTag.match(/name="([^"]*)"/);
                                    const placeholderMatch = textAreaTag.match(/placeholder="([^"]*)"/);
                                    const requiredMatch = textAreaTag.match(/required="([^"]*)"/);

                                    controls.textAreas.push({
                                        name: nameMatch ? nameMatch[1] : 'textarea',
                                        placeholder: placeholderMatch ? placeholderMatch[1] : 'Enter text...',
                                        required: requiredMatch ? requiredMatch[1] === 'true' : false
                                    });

                                    searchPos = textAreaEnd + 2;
                                }
                            } catch (e) {
                                console.error('[parseLabelConfig] Error parsing text areas:', e);
                            }

                            // Extract Rating elements
                            try {
                                let searchPos = 0;
                                while (true) {
                                    const ratingStart = configStr.indexOf('<Rating', searchPos);
                                    if (ratingStart === -1) break;

                                    const ratingEnd = configStr.indexOf('/>', ratingStart);
                                    if (ratingEnd === -1) {
                                        searchPos = ratingStart + 7;
                                        continue;
                                    }

                                    const ratingTag = configStr.substring(ratingStart, ratingEnd + 2);

                                    const nameMatch = ratingTag.match(/name="([^"]*)"/);
                                    const maxRatingMatch = ratingTag.match(/maxRating="([^"]*)"/);
                                    const requiredMatch = ratingTag.match(/required="([^"]*)"/);

                                    controls.ratings.push({
                                        name: nameMatch ? nameMatch[1] : 'rating',
                                        maxRating: maxRatingMatch ? parseInt(maxRatingMatch[1]) : 5,
                                        required: requiredMatch ? requiredMatch[1] === 'true' : false
                                    });

                                    searchPos = ratingEnd + 2;
                                }
                            } catch (e) {
                                console.error('[parseLabelConfig] Error parsing ratings:', e);
                            }

                            // Extract Labels elements (for error marking, etc.)
                            try {
                                let searchPos = 0;
                                while (true) {
                                    const labelsStart = configStr.indexOf('<Labels', searchPos);
                                    if (labelsStart === -1) break;

                                    const labelsEnd = configStr.indexOf('</Labels>', labelsStart);
                                    if (labelsEnd === -1) {
                                        searchPos = labelsStart + 7;
                                        continue;
                                    }

                                    const labelsTag = configStr.substring(labelsStart, labelsEnd + 9);

                                    const nameMatch = labelsTag.match(/name="([^"]*)"/);
                                    const name = nameMatch ? nameMatch[1] : 'labels';

                                    // Extract Label options
                                    const options = [];
                                    let optionPos = 0;
                                    while (true) {
                                        const labelStart = labelsTag.indexOf('<Label', optionPos);
                                        if (labelStart === -1) break;

                                        const labelEnd = labelsTag.indexOf('/>', labelStart);
                                        if (labelEnd === -1) break;

                                        const labelTagStr = labelsTag.substring(labelStart, labelEnd + 2);
                                        const valueMatch = labelTagStr.match(/value="([^"]*)"/);

                                        if (valueMatch) {
                                            options.push(valueMatch[1]);
                                        }

                                        optionPos = labelEnd + 2;
                                    }

                                    if (options.length > 0) {
                                        controls.labels.push({
                                            name: name,
                                            options: options
                                        });
                                    }

                                    searchPos = labelsEnd + 9;
                                }
                            } catch (e) {
                                console.error('[parseLabelConfig] Error parsing labels:', e);
                            }

                            console.log('[parseLabelConfig] Parsed controls:', controls);
                            return controls;
                        } catch (error) {
                            console.error('[parseLabelConfig] Fatal error:', error);
                            return {
                                choices: [],
                                textAreas: [],
                                ratings: [],
                                labels: [],
                                hasImage: false,
                                hasText: false,
                                hasSourceMT: false
                            };
                        }
                    }

                    function renderImageClassificationForm(assignment, task, taskData, labelConfig) {
                        const controls = parseLabelConfig(labelConfig);
                        const imageUrl = taskData.image || taskData.img || taskData.url;
                        const hasCaption = controls.textAreas.length > 0;

                        let choicesHtml = '';
                        if (controls.choices.length > 0) {
                            const choice = controls.choices[0];
                            const inputType = choice.multiple ? 'checkbox' : 'checkbox';
                            choicesHtml = \`
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 13px;">Classify image:</label>
                                    \${choice.options.map((option, idx) => \`
                                        <div style="margin-bottom: 8px;">
                                            <label style="display: flex; align-items: center; cursor: pointer; padding: 8px;">
                                                <input type="\${inputType}" name="choice-\${assignment.id}" value="\${escapeHtml(option)}"
                                                       style="margin-right: 8px;" />
                                                <span>\${escapeHtml(option)}</span>
                                            </label>
                                        </div>
                                    \`).join('')}
                                </div>
                            \`;
                        }

                        return \`
                            <div class="annotation-form">
                                <h4 style="margin-bottom: 16px; font-size: 14px;">Image Classification</h4>

                                \${imageUrl ? \`
                                    <div style="margin-bottom: 16px; text-align: center;">
                                        <img src="\${escapeHtml(imageUrl)}"
                                             style="max-width: 100%; max-height: 300px; border-radius: 4px; border: 1px solid var(--vscode-input-border);"
                                             alt="Task image" />
                                    </div>
                                \` : ''}

                                \${choicesHtml}

                                \${hasCaption ? \`
                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">Caption:</label>
                                        <textarea
                                            id="caption-\${assignment.id}"
                                            rows="3"
                                            placeholder="Provide a caption for the image..."
                                            style="width: 100%; padding: 8px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; resize: vertical;"
                                        ></textarea>
                                    </div>
                                \` : ''}

                                <button data-action="submit-classification" data-assignment-id="\${assignment.id}" style="width: 100%;">
                                    Submit Classification
                                </button>
                            </div>
                        \`;
                    }

                    function renderTextClassificationForm(assignment, task, taskData, labelConfig) {
                        const controls = parseLabelConfig(labelConfig);
                        const text = taskData.text || '';

                        let choicesHtml = '';
                        if (controls.choices.length > 0) {
                            const choice = controls.choices[0];
                            const inputType = choice.multiple ? 'checkbox' : 'radio';
                            choicesHtml = \`
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 13px;">Classify text:</label>
                                    \${choice.options.map(option => \`
                                        <div style="margin-bottom: 8px;">
                                            <label style="display: flex; align-items: center; cursor: pointer; padding: 8px;">
                                                <input type="\${inputType}" name="choice-\${assignment.id}" value="\${escapeHtml(option)}"
                                                       style="margin-right: 8px;" />
                                                <span>\${escapeHtml(option)}</span>
                                            </label>
                                        </div>
                                    \`).join('')}
                                </div>
                            \`;
                        }

                        return \`
                            <div class="annotation-form">
                                <h4 style="margin-bottom: 16px; font-size: 14px;">Text Classification</h4>

                                \${text ? \`
                                    <div style="margin-bottom: 16px; padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                                        <div style="font-size: 13px; line-height: 1.5;">\${escapeHtml(text)}</div>
                                    </div>
                                \` : ''}

                                \${choicesHtml}

                                <button data-action="submit-classification" data-assignment-id="\${assignment.id}" style="width: 100%;">
                                    Submit Classification
                                </button>
                            </div>
                        \`;
                    }

                    function renderMTEvaluationForm(assignment, task, taskData, labelConfig) {
                        const source = escapeHtml(taskData.source || '');
                        const mt = escapeHtml(taskData.mt || taskData.target || '');

                        const ratingOptions = [
                            { value: 'catastrophic', label: '* Catastrophic', description: 'Incomprehensible or life-threatening mistakes' },
                            { value: 'inadequate', label: '** Inadequate', description: 'Hard to understand or cannot be relied on' },
                            { value: 'passable', label: '*** Passable', description: 'Comprehensible but contains errors or not fluent' },
                            { value: 'good', label: '**** Good', description: 'Meaning present and language fluent. Few minor errors' },
                            { value: 'perfect', label: '***** Perfect', description: 'No errors and native fluency' }
                        ];

                        return \`
                            <div class="annotation-form">
                                <h4 style="margin-bottom: 16px; font-size: 14px;">MT Evaluation</h4>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                    <div style="padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 6px;">SOURCE</div>
                                        <div style="font-size: 12px; line-height: 1.4;">\${source}</div>
                                    </div>
                                    <div style="padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 6px;">MT OUTPUT</div>
                                        <div style="font-size: 12px; line-height: 1.4;">\${mt}</div>
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 13px;">Translation Quality Score:</label>
                                    \${ratingOptions.map(option => \`
                                        <div style="margin-bottom: 8px;">
                                            <label style="display: flex; align-items: start; cursor: pointer; padding: 8px;">
                                                <input type="radio" name="rating-\${assignment.id}" value="\${option.value}"
                                                       style="margin-top: 2px; margin-right: 8px;" />
                                                <div>
                                                    <div style="font-weight: 600; font-size: 12px; margin-bottom: 2px;">\${option.label}</div>
                                                    <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">\${option.description}</div>
                                                </div>
                                            </label>
                                        </div>
                                    \`).join('')}
                                </div>

                                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 12px;">Comment (optional):</label>
                                <textarea
                                    id="comment-\${assignment.id}"
                                    rows="3"
                                    placeholder="Add any additional comments..."
                                    style="width: 100%; padding: 8px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; resize: vertical; margin-bottom: 16px;"
                                ></textarea>

                                <button data-action="submit-mt-evaluation" data-assignment-id="\${assignment.id}" style="width: 100%;">
                                    Submit Evaluation
                                </button>
                            </div>
                        \`;
                    }

                    function renderGenericAnnotationForm(assignment, task, taskData) {
                        // Generic form for when label_config is not available
                        const imageUrl = taskData.image || taskData.img || taskData.url;
                        const text = taskData.text;

                        return \`
                            <div class="annotation-form">
                                <h4 style="margin-bottom: 16px; font-size: 14px;">Complete Annotation</h4>

                                \${imageUrl ? \`
                                    <div style="margin-bottom: 16px; text-align: center;">
                                        <img src="\${escapeHtml(imageUrl)}"
                                             style="max-width: 100%; max-height: 300px; border-radius: 4px; border: 1px solid var(--vscode-input-border);"
                                             alt="Task image" />
                                    </div>
                                \` : ''}

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">Your Annotation:</label>
                                    <textarea
                                        id="generic-annotation-\${assignment.id}"
                                        rows="4"
                                        placeholder="Enter your annotation here..."
                                        style="width: 100%; padding: 8px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px; resize: vertical;"
                                    ></textarea>
                                    <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                                        Provide your annotation in any format (text, JSON, etc.)
                                    </div>
                                </div>

                                <button data-action="submit-generic-annotation" data-assignment-id="\${assignment.id}" style="width: 100%;">
                                    Submit Annotation
                                </button>
                            </div>
                        \`;
                    }

                    function renderDynamicForm(assignment, task, taskData, labelConfig, controls) {
                        // Build form dynamically based on parsed Label Studio controls
                        let formContent = '';

                        // Display Header instruction if present
                        if (controls.header) {
                            formContent += \`
                                <h4 style="margin-bottom: 16px; font-size: 14px; font-weight: 600;">\${escapeHtml(controls.header)}</h4>
                            \`;
                        }

                        // Display Source/MT side by side if it's an MT evaluation task
                        if (controls.hasSourceMT && taskData.source && taskData.mt) {
                            formContent += \`
                                <h4 style="margin-bottom: 16px; font-size: 14px;">MT Evaluation</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                    <div style="padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 6px;">SOURCE</div>
                                        <div style="font-size: 12px; line-height: 1.4;">\${escapeHtml(taskData.source)}</div>
                                    </div>
                                    <div style="padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                                        <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 6px;">MT OUTPUT</div>
                                        <div style="font-size: 12px; line-height: 1.4;">\${escapeHtml(taskData.mt)}</div>
                                    </div>
                                </div>
                            \`;
                        }

                        // Display image if present
                        const imageUrl = taskData.image || taskData.img || taskData.url;
                        if (controls.hasImage && imageUrl) {
                            formContent += \`
                                <div style="margin-bottom: 16px; text-align: center;">
                                    <img src="\${escapeHtml(imageUrl)}"
                                         style="max-width: 100%; max-height: 300px; border-radius: 4px; border: 1px solid var(--vscode-input-border);"
                                         alt="Task image" />
                                </div>
                            \`;
                        }

                        // ONLY display text if label_config has a <Text> element
                        // Don't show random taskData.text for image-only tasks
                        if (controls.hasText && taskData.text) {
                            formContent += \`
                                <div style="margin-bottom: 16px; padding: 12px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
                                    <div style="font-size: 13px; line-height: 1.5;">\${escapeHtml(taskData.text)}</div>
                                </div>
                            \`;
                        }

                        // Render Choices (radio or checkboxes)
                        controls.choices.forEach((choice, idx) => {
                            const inputType = choice.multiple ? 'checkbox' : 'radio';
                            const inputName = \`\${choice.name}-\${assignment.id}\`;

                            formContent += \`
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 12px; font-weight: 600; font-size: 14px; text-transform: capitalize;">\${escapeHtml(choice.name)}</label>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
                                        \${choice.options.map(option => \`
                                            <label class="choice-option" style="display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 12px 16px; background-color: var(--vscode-input-background); border: 2px solid var(--vscode-input-border); border-radius: 6px; transition: all 0.2s ease; font-size: 13px; font-weight: 500;">
                                                <input type="\${inputType}" name="\${inputName}" value="\${escapeHtml(option)}"
                                                       data-control-name="\${escapeHtml(choice.name)}"
                                                       style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;" />
                                                <span>\${escapeHtml(option)}</span>
                                            </label>
                                        \`).join('')}
                                    </div>
                                </div>
                            \`;
                        });

                        // Render Labels (for error marking, etc.)
                        controls.labels.forEach((label, idx) => {
                            const inputName = \`\${label.name}-\${assignment.id}\`;

                            // Determine if this is an error-marking checkbox
                            const isErrorLabel = label.name.toLowerCase().includes('error');
                            const labelDescription = isErrorLabel
                                ? 'Mark this if the translation contains critical errors or mistakes'
                                : '';

                            formContent += \`
                                <div style="margin-bottom: 16px; background-color: var(--vscode-editor-inactiveSelectionBackground); padding: 12px; border-radius: 6px;">
                                    <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;">\${escapeHtml(label.name)}\${isErrorLabel ? ':' : ' (optional):'}</label>
                                    \${labelDescription ? \`<div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; font-style: italic;">\${labelDescription}</div>\` : ''}
                                    \${label.options.map(option => \`
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="checkbox" name="\${inputName}" value="\${escapeHtml(option)}"
                                                   data-control-name="\${escapeHtml(label.name)}"
                                                   style="margin-right: 8px;" />
                                            <span>\${escapeHtml(option)}</span>
                                        </label>
                                    \`).join('')}
                                </div>
                            \`;
                        });

                        // Render Ratings
                        controls.ratings.forEach((rating, idx) => {
                            const ratingName = \`\${rating.name}-\${assignment.id}\`;
                            const stars = [];
                            for (let i = 1; i <= rating.maxRating; i++) {
                                stars.push(i);
                            }

                            // Star rating rubric (matches Label Studio's MT evaluation rubric)
                            const rubricItems = [
                                { stars: 1, label: 'Catastrophic', color: '#dc3545', description: 'Incomprehensible or life-threatening mistakes' },
                                { stars: 2, label: 'Inadequate', color: '#fd7e14', description: 'Hard to understand or use, unreliable' },
                                { stars: 3, label: 'Passable', color: '#ffc107', description: 'Overall comprehensible but not fluent' },
                                { stars: 4, label: 'Good', color: '#28a745', description: 'Meaning present and fluent, few minor errors' },
                                { stars: 5, label: 'Perfect', color: '#20c997', description: 'No errors, native fluency' }
                            ];

                            formContent += \`
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 13px;">\${escapeHtml(rating.name)}\${rating.required ? ' *' : ''}:</label>
                                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                                        \${stars.map(star => \`
                                            <label style="cursor: pointer; font-size: 24px;">
                                                <input type="radio" name="\${ratingName}" value="\${star}"
                                                       data-control-name="\${escapeHtml(rating.name)}"
                                                       style="display: none;" />
                                                <span class="star" data-value="\${star}" style="cursor: pointer; color: #ccc; transition: color 0.2s;">★</span>
                                            </label>
                                        \`).join('')}
                                    </div>
                                    <div style="background-color: var(--vscode-editor-inactiveSelectionBackground); padding: 12px; border-radius: 6px; font-size: 11px;">
                                        \${rubricItems.map(item => \`
                                            <div style="display: flex; align-items: baseline; margin-bottom: 6px; line-height: 1.4;">
                                                <span style="color: \${item.color}; font-weight: 600; min-width: 20px; margin-right: 4px;">\${'★'.repeat(item.stars)}</span>
                                                <span style="font-weight: 600; color: \${item.color}; margin-right: 6px;">\${item.label}:</span>
                                                <span style="color: var(--vscode-descriptionForeground);">\${item.description}</span>
                                            </div>
                                        \`).join('')}
                                    </div>
                                </div>
                            \`;
                        });

                        // Render TextAreas
                        controls.textAreas.forEach((textArea, idx) => {
                            const textAreaId = \`\${textArea.name}-\${assignment.id}\`;

                            formContent += \`
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 14px; text-transform: capitalize;">\${escapeHtml(textArea.name)}\${textArea.required ? ' *' : ''}</label>
                                    <textarea
                                        id="\${textAreaId}"
                                        data-control-name="\${escapeHtml(textArea.name)}"
                                        rows="4"
                                        placeholder="\${escapeHtml(textArea.placeholder)}"
                                        style="width: 100%; padding: 12px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 2px solid var(--vscode-input-border); border-radius: 6px; font-size: 13px; line-height: 1.5; resize: vertical; font-family: var(--vscode-font-family); transition: border-color 0.2s ease;"
                                    ></textarea>
                                </div>
                            \`;
                        });

                        return \`
                            <div class="annotation-form">
                                \${!controls.hasSourceMT ? '<h4 style="margin-bottom: 16px; font-size: 14px;">Complete Annotation</h4>' : ''}
                                \${formContent}
                                <button data-action="submit-dynamic" data-assignment-id="\${assignment.id}" style="width: 100%;">
                                    Submit
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
                            console.error('Could not find annotation textarea');
                            return;
                        }

                        try {
                            const result = JSON.parse(textarea.value);
                            console.log('✓ Valid JSON!', result);
                        } catch (error) {
                            console.error('✗ Invalid JSON!', error.message);
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

                    function claimTaskFromProject(projectId) {
                        // Prevent duplicate claims
                        if (isClaimingTask) {
                            return;
                        }

                        isClaimingTask = true;

                        // Find and disable the claim button for this project
                        const claimBtn = document.querySelector(\`[data-action="claim-task-from-project"][data-project-id="\${projectId}"]\`);
                        if (claimBtn) {
                            claimBtn.disabled = true;
                            claimBtn.textContent = 'Claiming...';
                        }

                        vscode.postMessage({ type: 'claim-task-from-project', projectId });

                        // Reset after a timeout (in case the response is slow)
                        setTimeout(() => {
                            isClaimingTask = false;
                        }, 3000);
                    }

                    function startAssignment(assignmentId) {
                        vscode.postMessage({ type: 'start-assignment', assignmentId });
                    }

                    function cancelAssignment(assignmentId) {
                        // No confirmation needed - just cancel
                        vscode.postMessage({ type: 'cancel-assignment', assignmentId });
                    }

                    function submitGenericAnnotation(assignmentId) {
                        const annotationTextarea = document.getElementById('generic-annotation-' + assignmentId);
                        const annotationText = annotationTextarea ? annotationTextarea.value.trim() : '';

                        if (!annotationText) {
                            // Show error in the UI
                            const errorDiv = document.createElement('div');
                            errorDiv.style.color = '#d73a49';
                            errorDiv.style.padding = '8px';
                            errorDiv.style.marginTop = '8px';
                            errorDiv.style.backgroundColor = 'rgba(215, 58, 73, 0.1)';
                            errorDiv.style.borderRadius = '4px';
                            errorDiv.textContent = 'Please provide an annotation.';
                            const submitBtn = document.querySelector(\`[data-action="submit-generic-annotation"][data-assignment-id="\${assignmentId}"]\`);
                            if (submitBtn && submitBtn.parentElement) {
                                submitBtn.parentElement.insertBefore(errorDiv, submitBtn);
                                setTimeout(() => errorDiv.remove(), 5000);
                            }
                            return;
                        }

                        // Try to parse as JSON first, otherwise send as plain text
                        let result;
                        try {
                            result = JSON.parse(annotationText);
                        } catch (e) {
                            // Not valid JSON, send as text object
                            result = {
                                annotation: annotationText
                            };
                        }

                        // Submit the annotation
                        vscode.postMessage({
                            type: 'submit-assignment',
                            assignmentId,
                            result
                        });
                    }

                    function submitDynamic(assignmentId) {
                        // Collect all form values from the dynamic form
                        const result = {};

                        // Collect all inputs with data-control-name attribute
                        const allInputs = document.querySelectorAll(\`[data-control-name]\`);

                        allInputs.forEach(input => {
                            const controlName = input.getAttribute('data-control-name');
                            if (!controlName) return;

                            if (input.tagName === 'TEXTAREA') {
                                const value = input.value.trim();
                                if (value) {
                                    result[controlName] = value;
                                }
                            } else if (input.type === 'radio' || input.type === 'checkbox') {
                                if (input.checked) {
                                    if (input.type === 'radio') {
                                        result[controlName] = input.value;
                                    } else {
                                        // For checkboxes, accumulate into array
                                        if (!result[controlName]) {
                                            result[controlName] = [];
                                        }
                                        result[controlName].push(input.value);
                                    }
                                }
                            }
                        });

                        console.log('[submitDynamic] Collected result:', result);

                        if (Object.keys(result).length === 0) {
                            // Show error
                            const errorDiv = document.createElement('div');
                            errorDiv.style.color = '#d73a49';
                            errorDiv.style.padding = '8px';
                            errorDiv.style.marginTop = '8px';
                            errorDiv.style.backgroundColor = 'rgba(215, 58, 73, 0.1)';
                            errorDiv.style.borderRadius = '4px';
                            errorDiv.textContent = 'Please complete the required fields.';
                            const submitBtn = document.querySelector(\`[data-action="submit-dynamic"][data-assignment-id="\${assignmentId}"]\`);
                            if (submitBtn && submitBtn.parentElement) {
                                submitBtn.parentElement.insertBefore(errorDiv, submitBtn);
                                setTimeout(() => errorDiv.remove(), 5000);
                            }
                            return;
                        }

                        // Submit the annotation
                        vscode.postMessage({
                            type: 'submit-assignment',
                            assignmentId,
                            result
                        });
                    }

                    function submitMTEvaluation(assignmentId) {
                        // Get selected rating
                        const selectedRating = document.querySelector(\`input[name="rating-\${assignmentId}"]:checked\`);
                        if (!selectedRating) {
                            // Show error in the UI
                            const errorDiv = document.createElement('div');
                            errorDiv.style.color = '#d73a49';
                            errorDiv.style.padding = '8px';
                            errorDiv.style.marginTop = '8px';
                            errorDiv.style.backgroundColor = 'rgba(215, 58, 73, 0.1)';
                            errorDiv.style.borderRadius = '4px';
                            errorDiv.textContent = 'Please select a translation quality rating.';
                            const submitBtn = document.querySelector(\`[data-action="submit-mt-evaluation"][data-assignment-id="\${assignmentId}"]\`);
                            if (submitBtn && submitBtn.parentElement) {
                                submitBtn.parentElement.insertBefore(errorDiv, submitBtn);
                                setTimeout(() => errorDiv.remove(), 5000);
                            }
                            return;
                        }

                        const rating = selectedRating.value;
                        const commentTextarea = document.getElementById('comment-' + assignmentId);
                        const comment = commentTextarea ? commentTextarea.value.trim() : '';

                        // Build the annotation result in Label Studio format
                        const result = {
                            rating: rating,
                            comment: comment || undefined
                        };

                        // Remove undefined fields
                        const cleanResult = JSON.parse(JSON.stringify(result));

                        // Submit the annotation
                        vscode.postMessage({
                            type: 'submit-assignment',
                            assignmentId,
                            result: cleanResult
                        });
                    }

                    function submitClassification(assignmentId) {
                        // Get selected choices (can be checkboxes or radio buttons)
                        const selectedChoices = document.querySelectorAll(\`input[name="choice-\${assignmentId}"]:checked\`);
                        const choices = Array.from(selectedChoices).map(input => input.value);

                        if (choices.length === 0) {
                            // Show error in the UI
                            const errorDiv = document.createElement('div');
                            errorDiv.style.color = '#d73a49';
                            errorDiv.style.padding = '8px';
                            errorDiv.style.marginTop = '8px';
                            errorDiv.style.backgroundColor = 'rgba(215, 58, 73, 0.1)';
                            errorDiv.style.borderRadius = '4px';
                            errorDiv.textContent = 'Please select at least one option.';
                            const submitBtn = document.querySelector(\`[data-action="submit-classification"][data-assignment-id="\${assignmentId}"]\`);
                            if (submitBtn && submitBtn.parentElement) {
                                submitBtn.parentElement.insertBefore(errorDiv, submitBtn);
                                setTimeout(() => errorDiv.remove(), 5000);
                            }
                            return;
                        }

                        // Get caption/textarea if present
                        const captionTextarea = document.getElementById('caption-' + assignmentId) ||
                                              document.getElementById('textarea-' + assignmentId);
                        const caption = captionTextarea ? captionTextarea.value.trim() : '';

                        // Build the annotation result
                        const result = {
                            choices: choices.length === 1 ? choices[0] : choices,
                            caption: caption || undefined
                        };

                        // Remove undefined fields
                        const cleanResult = JSON.parse(JSON.stringify(result));

                        // Submit the annotation
                        vscode.postMessage({
                            type: 'submit-assignment',
                            assignmentId,
                            result: cleanResult
                        });
                    }

                    function submitAssignment(assignmentId) {
                        const textarea = document.getElementById('result-' + assignmentId);
                        if (!textarea) {
                            console.error('Could not find annotation textarea');
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
                            console.error('Invalid JSON format:', error);
                        }
                    }
                </script>
            </body>
            </html>`;
    }
}
