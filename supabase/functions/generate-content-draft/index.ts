import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
class RequestError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const limits: Record<string, number> = { linkedin: 3000, instagram: 2200, x: 280, facebook: 63206, mailing: 10000 };
const languages: Record<string, string> = { es: "español", en: "inglés", pt: "portugués" };

function parseDraft(value: string) {
  const clean = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("El modelo devolvió texto en lugar del formato esperado para el borrador.");
  const data = JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
  const string = (key: string) => typeof data[key] === "string" ? data[key].trim() : "";
  const hashtags = Array.isArray(data.hashtags) ? data.hashtags.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 12) : [];
  const title = string("title");
  if (!title) throw new Error("El modelo no devolvió un título válido.");
  return { title, body: string("body"), companyHelp: string("company_help"), cta: string("call_to_action"), hashtags, imagePrompt: string("image_prompt") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !auth) return reply({ error: "No autenticado" }, 401);
  try {
    const { tenantId, findingId, channel, language } = await req.json();
    if (typeof tenantId !== "string" || typeof findingId !== "string" || !(channel in limits) || !(language in languages)) return reply({ error: "Datos de generación inválidos." }, 400);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: authData } = await userClient.auth.getUser(); const user = authData.user;
    const { data: membership } = user ? await userClient.from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle() : { data: null };
    if (!user || !membership) return reply({ error: "No autorizado" }, 403);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const [{ data: finding, error: findingError }, { data: company }, { data: topic }, { data: configs, error: configError }] = await Promise.all([
      admin.from("content_findings").select("id,topic_id,title,summary,relevance_reason,source_name,canonical_url").eq("id", findingId).eq("tenant_id", tenantId).maybeSingle(),
      admin.from("company_profiles").select("legal_name,description,offerings,website_url,contact_email,phone").eq("tenant_id", tenantId).maybeSingle(),
      admin.from("content_findings").select("topic:content_topics(name)").eq("id", findingId).eq("tenant_id", tenantId).maybeSingle(),
      admin.from("llm_model_configs").select("integration_id,model_id,slot").eq("tenant_id", tenantId).eq("capability", "text").eq("is_active", true),
    ]);
    if (findingError || !finding) throw findingError ?? new Error("No se encontró la tendencia.");
    if (configError) throw configError;
    const text = (configs ?? []).sort((a, b) => a.slot === "primary" ? -1 : b.slot === "primary" ? 1 : 0)[0];
    if (!text) return reply({ error: "Configurá un modelo de texto principal en Integraciones antes de generar un borrador." }, 422);
    const { data: integration } = await admin.from("integrations").select("provider").eq("id", text.integration_id).eq("tenant_id", tenantId).maybeSingle();
    if (integration?.provider !== "openrouter") return reply({ error: "La generación de borradores actualmente requiere que el modelo de texto principal sea de OpenRouter." }, 422);
    const { data: token, error: tokenError } = await admin.rpc("read_llm_token", { p_integration_id: text.integration_id });
    if (tokenError || !token) throw tokenError ?? new Error("No se pudo acceder al token del modelo.");
    const topicName = (topic?.topic as { name?: string } | null)?.name ?? "";
    const companyContext = company ? `Empresa: ${company.legal_name ?? ""}\nDescripción: ${company.description ?? ""}\nServicios y productos: ${company.offerings ?? ""}\nContacto: ${company.website_url ?? ""} ${company.contact_email ?? ""} ${company.phone ?? ""}` : "No hay perfil de empresa cargado; no inventes información comercial.";
    const prompt = `Creá un borrador comercial para ${channel} en ${languages[language]}. Usá solamente la tendencia y el perfil entregados; si faltan datos de la empresa, no los inventes. El texto final completo (body + company_help + call_to_action + hashtags) no puede superar ${limits[channel]} caracteres. No uses Markdown ni HTML. Destacá 2 a 4 palabras o frases clave usando negrita Unicode (por ejemplo 𝐢𝐦𝐩𝐚𝐜𝐭𝐨), nunca asteriscos. Usá emojis solo si son naturales para la red. Devolvé ÚNICAMENTE JSON válido con: title, body, company_help, call_to_action, hashtags (array) e image_prompt.\n\nTema: ${topicName}\nTendencia: ${finding.title}\nResumen: ${finding.summary}\nRelevancia: ${finding.relevance_reason}\nFuente: ${finding.source_name ?? ""} ${finding.canonical_url}\n\nPerfil de empresa:\n${companyContext}`;
    const modelResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: text.model_id, messages: [{ role: "system", content: "Sos un redactor B2B preciso. No reveles razonamiento interno." }, { role: "user", content: prompt }], temperature: 0.5, max_tokens: 1600, reasoning: { effort: "none" } }), signal: AbortSignal.timeout(60_000) });
    if (!modelResponse.ok) { const providerDetail = (await modelResponse.text()).slice(0, 300); if (modelResponse.status === 429) throw new RequestError("El proveedor de IA alcanzó su límite temporal o de cuota. Esperá unos minutos, verificá el saldo/límite del modelo o elegí otro modelo de texto.", 429); if (modelResponse.status === 401 || modelResponse.status === 403) throw new RequestError("El proveedor de IA rechazó las credenciales configuradas. Revisá el token de OpenRouter.", 422); throw new RequestError(`El modelo no respondió correctamente (${modelResponse.status}). ${providerDetail}`, 422); }
    const payload = await modelResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("El modelo no devolvió contenido.");
    const draft = parseDraft(content);
    const textLength = [draft.body, draft.companyHelp, draft.cta, draft.hashtags.join(" ")].join("\n").length;
    if (textLength > limits[channel]) throw new Error(`El borrador excedió el límite de ${limits[channel]} caracteres de ${channel}. Probá generarlo nuevamente.`);
    const { data: post, error: postError } = await admin.from("content_posts").insert({ tenant_id: tenantId, finding_id: finding.id, topic_id: finding.topic_id, channel, language, title: draft.title.slice(0, 500), body: draft.body, company_help: draft.companyHelp, call_to_action: draft.cta, hashtags: draft.hashtags, image_prompt: draft.imagePrompt, created_by: user.id }).select("id").single();
    if (postError) throw postError;
    return reply({ postId: post.id });
  } catch (error) { console.error(error); return reply({ error: error instanceof Error ? error.message : "No se pudo generar el borrador." }, error instanceof RequestError ? error.status : 500); }
});
