import { Badge, Button, Card, Icon } from "../components/ui";

export function Agents() {
  return (
    <div className="flex flex-col gap-space-lg pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Configuración de Agentes
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Agentes de Venta IA</h1>
          <p className="text-body-md text-on-surface-variant">
            Administra los roles, prompts, modelos asignados y herramientas de tus agentes.
          </p>
        </div>

        <Button variant="primary" icon="add">
          Crear nuevo agente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <Card className="flex flex-col justify-between gap-space-md">
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <Badge tone="verified" icon="check_circle">
                Activo
              </Badge>
              <span className="text-body-sm text-outline">Gemini 2.5 Flash</span>
            </div>
            <h3 className="font-headline text-headline-sm font-bold text-on-surface">
              Asistente Comercial WhatsApp
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              Atiende consultas entrantes de catálogo, responde preguntas de precios desde la Knowledge Base y califica la intención de compra.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-hairline">
            <span className="text-body-sm text-outline">Canal: WhatsApp</span>
            <Button variant="secondary" className="text-label-sm">
              Editar reglas
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col justify-between gap-space-md">
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <Badge tone="ai" icon="auto_awesome">
                Activo
              </Badge>
              <span className="text-body-sm text-outline">Claude 3.5 Sonnet</span>
            </div>
            <h3 className="font-headline text-headline-sm font-bold text-on-surface">
              Especialista de Contenido B2B
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              Investiga tendencias de mercado vía Tavily, enlaza conceptos con la identidad de marca y redacta borradores para LinkedIn.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-hairline">
            <span className="text-body-sm text-outline">Módulo: Content Studio</span>
            <Button variant="secondary" className="text-label-sm">
              Editar reglas
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
