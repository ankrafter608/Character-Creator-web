import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '2rem',
                    backgroundColor: '#1a1a1a',
                    color: '#ff5555',
                    height: '100vh',
                    fontFamily: 'monospace',
                    overflow: 'auto'
                }}>
                    <h1>Something went wrong.</h1>
                    <h2 style={{ color: '#fff' }}>{this.state.error?.toString()}</h2>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', color: '#aaa' }}>
                        {this.state.errorInfo?.componentStack}
                    </details>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        style={{
                            marginTop: '2rem',
                            padding: '10px 20px',
                            background: '#ff5555',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        Clear LocalStorage & Reload (Emergency Reset)
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
