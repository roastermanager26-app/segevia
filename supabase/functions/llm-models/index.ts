import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !auth) return reply({ error: "No autenticado" }, 401);
  try {
    const { tenantId, action, provider = "openrouter", token, integrationId, capability } = await req.json();
    if (provider !== "openrouter" || typeof tenantId !== "string") return reply({ error: "Proveedor no soportado" }, 400);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: authData } = await userClient.auth.getUser();
    const user = authData.user;
    const { data: membership } = user ? await userClient.from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle() : { data: null };
    if (!user || !membership) return reply({ error: "No autorizado" }, 403);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    let key = token as string | undefined;
    let id = integrationId as string | undefined;
    if (action === "connect") {
      if (typeof key !== "string" || key.length < 12) return reply({ error: "Token inválido" }, 400);
      const check = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      if (!check.ok) return reply({ error: "OpenRouter rechazó el token" }, 422);
      const { data, error } = await admin.rpc("store_llm_token", { p_tenant_id: tenantId, p_provider: provider, p_token: key, p_actor_id: user.id });
      if (error) throw error; id = data;
    }
    if (!id) return reply({ error: "Falta la integración" }, 400);
    const { data: integration } = await admin.from("integrations").select("id").eq("id", id).eq("tenant_id", tenantId).eq("provider", provider).maybeSingle();
    if (!integration) return reply({ error: "Integración no encontrada" }, 404);
    if (!key) { const { data, error } = await admin.rpc("read_llm_token", { p_integration_id: id }); if (error || !data) throw error ?? new Error("Token no disponible"); key = data; }
    const endpoint = capability === "embedding" ? "https://openrouter.ai/api/v1/embeddings/models" : capability === "image" ? "https://openrouter.ai/api/v1/images/models" : "https://openrouter.ai/api/v1/models?output_modalities=text";
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) return reply({ error: "No se pudo leer el catálogo de modelos" }, 502);
    const payload = await response.json();
    const models = (payload.data ?? []).map((m: Record<string, unknown>) => ({ id: m.id, name: m.name ?? m.id, pricing: m.pricing, modalities: (m.architecture as Record<string, unknown> | undefined)?.output_modalities ?? [] }));
    return reply({ integrationId: id, models });
  } catch (error) { console.error(error); return reply({ error: "Error de integración" }, 500); }
});
