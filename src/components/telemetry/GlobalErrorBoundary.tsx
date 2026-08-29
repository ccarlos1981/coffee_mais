"use client";

import React, { Component, ErrorInfo, ReactNode, useEffect } from "react";
import { reportClientError, initClientRum } from "@/lib/telemetry/client-rum";

// --------------------------------------------------------------------------
// 1. BOOTSTRAP CLIENTE PARA INICIALIZAR RUM ON MOUNT
// --------------------------------------------------------------------------

export function TelemetryBootstrap(): null {
  useEffect(() => {
    initClientRum();
  }, []);

  return null;
}

// --------------------------------------------------------------------------
// 2. ERROR BOUNDARY GLOBAL DO REACT
// --------------------------------------------------------------------------

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      reportClientError(error, {
        componentStack: errorInfo.componentStack || undefined,
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    } catch {
      // Fail-safe silencioso
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-6 text-center bg-card/60 border border-border/40 rounded-xl m-4 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-3 font-bold text-xl">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Algo inesperado aconteceu nesta visualização
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            O erro foi registrado silenciosamente pela telemetria do sistema. Você pode recarregar a página para continuar.
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
