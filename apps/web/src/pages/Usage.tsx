import { useQuery } from "@tanstack/react-query";
import { formatPct, formatUsd } from "../lib/format";
import { db } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useActiveTenant } from "../tenant/TenantProvider";
import { useTenantBudget } from "../components/layout/Sidebar";
import { isDemoTenant } from "../lib/demo";
import { Badge, Button, Card, Icon } from "../components/ui";

interface UsageEventRecord {
  id: number;
  tenant_id: string;
  provider: string;
  model: string | null;
  operation: string;
  unit_type: string;
  units: number;
  cost_usd: string | number;
  created_at: string;
}

const DEMO_USAGE_EVENTS: UsageEventRecord[] = [
  {
    id: 1,
    tenant_id: "demo",
    provider: "Google Gemini",
    model: "gemini-2.5-flash",
    operation: "generate (RAG)",
    unit_type: "output_tokens",
    units: 120000,
    cost_usd: 12.4,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    tenant_id: "demo",
    provider: "Fal.ai",
    model: "flux-schnell",
    operation: "image (Post LinkedIn)",
    unit_type: "image",
    units: 40,
    cost_usd: 9.6,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 3,
    tenant_id: "demo",
    provider: "Tavily Search",
    model: null,
    operation: "search (Tendencias)",
    unit_type: "search",
    units: 300,
    cost_usd: 4.5,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

export function Usage() {
  const { session } = useAuth();
  const { tenant } = useActiveTenant();
  const { data: budget } = useTenantBudget();

  const isDemo = isDemoTenant(tenant, session?.user?.email);

  // Consulta de eventos reales de uso desde Supabase
  const { data: realEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["tenant", tenant.id, "usage-events"],
    queryFn: async () => {
      const { data, error } = await db()
        .from("usage_events")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as UsageEventRecord[];
    },
  });

  const displayEvents = isDemo && realEvents.length === 0 ? DEMO_USAGE_EVENTS : realEvents;

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      {isDemo && (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-body-sm">
          <div className="flex items-center gap-2.5">
            <Icon name="info" className="text-amber-600 text-lg shrink-0" />
            <span>
              <strong>Modo Demostración:</strong> Viendo consumos simulados del seed de desarrollo.
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Control de Consumos & Costos
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">
            Consumos y Presupuesto
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Trazabilidad inmutable de tokens, imágenes generadas, minutos de voz y límites por organización.
          </p>
        </div>

        <Button variant="secondary" icon="tune" onClick={() => alert("El presupuesto mensual actual es administrado por el Owner de la organización.")}>
          Modificar presupuesto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <Card className="flex flex-col justify-between gap-space-md">
          <span className="text-label-sm font-semibold uppercase text-outline">Gasto Mes Actual</span>
          <h3 className="font-headline text-headline-md font-bold text-on-surface tabular">
            {budget ? formatUsd(budget.spent_usd) : "$0.00 USD"}
          </h3>
          <span className="text-body-sm text-on-surface-variant">
            Límite configurado: {budget ? formatUsd(budget.limit_usd) : "$0.00"}
          </span>
        </Card>

        <Card className="flex flex-col justify-between gap-space-md">
          <span className="text-label-sm font-semibold uppercase text-outline">Porcentaje Utilizado</span>
          <h3 className="font-headline text-headline-md font-bold text-secondary tabular">
            {budget ? formatPct(budget.used_pct) : "0%"}
          </h3>
          <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full"
              style={{ width: `${Math.min(100, Number(budget?.used_pct ?? 0))}%` }}
            />
          </div>
        </Card>

        <Card className="flex flex-col justify-between gap-space-md">
          <span className="text-label-sm font-semibold uppercase text-outline">Regla al Agotar</span>
          <div className="flex items-center gap-2">
            <Badge tone="human" icon="shield">
              {budget?.on_exhaust === "degrade"
                ? "Degradar modelo"
                : budget?.on_exhaust === "pause"
                ? "Pausar agente"
                : "Alertar al administrador"}
            </Badge>
          </div>
          <span className="text-body-sm text-outline">Garantiza cero sobrecostos sorpresa</span>
        </Card>
      </div>

      <Card className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between border-b border-hairline pb-space-sm">
          <h3 className="font-headline text-headline-sm font-bold text-on-surface">
            Historial de Consumo (Ledger Inmutable)
          </h3>
          <span className="text-body-sm text-outline">Filtrado por: {tenant.name}</span>
        </div>

        {loadingEvents ? (
          <div className="py-8 text-center text-body-sm text-on-surface-variant">
            Cargando historial de consumos...
          </div>
        ) : displayEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-hairline text-outline uppercase font-semibold text-xs">
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">Operación</th>
                  <th className="py-2.5 px-3">Unidad</th>
                  <th className="py-2.5 px-3 text-right">Cantidad</th>
                  <th className="py-2.5 px-3 text-right">Costo USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {displayEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-2.5 px-3 font-medium">
                      {evt.provider} {evt.model ? `(${evt.model})` : ""}
                    </td>
                    <td className="py-2.5 px-3">{evt.operation}</td>
                    <td className="py-2.5 px-3 text-outline">{evt.unit_type}</td>
                    <td className="py-2.5 px-3 text-right tabular">
                      {Number(evt.units).toLocaleString("es-AR")}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular font-semibold">
                      {formatUsd(evt.cost_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary mb-1">
              <Icon name="receipt_long" className="text-2xl" />
            </div>
            <h4 className="font-headline text-headline-sm font-bold text-on-surface">
              Sin consumos registrados aún
            </h4>
            <p className="text-body-sm text-on-surface-variant max-w-md">
              Aún no se han ejecutado llamadas a modelos en <strong>{tenant.name}</strong>. Cada generación en Content Studio o respuesta de agente quedará registrada aquí con su costo exacto en dólares.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
