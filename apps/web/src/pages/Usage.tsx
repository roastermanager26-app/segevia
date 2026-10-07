import { formatPct, formatUsd } from "../lib/format";
import { useActiveTenant } from "../tenant/TenantProvider";
import { useTenantBudget } from "../components/layout/Sidebar";
import { Badge, Button, Card, Icon } from "../components/ui";

export function Usage() {
  const { tenant } = useActiveTenant();
  const { data: budget } = useTenantBudget();

  return (
    <div className="flex flex-col gap-space-lg pb-12">
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

        <Button variant="secondary" icon="tune">
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
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-2.5 px-3 font-medium">Google Gemini</td>
                <td className="py-2.5 px-3">generate (RAG)</td>
                <td className="py-2.5 px-3 text-outline">output_tokens</td>
                <td className="py-2.5 px-3 text-right tabular">120,000</td>
                <td className="py-2.5 px-3 text-right tabular font-semibold">$12.40</td>
              </tr>
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-2.5 px-3 font-medium">Fal.ai (Flux)</td>
                <td className="py-2.5 px-3">image (Post LinkedIn)</td>
                <td className="py-2.5 px-3 text-outline">image</td>
                <td className="py-2.5 px-3 text-right tabular">40</td>
                <td className="py-2.5 px-3 text-right tabular font-semibold">$9.60</td>
              </tr>
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-2.5 px-3 font-medium">Tavily Search</td>
                <td className="py-2.5 px-3">search (Tendencias)</td>
                <td className="py-2.5 px-3 text-outline">search</td>
                <td className="py-2.5 px-3 text-right tabular">300</td>
                <td className="py-2.5 px-3 text-right tabular font-semibold">$4.50</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
