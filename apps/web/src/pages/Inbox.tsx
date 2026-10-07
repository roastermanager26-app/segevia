import { Badge, Button, Card, Icon } from "../components/ui";

export function Inbox() {
  return (
    <div className="flex flex-col gap-space-lg pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              P1 · Omnicanalidad
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Inbox Omnicanal</h1>
          <p className="text-body-md text-on-surface-variant">
            Conversaciones en tiempo real por WhatsApp, Instagram y llamadas, con drawer de CRM y Takeover Humano.
          </p>
        </div>

        <Badge tone="human" icon="verified_user">
          Modo Seguro Activo
        </Badge>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary">
          <Icon name="forum" className="text-3xl" />
        </div>
        <h2 className="font-headline text-headline-sm font-bold text-on-surface">
          El Inbox se activa al conectar WhatsApp o Instagram
        </h2>
        <p className="text-body-md text-on-surface-variant max-w-md">
          Diseñado para que la IA atienda consultas iniciales y los comerciales humanos puedan intervenir de inmediato con un clic.
        </p>
        <Button variant="secondary" icon="extension" onClick={() => (window.location.href = "/integraciones")}>
          Ir a Integraciones
        </Button>
      </Card>
    </div>
  );
}
