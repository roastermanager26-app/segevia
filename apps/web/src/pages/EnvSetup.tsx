import { envIssues } from "../lib/env";
import { Badge, Button, Card, Icon } from "../components/ui";
import { AppCopyright } from "../components/AppCopyright";

export function EnvSetup() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-space-md bg-background p-space-md">
      <Card className="max-w-lg w-full flex flex-col gap-space-lg">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary">
            <Icon name="auto_awesome" className="text-2xl" />
          </div>
          <div>
            <h1 className="font-headline text-headline-sm font-bold text-on-surface">SEGEVIA</h1>
            <p className="text-body-sm text-on-surface-variant">Configuración inicial requerida</p>
          </div>
        </div>

        <div className="flex flex-col gap-space-sm">
          <Badge tone="review" icon="warning">
            Variables de entorno faltantes
          </Badge>
          <p className="text-body-md text-on-surface">
            Para inicializar SEGEVIA en desarrollo local o en producción, necesitas configurar las credenciales públicas de Supabase:
          </p>
          <ul className="list-disc pl-5 text-body-sm text-on-surface-variant space-y-1">
            {envIssues.map((issue) => (
              <li key={issue} className="font-mono text-error">
                {issue}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-surface-container-low p-space-md text-body-sm text-on-surface-variant flex flex-col gap-2">
          <p className="font-semibold text-on-surface">Pasos para solucionar:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Copia <code className="bg-surface-container px-1 rounded">.env.example</code> a{" "}
              <code className="bg-surface-container px-1 rounded">.env.local</code> en la raíz del proyecto.
            </li>
            <li>Coloca tu <code className="bg-surface-container px-1 rounded">VITE_SUPABASE_URL</code> y <code className="bg-surface-container px-1 rounded">VITE_SUPABASE_ANON_KEY</code>.</li>
            <li>Reinicia el servidor de desarrollo.</li>
          </ol>
        </div>

        <Button
          variant="secondary"
          icon="refresh"
          onClick={() => window.location.reload()}
          className="self-end"
        >
          Reintentar conexión
        </Button>
      </Card>
      <AppCopyright className="text-center" />
    </div>
  );
}
