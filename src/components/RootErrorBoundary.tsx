import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/chunkRecovery";

type RootErrorBoundaryState = { error: Error | null };

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RootErrorBoundary]", error, info.componentStack);
    recoverFromChunkLoadError(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkLoadFailed = isChunkLoadError(error);
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md text-center">
          <h1 className="text-xl font-semibold">Não foi possível carregar esta página</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {chunkLoadFailed
              ? "Há uma versão mais recente disponível. Atualize para continuar."
              : "Ocorreu um erro inesperado. Tente novamente."}
          </p>
          <button
            type="button"
            onClick={() => chunkLoadFailed ? window.location.reload() : this.setState({ error: null })}
            className="mt-6 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            {chunkLoadFailed ? "Atualizar página" : "Tentar novamente"}
          </button>
        </section>
      </main>
    );
  }
}

export default RootErrorBoundary;