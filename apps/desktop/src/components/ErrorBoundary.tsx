import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Catches render-time errors anywhere in the app subtree and shows them in
 * place of a blank screen. Critical for diagnosing problems during dev,
 * since Tauri's webview strips console.error formatting.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info });
    // Also log to console for browser devtools.
    console.error('ErrorBoundary caught:', error);
    if (info?.componentStack) console.error(info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0b0b10',
            color: '#f2f2f7',
            padding: 24,
            overflow: 'auto',
            fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <h1 style={{ color: '#f0506b', fontSize: 16, marginBottom: 12 }}>Render error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error.message}
          </pre>
          {this.state.error.stack && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#b7b7c6' }}>Stack</summary>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#7e7e90' }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
          {this.state.info?.componentStack && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#b7b7c6' }}>Component stack</summary>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#7e7e90' }}>
                {this.state.info.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
