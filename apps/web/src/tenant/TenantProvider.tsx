import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasAtLeastRole, type MembershipRole } from "@segevia/shared-types";
import { db } from "../lib/supabase";
import type { Membership, Profile } from "../lib/types";
import { useAuth } from "../auth/AuthProvider";

const STORAGE_KEY = "segevia.activeTenantId";

interface TenantState {
  memberships: Membership[];
  active: Membership | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  setActiveTenant: (tenantId: string) => void;
  can: (min: MembershipRole) => boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantState | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const [preferredId, setPreferredId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );

  const memberships = useQuery({
    queryKey: ["memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db()
        .from("memberships")
        .select("role, tenant:tenants(id, name, slug, plan)")
        .eq("user_id", userId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db()
        .from("profiles")
        .select("id, full_name, job_title, avatar_url")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const list = useMemo(() => memberships.data ?? [], [memberships.data]);

  // El tenant activo siempre se valida contra las membresías reales del usuario.
  const active = useMemo(
    () => list.find((m) => m.tenant.id === preferredId) ?? list[0] ?? null,
    [list, preferredId],
  );

  const setActiveTenant = useCallback(
    (tenantId: string) => {
      if (!list.some((m) => m.tenant.id === tenantId)) return;
      localStorage.setItem(STORAGE_KEY, tenantId);
      setPreferredId(tenantId);
      // Evita mostrar datos de la organización anterior.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === "tenant" });
    },
    [list, qc],
  );

  const value: TenantState = {
    memberships: list,
    active,
    profile: profile.data ?? null,
    loading: memberships.isLoading || profile.isLoading,
    error: (memberships.error as Error | null) ?? null,
    setActiveTenant,
    can: (min) => hasAtLeastRole(active?.role, min),
    refresh: async () => {
      await qc.invalidateQueries({ queryKey: ["memberships", userId] });
    },
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant debe usarse dentro de TenantProvider");
  return ctx;
}

/** Tenant activo garantizado (usar solo bajo RequireTenant). */
export function useActiveTenant() {
  const { active } = useTenant();
  if (!active) throw new Error("No hay organización activa");
  return active;
}
