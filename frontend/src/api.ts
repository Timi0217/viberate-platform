import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://django-production-3340.up.railway.app';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Enable cookies for httpOnly auth
});

// Add auth token to requests if available (backward compatibility)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: 'researcher' | 'annotator';
  rating?: number;
  tasks_completed?: number;
  base_wallet_address?: string;
  usdc_balance?: string;
}

export interface LabelStudioConnection {
  id: number;
  labelstudio_url: string;
  is_verified: boolean;
  last_verified_at: string;
  created_at: string;
}

export interface LabelStudioProject {
  id: number;
  labelstudio_project_id: number;
  title: string;
  description: string;
  researcher_username: string;
  is_active: boolean;
  is_published: boolean;
  can_publish: boolean;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  budget_usdc: string;
  price_per_task: string;
  remaining_budget: number;
  last_synced_at: string;
  created_at: string;
}

export interface Task {
  id: number;
  labelstudio_task_id: number;
  project: number;
  project_title: string;
  data: any;
  status: string;
  difficulty: string;
  reward_points: number;
  created_at: string;
}

// Auth API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login/', { username, password });
    if (response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  },
  
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    user_type?: 'researcher' | 'annotator';
  }) => {
    const response = await api.post('/api/auth/register/', userData);
    if (response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  },
  
  logout: async () => {
    await api.post('/api/auth/logout/');
    localStorage.removeItem('authToken');
  },
  
  getProfile: async () => {
    const response = await api.get<User>('/api/auth/profile/');
    return response.data;
  },
};

// Label Studio Connection API
export const labelStudioAPI = {
  // Connections
  getConnection: async () => {
    const response = await api.get<LabelStudioConnection>('/api/labelstudio/connections/');
    return response.data;
  },

  createConnection: async (connectionData: { labelstudio_url: string; api_token: string }) => {
    const response = await api.post<LabelStudioConnection>('/api/labelstudio/connections/', connectionData);
    return response.data;
  },

  verifyConnection: async (id: number) => {
    const response = await api.post(`/api/labelstudio/connections/${id}/verify/`);
    return response.data;
  },

  deleteConnection: async (id: number) => {
    const response = await api.delete(`/api/labelstudio/connections/${id}/`);
    return response.data;
  },

  // Projects
  listProjects: async () => {
    const response = await api.get<LabelStudioProject[]>('/api/labelstudio/projects/');
    return response.data;
  },

  getAvailableProjects: async () => {
    const response = await api.get('/api/labelstudio/projects/available_projects/');
    return response.data;
  },

  importProject: async (projectId: number) => {
    const response = await api.post('/api/labelstudio/projects/import_project/', {
      labelstudio_project_id: projectId
    });
    return response.data;
  },

  syncProject: async (id: number) => {
    const response = await api.post(`/api/labelstudio/projects/${id}/sync/`);
    return response.data;
  },

  updateBudget: async (id: number, budgetUsdc: number) => {
    const response = await api.patch(`/api/labelstudio/projects/${id}/`, {
      budget_usdc: budgetUsdc
    });
    return response.data;
  },

  deleteProject: async (id: number) => {
    const response = await api.delete(`/api/labelstudio/projects/${id}/`);
    return response.data;
  },

  publishProject: async (id: number) => {
    const response = await api.post(`/api/labelstudio/projects/${id}/publish/`);
    return response.data;
  },

  unpublishProject: async (id: number) => {
    const response = await api.post(`/api/labelstudio/projects/${id}/unpublish/`);
    return response.data;
  },
};

// Tasks API
export const tasksAPI = {
  list: async () => {
    const response = await api.get<Task[]>('/api/tasks/');
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get<Task>(`/api/tasks/${id}/`);
    return response.data;
  },
};

// Assignments API
export const assignmentsAPI = {
  list: async (status?: string) => {
    const params = status ? { status } : {};
    const response = await api.get('/api/task-assignments/', { params });
    return response.data;
  },

  approve: async (assignmentId: number, paymentAmount?: number, qualityScore?: number, feedback?: string) => {
    const response = await api.post(`/api/task-assignments/${assignmentId}/approve/`, {
      payment_amount: paymentAmount,
      quality_score: qualityScore,
      feedback: feedback
    });
    return response.data;
  },

  reject: async (assignmentId: number, reason?: string) => {
    const response = await api.post(`/api/task-assignments/${assignmentId}/reject/`, {
      reason: reason || 'Does not meet quality standards'
    });
    return response.data;
  },
};

// Wallet API
export const walletAPI = {
  getBalance: async () => {
    const response = await api.get('/api/wallet/balance/');
    return response.data;
  },

  transfer: async (toAddress: string, amount: string) => {
    const response = await api.post('/api/wallet/transfer/', {
      to_address: toAddress,
      amount: amount
    });
    return response.data;
  },

  getTransactions: async () => {
    const response = await api.get('/api/wallet/transactions/');
    return response.data;
  },
};

export default api;
