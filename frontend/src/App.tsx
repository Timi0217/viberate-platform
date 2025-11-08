import { useState, useEffect, useCallback } from 'react';
import {
  authAPI,
  labelStudioAPI,
  tasksAPI,
  walletAPI,
  type User,
  type LabelStudioConnection,
  type LabelStudioProject,
  type Task
} from './api';
import { CoinbaseOnramp } from './CoinbaseOnramp';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  // Auth state
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    user_type: 'researcher' as 'researcher' | 'annotator',
  });

  // Label Studio state
  const [connection, setConnection] = useState<LabelStudioConnection | null>(null);
  const [connectionForm, setConnectionForm] = useState({
    labelstudio_url: 'https://app.heartex.com',
    email: '',
    password: '',
  });
  const [projects, setProjects] = useState<LabelStudioProject[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    console.log('User effect triggered:', { isAuthenticated, userType: user?.user_type });
    if (isAuthenticated && user?.user_type === 'researcher') {
      console.log('Loading connection and projects...');
      setError(''); // Clear any previous errors
      loadConnection().catch(err => console.log('No connection yet:', err));
      loadProjects().catch(err => console.log('No projects yet:', err));
    }
  }, [isAuthenticated, user]);

  const checkAuth = async () => {
    console.log('Checking authentication...');
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        console.log('Token found, fetching profile...');
        const userData = await authAPI.getProfile();
        console.log('Profile received:', userData);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Auth check failed:', err);
        localStorage.removeItem('authToken');
      }
    }
    setPageLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login(loginData.username, loginData.password);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate password confirmation
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { confirmPassword, ...dataToSend } = registerData;
      const response = await authAPI.register(dataToSend);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error
        || err.response?.data?.detail
        || err.response?.data?.username?.[0]
        || err.response?.data?.email?.[0]
        || err.response?.data?.password?.[0]
        || 'Registration failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('authToken');
    }
  };

  const loadConnection = async () => {
    try {
      console.log('Loading connection...');
      const data = await labelStudioAPI.getConnection();
      console.log('Connection data received:', data);

      // Check if data is an array with connections
      if (Array.isArray(data)) {
        if (data.length > 0 && data[0].id && data[0].labelstudio_url) {
          console.log('Valid connection found in array:', data[0]);
          setConnection(data[0]);
        } else {
          console.log('Empty array or invalid connection, setting to null');
          setConnection(null);
        }
      }
      // Check if data is a single connection object
      else if (data && typeof data === 'object' && data.id && data.labelstudio_url) {
        console.log('Valid connection object found:', data);
        setConnection(data);
      }
      // No valid connection
      else {
        console.log('No valid connection found, setting to null');
        setConnection(null);
      }
    } catch (err) {
      console.log('Error loading connection:', err);
      setConnection(null);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const newConnection = await labelStudioAPI.createConnection(connectionForm);
      setConnection(newConnection);
      loadProjects();
    } catch (err: any) {
      setError(err.response?.data?.email?.[0] || err.response?.data?.error || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      console.log('Loading projects...');
      const data = await labelStudioAPI.listProjects();
      console.log('Projects loaded:', data);
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
    }
  };

  const loadAvailableProjects = async () => {
    try {
      console.log('Loading available projects...');
      const data = await labelStudioAPI.getAvailableProjects();
      console.log('Available projects loaded:', data);
      setAvailableProjects(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load available projects:', err);
      setError(err.response?.data?.error || 'Failed to load available projects');
      setAvailableProjects([]);
    }
  };

  const handleImportProject = async (projectId: number) => {
    setLoading(true);
    try {
      await labelStudioAPI.importProject(projectId);
      loadProjects();
      loadAvailableProjects();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import project');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProject = async (projectId: number) => {
    try {
      await labelStudioAPI.syncProject(projectId);
      loadProjects();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sync project');
    }
  };

  const loadTasks = async () => {
    try {
      const data = await tasksAPI.list();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const refreshBalance = useCallback(async () => {
    try {
      const balanceData = await walletAPI.getBalance();
      setUser((prevUser) => {
        if (!prevUser) return prevUser;
        return { ...prevUser, usdc_balance: balanceData.balance };
      });
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, []);

  // Loading state
  if (pageLoading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner"></div>
          <p className="loading-text">Loading Viberate...</p>
        </div>
      </div>
    );
  }

  // Login/Register View
  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">🎯</div>
            <h1 className="auth-title">
              {view === 'login' ? 'Welcome Back' : 'Join Viberate'}
            </h1>
            <p className="auth-subtitle">
              {view === 'login'
                ? 'Sign in to your account to continue'
                : 'Create your account to get started'}
            </p>
          </div>

          {view === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter your username"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              {error && <div className="error-message">⚠️ {error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div className="auth-switch">
                Don't have an account?{' '}
                <a className="auth-link" onClick={() => { setView('register'); setError(''); }}>
                  Create one
                </a>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Choose a username"
                  value={registerData.username}
                  onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="your@email.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Create a strong password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Re-enter your password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  required
                />
              </div>
              {error && <div className="error-message">⚠️ {error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-success"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
              <div className="auth-switch">
                Already have an account?{' '}
                <a className="auth-link" onClick={() => { setView('login'); setError(''); }}>
                  Sign in
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Main Dashboard
  console.log('Rendering dashboard. User:', user);

  try {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-brand">
              <div className="brand-icon">🎯</div>
              <div className="brand-text">
                <h1>Viberate</h1>
              </div>
            </div>
            <div className="user-menu">
              <div className="user-info">
                <p className="user-name">{user?.username}</p>
                <p className="user-type">{user?.user_type}</p>
              </div>
              <button onClick={handleLogout} className="btn btn-danger btn-sm">
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          {error && (
            <div className="alert alert-error">
              ⚠️ {error}
            </div>
          )}

      {user?.user_type === 'researcher' ? (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Label Studio Integration</h2>
              <div className="balance-container">
                <div className="balance-card">
                  <div className="balance-icon">💰</div>
                  <div className="balance-info">
                    <p className="balance-amount">${user.usdc_balance || '0.00'}</p>
                    <p className="balance-label">USDC on Base</p>
                  </div>
                </div>
              </div>
            </div>
            {user.base_wallet_address && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={refreshBalance}
                  className="btn btn-outline btn-sm"
                  title="Refresh balance"
                >
                  🔄 Refresh
                </button>
                <CoinbaseOnramp
                  walletAddress={user.base_wallet_address}
                  onSuccess={refreshBalance}
                />
              </div>
            )}
          </div>
          <div className="card-body">

          {(() => {
            const hasValidConnection = connection &&
                                      connection.id &&
                                      connection.labelstudio_url &&
                                      connection.labelstudio_url.trim() !== '';
            console.log('Render check - Connection state:', { connection, hasValidConnection });
            return !hasValidConnection;
          })() ? (
            <div className="connection-form">
              <h3>Connect to Label Studio</h3>
              <p>Login with your Label Studio account credentials to get started</p>
              <form onSubmit={handleCreateConnection}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="your@email.com"
                    value={connectionForm.email}
                    onChange={(e) => setConnectionForm({ ...connectionForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Your Label Studio password"
                    value={connectionForm.password}
                    onChange={(e) => setConnectionForm({ ...connectionForm, password: e.target.value })}
                    required
                  />
                  <small style={{ color: '#6B7280', display: 'block', marginTop: '6px', fontSize: '13px' }}>
                    🔒 We'll securely login and save your API token. Your password is not stored.
                  </small>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Connecting...' : 'Connect to Label Studio'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✓ Connected to Label Studio: {connection.labelstudio_url}</span>
                <button
                  onClick={() => {
                    setConnection(null);
                    setError('');
                  }}
                  className="btn btn-danger btn-sm"
                >
                  Disconnect
                </button>
              </div>

              <div className="projects-section">
                <div className="section-header">
                  <h3 className="section-title">Your Projects</h3>
                  <button
                    onClick={loadAvailableProjects}
                    className="btn btn-success"
                  >
                    + Import New Project
                  </button>
                </div>

                {!projects || projects.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <h3 className="empty-title">No Projects Yet</h3>
                    <p className="empty-description">Click "Import New Project" to get started with Label Studio</p>
                  </div>
                ) : (
                  <div className="projects-grid">
                    {projects.map((project) => (
                      <div key={project.id} className="project-card">
                        <div className="project-header">
                          <div>
                            <h4 className="project-title">{project.title}</h4>
                            <p className="project-description">{project.description}</p>
                          </div>
                          <button
                            onClick={() => handleSyncProject(project.id)}
                            className="btn btn-secondary btn-sm"
                          >
                            🔄 Sync
                          </button>
                        </div>
                        <div className="project-stats">
                          <div className="stat-item">
                            <span className="stat-label">Total Tasks</span>
                            <span className="stat-value">{project.total_tasks}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Completed</span>
                            <span className="stat-value">{project.completed_tasks}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Progress</span>
                            <span className="stat-value">{project.completion_percentage}%</span>
                          </div>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${project.completion_percentage}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {availableProjects && availableProjects.length > 0 && (
                <div className="connection-form" style={{ marginTop: '32px' }}>
                  <h3>Available Projects to Import</h3>
                  <p>Select projects from your Label Studio account to import</p>
                  <div className="projects-grid" style={{ marginTop: '20px' }}>
                    {availableProjects.map((project) => (
                      <div key={project.id} className="project-card">
                        <div className="project-header">
                          <div>
                            <h4 className="project-title">{project.title}</h4>
                            <p className="project-description">{project.task_number} tasks available</p>
                          </div>
                          <button
                            onClick={() => handleImportProject(project.id)}
                            disabled={loading}
                            className="btn btn-primary btn-sm"
                          >
                            Import
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body annotator-container">
            <div className="coming-soon-icon">🎨</div>
            <h2 className="coming-soon-title">Annotator Dashboard</h2>
            <p className="coming-soon-text">Exciting features coming soon!</p>
            <p style={{ color: '#9CA3AF', fontSize: '16px', margin: 0 }}>
              You'll be able to view and complete annotation tasks assigned to you.
            </p>
          </div>
        </div>
      )}
        </main>
      </div>
    );
  } catch (error) {
    console.error('Dashboard rendering error:', error);
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="empty-icon" style={{ fontSize: '80px' }}>⚠️</div>
          <h2 style={{ color: '#EF4444', marginBottom: '16px' }}>Something Went Wrong</h2>
          <p style={{ color: '#6B7280', marginBottom: '32px' }}>
            Please try refreshing the page or logging out and back in.
          </p>
          <button onClick={() => {
            localStorage.removeItem('authToken');
            window.location.reload();
          }} className="btn btn-primary">
            Logout and Reload
          </button>
        </div>
      </div>
    );
  }
}

export default App;
