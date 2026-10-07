import { NavLink } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "../../lib/supabase";
import { formatPct, formatUsd } from "../../lib/format";
import type { BudgetStatus } from "../../lib/types";
import { useActiveTenant } from "../../tenant/TenantProvider";
import { Icon, cx } from "../ui";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Inicio", icon: "dashboard", end: true },
  { to: "/content-studio", label: "Content Studio", icon: "auto_fix_high" },
  { to: "/inbox", label: "Inbox", icon: "forum" },
  { to: "/agentes", label: "Agentes", icon: "smart_toy" },
  { to: "/knowledge-base", label: "Knowledge Base", icon: "menu_book" },
  { to: "/integraciones", label: "Integraciones", icon: "extension" },
  { to: "/consumos", label: "Consumos", icon: "query_stats" },
  { to: "/configuracion", label: "Configuración", icon: "settings" },
] as const;

export function useTenantBudget() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["tenant", tenant.id, "budget-status"],
    queryFn: async () => {
      const { data, error } = await db().rpc("tenant_budget_status", { p_tenant_id: tenant.id });
      if (error) throw error;
      return ((data ?? []) as BudgetStatus[]).find((b) => b.scope === "tenant") ?? null;
    },
  });
}

function BudgetWidget() {
  const { data: budget, isLoading } = useTenantBudget();
  const pct = Math.min(100, Number(budget?.used_pct ?? 0));

  return (
    <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
          </span>
          <span className="text-label-sm text-on-surface">IA Supervisada</span>
        </div>
        <span className="rounded bg-secondary-fixed/50 px-1.5 py-0.5 text-label-sm text-secondary">Activa</span>
      </div>
      {isLoading ? (
        <div className="h-10 animate-pulse rounded bg-surface-container" />
      ) : budget ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
            <span>Presupuesto mensual</span>
            <span className="tabular text-code-num text-on-surface">{formatPct(budget.used_pct)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className={cx("h-full rounded-full", pct >= 90 ? "bg-error" : pct >= 75 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="tabular text-body-sm text-outline">
            {formatUsd(budget.spent_usd)} / {formatUsd(budget.limit_usd)}
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">Sin presupuesto configurado.</p>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 select-none flex-col justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-space-sm px-space-lg pb-space-md pt-space-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low">
            <Icon name="auto_awesome" className="text-2xl text-primary" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-headline text-headline-sm font-bold uppercase leading-none tracking-tight">SEGEVIA</span>
            <span className="truncate pt-0.5 text-body-sm text-on-surface-variant" title="Gestión comercial impulsada por IA">
              Gestión comercial IA
            </span>
          </div>
        </div>
        <div className="px-space-md py-space-xs">
          <div className="h-px bg-surface-container" />
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-space-xs overflow-y-auto px-space-md py-space-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-space-sm rounded-lg px-space-md py-space-sm text-label-md transition-colors",
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                )
              }
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-space-md">
        <BudgetWidget />
      </div>
    </aside>
  );
}
