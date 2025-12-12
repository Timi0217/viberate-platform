import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { githubOAuth } from '../utils/githubOAuth';

export function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      // Handle OAuth errors
      if (errorParam) {
        setError(`GitHub OAuth error: ${errorParam}`);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code || !state) {
        setError('Invalid OAuth callback');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Validate state to prevent CSRF
      if (!githubOAuth.validateState(state)) {
        setError('Invalid OAuth state. Please try again.');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Authenticate with backend (backend handles code exchange)
        const authData = await githubOAuth.authenticateWithCode(code);

        // Store user data
        localStorage.setItem('auth_token', authData.token);
        localStorage.setItem('user', JSON.stringify(authData.user));

        // Redirect to the user's GitRank profile
        navigate(`/gitrank/${authData.user.github_username}`);
      } catch (err: any) {
        console.error('OAuth error:', err);
        setError(err.message || 'Failed to complete GitHub authentication');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#1a1f2e',
      color: 'white'
    }}>
      {error ? (
        <>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2>{error}</h2>
          <p>Redirecting...</p>
        </>
      ) : (
        <>
          <div className="spinner" style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#60A5FA',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <h2>Authenticating with GitHub...</h2>
          <p>Please wait while we complete your login</p>
        </>
      )}
    </div>
  );
}
