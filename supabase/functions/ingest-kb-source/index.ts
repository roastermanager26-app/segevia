import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const MAX_BYTES = 20 * 1024 * 1024;

const chunkText = (text: string, size = 1_000, overlap = 150) => {
  const cleaned = text.replace(/\s+/g, " ").trim(); const chunks: string[] = [];
  for (let start = 0; start < cleaned.length; start += size - overlap) { const chunk = cleaned.slice(start, start + size).trim(); if (chunk.length >= 60) chunks.push(chunk); if (start + size >= cleaned.length) break; }
  return chunks;
};
const publicUrl = (value: string) => { const url = new URL(value); const host = url.hostname.toLowerCase(); if (!(url.protocol === "https:" || url.protocol === "http:") || host === "localhost" || host.endsWith(".local") || /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) throw new Error("La URL debe ser HTTP(S) pública."); return url; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !auth) return reply({ error: "No autenticado" }, 401);
  let sourceIdForError: string | null = null; let tenantIdForError: string | null = null;
  try {
    const { tenantId, sourceId } = await req.json(); if (typeof tenantId !== "string" || typeof sourceId !== "string") return reply({ error: "Solicitud inválida" }, 400);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } }); const { data: userData } = await userClient.auth.getUser(); const user = userData.user;
    const { data: membership } = user ? await userClient.from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle() : { data: null };
    if (!user || !membership) return reply({ error: "No autorizado" }, 403); sourceIdForError = sourceId; tenantIdForError = tenantId;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: source, error: sourceError } = await admin.from("kb_sources").select("id,kind,source_url,title,status").eq("id", sourceId).eq("tenant_id", tenantId).single();
    if (sourceError || !source || source.kind !== "url" || !source.source_url) return reply({ error: "La fuente web no existe." }, 404);
    await admin.from("kb_sources").update({ status: "processing", last_error: null }).eq("id", source.id);
    const page = await fetch(publicUrl(source.source_url), { redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!page.ok) throw new Error(`No se pudo leer la página (${page.status}).`);
    if (Number(page.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("La página supera 20 MB.");
    const html = await page.text(); if (html.length > MAX_BYTES) throw new Error("La página supera 20 MB.");
    const chunks = chunkText(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
    if (!chunks.length) throw new Error("No se encontró texto utilizable en la página.");
    const { data: configs, error: configError } = await admin.from("llm_model_configs").select("id,integration_id,model_id,slot").eq("tenant_id", tenantId).eq("capability", "embedding").eq("is_active", true);
    if (configError) throw configError;
    const config = (configs ?? []).sort((a, b) => a.slot === "primary" ? -1 : b.slot === "primary" ? 1 : 0)[0]; if (!config) throw new Error("Configurá un modelo de embeddings antes de procesar la fuente.");
    const { data: integration } = await admin.from("integrations").select("provider").eq("id", config.integration_id).single(); if (integration?.provider !== "openrouter") throw new Error("La ingestión automática de URLs actualmente requiere OpenRouter como proveedor de embeddings.");
    const { data: token, error: tokenError } = await admin.rpc("read_llm_token", { p_integration_id: config.integration_id }); if (tokenError || !token) throw tokenError ?? new Error("No se encontró el token del proveedor.");
    const vectors: number[][] = [];
    for (let offset = 0; offset < chunks.length; offset += 32) { const response = await fetch("https://openrouter.ai/api/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model_id, input: chunks.slice(offset, offset + 32) }) }); if (!response.ok) throw new Error(`No se pudieron generar embeddings (${response.status}).`); const payload = await response.json() as { data?: Array<{ embedding?: number[] }> }; const values = payload.data?.map((item) => item.embedding).filter((item): item is number[] => Array.isArray(item)) ?? []; if (values.length !== Math.min(32, chunks.length - offset)) throw new Error("El proveedor devolvió embeddings incompletos."); vectors.push(...values); }
    const { error: deleteError } = await admin.from("kb_chunks").delete().eq("source_id", source.id); if (deleteError) throw deleteError;
    const { error: insertError } = await admin.from("kb_chunks").insert(chunks.map((content, chunk_index) => ({ tenant_id: tenantId, source_id: source.id, chunk_index, content, metadata: { title: source.title }, embedding: `[${vectors[chunk_index].join(",")}]`, embedding_model: config.model_id }))); if (insertError) throw insertError;
    await admin.from("kb_sources").update({ status: "review", chunks_count: chunks.length, last_error: null }).eq("id", source.id);
    return reply({ sourceId, status: "review", chunks: chunks.length });
  } catch (error) { const message = error instanceof Error ? error.message : "No se pudo procesar la fuente."; if (sourceIdForError && tenantIdForError) { const admin = createClient(url, service, { auth: { persistSession: false } }); await admin.from("kb_sources").update({ status: "error", last_error: message }).eq("id", sourceIdForError).eq("tenant_id", tenantIdForError); } console.error(error); return reply({ error: message }, 500); }
});
