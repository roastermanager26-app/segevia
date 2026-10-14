import { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "./ui";

type Props = {
  children: ReactNode;
  onError?: (error: Error) => void;
};
type State = { error: Error | null };

/** Evita que un dato inesperado deje la aplicación completa sin interfaz. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error de interfaz recuperable", error, info);
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-surface-container-low p-6">
        <section className="w-full max-w-xl rounded-xl border border-error-container bg-surface-container-lowest p-6 shadow-card">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-error-container p-2 text-error">
              <Icon name="error" />
            </div>
            <div>
              <h1 className="font-headline text-headline-md font-bold">
                No se pudo mostrar esta vista
              </h1>
              <p className="mt-2 text-body-md text-on-surface-variant">
                La aplicación se mantuvo abierta. Podés reintentar la vista o recargarla; el equipo
                ya puede identificar el error desde la consola.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-hairline px-4 py-2 text-label-md hover:bg-surface-container-low"
              onClick={() => this.setState({ error: null })}
            >
              Reintentar
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-on-primary hover:bg-primary-container"
              onClick={() => window.location.reload()}
            >
              Recargar aplicación
            </button>
          </div>
        </section>
      </main>
    );
  }
}
