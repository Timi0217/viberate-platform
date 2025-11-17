import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';
import { StorageManager } from '../utils/storage';

export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    user_type: 'annotator' | 'researcher';
    usdc_balance: string;
    base_wallet_address: string | null;
}

export class AuthManager {
    private apiClient: AxiosInstance;
    private storage: StorageManager;

    constructor(storage: StorageManager) {
        this.storage = storage;
        const config = vscode.workspace.getConfiguration('viberate');
        const apiUrl = config.get<string>('apiUrl', 'http://localhost:8000');

        this.apiClient = axios.create({
            baseURL: `${apiUrl}/api`,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add auth interceptor
        this.apiClient.interceptors.request.use(async (config) => {
            const token = await this.storage.get('authToken');
            if (token) {
                config.headers.Authorization = `Token ${token}`;
            }
            return config;
        });
    }

    async register(username: string, email: string, password: string): Promise<User> {
        try {
            const response = await this.apiClient.post('/users/', {
                username,
                email,
                password,
                user_type: 'annotator',
                first_name: '',
                last_name: ''
            });

            const user = response.data;

            // Automatically login after registration
            return await this.login(username, password);
        } catch (error: any) {
            if (error.response?.data?.username) {
                throw new Error(`Username: ${error.response.data.username[0]}`);
            } else if (error.response?.data?.email) {
                throw new Error(`Email: ${error.response.data.email[0]}`);
            } else if (error.response?.data?.password) {
                throw new Error(`Password: ${error.response.data.password[0]}`);
            } else if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            }
            throw error;
        }
    }

    async login(username: string, password: string): Promise<User> {
        try {
            // Login to get token
            const response = await this.apiClient.post('/auth/login/', {
                username,
                password
            });

            const { token, user } = response.data;

            // Validate user is an annotator
            if (user.user_type !== 'annotator') {
                throw new Error('Only annotators can use this extension. Please use the web interface for researchers.');
            }

            // Store token
            await this.storage.set('authToken', token);
            await this.storage.set('user', user);

            return user;
        } catch (error: any) {
            if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            } else if (error.response?.data?.detail) {
                throw new Error(error.response.data.detail);
            }
            throw error;
        }
    }

    async logout(): Promise<void> {
        try {
            await this.apiClient.post('/auth/logout/');
        } catch (error) {
            // Ignore logout errors
            console.error('Logout error:', error);
        } finally {
            await this.storage.remove('authToken');
            await this.storage.remove('user');
        }
    }

    async getUser(): Promise<User | null> {
        return await this.storage.get('user');
    }

    async updateWalletAddress(walletAddress: string): Promise<User> {
        try {
            const user = await this.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const response = await this.apiClient.patch(`/users/${user.id}/`, {
                base_wallet_address: walletAddress
            });

            const updatedUser = response.data;
            await this.storage.set('user', updatedUser);
            return updatedUser;
        } catch (error: any) {
            if (error.response?.data?.base_wallet_address) {
                throw new Error(`Wallet: ${error.response.data.base_wallet_address[0]}`);
            } else if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            }
            throw error;
        }
    }

    isAuthenticated(): boolean {
        return this.storage.has('authToken');
    }

    getApiClient(): AxiosInstance {
        return this.apiClient;
    }
}
