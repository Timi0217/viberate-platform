import { AuthManager } from './auth';
import { StorageManager } from '../utils/storage';

export interface Task {
    id: number;
    labelstudio_task_id: number;
    project: number;
    project_title?: string;
    data: any;
    status: 'available' | 'assigned' | 'completed';
    price_per_task?: number;
    created_at: string;
    updated_at: string;
}

export interface TaskAssignment {
    id: number;
    task: Task;
    annotator: number;
    status: 'assigned' | 'accepted' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
    annotation_result: any | null;
    quality_score: number | null;
    payment_amount: string | null;
    payment_status: 'pending' | 'paid' | 'failed';
    created_at: string;
    updated_at: string;
    started_at: string | null;
    submitted_at: string | null;
}

export class TaskManager {
    private authManager: AuthManager;
    private storage: StorageManager;
    private pollingInterval: NodeJS.Timeout | null = null;
    private readonly POLL_INTERVAL_MS = 30000; // 30 seconds

    constructor(authManager: AuthManager, storage: StorageManager) {
        this.authManager = authManager;
        this.storage = storage;
    }

    async getAvailableTasks(): Promise<Task[]> {
        try {
            const client = this.authManager.getApiClient();
            const response = await client.get('/tasks/', {
                params: { status: 'available' }
            });
            return response.data.results || response.data;
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    }

    async getMyAssignments(): Promise<TaskAssignment[]> {
        try {
            const client = this.authManager.getApiClient();
            const response = await client.get('/task-assignments/my_assignments/');
            return response.data;
        } catch (error) {
            console.error('Error fetching assignments:', error);
            return [];
        }
    }

    async claimTask(taskId: number): Promise<TaskAssignment> {
        const client = this.authManager.getApiClient();
        const response = await client.post('/tasks/claim/', {
            task_id: taskId
        });
        return response.data;
    }

    async acceptAssignment(assignmentId: number): Promise<TaskAssignment> {
        const client = this.authManager.getApiClient();
        const response = await client.post(`/task-assignments/${assignmentId}/accept/`);
        return response.data;
    }

    async startAssignment(assignmentId: number): Promise<TaskAssignment> {
        const client = this.authManager.getApiClient();
        const response = await client.post(`/task-assignments/${assignmentId}/start/`);
        return response.data;
    }

    async submitAssignment(
        assignmentId: number,
        annotationResult: any
    ): Promise<TaskAssignment> {
        const client = this.authManager.getApiClient();
        const response = await client.post(`/task-assignments/${assignmentId}/submit/`, {
            annotation_result: annotationResult,
            sync_to_labelstudio: true
        });
        return response.data;
    }

    async cancelAssignment(assignmentId: number): Promise<TaskAssignment> {
        const client = this.authManager.getApiClient();
        const response = await client.post(`/task-assignments/${assignmentId}/cancel/`);
        return response.data;
    }

    async refreshTasks(): Promise<void> {
        const tasks = await this.getAvailableTasks();
        const assignments = await this.getMyAssignments();

        await this.storage.set('availableTasks', tasks);
        await this.storage.set('myAssignments', assignments);
    }

    startPolling(): void {
        if (this.pollingInterval) {
            return; // Already polling
        }

        // Initial fetch
        this.refreshTasks();

        // Poll every 30 seconds
        this.pollingInterval = setInterval(() => {
            this.refreshTasks();
        }, this.POLL_INTERVAL_MS);
    }

    stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
}
