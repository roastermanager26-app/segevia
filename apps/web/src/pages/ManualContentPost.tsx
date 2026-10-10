import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useActiveTenant, useTenant } from "../tenant/TenantProvider";
import { db } from "../lib/supabase";
import { Button, Card, Field, inputClass } from "../components/ui";

type Channel = "linkedin" | "instagram" | "x" | "facebook" | "mailing";

export function ManualContentPost() {
  const { tenant } = useActiveTenant(); const { can } = useTenant(); const navigate = useNavigate(); const [channel, setChannel] = useState<Channel>("linkedin"); const [language, setLanguage] = useState<"es" | "en" | "pt">("es"); const [error, setError] = useState<string | null>(null);
  const create = useMutation({ mutationFn: async () => { const { data, error: insertError } = await db().from("content_posts").insert({ tenant_id: tenant.id, channel, language, title: "Nueva publicación", subtitle: "", body: "", company_help: "", call_to_action: "", hashtags: [], image_prompt: "" }).select("id").single(); if (insertError) throw insertError; return data.id as string; }, onSuccess: (id) => navigate(`/content-studio/publicaciones/${id}`), onError: (createError) => setError(createError instanceof Error ? createError.message : "No se pudo crear la publicación.") });
  return <div className="mx-auto flex max-w-2xl flex-col gap-space-lg pb-12"><div><h1 className="font-headline text-headline-lg font-bold">Nueva publicación manual</h1><p className="text-body-md text-on-surface-variant">Creá un borrador sin artículo ni tendencia de referencia.</p></div><Card className="flex flex-col gap-space-md"><Field label="Red social"><select value={channel} onChange={(event) => setChannel(event.target.value as Channel)} className={inputClass}><option value="linkedin">LinkedIn</option><option value="instagram">Instagram</option><option value="x">X</option><option value="facebook">Facebook</option><option value="mailing">Mailing</option></select></Field><Field label="Idioma"><select value={language} onChange={(event) => setLanguage(event.target.value as "es" | "en" | "pt")} className={inputClass}><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></Field>{error && <p className="text-body-sm text-error">{error}</p>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => navigate("/content-studio/publicaciones")}>Cancelar</Button><Button disabled={!can("admin")} loading={create.isPending} onClick={() => create.mutate()}>Abrir formulario vacío</Button></div></Card></div>;
}
