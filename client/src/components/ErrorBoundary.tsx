import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary caught]", error.message, info.componentStack?.substring(0, 300));
    this.setState({ errorInfo: info.componentStack });
    // Show error in loader div as fallback for iOS Safari
    if (typeof (window as any).__showError === 'function') {
      (window as any).__showError(
        'React Component Error: ' + error.message + '\n\nStack: ' + (info.componentStack || '').substring(0, 300),
        '',
        ''
      );
    }
  }

  render() {
    if (this.state.hasError) {
      // Use hardcoded inline styles — no CSS variables, no Tailwind
      // This ensures visibility on ALL browsers including iOS Safari
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          backgroundColor: '#0d1b2a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '600px',
            backgroundColor: '#152233',
            border: '1px solid #ff6b35',
            borderRadius: '12px',
            padding: '32px',
            color: '#e8f4f8',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>⚠️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#ff6b35' }}>
              Application Error
            </h2>
            <p style={{ fontSize: '14px', color: '#90caf9', marginBottom: '16px' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            {this.state.error?.stack && (
              <div style={{
                backgroundColor: '#0d1b2a',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                overflowX: 'auto',
              }}>
                <pre style={{
                  fontSize: '11px',
                  color: '#6b8fa8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                }}>
                  {this.state.error.stack.substring(0, 600)}
                </pre>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: '#42a5f5',
                color: '#0a1520',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%',
                justifyContent: 'center',
              }}
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
