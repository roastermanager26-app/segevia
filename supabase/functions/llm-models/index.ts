import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const providers = ["openrouter", "gemini", "openai", "anthropic", "deepseek", "qwen", "groq", "cerebras"] as const;
type Provider = typeof providers[number];
type Capability = "text" | "image" | "embedding";
type Model = { id: string; name: string; provider: Provider; capability: Capability[]; isFree: boolean; pricing?: Record<string, unknown> };

const providerName: Record<Provider, string> = { openrouter: "OpenRouter", gemini: "Google Gemini", openai: "OpenAI", anthropic: "Anthropic Claude", deepseek: "DeepSeek", qwen: "Qwen", groq: "Groq", cerebras: "Cerebras" };
const isProvider = (value: unknown): value is Provider => typeof value === "string" && providers.includes(value as Provider);

function inferCapabilities(id: string, output?: unknown) {
  const value = `${id} ${Array.isArray(output) ? output.join(" ") : ""}`.toLowerCase();
  const result: Capability[] = [];
  if (value.includes("embed")) result.push("embedding");
  if (value.includes("image") || value.includes("dall-e") || value.includes("imagen") || value.includes("nano-banana")) result.push("image");
  if (!result.length || value.includes("text")) result.push("text");
  return result;
}

function normalize(provider: Provider, raw: Record<string, unknown>): Model {
  const id = String(raw.id ?? raw.name ?? "").replace(/^models\//, "");
  const architecture = raw.architecture as Record<string, unknown> | undefined;
  const pricing = raw.pricing as Record<string, unknown> | undefined;
  const prompt = Number(pricing?.prompt ?? pricing?.input ?? NaN);
  const completion = Number(pricing?.completion ?? pricing?.output ?? NaN);
  return { id, name: String(raw.name ?? raw.displayName ?? raw.id ?? id).replace(/^models\//, ""), provider, capability: inferCapabilities(id, architecture?.output_modalities ?? raw.supportedGenerationMethods ?? raw.output_modalities), isFree: id.endsWith(":free") || (Number.isFinite(prompt) && Number.isFinite(completion) && prompt === 0 && completion === 0), pricing };
}

async function listModels(provider: Provider, key: string): Promise<Model[]> {
  let endpoint = ""; let init: RequestInit = { headers: { Authorization: `Bearer ${key}` } };
  if (provider === "openrouter") endpoint = "https://openrouter.ai/api/v1/models";
  if (provider === "openai") endpoint = "https://api.openai.com/v1/models";
  if (provider === "deepseek") endpoint = "https://api.deepseek.com/models";
  if (provider === "groq") endpoint = "https://api.groq.com/openai/v1/models";
  if (provider === "cerebras") endpoint = "https://api.cerebras.ai/v1/models";
  if (provider === "qwen") endpoint = "https://dashscope-intl.aliyuncs.com/api/v1/models";
  if (provider === "gemini") { endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`; init = {}; }
  if (provider === "anthropic") { endpoint = "https://api.anthropic.com/v1/models"; init = { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } }; }
  const response = await fetch(endpoint, init);
  if (!response.ok) throw new Error(`${providerName[provider]} rechazó el token o no permitió leer los modelos (${response.status}).`);
  const payload = await response.json() as { data?: Record<string, unknown>[]; models?: Record<string, unknown>[] };
  return (payload.data ?? payload.models ?? []).map((model) => normalize(provider, model)).filter((model) => model.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !auth) return reply({ error: "No autenticado" }, 401);
  try {
    const { tenantId, action, provider, token, integrationId, capability } = await req.json();
    if (!isProvider(provider) || typeof tenantId !== "string") return reply({ error: "Proveedor no soportado" }, 400);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: authData } = await userClient.auth.getUser(); const user = authData.user;
    const { data: membership } = user ? await userClient.from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle() : { data: null };
    if (!user || !membership) return reply({ error: "No autorizado" }, 403);
    const admin = createClient(url, service, { auth: { persistSession: false } }); let id = integrationId as string | undefined; let key = token as string | undefined;
    if (action === "connect") {
      if (typeof key !== "string" || key.length < 12) return reply({ error: "Token inválido" }, 400);
      await listModels(provider, key);
      const { data, error } = await admin.rpc("store_llm_token", { p_tenant_id: tenantId, p_provider: provider, p_token: key, p_actor_id: user.id });
      if (error) throw error; id = data;
    }
    if (!id) return reply({ error: "Falta la integración" }, 400);
    const { data: integration } = await admin.from("integrations").select("id").eq("id", id).eq("tenant_id", tenantId).eq("provider", provider).maybeSingle();
    if (!integration) return reply({ error: "Integración no encontrada" }, 404);
    if (!key) { const { data, error } = await admin.rpc("read_llm_token", { p_integration_id: id }); if (error || !data) throw error ?? new Error("Token no disponible"); key = data; }
    const all = await listModels(provider, key);
    const models = typeof capability === "string" ? all.filter((model) => model.capability.includes(capability as Capability)) : all;
    return reply({ integrationId: id, provider, displayName: providerName[provider], models: models.sort((a, b) => a.name.localeCompare(b.name, "es")) });
  } catch (error) { console.error(error); return reply({ error: error instanceof Error ? error.message : "Error de integración" }, 500); }
});
