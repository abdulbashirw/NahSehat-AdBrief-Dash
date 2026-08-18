/**
 * ErrorBoundary — catches render errors and shows a fallback UI.
 * Prevents the entire app from crashing when a component throws.
 *
 * Automatically retries on "Rendered more hooks" errors caused by
 * React 19 + React.lazy() reconciliation issues. The retry always
 * succeeds because the lazy module is already loaded by then.
 *
 * Uses synchronous retry (no setTimeout) to avoid visual flash.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  /** Incremented on each auto-retry; triggers re-render when changed */
  retryCount: number;
}

const HOOKS_RETRY_ERROR = 'Rendered more hooks than during the previous render';
const MAX_AUTO_RETRIES = 3;

export default class ErrorBoundary extends Component<Props, State> {
  private autoRetryCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // For React lazy-load reconciliation errors ("Rendered more hooks"),
    // we DON'T set hasError=true — instead, we let componentDidCatch handle
    // the auto-retry by incrementing retryCount to force a remount.
    // This avoids a visual flash of the error UI.
    if (error.message?.includes(HOOKS_RETRY_ERROR)) {
      // Return hasError:false so the tree is NOT replaced with the fallback.
      // componentDidCatch will increment retryCount to force a remount.
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Auto-retry for React lazy-load reconciliation errors.
    // Incrementing retryCount changes the key on the wrapper div, forcing
    // React to discard the old fiber tree and remount the children.
    // The lazy module is already loaded by this point, so the retry succeeds.
    if (error.message?.includes(HOOKS_RETRY_ERROR) && this.autoRetryCount < MAX_AUTO_RETRIES) {
      this.autoRetryCount++;
      this.setState((prev) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prev.retryCount + 1,
      }));
      return;
    }

    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.autoRetryCount = 0;
    this.setState({ hasError: false, error: null, errorInfo: null, retryCount: 0 });
  };

  render() {
    // Key by retryCount to force React to remount children on auto-retry
    // This is the key fix — it forces React to discard the old fiber tree
    // and create a new one, which resolves the "more hooks" mismatch.
    const key = this.state.retryCount;

    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-[#1F2A37]">Something went wrong</h2>
          <p className="max-w-md text-center text-sm text-[#6B7280]">
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {this.state.errorInfo?.componentStack && (
            <pre className="max-w-lg overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-600">
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          {this.state.error?.stack && (
            <pre className="max-w-lg overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-600">
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#2E7D5B] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#245A47]"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }
    return <div key={key}>{this.props.children}</div>;
  }
}