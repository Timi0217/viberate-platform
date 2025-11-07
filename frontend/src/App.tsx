import { useState, useEffect } from 'react';
import {
  authAPI,
  labelStudioAPI,
  tasksAPI,
  type User,
  type LabelStudioConnection,
  type LabelStudioProject,
  type Task
} from './api';

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
    api_token: '',
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
      const data = await labelStudioAPI.getConnection();
      if (Array.isArray(data) && data.length > 0) {
        setConnection(data[0]);
      } else if (!Array.isArray(data)) {
        setConnection(data);
      }
    } catch (err) {
      console.log('No connection yet');
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
      setError(err.response?.data?.api_token?.[0] || err.response?.data?.error || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await labelStudioAPI.listProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadAvailableProjects = async () => {
    try {
      const data = await labelStudioAPI.getAvailableProjects();
      setAvailableProjects(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load available projects');
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

  // Loading state
  if (pageLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Login/Register View
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
        <h1>Viberate Platform</h1>

        {view === 'login' ? (
          <div>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="text"
                  placeholder="Username"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="password"
                  placeholder="Password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                  required
                />
              </div>
              {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
            <p style={{ marginTop: '15px', textAlign: 'center' }}>
              Don't have an account?{' '}
              <a href="#" onClick={() => setView('register')}>Register</a>
            </p>
          </div>
        ) : (
          <div>
            <h2>Register</h2>
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="text"
                  placeholder="Username"
                  value={registerData.username}
                  onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="password"
                  placeholder="Password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  style={{ width: '100%', padding: '10px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Account Type:</label>
                <select
                  value={registerData.user_type}
                  onChange={(e) => setRegisterData({ ...registerData, user_type: e.target.value as 'researcher' | 'annotator' })}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="researcher">Researcher (Customer)</option>
                  <option value="annotator">Annotator</option>
                </select>
              </div>
              {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>
            <p style={{ marginTop: '15px', textAlign: 'center' }}>
              Already have an account?{' '}
              <a href="#" onClick={() => setView('login')}>Login</a>
            </p>
          </div>
        )}
      </div>
    );
  }

  // Main Dashboard
  console.log('Rendering dashboard. User:', user);

  try {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', minHeight: '100vh', background: '#f5f5f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h1 style={{ margin: 0 }}>Viberate Platform</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {user?.username} ({user?.user_type})
          </span>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '15px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {user?.user_type === 'researcher' ? (
        <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>Label Studio Integration</h2>

          {!connection ? (
            <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '30px', border: '2px dashed #ddd' }}>
              <h3 style={{ marginTop: 0 }}>Connect to Label Studio</h3>
              <form onSubmit={handleCreateConnection}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Label Studio URL:</label>
                  <input
                    type="url"
                    placeholder="https://app.heartex.com"
                    value={connectionForm.labelstudio_url}
                    onChange={(e) => setConnectionForm({ ...connectionForm, labelstudio_url: e.target.value })}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>API Token:</label>
                  <input
                    type="text"
                    placeholder="Your Label Studio API Token"
                    value={connectionForm.api_token}
                    onChange={(e) => setConnectionForm({ ...connectionForm, api_token: e.target.value })}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  />
                  <small style={{ color: '#666' }}>
                    Get your API token from Label Studio: Account & Settings → Access Token
                  </small>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div style={{ padding: '15px', background: '#d4edda', color: '#155724', borderRadius: '4px', marginBottom: '20px' }}>
                ✓ Connected to Label Studio: {connection.labelstudio_url}
              </div>

              <div style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3>Your Projects</h3>
                  <button
                    onClick={loadAvailableProjects}
                    style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Import New Project
                  </button>
                </div>

                {projects.length === 0 ? (
                  <p>No projects imported yet. Click "Import New Project" to get started.</p>
                ) : (
                  <div>
                    {projects.map((project) => (
                      <div key={project.id} style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <h4 style={{ margin: '0 0 10px 0' }}>{project.title}</h4>
                            <p style={{ margin: '0 0 10px 0', color: '#666' }}>{project.description}</p>
                            <div style={{ display: 'flex', gap: '15px', fontSize: '14px' }}>
                              <span>Tasks: {project.total_tasks}</span>
                              <span>Completed: {project.completed_tasks}</span>
                              <span>Progress: {project.completion_percentage}%</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSyncProject(project.id)}
                            style={{ padding: '6px 12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Sync Tasks
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {availableProjects.length > 0 && (
                <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <h3>Available Projects to Import</h3>
                  {availableProjects.map((project) => (
                    <div key={project.id} style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '15px', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: '0 0 5px 0' }}>{project.title}</h4>
                          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                            {project.task_number} tasks
                          </p>
                        </div>
                        <button
                          onClick={() => handleImportProject(project.id)}
                          disabled={loading}
                          style={{ padding: '6px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Import
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h2 style={{ marginTop: 0 }}>Annotator Dashboard</h2>
          <p style={{ color: '#666', fontSize: '16px' }}>Annotator features coming in the next sprint...</p>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '20px' }}>
            You'll be able to view and complete annotation tasks assigned to you.
          </p>
        </div>
      )}
    </div>
    );
  } catch (error) {
    console.error('Dashboard rendering error:', error);
    return (
      <div style={{ maxWidth: '600px', margin: '50px auto', padding: '30px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#dc3545' }}>Something went wrong</h2>
        <p>Please try refreshing the page or logging out and back in.</p>
        <button onClick={() => {
          localStorage.removeItem('authToken');
          window.location.reload();
        }} style={{ marginTop: '20px', padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Logout and Reload
        </button>
      </div>
    );
  }
}

export default App;
