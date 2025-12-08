import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full">
            <div className="w-20 h-20 bg-red-900/30 text-red-500 rounded-full mx-auto flex items-center justify-center mb-6 text-4xl">
                <i className="fa-solid fa-bug"></i>
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Mala mía...</h1>
            <p className="text-slate-400 mb-6">La aplicación tuvo un error inesperado.</p>
            
            <div className="bg-black/30 p-4 rounded-xl text-left mb-6 overflow-hidden">
                <p className="text-xs font-mono text-red-300 break-words">
                    {this.state.error?.message || "Unknown Error"}
                </p>
            </div>

            <button 
                onClick={() => window.location.reload()} 
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl transition-colors"
            >
                Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;