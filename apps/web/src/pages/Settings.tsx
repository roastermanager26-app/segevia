import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { useActiveTenant, useTenant } from "../tenant/TenantProvider";
import type { CompanyProfile } from "../lib/types";
import { db } from "../lib/supabase";
import { Badge, Button, Card, Field, Icon, inputClass } from "../components/ui";

type CompanyForm = {
  name: string;
  legal_name: string;
  tax_id: string;
  address_street: string;
  address_number: string;
  city: string;
  province: string;
  country: string;
  postal_code: string;
  phone: string;
  website_url: string;
  linkedin_url: string;
  contact_email: string;
  telegram_handle: string;
  instagram_handle: string;
  description: string;
  offerings: string;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
};

const emptyCompany = (name = ""): CompanyForm => ({
  name,
  legal_name: "",
  tax_id: "",
  address_street: "",
  address_number: "",
  city: "",
  province: "",
  country: "Argentina",
  postal_code: "",
  phone: "",
  website_url: "",
  linkedin_url: "",
  contact_email: "",
  telegram_handle: "",
  instagram_handle: "",
  description: "",
  offerings: "",
  logo_path: null,
  primary_color: "#3525cd",
  secondary_color: "#006a61",
});

function fromCompanyProfile(tenantName: string, profile: CompanyProfile | null): CompanyForm {
  if (!profile) return emptyCompany(tenantName);
  const { tenant_id: _tenantId, ...rest } = profile;
  return Object.fromEntries(
    Object.entries({ name: tenantName, ...rest }).map(([key, value]) => [key, value ?? ""]),
  ) as CompanyForm;
}

async function cropLogo(source: string, zoom: number, offsetX: number, offsetY: number): Promise<Blob> {
  const image = new Image();
  image.src = source;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo procesar la imagen del logo"));
  });

  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const maxX = Math.max(0, (image.naturalWidth - cropSize) / 2);
  const maxY = Math.max(0, (image.naturalHeight - cropSize) / 2);
  const sx = Math.max(0, Math.min(image.naturalWidth - cropSize, (image.naturalWidth - cropSize) / 2 + (offsetX / 100) * maxX));
  const sy = Math.max(0, Math.min(image.naturalHeight - cropSize, (image.naturalHeight - cropSize) / 2 + (offsetY / 100) * maxY));
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar el recorte del logo");
  context.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, 512, 512);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo exportar el logo"))), "image/png"),
  );
}

