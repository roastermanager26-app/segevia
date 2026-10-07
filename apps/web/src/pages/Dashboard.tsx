import { useNavigate } from "react-router";
import { formatPct, formatUsd } from "../lib/format";
import { useActiveTenant, useTenant } from "../tenant/TenantProvider";
import { useTenantBudget } from "../components/layout/Sidebar";
import { Badge, Button, Card, Icon } from "../components/ui";

export function Dashboard() {
  const navigate = useNavigate();
  const { tenant } = useActiveTenant();
  const { profile } = useTenant();
  const { data: budget } = useTenantBudget();

  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : "Operador";

  const todayStr = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const formattedDate = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  return (
    <div className="flex flex-col gap-space-xl pb-12">
      {/* SECTION 1: HEADER & HIGH-LEVEL METRICS (Resumen Ejecutivo) */}
      <section className="flex flex-col gap-space-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm">
              <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full font-semibold uppercase">
                {tenant.name} · SEDE OPERATIVA
              </span>
              <span className="text-body-sm text-outline">·</span>
              <span className="tabular text-body-sm text-outline">{formattedDate}</span>
            </div>
            <h1 className="font-headline text-headline-lg text-on-surface font-bold tracking-tight">
              Buen día, {firstName}
            </h1>
            <p className="text-body-md text-on-surface-variant max-w-2xl">
              Aquí está el pulso comercial y la actividad supervisada de tu equipo y agentes IA en {tenant.name}.
            </p>
          </div>

          <div className="flex items-center gap-space-sm self-start lg:self-center">
            <Button
              variant="secondary"
              icon="download"
              onClick={() => alert("Generando reporte de auditoría comercial...")}
            >
              Generar reporte ejecutivo
            </Button>
            <Button
              variant="primary"
              icon="add"
              onClick={() => navigate("/content-studio")}
            >
              Nueva acción rápida
            </Button>
          </div>
        </div>

        {/* Primary Metric Strip (4 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
          {/* KPI 1: Pendiente de Aprobación */}
          <Card className="flex flex-col justify-between gap-space-md">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Pendiente de Aprobación
                </span>
                <span className="font-headline text-headline-md font-bold text-on-surface">
                  6 publicaciones
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                <Icon name="pending_actions" className="text-xl" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <Badge tone="review" icon="bolt">
                  Requiere revisión humana
                </Badge>
              </div>
              <p className="text-body-sm text-on-surface-variant leading-snug">
                3 LinkedIn · 3 Instagram · Próxima salida hoy
              </p>
            </div>
          </Card>

          {/* KPI 2: Conversaciones Activas */}
          <Card className="flex flex-col justify-between gap-space-md">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Conversaciones Activas
                </span>
                <span className="font-headline text-headline-md font-bold text-on-surface">
                  42 en curso
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
                <Icon name="forum" className="text-xl" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <Badge tone="verified" icon="trending_up">
                  +18% vs ayer
                </Badge>
              </div>
              <p className="text-body-sm text-on-surface-variant leading-snug">
                35 atendidas por IA · 7 con operador humano
              </p>
            </div>
          </Card>

          {/* KPI 3: Leads Calificados */}
          <Card className="flex flex-col justify-between gap-space-md">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Leads Calificados (Mes)
                </span>
                <span className="font-headline text-headline-md font-bold text-on-surface">
                  184 leads
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center text-tertiary">
                <Icon name="verified" className="text-xl" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <Badge tone="human" icon="task_alt">
                  Objetivo 85% alcanzado
                </Badge>
              </div>
              <p className="text-body-sm text-on-surface-variant leading-snug">
                Tasa de conversión calificada: 28.4%
              </p>
            </div>
          </Card>

          {/* KPI 4: Consumo Mensual (Datos de Presupuesto Real) */}
          <Card className="flex flex-col justify-between gap-space-md">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Consumo Mensual
                </span>
                <span className="font-headline text-headline-md font-bold text-on-surface tabular">
                  {budget ? formatUsd(budget.spent_usd) : "$0.00 USD"}
                  <span className="text-body-md font-normal text-outline">
                    {" "}
                    / {budget ? formatUsd(budget.limit_usd) : "$0.00"}
                  </span>
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                <Icon name="pie_chart" className="text-xl" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-label-sm">
                <span className="text-secondary font-semibold">
                  {budget ? formatPct(budget.used_pct) : "0%"} del presupuesto
                </span>
                <span className="text-outline">
                  Cupo restante: {budget ? formatUsd(Number(budget.limit_usd) - Number(budget.spent_usd)) : "$0"}
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant leading-snug">
                Modo activo:{" "}
                <strong className="text-on-surface">
                  {budget?.on_exhaust === "degrade"
                    ? "Degradar modelo"
                    : budget?.on_exhaust === "pause"
                    ? "Pausar agente"
                    : "Alertar"}
                </strong>
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* SECTION 2: ACCIONES RÁPIDAS & FLUJOS CLAVE */}
      <section className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="bolt" className="text-primary text-xl" />
            <h2 className="font-headline text-headline-sm font-bold text-on-surface">
              Acciones Rápidas & Flujos Clave
            </h2>
          </div>
          <span className="text-body-sm text-on-surface-variant">
            Acceso directo a herramientas comerciales supervisadas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
          {/* Card Acción 1 */}
          <div
            onClick={() => navigate("/content-studio")}
            className="group cursor-pointer rounded-xl border border-hairline bg-surface-container-lowest p-space-lg shadow-card hover:border-primary-container transition-all flex flex-col justify-between gap-space-md"
          >
            <div className="flex items-start gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <Icon name="edit_note" className="text-xl" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline text-headline-sm font-bold text-on-surface leading-tight">
                  Crear contenido
                </h3>
                <p className="text-body-sm text-on-surface-variant pt-1">
                  Generar posts para LinkedIn o Instagram respetando tu voz de marca y tono institucional.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline text-label-sm">
              <span className="text-primary font-bold">Abrir Content Studio</span>
              <Badge tone="ai" icon="auto_awesome">
                Borradores asistidos
              </Badge>
            </div>
          </div>

          {/* Card Acción 2 */}
          <div
            onClick={() => navigate("/knowledge-base")}
            className="group cursor-pointer rounded-xl border border-hairline bg-surface-container-lowest p-space-lg shadow-card hover:border-primary-container transition-all flex flex-col justify-between gap-space-md"
          >
            <div className="flex items-start gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <Icon name="menu_book" className="text-xl" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline text-headline-sm font-bold text-on-surface leading-tight">
                  Cargar conocimiento
                </h3>
                <p className="text-body-sm text-on-surface-variant pt-1">
                  Subir PDFs, catálogo de precios o sincronizar FAQ para alimentar los agentes de venta.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline text-label-sm">
              <span className="text-primary font-bold">Añadir documentos</span>
              <Badge tone="verified" icon="database">
                RAG Vectorial
              </Badge>
            </div>
          </div>

          {/* Card Acción 3 */}
          <div
            onClick={() => navigate("/inbox")}
            className="group cursor-pointer rounded-xl border border-hairline bg-surface-container-lowest p-space-lg shadow-card hover:border-primary-container transition-all flex flex-col justify-between gap-space-md"
          >
            <div className="flex items-start gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
                <Icon name="chat" className="text-xl" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline text-headline-sm font-bold text-on-surface leading-tight">
                  Ver Inbox
                </h3>
                <p className="text-body-sm text-on-surface-variant pt-1">
                  Atender conversaciones omnicanal que solicitaron cotización directa con ejecutivo humano.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline text-label-sm">
              <span className="text-primary font-bold">Entrar a Inbox</span>
              <Badge tone="human" icon="priority_high">
                3 urgentes
              </Badge>
            </div>
          </div>

          {/* Card Acción 4 */}
          <div
            onClick={() => navigate("/agentes")}
            className="group cursor-pointer rounded-xl border border-hairline bg-surface-container-lowest p-space-lg shadow-card hover:border-primary-container transition-all flex flex-col justify-between gap-space-md"
          >
            <div className="flex items-start gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <Icon name="smart_toy" className="text-xl" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline text-headline-sm font-bold text-on-surface leading-tight">
                  Configurar agente
                </h3>
                <p className="text-body-sm text-on-surface-variant pt-1">
                  Configurar un nuevo bot comercial o calificador de leads con reglas y guardarraíles.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline text-label-sm">
              <span className="text-primary font-bold">Nuevo bot asistido</span>
              <Badge tone="neutral" icon="tune">
                Plantillas listas
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: ACTIVIDAD RECIENTE SUPERVISADA */}
      <section className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="history" className="text-secondary text-xl" />
            <h2 className="font-headline text-headline-sm font-bold text-on-surface">
              Actividad Reciente Supervisada (Human-in-the-Loop)
            </h2>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg text-label-sm">
            <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface font-semibold shadow-xs">
              Todos
            </span>
            <span className="px-2 py-0.5 text-on-surface-variant">Sólo IA</span>
            <span className="px-2 py-0.5 text-on-surface-variant">Intervención Humana</span>
          </div>
        </div>

        <div className="flex flex-col gap-space-sm">
          {/* Feed Item 1 */}
          <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-lowest border border-hairline hover:shadow-card transition-shadow gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary shrink-0">
                <Icon name="chat" className="text-xl" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tabular text-body-sm text-outline">10:42 hs</span>
                  <Badge tone="verified" icon="forum">
                    WhatsApp · Asistente Comercial
                  </Badge>
                  <Badge tone="ai">IA Sugerida · 96%</Badge>
                </div>
                <p className="text-body-md text-on-surface">
                  Calificó a Lead <strong>Gonzalo Méndez (Distribuidora Sur)</strong> como{" "}
                  <strong className="text-secondary">Oportunidad Alta</strong>
                </p>
                <span className="text-body-sm text-on-surface-variant">
                  Presupuesto estimado: <strong>$12,000 USD</strong> · Producto: Abastecimiento Industrial Q1
                </span>
              </div>
            </div>
            <Button variant="secondary" icon="visibility" onClick={() => navigate("/inbox")}>
              Ver chat
            </Button>
          </div>

          {/* Feed Item 2 */}
          <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-lowest border border-hairline hover:shadow-card transition-shadow gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
                <Icon name="auto_fix_high" className="text-xl" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tabular text-body-sm text-outline">09:30 hs</span>
                  <Badge tone="ai" icon="auto_awesome">
                    Content Studio · Especialista IA
                  </Badge>
                  <Badge tone="review">Revisión Pendiente</Badge>
                </div>
                <p className="text-body-md text-on-surface">
                  Generó <strong>2 borradores para LinkedIn</strong> basados en el caso de éxito de Implementación AgroTech.
                </p>
                <span className="text-body-sm text-on-surface-variant">
                  Tono: Autoridad B2B · Citas validadas de métricas de retención
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              icon="check_circle"
              onClick={() => navigate("/content-studio")}
            >
              Revisar y aprobar
            </Button>
          </div>

          {/* Feed Item 3 */}
          <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-lowest border border-hairline hover:shadow-card transition-shadow gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center text-tertiary shrink-0">
                <Icon name="person" className="text-xl" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tabular text-body-sm text-outline">08:15 hs</span>
                  <Badge tone="human" icon="verified_user">
                    Supervisión Humana
                  </Badge>
                  <span className="text-body-sm text-outline">Operador: Sofía Valenzuela</span>
                </div>
                <p className="text-body-md text-on-surface">
                  Tomó <strong>control manual</strong> del chat de <strong>Logística Patagonia</strong> tras solicitud de condiciones contractuales complejas.
                </p>
                <span className="text-body-sm text-secondary font-medium flex items-center gap-1">
                  <Icon name="lock" className="text-sm" /> Modo seguro: IA pausada en este canal
                </span>
              </div>
            </div>
            <Button variant="secondary" icon="tune" onClick={() => navigate("/inbox")}>
              Supervisar
            </Button>
          </div>

          {/* Feed Item 4 */}
          <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-lowest border border-hairline hover:shadow-card transition-shadow gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary shrink-0">
                <Icon name="library_books" className="text-xl" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tabular text-body-sm text-outline">Ayer 19:20 hs</span>
                  <Badge tone="verified" icon="menu_book">
                    Knowledge Base
                  </Badge>
                  <Badge tone="verified">Indexado</Badge>
                </div>
                <p className="text-body-md text-on-surface">
                  Indexación completada: <strong>Tarifario Servicios Q4 2024.pdf</strong>
                </p>
                <span className="text-body-sm text-on-surface-variant">
                  24 fragmentos vectorizados con éxito · Disponibilidad inmediata en agentes comerciales
                </span>
              </div>
            </div>
            <Button variant="secondary" icon="visibility" onClick={() => navigate("/knowledge-base")}>
              Ver fuentes
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
