/**
 * GitHub OAuth utility for web authentication
 */

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

export interface GitHubOAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
}

export class GitHubOAuth {
  private config: GitHubOAuthConfig;

  constructor() {
    this.config = {
      clientId: GITHUB_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scope: 'read:user user:email repo'  // Request access to user info and repos
    };
  }

  /**
   * Initiate GitHub OAuth flow
   */
  login(state?: string): void {
    const authState = state || this.generateState();
    sessionStorage.setItem('github_oauth_state', authState);

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', this.config.clientId);
    authUrl.searchParams.append('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.append('scope', this.config.scope);
    authUrl.searchParams.append('state', authState);

    window.location.href = authUrl.toString();
  }

  /**
   * Authenticate with GitHub authorization code
   * Backend handles code exchange and authentication in one step
   */
  async authenticateWithCode(code: string): Promise<any> {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const response = await fetch(`${apiUrl}/api/auth/github/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to authenticate with GitHub');
    }

    return response.json();
  }

  /**
   * Validate OAuth state to prevent CSRF
   */
  validateState(state: string): boolean {
    const storedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');
    return state === storedState;
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }
}

export const githubOAuth = new GitHubOAuth();
