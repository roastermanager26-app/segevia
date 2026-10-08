import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useActiveTenant } from "../tenant/TenantProvider";
import { isDemoTenant } from "../lib/demo";
import { Badge, Button, Card, Icon } from "../components/ui";

interface DemoDoc {
  id: string;
  title: string;
  detail: string;
  icon: string;
}

const DEMO_DOCS: DemoDoc[] = [
  {
    id: "1",
    title: "Tarifario Servicios Q4 2024.pdf",
    detail: "24 chunks vectorizados · Actualizado hace 2 días",
    icon: "description",
  },
  {
    id: "2",
    title: "Catalogo_Maquinaria_Industrial.pdf",
    detail: "118 chunks vectorizados · Actualizado hace 1 semana",
    icon: "description",
  },
  {
    id: "3",
    title: "Preguntas Frecuentes y Garantías (FAQ)",
    detail: "15 pares de preguntas y respuestas verificadas",
    icon: "help",
  },
];

export function KnowledgeBase() {
  const { session } = useAuth();
  const { tenant } = useActiveTenant();
  const isDemo = isDemoTenant(tenant, session?.user?.email);

  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestSearch = () => {
    if (!testQuery.trim()) return;
    if (isDemo) {
      setTestResult(
        "Fragmento encontrado [Tarifario Servicios Q4 2024.pdf #chunk-4]: 'El plazo de entrega estándar en planta es de 72 a 96 horas hábiles tras la confirmación de la orden de compra.' (Similitud semántica: 94.2%)"
      );
    } else {
      setTestResult(
        `Búsqueda en ${tenant.name}: No se encontraron fragmentos coincidentes porque aún no has indexado documentos en esta organización.`
      );
    }
  };

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      {isDemo && (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-body-sm">
          <div className="flex items-center gap-2.5">
            <Icon name="info" className="text-amber-600 text-lg shrink-0" />
            <span>
              <strong>Modo Demostración:</strong> Mostrando fuentes de conocimiento ficticias indexadas.
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Release 1 · Base de Conocimiento
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Knowledge Base</h1>
          <p className="text-body-md text-on-surface-variant">
            Conocimiento verificado de productos, servicios y condiciones comerciales para tus agentes IA en {tenant.name}.
          </p>
        </div>

        <Button
          variant="primary"
          icon="upload_file"
          onClick={() => alert("Módulo de subida directa: selecciona PDFs o TXTs para iniciar la vectorización RAG.")}
        >
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
              {isDemo ? "RAG Activo" : "RAG Preparado"}
            </Badge>
          </div>

          {isDemo ? (
            <div className="flex flex-col gap-space-sm">
              {DEMO_DOCS.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low border border-hairline"
                >
                  <div className="flex items-center gap-space-md">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary">
                      <Icon name={doc.icon} className="text-xl" />
                    </div>
                    <div>
                      <h4 className="text-label-md font-bold text-on-surface">{doc.title}</h4>
                      <span className="text-body-sm text-on-surface-variant">{doc.detail}</span>
                    </div>
                  </div>
                  <Badge tone="verified">Indexado</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary">
                <Icon name="library_books" className="text-3xl" />
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                  Tu base de conocimiento está vacía
                </h3>
                <p className="text-body-sm text-on-surface-variant">
                  Sube tus listas de precios, catálogos técnicos o manuales en PDF/TXT. Tus agentes comerciales utilizarán únicamente esta información verificada para responder a tus clientes.
                </p>
              </div>
              <Button
                variant="primary"
                icon="upload_file"
                className="mt-1"
                onClick={() => alert("Elige un archivo PDF o catálogo para indexar en tu organización.")}
              >
                Subir primer documento
              </Button>
            </div>
          )}
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
            Haz una consulta comercial para comprobar las citas y fragmentos que recupera el RAG.
          </p>
          <div className="relative">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Ej. ¿Cuál es el plazo de entrega del generador?"
              className="w-full rounded-lg border border-hairline bg-surface-container-low px-3 py-2 text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button
            variant="secondary"
            icon="search"
            className="w-full"
            onClick={handleTestSearch}
          >
            Verificar respuesta y citas
          </Button>

          {testResult && (
            <div className="p-3 rounded-lg bg-surface-container-low border border-hairline text-body-sm text-on-surface">
              <p className="font-semibold text-primary mb-1">Resultado de la verificación:</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">{testResult}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
