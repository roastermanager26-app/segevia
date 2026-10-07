import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import type { MembershipRole } from "../lib/types";
import { useAuth } from "./AuthProvider";
import { useTenant } from "../tenant/TenantProvider";
import { ErrorState, ForbiddenState, LoadingState } from "../components/states";

/** Exige sesión iniciada. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Verificando sesión…" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Exige al menos una organización; si no hay, envía al onboarding. */
export function RequireTenant() {
  const { active, loading, error, refresh } = useTenant();
  if (loading) return <LoadingState label="Cargando organización…" />;
  if (error) return <ErrorState error={error} onRetry={() => void refresh()} />;
  if (!active) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/**
 * Guard de UI por rol. La autorización real ocurre en Postgres (RLS);
 * esto solo evita mostrar pantallas que el usuario no podría operar.
 */
export function RequireRole({ min, children }: { min: MembershipRole; children: ReactNode }) {
  const { can } = useTenant();
  return can(min) ? <>{children}</> : <ForbiddenState />;
}
