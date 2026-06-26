import { Component } from 'react';
import { logger } from '../utils/logger.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface p-6">
          <div className="max-w-md text-center space-y-4">
            <span className="material-symbols-outlined text-error" style={{ fontSize: 64 }}>error</span>
            <h1 className="text-display-sm font-bold">Something went wrong</h1>
            <p className="text-on-surface-variant font-body-md">
              We've encountered an unexpected error. Our team has been notified.
            </p>
            <div className="bg-surface-container-low p-4 rounded text-left overflow-auto text-xs font-mono text-error">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-6 px-lg py-md bg-primary text-on-primary rounded-full hover:opacity-90 transition-opacity"
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
