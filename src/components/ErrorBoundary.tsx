import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so one broken screen does not blank the whole app. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-stone-200 p-6 shadow-sm text-center">
          <h1 className="text-lg font-extrabold text-stone-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-stone-600">
            The page hit an unexpected error. Your saved data is not affected. Reload to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-sm font-bold"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
