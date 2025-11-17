import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // In production, you would send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>⚠️</div>
          <h2 style={{
            fontSize: '24px',
            marginBottom: '16px',
            color: 'var(--text-primary)'
          }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-muted)',
            marginBottom: '24px'
          }}>
            We encountered an unexpected error. Please try refreshing the page.
          </p>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Reload Page
          </button>

          {/* Show error details in development */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginTop: '40px',
              textAlign: 'left',
              padding: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600', marginBottom: '12px' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{
                overflow: 'auto',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