export function Settings() {
  const { tenant, role } = useActiveTenant();
  const { can, profile, refresh } = useTenant();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isSetup = searchParams.get("setup") === "company";
  const canEditCompany = can("admin");
  const [form, setForm] = useState<CompanyForm>(() => emptyCompany(tenant.name));
  const [adminName, setAdminName] = useState("");
  const [adminTitle, setAdminTitle] = useState("");
  const [logoSource, setLogoSource] = useState<string | null>(null);
  const [newLogo, setNewLogo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const companyQuery = useQuery({
    queryKey: ["company-profile", tenant.id],
    queryFn: async () => {
      const { data, error: queryError } = await db()
        .from("company_profiles")
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (queryError) throw queryError;
      return data as CompanyProfile | null;
    },
  });

  useEffect(() => {
    if (!companyQuery.isSuccess) return;
    setForm(fromCompanyProfile(tenant.name, companyQuery.data));
  }, [companyQuery.data, companyQuery.isSuccess, tenant.name]);

  useEffect(() => {
    setAdminName(profile?.full_name ?? "");
    setAdminTitle(profile?.job_title ?? "");
  }, [profile]);

  useEffect(() => {
    if (!form.logo_path || newLogo) return;
    let active = true;
    db()
      .storage
      .from("brand-assets")
      .createSignedUrl(form.logo_path, 60 * 60)
      .then(({ data }) => {
        if (active && data?.signedUrl) setLogoSource(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [form.logo_path, newLogo]);

  useEffect(
    () => () => {
      if (newLogo && logoSource?.startsWith("blob:")) URL.revokeObjectURL(logoSource);
    },
    [logoSource, newLogo],
  );

  const requiredMissing = useMemo(
    () => [form.name, form.legal_name, form.tax_id, form.address_street, form.address_number, form.city, form.province, form.country, form.postal_code, form.phone]
      .some((value) => !value.trim()),
    [form],
  );

  const setField = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const selectLogo = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("El logo debe ser PNG, JPG o WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("El logo no puede superar 10 MB.");
      return;
    }
    if (logoSource?.startsWith("blob:")) URL.revokeObjectURL(logoSource);
    setLogoSource(URL.createObjectURL(file));
    setNewLogo(true);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setError(null);
  };

  const enrichFromWebsite = async () => {
    if (!form.website_url.trim()) {
      setError("Ingresá la página web de la empresa para completar datos con IA.");
      return;
    }
    setError(null);
    setNotice(null);
    setEnriching(true);
    try {
      const { data, error: invokeError } = await db().functions.invoke("enrich-company-profile", {
        body: { tenantId: tenant.id, url: form.website_url.trim() },
      });
      if (invokeError) throw invokeError;
      const suggested = data?.profile as Partial<CompanyProfile & { name: string }> | undefined;
      if (!suggested) throw new Error("La IA no pudo extraer datos utilizables de ese sitio.");
      setForm((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(suggested)) {
          const field = key as keyof CompanyForm;
          if (field in next && !String(next[field] ?? "").trim() && typeof value === "string" && value.trim()) {
            (next[field] as string) = value;
          }
        }
        return next;
      });
      setNotice("La IA completó los campos que estaban vacíos. Revisá y confirmá la información antes de guardar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron obtener datos desde la web.");
    } finally {
      setEnriching(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditCompany) return;
    if (requiredMissing) {
      setError("Completá los campos obligatorios de la empresa antes de guardar.");
      return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      let logoPath = form.logo_path || null;
      if (newLogo && logoSource) {
        const cropped = await cropLogo(logoSource, zoom, offsetX, offsetY);
        const path = `${tenant.id}/company/logo-${Date.now()}.png`;
        const { error: uploadError } = await db().storage.from("brand-assets").upload(path, cropped, {
          contentType: "image/png",
          upsert: true,
        });
        if (uploadError) throw uploadError;
        logoPath = path;
      }

      const { error: tenantError } = await db()
        .from("tenants")
        .update({ name: form.name.trim() })
        .eq("id", tenant.id);
      if (tenantError) throw tenantError;

      const { error: companyError } = await db().from("company_profiles").upsert({
        tenant_id: tenant.id,
        legal_name: form.legal_name.trim(),
        tax_id: form.tax_id.trim(),
        address_street: form.address_street.trim(),
        address_number: form.address_number.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        country: form.country.trim(),
        postal_code: form.postal_code.trim(),
        phone: form.phone.trim(),
        website_url: form.website_url.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        contact_email: form.contact_email.trim() || null,
        telegram_handle: form.telegram_handle.trim() || null,
        instagram_handle: form.instagram_handle.trim() || null,
        description: form.description.trim() || null,
        offerings: form.offerings.trim() || null,
        logo_path: logoPath,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      });
      if (companyError) throw companyError;

      if (session?.user.id) {
        const { error: profileError } = await db()
          .from("profiles")
          .update({ full_name: adminName.trim(), job_title: adminTitle.trim() || null })
          .eq("id", session.user.id);
        if (profileError) throw profileError;
      }

      if (logoSource?.startsWith("blob:")) URL.revokeObjectURL(logoSource);
      setLogoSource(null);
      setForm((current) => ({ ...current, logo_path: logoPath }));
      setNewLogo(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["company-profile", tenant.id] }),
        refresh(),
      ]);
      setNotice("Datos de la empresa guardados correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los datos de la empresa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-space-lg pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          {isSetup && <Badge tone="review" icon="priority_high">Paso inicial requerido</Badge>}
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Perfil de empresa</h1>
          <p className="text-body-md text-on-surface-variant">
            Esta información da contexto comercial a SEGEVIA, sus agentes y el Content Studio.
          </p>
        </div>
        <Button type="submit" loading={saving} disabled={!canEditCompany} icon="save">
          Guardar datos
        </Button>
      </div>

      {!canEditCompany && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-space-sm text-body-sm text-amber-900 flex gap-2">
          <Icon name="lock" className="shrink-0" /> Solo propietarios y administradores pueden editar la información de la empresa.
        </div>
      )}
      {error && <div className="rounded-lg bg-error-container p-space-sm text-body-sm text-on-error-container">{error}</div>}
      {notice && <div className="rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] p-space-sm text-body-sm text-[#0d5d54]">{notice}</div>}

      <Card className="flex flex-col gap-space-lg">
        <div className="flex flex-col gap-1 border-b border-hairline pb-space-md">
          <h2 className="font-headline text-headline-sm font-bold">Identidad comercial</h2>
          <p className="text-body-sm text-on-surface-variant">Los campos marcados con * son obligatorios.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <Field label="Nombre de la empresa *">
            <input required value={form.name} onChange={(e) => setField("name", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="Ej. Acme Argentina" />
          </Field>
          <Field label="Razón social *">
            <input required value={form.legal_name} onChange={(e) => setField("legal_name", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="Ej. Acme S.A." />
          </Field>
          <Field label="CUIT *" hint="Sin guiones o con formato local">
            <input required value={form.tax_id} onChange={(e) => setField("tax_id", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="30-12345678-9" />
          </Field>
          <Field label="Teléfono *">
            <input required type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="+54 11 5555 5555" />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-space-sm items-end rounded-xl bg-surface-container-low p-space-md">
          <Field label="Página web" hint="Usala para obtener una propuesta con IA">
            <input type="url" value={form.website_url} onChange={(e) => setField("website_url", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="https://www.empresa.com" />
          </Field>
          <Button type="button" variant="secondary" icon="auto_awesome" loading={enriching} disabled={!canEditCompany} onClick={enrichFromWebsite}>
            Completar con IA
          </Button>
        </div>
        <p className="-mt-space-md text-body-sm text-on-surface-variant">La IA propone datos a partir de la web y nunca reemplaza información ya cargada. Revisá todo antes de guardar.</p>
      </Card>

      <Card className="flex flex-col gap-space-lg">
        <div className="border-b border-hairline pb-space-md"><h2 className="font-headline text-headline-sm font-bold">Dirección fiscal y comercial</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md">
          <div className="md:col-span-7"><Field label="Calle *"><input required value={form.address_street} onChange={(e) => setField("address_street", e.target.value)} disabled={!canEditCompany} className={inputClass} /></Field></div>
          <div className="md:col-span-5"><Field label="Número *"><input required value={form.address_number} onChange={(e) => setField("address_number", e.target.value)} disabled={!canEditCompany} className={inputClass} /></Field></div>
          <div className="md:col-span-4"><Field label="Ciudad *"><input required value={form.city} onChange={(e) => setField("city", e.target.value)} disabled={!canEditCompany} className={inputClass} /></Field></div>
          <div className="md:col-span-3"><Field label="Provincia *"><input required value={form.province} onChange={(e) => setField("province", e.target.value)} disabled={!canEditCompany} className={inputClass} /></Field></div>
          <div className="md:col-span-3"><Field label="País *"><input required value={form.country} onChange={(e) => setField("country", e.target.value)} disabled={!canEditCompany} className={inputClass} /></Field></div>
          <div className="md:col-span-2"><Field label="Código postal *"><input required value={form.postal_code} onChange={(e) => setField("postal_code", e.target.value)} disabled={!canEditCompany} className={inputClass} /></Field></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <Card className="lg:col-span-2 flex flex-col gap-space-lg">
          <div className="border-b border-hairline pb-space-md"><h2 className="font-headline text-headline-sm font-bold">Canales y propuesta comercial</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <Field label="Página de LinkedIn"><input type="url" value={form.linkedin_url} onChange={(e) => setField("linkedin_url", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="https://linkedin.com/company/..." /></Field>
            <Field label="Email de contacto"><input type="email" value={form.contact_email} onChange={(e) => setField("contact_email", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="ventas@empresa.com" /></Field>
            <Field label="Telegram de contacto"><input value={form.telegram_handle} onChange={(e) => setField("telegram_handle", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="@empresa" /></Field>
            <Field label="Instagram"><input value={form.instagram_handle} onChange={(e) => setField("instagram_handle", e.target.value)} disabled={!canEditCompany} className={inputClass} placeholder="@empresa" /></Field>
          </div>
          <Field label="Descripción de la empresa"><textarea value={form.description} onChange={(e) => setField("description", e.target.value)} disabled={!canEditCompany} className={`${inputClass} h-28 py-2`} placeholder="Qué hace la empresa, a quién ayuda y qué la diferencia." /></Field>
          <Field label="Productos y servicios"><textarea value={form.offerings} onChange={(e) => setField("offerings", e.target.value)} disabled={!canEditCompany} className={`${inputClass} h-28 py-2`} placeholder="Describí las líneas de productos, servicios y soluciones que ofrecen." /></Field>
        </Card>

        <Card className="flex flex-col gap-space-lg">
          <div className="border-b border-hairline pb-space-md"><h2 className="font-headline text-headline-sm font-bold">Logo y colores</h2></div>
          <div className="flex flex-col items-center gap-space-md">
            <div className="relative h-40 w-40 overflow-hidden rounded-2xl border border-hairline bg-surface-container-low">
              {logoSource ? <img src={logoSource} alt="Vista previa del logo" className="h-full w-full object-cover" style={{ transform: `translate(${offsetX / 3}px, ${offsetY / 3}px) scale(${zoom})` }} /> : <div className="h-full w-full flex flex-col items-center justify-center text-outline"><Icon name="image" className="text-3xl" /><span className="text-body-sm">Sin logo</span></div>}
            </div>
            <label className="cursor-pointer text-label-md text-primary font-semibold hover:underline">Subir logo<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!canEditCompany} onChange={(e) => selectLogo(e.target.files?.[0])} /></label>
          </div>
          {newLogo && <div className="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-md">
            <Field label="Zoom"><input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-primary" /></Field>
            <Field label="Mover horizontal"><input type="range" min="-100" max="100" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} className="w-full accent-primary" /></Field>
            <Field label="Mover vertical"><input type="range" min="-100" max="100" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} className="w-full accent-primary" /></Field>
          </div>}
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Color principal"><div className="flex gap-2"><input aria-label="Color principal" type="color" value={form.primary_color} onChange={(e) => setField("primary_color", e.target.value)} disabled={!canEditCompany} className="h-10 w-12 rounded border border-hairline bg-white p-1" /><input value={form.primary_color} onChange={(e) => setField("primary_color", e.target.value)} disabled={!canEditCompany} className={inputClass} /></div></Field>
            <Field label="Color secundario"><div className="flex gap-2"><input aria-label="Color secundario" type="color" value={form.secondary_color} onChange={(e) => setField("secondary_color", e.target.value)} disabled={!canEditCompany} className="h-10 w-12 rounded border border-hairline bg-white p-1" /><input value={form.secondary_color} onChange={(e) => setField("secondary_color", e.target.value)} disabled={!canEditCompany} className={inputClass} /></div></Field>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-space-md">
        <div className="border-b border-hairline pb-space-md"><h2 className="font-headline text-headline-sm font-bold">Administrador responsable</h2><p className="text-body-sm text-on-surface-variant mt-1">Estos datos identifican a la persona que configuró la organización.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <Field label="Nombre y apellido"><input value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputClass} placeholder="Nombre completo" /></Field>
          <Field label="Puesto"><input value={adminTitle} onChange={(e) => setAdminTitle(e.target.value)} className={inputClass} placeholder="Ej. Director Comercial" /></Field>
          <Field label="Email admin" hint="Solo lectura"><input readOnly value={session?.user.email ?? ""} className={`${inputClass} bg-surface-container-low text-on-surface-variant`} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-md"><span className="text-body-sm text-on-surface-variant">Tu rol actual</span><Badge tone="human">{role.toUpperCase()}</Badge></div>
      </Card>

      <div className="flex justify-end"><Button type="submit" loading={saving} disabled={!canEditCompany || requiredMissing} icon="save">Guardar datos de la empresa</Button></div>
    </form>
  );
}
