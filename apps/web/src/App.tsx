import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { env } from "./lib/env";
import { AuthProvider } from "./auth/AuthProvider";
import { TenantProvider } from "./tenant/TenantProvider";
import { RequireAuth, RequireTenant } from "./auth/guards";
import { AppShell } from "./components/layout/AppShell";
import { EnvSetup } from "./pages/EnvSetup";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { ContentStudio } from "./pages/ContentStudio";
import { Inbox } from "./pages/Inbox";
import { Agents } from "./pages/Agents";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import { Integrations } from "./pages/Integrations";
import { Usage } from "./pages/Usage";
import { Settings } from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

export function App() {
  if (!env) {
    return <EnvSetup />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <BrowserRouter>
            <Routes>
              {/* Rutas Públicas */}
              <Route path="/login" element={<Login />} />

              {/* Rutas que requieren autenticación */}
              <Route element={<RequireAuth />}>
                <Route path="/onboarding" element={<Onboarding />} />

                {/* Rutas que requieren organización activa y usan el shell */}
                <Route element={<RequireTenant />}>
                  <Route element={<AppShell />}>
                    <Route index element={<Dashboard />} />
                    <Route path="/content-studio" element={<ContentStudio />} />
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/agentes" element={<Agents />} />
                    <Route path="/knowledge-base" element={<KnowledgeBase />} />
                    <Route path="/integraciones" element={<Integrations />} />
                    <Route path="/consumos" element={<Usage />} />
                    <Route path="/configuracion" element={<Settings />} />
                  </Route>
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
