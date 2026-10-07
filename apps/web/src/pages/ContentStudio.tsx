import { useState } from "react";
import { Badge, Button, Card, Icon } from "../components/ui";

export function ContentStudio() {
  const [selectedChannel, setSelectedChannel] = useState<"all" | "linkedin" | "instagram">("all");

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Release 3 · Content Studio MVP
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Content Studio</h1>
          <p className="text-body-md text-on-surface-variant">
            Generación y auditoría de contenido comercial fundamentado para redes B2B.
          </p>
        </div>

        <div className="flex items-center gap-space-sm">
          {/* Channel Selector Tabs */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-hairline gap-1">
            <button
              type="button"
              onClick={() => setSelectedChannel("all")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-label-md font-semibold transition-all ${
                selectedChannel === "all"
                  ? "bg-surface-container-lowest text-on-surface shadow-xs border border-hairline"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Todos <span className="px-1.5 py-0.5 rounded-full bg-surface-container text-xs">18</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedChannel("linkedin")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-label-md font-semibold transition-all ${
                selectedChannel === "linkedin"
                  ? "bg-surface-container-lowest text-[#0a66c2] shadow-xs border border-hairline"
                  : "text-on-surface-variant hover:text-[#0a66c2]"
              }`}
            >
              <span className="flex items-center justify-center w-4 h-4 rounded bg-[#0a66c2] text-white text-[10px]">
                in
              </span>
              LinkedIn <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-xs">12</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedChannel("instagram")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-label-md font-semibold transition-all ${
                selectedChannel === "instagram"
                  ? "bg-surface-container-lowest text-pink-700 shadow-xs border border-hairline"
                  : "text-on-surface-variant hover:text-pink-600"
              }`}
            >
              <Icon name="photo_camera" className="text-sm text-pink-600" />
              Instagram <span className="px-1.5 py-0.5 rounded-full bg-pink-50 text-xs">6</span>
            </button>
          </div>

          <Button variant="primary" icon="add">
            Nuevo contenido
          </Button>
        </div>
      </div>

      {/* Governance Summary Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-surface-container-low/80 border border-hairline rounded-xl gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-on-primary font-bold shadow-sm shrink-0">
            <Icon name="verified" className="text-2xl" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-label-md font-semibold text-on-surface">
                3 contenidos esperando tu aprobación para salir esta semana
              </span>
              <Badge tone="verified">Listo para auditoría</Badge>
            </div>
            <span className="text-body-sm text-on-surface-variant">
              Garantía de voz de marca: 100% verificado contra la Knowledge Base
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge tone="human" icon="rule">
            Supervisión humana requerida
          </Badge>
        </div>
      </div>

      {/* Radar de Tendencias */}
      <Card className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between border-b border-hairline pb-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary-fixed text-tertiary">
              <Icon name="insights" className="text-2xl" />
            </div>
            <div>
              <h2 className="font-headline text-headline-sm font-bold text-on-surface">
                Radar de Tendencias & Oportunidades
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                Detección automática en medios sectoriales B2B y transcripciones comerciales
              </p>
            </div>
          </div>
          <Button variant="secondary" icon="refresh">
            Escanear ahora
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low/70 border border-hairline gap-3 hover:border-primary-container transition-colors">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge tone="verified" icon="trending_up">
                  Alta relevancia (+45%)
                </Badge>
                <span className="text-body-sm text-outline font-mono text-xs">Statista / TechLatam</span>
              </div>
              <h4 className="text-label-md font-bold text-on-surface leading-snug">
                Interés en WhatsApp Commerce creció un 45% en sector PyME
              </h4>
              <p className="text-body-sm text-on-surface-variant">
                Las empresas buscan cerrar cotizaciones directamente en el chat sin derivar a formularios fríos.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline text-label-sm">
              <span className="text-tertiary font-medium">Sugerido: LinkedIn Post</span>
              <span className="text-primary font-bold cursor-pointer hover:underline">Crear borrador →</span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low/70 border border-hairline gap-3 hover:border-primary-container transition-colors">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge tone="ai" icon="psychology">
                  Tendencia Editorial
                </Badge>
                <span className="text-body-sm text-outline font-mono text-xs">Harvard Business Review</span>
              </div>
              <h4 className="text-label-md font-bold text-on-surface leading-snug">
                Preocupación por alucinaciones: auge del Human-in-the-Loop
              </h4>
              <p className="text-body-sm text-on-surface-variant">
                Por qué la supervisión humana es el factor decisivo de adopción en empresas industriales.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline text-label-sm">
              <span className="text-tertiary font-medium">Sugerido: LinkedIn Post</span>
              <span className="text-primary font-bold cursor-pointer hover:underline">Crear borrador →</span>
            </div>
          </div>

          <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low/70 border border-hairline gap-3 hover:border-primary-container transition-colors">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge tone="human" icon="dataset">
                  Dato Interno CRM
                </Badge>
                <span className="text-body-sm text-outline font-mono text-xs">12 chats ganados</span>
              </div>
              <h4 className="text-label-md font-bold text-on-surface leading-snug">
                Tips de negociación en WhatsApp para cotizaciones consultivas
              </h4>
              <p className="text-body-sm text-on-surface-variant">
                Patrón detectado en ventas cerradas por el equipo comercial durante el último trimestre.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline text-label-sm">
              <span className="text-pink-700 font-medium">Sugerido: Instagram Carousel</span>
              <span className="text-primary font-bold cursor-pointer hover:underline">Crear borrador →</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
