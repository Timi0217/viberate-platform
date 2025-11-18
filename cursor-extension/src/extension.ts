import * as vscode from 'vscode';
import { AuthManager } from './api/auth';
import { TaskManager } from './api/tasks';
import { TaskPanelProvider } from './ui/taskPanel';
import { IdleDetector } from './utils/idleDetector';
import { StorageManager } from './utils/storage';
import { validateWalletAddress, validateEmail, validatePassword, validateUsername } from './utils/validation';

export function activate(context: vscode.ExtensionContext) {
    // Initialize managers
    const storage = new StorageManager(context);
    const authManager = new AuthManager(storage);
    const taskManager = new TaskManager(authManager, storage);
    const idleDetector = new IdleDetector();

    // Register sidebar webview provider
    const taskPanelProvider = new TaskPanelProvider(
        context.extensionUri,
        authManager,
        taskManager,
        storage
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'viberate.taskPanel',
            taskPanelProvider
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('viberate.login', async () => {
            await handleLogin(authManager, taskPanelProvider, taskManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('viberate.register', async () => {
            await handleRegister(authManager, taskPanelProvider, taskManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('viberate.logout', async () => {
            await handleLogout(authManager, taskPanelProvider, taskManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('viberate.refreshTasks', async () => {
            await taskManager.refreshTasks();
            taskPanelProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('viberate.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'viberate');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('viberate.connectWallet', async () => {
            await handleConnectWallet(authManager, taskPanelProvider);
        })
    );

    // Set up idle detection
    setupIdleDetection(idleDetector, taskManager, taskPanelProvider, storage);

    // Auto-login if token exists
    if (authManager.isAuthenticated()) {
        taskManager.startPolling();
    }
}

async function handleLogin(
    authManager: AuthManager,
    taskPanelProvider: TaskPanelProvider,
    taskManager: TaskManager
) {
    const username = await vscode.window.showInputBox({
        prompt: 'Enter your Viberate username',
        placeHolder: 'username',
        ignoreFocusOut: true
    });

    if (!username) {
        return;
    }

    const password = await vscode.window.showInputBox({
        prompt: 'Enter your Viberate password',
        placeHolder: 'password',
        password: true,
        ignoreFocusOut: true
    });

    if (!password) {
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Logging in to Viberate...',
            cancellable: false
        }, async () => {
            await authManager.login(username, password);
        });

        vscode.window.showInformationMessage('Successfully logged in to Viberate!');

        // Start polling for tasks
        taskManager.startPolling();

        // Show the Viberate view in the sidebar
        await vscode.commands.executeCommand('viberate.taskPanel.focus');

        // Wait a moment for view to be visible, then refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        await taskPanelProvider.refresh();
    } catch (error: any) {
        vscode.window.showErrorMessage(`Login failed: ${error.message}`);
    }
}

async function handleRegister(
    authManager: AuthManager,
    taskPanelProvider: TaskPanelProvider,
    taskManager: TaskManager
) {
    const username = await vscode.window.showInputBox({
        prompt: 'Choose a username',
        placeHolder: 'username',
        ignoreFocusOut: true,
        validateInput: (value) => {
            return validateUsername(value);
        }
    });

    if (!username) {
        return;
    }

    const email = await vscode.window.showInputBox({
        prompt: 'Enter your email address',
        placeHolder: 'email@example.com',
        ignoreFocusOut: true,
        validateInput: (value) => {
            return validateEmail(value);
        }
    });

    if (!email) {
        return;
    }

    const password = await vscode.window.showInputBox({
        prompt: 'Create a password (min 8 characters)',
        placeHolder: 'password',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
            return validatePassword(value);
        }
    });

    if (!password) {
        return;
    }

    const confirmPassword = await vscode.window.showInputBox({
        prompt: 'Confirm your password',
        placeHolder: 'password',
        password: true,
        ignoreFocusOut: true
    });

    if (!confirmPassword) {
        return;
    }

    if (password !== confirmPassword) {
        vscode.window.showErrorMessage('Passwords do not match!');
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating your Viberate account...',
            cancellable: false
        }, async () => {
            await authManager.register(username, email, password);
        });

        vscode.window.showInformationMessage('Account created successfully! You are now logged in.');

        // Start polling for tasks
        taskManager.startPolling();

        // Show the Viberate view in the sidebar
        await vscode.commands.executeCommand('viberate.taskPanel.focus');

        // Wait a moment for view to be visible, then refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        await taskPanelProvider.refresh();
    } catch (error: any) {
        vscode.window.showErrorMessage(`Registration failed: ${error.message}`);
    }
}

async function handleLogout(
    authManager: AuthManager,
    taskPanelProvider: TaskPanelProvider,
    taskManager: TaskManager
) {
    await authManager.logout();
    taskManager.stopPolling();
    taskPanelProvider.refresh();
    vscode.window.showInformationMessage('Logged out from Viberate');
}

async function handleConnectWallet(
    authManager: AuthManager,
    taskPanelProvider: TaskPanelProvider
) {
    const walletAddress = await vscode.window.showInputBox({
        prompt: 'Enter your Base network wallet address',
        placeHolder: '0x...',
        ignoreFocusOut: true,
        validateInput: (value) => {
            return validateWalletAddress(value);
        }
    });

    if (!walletAddress) {
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Connecting wallet...',
            cancellable: false
        }, async () => {
            await authManager.updateWalletAddress(walletAddress);
        });

        vscode.window.showInformationMessage('Wallet connected successfully! You can now receive USDC payouts.');
        taskPanelProvider.refresh();
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to connect wallet: ${error.message}`);
    }
}

function setupIdleDetection(
    idleDetector: IdleDetector,
    taskManager: TaskManager,
    taskPanelProvider: TaskPanelProvider,
    storage: StorageManager
) {
    const config = vscode.workspace.getConfiguration('viberate');
    const idleTimeSeconds = config.get<number>('idleTimeSeconds', 5);
    const autoAcceptTasks = config.get<boolean>('autoAcceptTasks', false);

    idleDetector.onIdle(idleTimeSeconds, async () => {
        // Check if user is authenticated and auto-accept is enabled
        const isAuthenticated = await storage.get('authToken');
        if (!isAuthenticated || !autoAcceptTasks) {
            return;
        }

        // Get available tasks
        const tasks = await taskManager.getAvailableTasks();
        if (tasks.length > 0) {
            // Show notification
            const action = await vscode.window.showInformationMessage(
                `You have ${tasks.length} annotation task(s) available. Start earning USDC!`,
                'View Tasks',
                'Dismiss'
            );

            if (action === 'View Tasks') {
                // Focus on the Viberate sidebar
                vscode.commands.executeCommand('viberate.taskPanel.focus');
            }
        }
    });

    idleDetector.start();
}

export function deactivate() {
    // Extension cleanup
}
