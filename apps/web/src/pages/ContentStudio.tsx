import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useActiveTenant } from "../tenant/TenantProvider";
import { isDemoTenant } from "../lib/demo";
import { Badge, Button, Card, Icon } from "../components/ui";

export function ContentStudio() {
  const { session } = useAuth();
  const { tenant } = useActiveTenant();
  const isDemo = isDemoTenant(tenant, session?.user?.email);

  const [selectedChannel, setSelectedChannel] = useState<"all" | "linkedin" | "instagram">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [topic, setTopic] = useState("");
  const [channel, setChannel] = useState<"linkedin" | "instagram">("linkedin");
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdDraft, setCreatedDraft] = useState<string | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setCreatedDraft(
        `[Borrador generado para ${channel.toUpperCase()} en ${tenant.name}]\n\n🚀 Innovación y rigor comercial en B2B: ¿Por qué la supervisión humana es la clave del éxito comercial?\n\nAl integrar inteligencia artificial en tus procesos de venta, la certeza de la información y la voz de marca son innegociables.\n\nEn ${tenant.name}, capacitamos agentes que investigan y fundamentan cada argumento con datos reales de tu empresa.\n\n#B2BSales #AI #SEGEVIA #InnovacionComercial`
      );
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      {isDemo && (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-body-sm">
          <div className="flex items-center gap-2.5">
            <Icon name="info" className="text-amber-600 text-lg shrink-0" />
            <span>
              <strong>Modo Demostración:</strong> Mostrando borradores y radar de tendencias de prueba.
            </span>
          </div>
        </div>
      )}

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
            Generación y auditoría de contenido comercial fundamentado para {tenant.name}.
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
              Todos <span className="px-1.5 py-0.5 rounded-full bg-surface-container text-xs">{isDemo ? "18" : createdDraft ? "1" : "0"}</span>
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
              LinkedIn <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-xs">{isDemo ? "12" : channel === "linkedin" && createdDraft ? "1" : "0"}</span>
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
              Instagram <span className="px-1.5 py-0.5 rounded-full bg-pink-50 text-xs">{isDemo ? "6" : channel === "instagram" && createdDraft ? "1" : "0"}</span>
            </button>
          </div>

          <Button variant="primary" icon="add" onClick={() => setShowCreateModal(true)}>
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
                {isDemo
                  ? "3 contenidos esperando tu aprobación para salir esta semana"
                  : createdDraft
                  ? "1 nuevo borrador listo para tu revisión y aprobación"
                  : "0 contenidos pendientes de aprobación. Todo al día."}
              </span>
              <Badge tone="verified">
                {isDemo ? "Listo para auditoría" : "Supervisión activa"}
              </Badge>
            </div>
            <span className="text-body-sm text-on-surface-variant">
              Garantía de voz de marca: 100% verificado contra las directrices de {tenant.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge tone="human" icon="rule">
            Supervisión humana requerida
          </Badge>
        </div>
      </div>

      {/* Borrador recién creado */}
      {createdDraft && (
        <Card className="flex flex-col gap-space-md border-primary-container bg-primary-fixed/5">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <div className="flex items-center gap-2">
              <Badge tone="ai" icon="auto_awesome">
                Borrador generado con IA
              </Badge>
              <span className="text-body-sm text-on-surface font-semibold uppercase">{channel}</span>
            </div>
            <Button variant="primary" icon="check" onClick={() => alert("Publicación aprobada y guardada.")}>
              Aprobar y guardar
            </Button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-body-md text-on-surface bg-surface-container-lowest p-4 rounded-xl border border-hairline">
            {createdDraft}
          </pre>
        </Card>
      )}

      {/* MODO DEMO: Radar de Tendencias Mock */}
      {isDemo ? (
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
                <span className="text-primary font-bold cursor-pointer hover:underline" onClick={() => { setTopic("WhatsApp Commerce para PyMEs B2B"); setShowCreateModal(true); }}>
                  Crear borrador →
                </span>
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
                <span className="text-primary font-bold cursor-pointer hover:underline" onClick={() => { setTopic("Human-in-the-loop y supervisión de IA"); setShowCreateModal(true); }}>
                  Crear borrador →
                </span>
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
                <span className="text-primary font-bold cursor-pointer hover:underline" onClick={() => { setTopic("Buenas prácticas comerciales por WhatsApp"); setChannel("instagram"); setShowCreateModal(true); }}>
                  Crear borrador →
                </span>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        /* MODO REAL: Espacio de creación real */
        !createdDraft && (
          <Card className="flex flex-col items-center justify-center p-12 text-center gap-4 border-dashed border-2">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary">
              <Icon name="edit_note" className="text-3xl" />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                Comienza a generar contenido para {tenant.name}
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Crea publicaciones B2B fundamentadas con tus fuentes de conocimiento, voz de marca y supervisión humana.
              </p>
            </div>
            <Button
              variant="primary"
              icon="add"
              className="mt-2"
              onClick={() => setShowCreateModal(true)}
            >
              Crear primer borrador asistido
            </Button>
          </Card>
        )
      )}

      {/* Modal para crear contenido */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-hairline p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Icon name="auto_awesome" className="text-primary text-xl" />
                <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                  Crear nuevo contenido asistido
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center"
              >
                <Icon name="close" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-semibold text-on-surface">
                  Canal de publicación
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel("linkedin")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-label-md font-semibold ${
                      channel === "linkedin"
                        ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]"
                        : "border-hairline text-on-surface-variant"
                    }`}
                  >
                    LinkedIn (B2B)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("instagram")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-label-md font-semibold ${
                      channel === "instagram"
                        ? "border-pink-600 bg-pink-50 text-pink-700"
                        : "border-hairline text-on-surface-variant"
                    }`}
                  >
                    Instagram
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-semibold text-on-surface">
                  Idea central o tema del post
                </label>
                <textarea
                  required
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej. Anuncio de nueva solución logística con reducción de costos del 20%..."
                  className="w-full p-3 rounded-lg border border-hairline bg-surface-container-low text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" loading={isGenerating} icon="auto_awesome">
                  Generar borrador supervisado
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
