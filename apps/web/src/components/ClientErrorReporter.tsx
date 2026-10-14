import { useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { APP_VERSION } from "../lib/appInfo";
import { db } from "../lib/supabase";
import { useActiveTenant } from "../tenant/TenantProvider";
import { AppErrorBoundary } from "./AppErrorBoundary";

type ErrorSource = "react" | "window" | "promise";

const sanitizeMessage = (value: unknown) =>
  String(value ?? "Error desconocido")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redactado]")
    .replace(/(?:sk|tvly|eoML|e46e)[-_A-Za-z0-9]{12,}/g, "[redactado]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);

/** Reporta fallos no controlados sin interrumpir el flujo ni guardar contenido sensible. */
export function ClientErrorReporter() {
  const { tenant } = useActiveTenant();
  const location = useLocation();
  const recent = useRef(new Map<string, number>());

  const report = useCallback(
    (source: ErrorSource, reason: unknown) => {
      const message = sanitizeMessage(reason instanceof Error ? reason.message : reason);
      const route = `${location.pathname}${location.search}`.slice(0, 500);
      const fingerprint = `${source}:${route}:${message}`;
      const now = Date.now();
      const previous = recent.current.get(fingerprint);
      if (previous && now - previous < 30_000) return;
      recent.current.set(fingerprint, now);

      void db()
        .functions.invoke("report-client-error", {
          body: {
            tenantId: tenant.id,
            source,
            message,
            route,
            appVersion: APP_VERSION,
          },
        })
        .catch(() => undefined);
    },
    [location.pathname, location.search, tenant.id],
  );

  useEffect(() => {
    const onError = (event: ErrorEvent) => report("window", event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => report("promise", event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report]);

  return (
    <AppErrorBoundary onError={(error) => report("react", error)}>
      <Outlet />
    </AppErrorBoundary>
  );
}
