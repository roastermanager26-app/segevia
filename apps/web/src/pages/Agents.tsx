import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useActiveTenant } from "../tenant/TenantProvider";
import { isDemoTenant } from "../lib/demo";
import { Badge, Button, Card, Icon } from "../components/ui";

interface AgentItem {
  id: string;
  name: string;
  role: string;
  model: string;
  channel: string;
  description: string;
  status: "active" | "standby";
}

const TEMPLATE_AGENTS: AgentItem[] = [
  {
    id: "whatsapp-commercial",
    name: "Asistente Comercial WhatsApp",
    role: "Calificación y Catálogo",
    model: "Google Gemini 2.5 Flash",
    channel: "WhatsApp",
    description:
      "Atiende consultas entrantes de catálogo, responde preguntas de precios desde la Knowledge Base y califica la intención de compra.",
    status: "active",
  },
  {
    id: "content-b2b",
    name: "Especialista de Contenido B2B",
    role: "Content Studio & Redes",
    model: "Claude 3.5 Sonnet",
    channel: "Content Studio (LinkedIn / IG)",
    description:
      "Investiga tendencias de mercado vía Tavily, enlaza conceptos con la identidad de marca y redacta borradores para redes sociales.",
    status: "active",
  },
  {
    id: "lead-qualifier",
    name: "Calificador de Oportunidades BANT",
    role: "Pipeline & CRM",
    model: "GPT-4o Mini",
    channel: "Inbox Omnicanal",
    description:
      "Evalúa presupuesto (Budget), autoridad de decisión (Authority), necesidad (Need) y plazos (Timeline) antes de derivar al ejecutivo humano.",
    status: "standby",
  },
];

export function Agents() {
  const { session } = useAuth();
  const { tenant } = useActiveTenant();
  const isDemo = isDemoTenant(tenant, session?.user?.email);

  const [activeAgents, setActiveAgents] = useState<AgentItem[]>(TEMPLATE_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);

  const toggleAgent = (id: string) => {
    setActiveAgents((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === "active" ? "standby" : "active" } : a
      )
    );
  };

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      {isDemo && (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-body-sm">
          <div className="flex items-center gap-2.5">
            <Icon name="info" className="text-amber-600 text-lg shrink-0" />
            <span>
              <strong>Modo Demostración:</strong> Mostrando agentes comerciales preconfigurados de prueba.
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Configuración de Agentes
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Agentes de Venta IA</h1>
          <p className="text-body-md text-on-surface-variant">
            Administra los roles, prompts, modelos asignados y herramientas de tus agentes en {tenant.name}.
          </p>
        </div>

        <Button
          variant="primary"
          icon="add"
          onClick={() => alert("Asistente de creación de agentes: define rol, canal, guardarraíles y temperatura.")}
        >
          Crear nuevo agente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {activeAgents.map((agent) => {
          const isActive = agent.status === "active";

          return (
            <Card key={agent.id} className="flex flex-col justify-between gap-space-md">
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <Badge tone={isActive ? "verified" : "neutral"} icon={isActive ? "check_circle" : "pause"}>
                    {isActive ? "Activo" : "En pausa"}
                  </Badge>
                  <span className="text-body-sm text-outline font-medium">{agent.model}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                    {agent.name}
                  </h3>
                  <span className="text-xs font-semibold uppercase text-secondary tracking-wider">
                    {agent.role}
                  </span>
                  <p className="text-body-sm text-on-surface-variant pt-1">{agent.description}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-hairline">
                <div className="flex items-center justify-between text-body-sm text-outline">
                  <span>Canal asignado:</span>
                  <strong className="text-on-surface font-semibold">{agent.channel}</strong>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant={isActive ? "secondary" : "primary"}
                    className="flex-1 text-label-sm"
                    onClick={() => toggleAgent(agent.id)}
                  >
                    {isActive ? "Pausar bot" : "Activar bot"}
                  </Button>
                  <Button
                    variant="secondary"
                    icon="tune"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    Reglas
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal de edición de reglas */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-hairline p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Icon name="smart_toy" className="text-primary text-xl" />
                <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                  Reglas y Guardarraíles · {selectedAgent.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-body-sm text-on-surface">
              <p className="text-on-surface-variant">
                Configura los límites operativos y la política de atención de este agente para <strong>{tenant.name}</strong>.
              </p>

              <div className="p-3 rounded-xl bg-surface-container-low border border-hairline flex flex-col gap-2">
                <span className="font-semibold text-primary">Política Human-in-the-Loop</span>
                <p className="text-xs text-on-surface-variant">
                  Si un prospecto solicita una cotización superior al umbral o términos contractuales especiales, el agente transfiere el control de forma inmediata al operador humano.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-hairline flex flex-col gap-2">
                <span className="font-semibold text-secondary">Fundamentación obligatoria</span>
                <p className="text-xs text-on-surface-variant">
                  Cualquier afirmación de precios o especificaciones debe provenir de documentos activos en la Knowledge Base. Sin coincidencia, el bot debe indicar que consultará con un asesor.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <Button variant="primary" onClick={() => setSelectedAgent(null)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
