import { Badge, Button, Card, Icon } from "../components/ui";

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  category: "LLM" | "Canal" | "Búsqueda e Imagen" | "CRM" | "Telefonía";
  status: "connected" | "disconnected" | "error";
  description: string;
  lastSynced?: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: "openrouter",
    provider: "openrouter",
    name: "OpenRouter",
    category: "LLM",
    status: "connected",
    description: "Gateway multimodelo unificado (Claude 3.5 Sonnet, GPT-4o, Gemini 2.5).",
    lastSynced: "Activo",
  },
  {
    id: "gemini",
    provider: "google",
    name: "Google Gemini 2.5 Flash",
    category: "LLM",
    status: "connected",
    description: "Modelo directo de ultra baja latencia para RAG y respuestas rápidas.",
    lastSynced: "Activo",
  },
  {
    id: "tavily",
    provider: "tavily",
    name: "Tavily Search API",
    category: "Búsqueda e Imagen",
    status: "connected",
    description: "Búsqueda y rastreo de tendencias del sector en tiempo real para Content Studio.",
    lastSynced: "Hace 15 min",
  },
  {
    id: "fal",
    provider: "fal",
    name: "Fal.ai (Flux Pro)",
    category: "Búsqueda e Imagen",
    status: "connected",
    description: "Motor de síntesis visual hiperrealista para publicaciones de LinkedIn e Instagram.",
    lastSynced: "Activo",
  },
  {
    id: "meta",
    provider: "meta",
    name: "WhatsApp Cloud API & Instagram",
    category: "Canal",
    status: "disconnected",
    description: "Conexión a Meta Business Manager para conversaciones automáticas y publicaciones.",
  },
  {
    id: "linkedin",
    provider: "linkedin",
    name: "LinkedIn API",
    category: "Canal",
    status: "disconnected",
    description: "Publicación directa y métricas de alcance en perfiles de empresa o personales.",
  },
  {
    id: "crm",
    provider: "crm",
    name: "CRM Propietario",
    category: "CRM",
    status: "disconnected",
    description: "Sincronización bidireccional de leads, estados BANT y notas de interacciones.",
  },
  {
    id: "vapi",
    provider: "vapi",
    name: "Vapi / Retell (Telefonía IA)",
    category: "Telefonía",
    status: "disconnected",
    description: "Infraestructura para llamadas entrantes y campañas de cold calling.",
  },
];

export function Integrations() {
  return (
    <div className="flex flex-col gap-space-lg pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Credenciales & Proveedores
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Integraciones</h1>
          <p className="text-body-md text-on-surface-variant">
            Conecta tus proveedores de inteligencia artificial, canales de mensajería y sistemas externos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
        {INTEGRATIONS.map((item) => (
          <Card key={item.id} className="flex flex-col justify-between gap-space-md">
            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="text-label-sm font-semibold uppercase text-outline">
                  {item.category}
                </span>
                {item.status === "connected" ? (
                  <Badge tone="verified" icon="check_circle">
                    Conectado
                  </Badge>
                ) : (
                  <Badge tone="neutral" icon="link_off">
                    Desconectado
                  </Badge>
                )}
              </div>
              <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                {item.name}
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                {item.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-space-sm border-t border-hairline">
              <span className="text-body-sm text-outline">
                {item.lastSynced ? `Estado: ${item.lastSynced}` : "No configurado"}
              </span>
              <Button
                variant={item.status === "connected" ? "secondary" : "primary"}
                className="text-label-sm"
              >
                {item.status === "connected" ? "Configurar" : "Conectar"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
