import { Badge, Button, Card, Icon } from "../components/ui";

export function KnowledgeBase() {
  return (
    <div className="flex flex-col gap-space-lg pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Release 1 · Base de Conocimiento
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Knowledge Base</h1>
          <p className="text-body-md text-on-surface-variant">
            Conocimiento verificado de productos, servicios y condiciones comerciales para tus agentes IA.
          </p>
        </div>

        <Button variant="primary" icon="upload_file">
          Subir documento
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <Card className="lg:col-span-2 flex flex-col gap-space-md">
          <div className="flex items-center justify-between border-b border-hairline pb-space-sm">
            <h2 className="font-headline text-headline-sm font-bold text-on-surface">
              Fuentes Indexadas
            </h2>
            <Badge tone="verified" icon="check_circle">
              RAG Activo
            </Badge>
          </div>

          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low border border-hairline">
              <div className="flex items-center gap-space-md">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary">
                  <Icon name="description" className="text-xl" />
                </div>
                <div>
                  <h4 className="text-label-md font-bold text-on-surface">Tarifario Servicios Q4 2024.pdf</h4>
                  <span className="text-body-sm text-on-surface-variant">24 chunks vectorizados · Actualizado hace 2 días</span>
                </div>
              </div>
              <Badge tone="verified">Indexado</Badge>
            </div>

            <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low border border-hairline">
              <div className="flex items-center gap-space-md">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary">
                  <Icon name="description" className="text-xl" />
                </div>
                <div>
                  <h4 className="text-label-md font-bold text-on-surface">Catalogo_Maquinaria_Industrial.pdf</h4>
                  <span className="text-body-sm text-on-surface-variant">118 chunks vectorizados · Actualizado hace 1 semana</span>
                </div>
              </div>
              <Badge tone="verified">Indexado</Badge>
            </div>

            <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low border border-hairline">
              <div className="flex items-center gap-space-md">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary">
                  <Icon name="help" className="text-xl" />
                </div>
                <div>
                  <h4 className="text-label-md font-bold text-on-surface">Preguntas Frecuentes y Garantías (FAQ)</h4>
                  <span className="text-body-sm text-on-surface-variant">15 pares de preguntas y respuestas verificadas</span>
                </div>
              </div>
              <Badge tone="verified">Indexado</Badge>
            </div>
          </div>
        </Card>

        {/* Panel Probá lo que sabe tu agente */}
        <Card className="flex flex-col gap-space-md">
          <div className="flex items-center gap-2 border-b border-hairline pb-space-sm">
            <Icon name="psychology" className="text-primary text-xl" />
            <h2 className="font-headline text-headline-sm font-bold text-on-surface">
              Probá lo que sabe tu agente
            </h2>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Haz una consulta técnica o de precios para comprobar las citas y fragmentos que recupera el RAG.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Ej. ¿Cuál es el plazo de entrega del generador?"
              className="w-full rounded-lg border border-hairline bg-surface-container-low px-3 py-2 text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button variant="secondary" icon="search" className="w-full">
            Verificar respuesta y citas
          </Button>
        </Card>
      </div>
    </div>
  );
}
