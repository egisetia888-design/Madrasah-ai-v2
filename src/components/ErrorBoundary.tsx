import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-6 w-full">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto border border-gray-100 shadow-sm">
              <AlertTriangle className="w-8 h-8 text-gray-700" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display text-gray-900">
                Terjadi Kesalahan
              </h2>
              <p className="text-sm text-gray-500 font-serif leading-relaxed">
                {this.props.fallbackMessage || "Terjadi kesalahan tak terduga. Data Anda aman tersimpan secara lokal."}
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors shadow-sm w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
