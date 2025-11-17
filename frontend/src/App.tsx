import { useState, useEffect, useCallback } from 'react';
import {
  authAPI,
  labelStudioAPI,
  tasksAPI,
  assignmentsAPI,
  walletAPI,
  type User,
  type LabelStudioConnection,
  type LabelStudioProject,
  type Task
} from './api';
import { CoinbaseOnramp } from './CoinbaseOnramp';
import { validateEmail, validatePassword, validateUsername, validateURL, validatePaymentAmount } from './utils/validation';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');
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
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [pendingAssignments, setPendingAssignments] = useState<any[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<number>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.user_type === 'researcher') {
      setError(''); // Clear any previous errors
      loadConnection().catch(() => {});
      loadProjects().catch(() => {});
      loadPendingAssignments().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const userData = await authAPI.getProfile();
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

    // Validate username
    const usernameError = validateUsername(registerData.username);
    if (usernameError) {
      setError(usernameError);
      setLoading(false);
      return;
    }

    // Validate email
    const emailError = validateEmail(registerData.email);
    if (emailError) {
      setError(emailError);
      setLoading(false);
      return;
    }

    // Validate password
    const passwordError = validatePassword(registerData.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    // Validate password confirmation
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
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
      setView('landing'); // Redirect to landing page after logout
    }
  };

  const loadConnection = async () => {
    try {
      const data = await labelStudioAPI.getConnection();
      console.log('Load connection response:', data);

      // Check if data is a paginated response with results
      if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
        if (data.results.length > 0 && data.results[0].id && data.results[0].labelstudio_url) {
          console.log('Setting connection from paginated results:', data.results[0]);
          setConnection(data.results[0]);
        } else {
          console.log('Empty paginated results');
          setConnection(null);
        }
      }
      // Check if data is an array with connections
      else if (Array.isArray(data)) {
        if (data.length > 0 && data[0].id && data[0].labelstudio_url) {
          console.log('Setting connection from array:', data[0]);
          setConnection(data[0]);
        } else {
          console.log('Empty array or invalid connection');
          setConnection(null);
        }
      }
      // Check if data is a single connection object
      else if (data && typeof data === 'object' && data.id && data.labelstudio_url) {
        console.log('Setting connection from object:', data);
        setConnection(data);
      }
      // No valid connection
      else {
        console.log('No valid connection found');
        setConnection(null);
      }
    } catch (err) {
      console.error('Load connection error:', err);
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
      setShowConnectionModal(false);
      loadProjects();
    } catch (err: any) {
      setError(err.response?.data?.email?.[0] || err.response?.data?.error || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await labelStudioAPI.listProjects();
      console.log('Load projects response:', data);

      // Handle paginated response
      if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
        setProjects(data.results);
      } else {
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Load projects error:', err);
      setProjects([]);
    }
  };

  const loadAvailableProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await labelStudioAPI.getAvailableProjects();
      setAvailableProjects(Array.isArray(data) ? data : []);
      if (!data || data.length === 0) {
        setError('All Label Studio projects have been imported. Create new projects in Label Studio to import more.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load available projects');
      setAvailableProjects([]);
    } finally {
      setLoading(false);
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
    setLoading(true);
    setError('');
    try {
      console.log('Syncing project:', projectId);
      const result = await labelStudioAPI.syncProject(projectId);
      console.log('Sync result:', result);
      await loadProjects();
      // Show success message
      alert('Project synced successfully! Task counts updated.');
    } catch (err: any) {
      console.error('Sync error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to sync project';
      setError(errorMsg);
      alert(`Sync failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishProject = async (projectId: number) => {
    try {
      await labelStudioAPI.publishProject(projectId);
      await loadProjects();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to publish project');
    }
  };

  const handleUnpublishProject = async (projectId: number) => {
    try {
      await labelStudioAPI.unpublishProject(projectId);
      await loadProjects();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to unpublish project');
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

  const loadPendingAssignments = async () => {
    try {
      console.log('Loading pending assignments...');
      const data = await assignmentsAPI.list('submitted');
      console.log('Pending assignments response:', data);
      // Handle both paginated response {results: [...]} and direct array
      const assignments = Array.isArray(data) ? data : (data.results || []);
      console.log('Extracted assignments:', assignments);
      setPendingAssignments(assignments);
      setSelectedAssignments(new Set()); // Clear selection when reloading
    } catch (err: any) {
      console.error('Failed to load pending assignments:', err);
      setPendingAssignments([]);
    }
  };

  const toggleAssignmentSelection = (assignmentId: number) => {
    const newSelected = new Set(selectedAssignments);
    if (newSelected.has(assignmentId)) {
      newSelected.delete(assignmentId);
    } else {
      newSelected.add(assignmentId);
    }
    setSelectedAssignments(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedAssignments.size === pendingAssignments.length) {
      setSelectedAssignments(new Set());
    } else {
      setSelectedAssignments(new Set(pendingAssignments.map(a => a.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedAssignments.size === 0) {
      alert('Please select at least one assignment to approve.');
      return;
    }

    // Calculate total payment
    let totalPayment = 0;
    selectedAssignments.forEach(assignmentId => {
      const assignment = pendingAssignments.find(a => a.id === assignmentId);
      if (assignment) {
        const task = assignment.task_data || assignment.task;
        const project = projects.find(p => p.id === task?.project);
        const defaultPrice = project?.price_per_task ? parseFloat(project.price_per_task) : 5.00;
        totalPayment += defaultPrice;
      }
    });

    const confirmed = window.confirm(
      `Approve ${selectedAssignments.size} assignment(s) for a total of $${totalPayment.toFixed(2)} USDC?`
    );

    if (!confirmed) return;

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    // Process each selected assignment
    for (const assignmentId of Array.from(selectedAssignments)) {
      try {
        const assignment = pendingAssignments.find(a => a.id === assignmentId);
        const task = assignment?.task_data || assignment?.task;
        const project = projects.find(p => p.id === task?.project);
        const paymentAmount = project?.price_per_task ? parseFloat(project.price_per_task) : 5.00;

        await assignmentsAPI.approve(assignmentId, paymentAmount);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to approve assignment ${assignmentId}:`, err);
        errorCount++;
      }
    }

    setLoading(false);

    // Reload assignments
    await loadPendingAssignments();

    // Show result
    if (errorCount === 0) {
      alert(`Successfully approved ${successCount} assignment(s)!`);
    } else {
      alert(`Approved ${successCount} assignment(s). Failed: ${errorCount}`);
    }
  };

  const handleApproveAssignment = async (assignmentId: number, paymentAmount: number) => {
    // Validate payment amount
    const paymentError = validatePaymentAmount(paymentAmount);
    if (paymentError) {
      setError(paymentError);
      return;
    }

    setLoading(true);
    try {
      await assignmentsAPI.approve(assignmentId, paymentAmount);
      await loadPendingAssignments();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAssignment = async (assignmentId: number, reason: string) => {
    setLoading(true);
    try {
      await assignmentsAPI.reject(assignmentId, reason);
      await loadPendingAssignments();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject assignment');
    } finally {
      setLoading(false);
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
    // Landing page
    if (view !== 'login' && view !== 'register') {
      return (
        <div className="landing-container">
          <header className="landing-header">
            <div className="landing-header-content">
              <div className="header-brand">
                <svg className="brand-icon" width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path d="M6 16h4M12 12v8M16 8v16M20 12v8M26 16h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <h1 className="brand-text">Viberate</h1>
              </div>
              <div className="landing-nav">
                <button onClick={() => setView('register')} className="btn-landing-nav btn-landing-nav-primary">
                  Get Started
                </button>
                <button onClick={() => window.location.href = 'mailto:contact@viberate.com'} className="btn-landing-nav">
                  Contact Us
                </button>
              </div>
            </div>
          </header>

          <main className="landing-main">
            <div className="landing-content">
              <h1 className="landing-headline">
                <span className="no-break">Data annotation for AI researchers.</span><br />
                <span className="no-break">Done right. Done fast.</span>
              </h1>
              <p className="landing-subheadline">
                Get affordable consensus-validated data annotations directly in your Label Studio account.
              </p>
              <div className="landing-actions">
                <button onClick={() => setView('register')} className="btn-landing btn-landing-primary">
                  Get Started
                </button>
                <button onClick={() => window.location.href = 'mailto:contact@viberate.com'} className="btn-landing btn-landing-secondary">
                  Contact Us
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // Auth forms
    return (
      <div className="auth-container">
        <div className="auth-card">
          <button
            onClick={() => setView('landing')}
            style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#86868B',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1D1D1F'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#86868B'}
            title="Back to home"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 16px' }}>
              <path d="M6 16h4M12 12v8M16 8v16M20 12v8M26 16h-4" stroke="#1D1D1F" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <h1 className="auth-title">
              {view === 'login' ? 'Welcome to Viberate' : 'Join Viberate'}
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
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ minWidth: '200px' }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
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
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-success"
                  style={{ minWidth: '200px' }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
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
  try {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-brand">
              <svg className="brand-icon" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M6 16h4M12 12v8M16 8v16M20 12v8M26 16h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <h1 className="brand-text">Viberate</h1>
            </div>
            <div className="user-menu">
              <div className="wallet-section">
                {user.base_wallet_address && (
                  <div className="balance-display">
                    <span className="balance-value">${parseFloat(user.usdc_balance || '0').toFixed(2)}</span>
                    <span className="balance-currency">USDC</span>
                  </div>
                )}
              </div>
              <div className="user-info">
                <p className="user-name">{user?.username}</p>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-sm"
                style={{ backgroundColor: '#EF4444', color: 'white', border: 'none' }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          {/* Wallet Actions Bar */}
          {user.base_wallet_address && (
            <div className="wallet-actions-bar">
              <div className="wallet-info">
                <div className="wallet-address">
                  <span className="wallet-label">Wallet Address</span>
                  <code className="wallet-code">{user.base_wallet_address.slice(0, 6)}...{user.base_wallet_address.slice(-4)}</code>
                </div>
              </div>
              <div className="wallet-actions">
                <button
                  onClick={refreshBalance}
                  className="btn btn-outline btn-sm"
                  title="Refresh balance"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Refresh
                </button>
                <CoinbaseOnramp
                  walletAddress={user.base_wallet_address}
                  onSuccess={refreshBalance}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError('')}
                className="alert-close-btn"
                aria-label="Close alert"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}

      {user?.user_type === 'researcher' ? (
        <>
        {/* Pending Approvals Section */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title">Pending Approvals</h2>
                <p className="card-subtitle" style={{ marginTop: '4px' }}>
                  {pendingAssignments.length > 0
                    ? `${pendingAssignments.length} annotation${pendingAssignments.length > 1 ? 's' : ''} awaiting review`
                    : 'No pending annotations to review at this time'}
                </p>
              </div>
              <button
                onClick={() => loadPendingAssignments()}
                className="btn btn-secondary"
                disabled={loading}
                style={{ whiteSpace: 'nowrap' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Refresh
              </button>
            </div>

            {pendingAssignments.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                padding: '10px 14px',
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderRadius: '4px',
                border: '1px solid rgba(0, 0, 0, 0.06)'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  margin: 0,
                  color: 'var(--text-primary)'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedAssignments.size === pendingAssignments.length && pendingAssignments.length > 0}
                    onChange={toggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Select All</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>({pendingAssignments.length})</span>
                </label>

                {selectedAssignments.size > 0 && (
                  <>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {selectedAssignments.size} selected
                    </span>
                    <button
                      onClick={handleBatchApprove}
                      disabled={loading}
                      style={{
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: '500',
                        backgroundColor: '#0066ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                        opacity: loading ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#0052cc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0066ff')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      Approve Selected
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {pendingAssignments.length > 0 && (
            <div className="card-body">
              {pendingAssignments.map((assignment: any) => {
                const task = assignment.task_data || assignment.task;
                const project = projects.find(p => p.id === task?.project);
                const defaultPrice = project?.price_per_task ? parseFloat(project.price_per_task) : 5.00;
                const taskData = task?.data || {};
                const isSelected = selectedAssignments.has(assignment.id);

                return (
                  <div key={assignment.id} className="assignment-card" style={{
                    border: `1px solid ${isSelected ? '#0066ff' : 'rgba(0, 0, 0, 0.08)'}`,
                    borderRadius: '6px',
                    padding: '16px',
                    marginBottom: '12px',
                    backgroundColor: isSelected ? 'rgba(0, 102, 255, 0.04)' : 'white',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(0, 102, 255, 0.1)' : 'none'
                  }}>
                    {/* Header with checkbox */}
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAssignmentSelection(assignment.id)}
                          style={{ width: '17px', height: '17px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '3px' }}>
                            Assignment #{assignment.id}
                          </div>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            {assignment.task_data?.project_title || 'Unknown Project'} • <span style={{ fontWeight: '500', color: '#0066ff' }}>${defaultPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', textAlign: 'right' }}>
                        {assignment.submitted_at ? new Date(assignment.submitted_at).toLocaleString() : 'Unknown'}
                      </div>
                    </div>

                    {/* Task Data */}
                    {(taskData.image || taskData.text) && (
                      <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Task Data
                        </div>
                        {taskData.image && (
                          <img
                            src={taskData.image}
                            alt="Task"
                            style={{ maxWidth: '250px', maxHeight: '180px', borderRadius: '4px', marginBottom: taskData.text ? '6px' : '0' }}
                          />
                        )}
                        {taskData.text && (
                          <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
                            "{taskData.text}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Annotation Result - Formatted */}
                    <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Annotation
                      </div>
                      {(() => {
                        const result = assignment.annotation_result;
                        if (!result) return <div style={{ fontSize: '13px', color: '#999' }}>No result</div>;

                        // Format the result in a readable way
                        return (
                          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                            {Object.entries(result).map(([key, value]) => (
                              <div key={key} style={{ marginBottom: '4px' }}>
                                <span style={{ fontWeight: '600', textTransform: 'capitalize', color: '#333' }}>{key}:</span>{' '}
                                <span style={{ color: '#555' }}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Individual Actions */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleApproveAssignment(assignment.id, defaultPrice)}
                        disabled={loading}
                        style={{
                          padding: '6px 12px',
                          fontSize: '13px',
                          fontWeight: '500',
                          backgroundColor: '#0066ff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          opacity: loading ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#0052cc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0066ff')}
                      >
                        Approve ${defaultPrice.toFixed(2)}
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for rejection (optional):');
                          if (reason !== null) {
                            handleRejectAssignment(assignment.id, reason);
                          }
                        }}
                        disabled={loading}
                        style={{
                          padding: '6px 12px',
                          fontSize: '13px',
                          fontWeight: '500',
                          backgroundColor: 'white',
                          color: '#666',
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          opacity: loading ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Projects</h2>
              <p className="card-subtitle">Manage your Label Studio annotation projects</p>
            </div>
          </div>
          <div className="card-body">

          {(() => {
            const hasValidConnection = connection &&
                                      connection.id &&
                                      connection.labelstudio_url &&
                                      connection.labelstudio_url.trim() !== '';
            return !hasValidConnection;
          })() ? (
            <div className="connection-empty-state">
              <button
                onClick={() => setShowConnectionModal(true)}
                className="btn btn-primary btn-large"
              >
                Connect Label Studio
              </button>
            </div>
          ) : (
            <div>
              <div className="connection-success-banner">
                <div className="connection-success-content">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span className="connection-success-label">Connected to Label Studio</span>
                </div>
                <button
                  onClick={async () => {
                    if (connection?.id) {
                      try {
                        await labelStudioAPI.deleteConnection(connection.id);
                      } catch (err) {
                        console.error('Failed to delete connection:', err);
                      }
                    }
                    setConnection(null);
                    setError('');
                  }}
                  className="btn btn-outline btn-sm disconnect-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                  Disconnect
                </button>
              </div>

              {/* Available Projects to Import - Show first for better UX */}
              {availableProjects && availableProjects.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1D1D1F', margin: '0 0 6px 0' }}>Available Projects to Import</h3>
                    <p style={{ fontSize: '15px', color: '#86868B', margin: 0 }}>Select projects from your Label Studio account to import</p>
                  </div>
                  <div className="projects-grid">
                    {availableProjects.map((project) => (
                      <div key={project.id} className="import-project-card">
                        <div style={{ flex: 1 }}>
                          <h4 className="project-title" style={{ marginBottom: '8px' }}>{project.title}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#86868B', fontSize: '14px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 11l3 3L22 4"/>
                              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                            <span style={{ fontWeight: '500' }}>{project.task_number} tasks</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleImportProject(project.id)}
                          disabled={loading}
                          className="btn-import"
                        >
                          {loading ? 'Importing...' : 'Import'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="projects-section">
                <div className="section-header">
                  <h3 className="section-title">Your Projects</h3>
                  <button
                    onClick={loadAvailableProjects}
                    className="btn btn-success"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : '+ Import New Project'}
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
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleSyncProject(project.id)}
                              className="btn btn-secondary btn-sm"
                              title="Sync tasks from Label Studio"
                              disabled={loading}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  show: true,
                                  title: `Remove "${project.title}"`,
                                  message: 'This will delete the project from Viberate but NOT from Label Studio.',
                                  onConfirm: async () => {
                                    try {
                                      await labelStudioAPI.deleteProject(project.id);
                                      await loadProjects();
                                      setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} });
                                    } catch (err: any) {
                                      setError(err.response?.data?.error || 'Failed to delete project');
                                      setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} });
                                    }
                                  },
                                });
                              }}
                              className="btn btn-sm"
                              title="Remove project from Viberate"
                              style={{ backgroundColor: '#EF4444', color: 'white', border: 'none' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" fill="none"/>
                                <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2"/>
                                <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2"/>
                              </svg>
                            </button>
                          </div>
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

                        {/* Budget Section */}
                        <div style={{ marginTop: '16px', padding: '16px 24px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginLeft: '-24px', marginRight: '-24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Budget</span>
                              <span style={{ fontSize: '20px', fontWeight: '700', color: '#10B981' }}>
                                ${parseFloat(project.budget_usdc || '0').toFixed(2)}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Enter amount"
                                  id={`budget-${project.id}`}
                                  defaultValue={parseFloat(project.budget_usdc || '0')}
                                  title="Set new budget amount in USDC"
                                  style={{
                                    width: '100px',
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '13px',
                                    backgroundColor: 'var(--bg-primary)'
                                  }}
                                />
                                <button
                                  onClick={async () => {
                                    const input = document.getElementById(`budget-${project.id}`) as HTMLInputElement;
                                    const budget = parseFloat(input.value || '0');
                                    try {
                                      await labelStudioAPI.updateBudget(project.id, budget);
                                      await loadProjects();
                                    } catch (err: any) {
                                      setError(err.response?.data?.error || 'Failed to update budget');
                                    }
                                  }}
                                  style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#3B82F6',
                                    color: 'white',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                  title="Update budget"
                                >
                                  Set
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                              <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price per Task</span>
                              <span style={{ fontSize: '20px', fontWeight: '700' }}>${parseFloat(project.price_per_task || '5.00').toFixed(2)}</span>
                              <button
                                onClick={() => {
                                  if (project.is_published) {
                                    handleUnpublishProject(project.id);
                                  } else {
                                    handlePublishProject(project.id);
                                  }
                                }}
                                disabled={!project.can_publish && !project.is_published}
                                style={{
                                  marginTop: '8px',
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  backgroundColor: project.is_published ? '#EF4444' : '#10B981',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor: (!project.can_publish && !project.is_published) ? 'not-allowed' : 'pointer',
                                  opacity: (!project.can_publish && !project.is_published) ? 0.5 : 1,
                                  transition: 'all 0.2s'
                                }}
                                title={
                                  !project.can_publish && !project.is_published
                                    ? 'Set a budget greater than $0 to publish'
                                    : project.is_published
                                    ? 'Remove from network'
                                    : 'Publish to network'
                                }
                              >
                                {project.is_published ? 'Unpublish' : 'Publish'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
        </>
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

        {/* Connection Modal */}
        {showConnectionModal && (
          <div className="modal-overlay" onClick={() => setShowConnectionModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Connect to Label Studio</h3>
                <button
                  onClick={() => setShowConnectionModal(false)}
                  className="modal-close"
                  aria-label="Close"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateConnection} className="modal-body">
                <div className="form-group">
                  <label className="form-label">Legacy API Token</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter your Label Studio legacy API token"
                    value={connectionForm.api_token}
                    onChange={(e) => setConnectionForm({ ...connectionForm, api_token: e.target.value })}
                    required
                    autoFocus
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Get your token from Label Studio: Account & Settings → Legacy Token
                  </p>
                </div>

                {error && (
                  <div className="modal-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {error}
                  </div>
                )}

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowConnectionModal(false)}
                    className="btn btn-outline"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" opacity="0.25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog.show && (
          <div className="modal-overlay" onClick={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} })}>
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="confirm-title">{confirmDialog.title}</h3>
              <p className="confirm-message">{confirmDialog.message}</p>
              <div className="confirm-actions">
                <button
                  onClick={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} })}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="btn"
                  style={{ flex: 1, backgroundColor: '#EF4444', color: 'white', border: 'none' }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
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
