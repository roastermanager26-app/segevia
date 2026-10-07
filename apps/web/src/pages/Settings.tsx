import { useActiveTenant } from "../tenant/TenantProvider";
import { Badge, Button, Card, Field, Icon, inputClass } from "../components/ui";

export function Settings() {
  const { tenant, role } = useActiveTenant();

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Administración
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Configuración</h1>
          <p className="text-body-md text-on-surface-variant">
            Ajustes generales de la organización, roles y miembros de tu equipo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <Card className="lg:col-span-2 flex flex-col gap-space-md">
          <h3 className="font-headline text-headline-sm font-bold text-on-surface border-b border-hairline pb-space-sm">
            Datos de la Organización
          </h3>

          <div className="flex flex-col gap-space-md">
            <Field label="Nombre comercial">
              <input type="text" defaultValue={tenant.name} className={inputClass} />
            </Field>

            <Field label="Slug identificador" hint="Solo lectura">
              <input type="text" disabled defaultValue={tenant.slug} className={inputClass} />
            </Field>

            <Field label="Plan activo">
              <div className="flex items-center gap-2">
                <Badge tone="verified" icon="star">
                  Plan {tenant.plan.toUpperCase()}
                </Badge>
              </div>
            </Field>
          </div>

          <div className="pt-space-sm border-t border-hairline flex justify-end">
            <Button variant="primary">Guardar cambios</Button>
          </div>
        </Card>

        <Card className="flex flex-col gap-space-md">
          <h3 className="font-headline text-headline-sm font-bold text-on-surface border-b border-hairline pb-space-sm">
            Tu Rol y Permisos
          </h3>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-outline">Rol asignado:</span>
              <Badge tone="human">{role.toUpperCase()}</Badge>
            </div>
            <p className="text-body-sm text-on-surface-variant pt-2">
              Como <strong>{role}</strong> tienes permisos para gestionar agentes, supervisar conversaciones omnicanal y aprobar publicaciones de Content Studio.
            </p>
          </div>

          <div className="pt-space-sm border-t border-hairline">
            <Button variant="secondary" icon="group" className="w-full">
              Invitar colaboradores
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
