import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const MAX_TOPICS = 5;
const PER_PROVIDER = 1;

type Candidate = { provider: "tavily" | "searchapi" | "serpapi"; url: string; title: string; sourceName: string | null; publishedAt: string | null; summary: string; language: string | null };
type Topic = { id: string; name: string; keywords: string[] };

const normalizeUrl = (value: string) => {
  const url = new URL(value); url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
  return url.toString();
};
const summarize = (value: string) => value.trim().split(/\s+/).slice(0, 500).join(" ");
const asDate = (value: unknown) => { if (typeof value !== "string") return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); };

async function searchTavily(key: string, query: string): Promise<Candidate[]> {
  const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: key, query, topic: "news", search_depth: "basic", max_results: 8, include_answer: false }), signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`Tavily respondió ${response.status}.`);
  const payload = await response.json() as { results?: Array<{ url?: string; title?: string; content?: string; published_date?: string; raw_content?: string }> };
  return (payload.results ?? []).flatMap((item) => {
    if (!item.url || !item.title) return [];
    try { const url = normalizeUrl(item.url); return [{ provider: "tavily" as const, url, title: item.title.trim(), sourceName: new URL(url).hostname.replace(/^www\./, ""), publishedAt: asDate(item.published_date), summary: summarize(item.content ?? item.raw_content ?? "Sin resumen disponible."), language: null }]; } catch { return []; }
  });
}

async function searchSearchApi(key: string, query: string): Promise<Candidate[]> {
  const url = new URL("https://www.searchapi.io/api/v1/search");
  url.searchParams.set("engine", "google_news"); url.searchParams.set("q", query); url.searchParams.set("link", "resolved"); url.searchParams.set("num", "10");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`SearchApi respondió ${response.status}.`);
  const payload = await response.json() as { news_results?: Array<Record<string, unknown>>; organic_results?: Array<Record<string, unknown>>; top_stories?: Array<Record<string, unknown>> };
  const results = payload.news_results ?? payload.organic_results ?? payload.top_stories ?? [];
  return results.flatMap((item) => {
    const link = typeof item.link === "string" ? item.link : typeof item.url === "string" ? item.url : null;
    const title = typeof item.title === "string" ? item.title : null;
    if (!link || !title) return [];
    try { const normalized = normalizeUrl(link); const snippet = typeof item.snippet === "string" ? item.snippet : typeof item.description === "string" ? item.description : "Sin resumen disponible."; return [{ provider: "searchapi" as const, url: normalized, title: title.trim(), sourceName: typeof item.source === "string" ? item.source : new URL(normalized).hostname.replace(/^www\./, ""), publishedAt: asDate(item.date), summary: summarize(snippet), language: typeof item.language === "string" ? item.language : null }]; } catch { return []; }
  });
}

async function searchSerpApi(key: string, query: string): Promise<Candidate[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_news"); url.searchParams.set("q", query); url.searchParams.set("api_key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`SerpApi respondió ${response.status}.`);
  const payload = await response.json() as { news_results?: Array<Record<string, unknown>> };
  return (payload.news_results ?? []).flatMap((item) => {
    const link = typeof item.link === "string" ? item.link : null; const title = typeof item.title === "string" ? item.title : null;
    if (!link || !title) return [];
    try { const normalized = normalizeUrl(link); const source = typeof item.source === "string" ? item.source : item.source && typeof item.source === "object" && typeof (item.source as Record<string, unknown>).name === "string" ? (item.source as Record<string, unknown>).name as string : new URL(normalized).hostname.replace(/^www\./, ""); const snippet = typeof item.snippet === "string" ? item.snippet : "Sin resumen disponible."; return [{ provider: "serpapi" as const, url: normalized, title: title.trim(), sourceName: source, publishedAt: asDate(item.date), summary: summarize(snippet), language: null }]; } catch { return []; }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const tavilyKey = Deno.env.get("TAVILY_API_KEY"); const searchApiKey = Deno.env.get("SEARCHAPI_API_KEY"); const serpApiKey = Deno.env.get("SERPAPI_API_KEY"); const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !tavilyKey || !searchApiKey || !serpApiKey || !auth) return reply({ error: "La búsqueda de tendencias no está configurada." }, 503);
  try {
    const { tenantId } = await req.json(); if (typeof tenantId !== "string") return reply({ error: "Organización inválida." }, 400);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } }); const { data: authData } = await userClient.auth.getUser(); const user = authData.user;
    const { data: membership } = user ? await userClient.from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle() : { data: null };
    if (!user || !membership) return reply({ error: "No autorizado" }, 403);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: topics, error: topicsError } = await admin.from("content_topics").select("id,name,keywords").eq("tenant_id", tenantId).eq("is_active", true).order("updated_at", { ascending: false }).limit(MAX_TOPICS);
    if (topicsError) throw topicsError; if (!topics?.length) return reply({ inserted: 0, topics: [], message: "Creá y activá al menos un tema para buscar tendencias." });
    const existingResult = await admin.from("content_findings").select("canonical_url").eq("tenant_id", tenantId).gte("expires_at", new Date().toISOString()); if (existingResult.error) throw existingResult.error;
    const existingUrls = new Set((existingResult.data ?? []).map((finding) => finding.canonical_url)); let inserted = 0; const results: Array<{ topicId: string; topic: string; tavily: number; searchapi: number; serpapi: number }> = []; const providerErrors: Array<{ topic: string; provider: string; error: string }> = [];
    for (const topic of topics as Topic[]) {
      const query = [topic.name, ...topic.keywords].join(" ").slice(0, 800);
      const [tavily, searchapi, serpapi] = await Promise.allSettled([searchTavily(tavilyKey, query), searchSearchApi(searchApiKey, query), searchSerpApi(serpApiKey, query)]);
      for (const [provider, result] of [["Tavily", tavily], ["SearchApi.io", searchapi], ["SerpApi", serpapi]] as const) if (result.status === "rejected") providerErrors.push({ topic: topic.name, provider, error: result.reason instanceof Error ? result.reason.message : "Error desconocido" });
      const providerResults = [{ name: "tavily" as const, candidates: tavily.status === "fulfilled" ? tavily.value : [] }, { name: "searchapi" as const, candidates: searchapi.status === "fulfilled" ? searchapi.value : [] }, { name: "serpapi" as const, candidates: serpapi.status === "fulfilled" ? serpapi.value : [] }];
      const tally = { tavily: 0, searchapi: 0, serpapi: 0 };
      for (const provider of providerResults) for (const candidate of provider.candidates) {
        if (tally[provider.name] >= PER_PROVIDER || existingUrls.has(candidate.url)) continue;
        const { error } = await admin.from("content_findings").insert({ tenant_id: tenantId, topic_id: topic.id, provider: candidate.provider, canonical_url: candidate.url, source_name: candidate.sourceName, title: candidate.title, published_at: candidate.publishedAt, summary: candidate.summary, relevance_reason: `Resultado reciente relacionado con el tema “${topic.name}” y sus palabras clave.`, language: candidate.language });
        if (error?.code === "23505") { existingUrls.add(candidate.url); continue; }
        if (error) throw error;
        existingUrls.add(candidate.url); tally[provider.name] += 1; inserted += 1;
      }
      results.push({ topicId: topic.id, topic: topic.name, ...tally });
    }
    return reply({ inserted, topics: results, providerErrors });
  } catch (error) { console.error(error); const message = error instanceof Error ? error.message : "No se pudieron buscar tendencias."; return reply({ error: message }, 500); }
});
