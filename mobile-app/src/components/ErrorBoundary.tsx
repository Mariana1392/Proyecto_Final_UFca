import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', backgroundColor: '#fff', minHeight: '100vh' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>Something went wrong.</h1>
          <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: '10px', color: '#666' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
