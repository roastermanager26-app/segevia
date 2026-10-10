import { useState } from "react";
import { useNavigate } from "react-router";
import { db } from "../lib/supabase";
import { slugify } from "../lib/format";
import { useTenant } from "../tenant/TenantProvider";
import { Button, Card, Field, Icon, inputClass } from "../components/ui";
import { AppCopyright } from "../components/AppCopyright";

export function Onboarding() {
  const navigate = useNavigate();
  const { refresh, setActiveTenant } = useTenant();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const { data, error: rpcError } = await db().rpc("create_tenant", {
        p_name: name.trim(),
        p_slug: slug.trim(),
      });

      if (rpcError) throw rpcError;

      await refresh();
      if (data?.id) {
        setActiveTenant(data.id);
      }
      // La organización existe, pero todavía falta el perfil comercial que
      // alimenta a los agentes y al Content Studio.
      navigate("/configuracion?setup=company", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la organización");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-space-md bg-background p-space-md">
      <Card className="max-w-md w-full flex flex-col gap-space-lg">
        <div className="flex flex-col gap-space-xs text-center items-center">
          <img src="/logo.png" alt="SEGEVIA" className="h-10 object-contain mb-2" />
          <h1 className="font-headline text-headline-md font-bold text-on-surface">
            Crea tu Organización
          </h1>
          <p className="text-body-sm text-on-surface-variant">
            Para comenzar a operar tus agentes de venta y Content Studio, crea un espacio de trabajo para tu empresa.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-error-container p-space-sm text-body-sm text-on-error-container flex items-center gap-2">
            <Icon name="error" className="text-lg shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
          <Field label="Nombre de la empresa" hint="Obligatorio">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej. Acme Argentina"
              className={inputClass}
            />
          </Field>

          <Field label="Identificador único (slug)" hint="URL friendly">
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="acme-argentina"
              className={inputClass}
            />
          </Field>

          <Button type="submit" loading={loading} className="w-full mt-2" icon="arrow_forward">
            Comenzar a operar
          </Button>
        </form>
      </Card>
      <AppCopyright className="text-center" />
    </div>
  );
}
