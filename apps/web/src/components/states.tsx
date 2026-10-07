import type { ReactNode } from "react";
import { Button, Icon } from "./ui";

/** Estados obligatorios de interfaz (design.md §2): cargando, vacío, error, sin permisos. */

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-space-sm py-16 text-on-surface-variant">
      <Icon name="progress_activity" className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-space-sm px-space-lg py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-primary">
        <Icon name={icon} />
      </div>
      <h3 className="text-headline-sm text-on-surface">{title}</h3>
      {description && <p className="max-w-md text-body-md text-on-surface-variant">{description}</p>}
      {action && <div className="pt-space-sm">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return (
    <div role="alert" className="flex flex-col items-center gap-space-sm py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error-container text-error">
        <Icon name="error" />
      </div>
      <h3 className="text-headline-sm">No pudimos cargar esta sección</h3>
      <p className="max-w-md text-body-md text-on-surface-variant">{message}</p>
      {onRetry && (
        <Button variant="secondary" icon="refresh" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function ForbiddenState() {
  return (
    <EmptyState
      icon="lock"
      title="No tenés permisos para esta sección"
      description="Pedile a un administrador de tu organización que te asigne un rol con acceso."
    />
  );
}
