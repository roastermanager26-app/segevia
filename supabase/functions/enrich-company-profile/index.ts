// Supabase Edge Function: propone datos comerciales desde la web pública de una empresa.
// Requiere secretos: OPENROUTER_API_KEY, SUPABASE_URL y SUPABASE_ANON_KEY.
// OPENROUTER_MODEL es opcional; para el piloto usa openrouter/free.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const fields = [
  "name", "legal_name", "tax_id", "address_street", "address_number", "city", "province", "country", "postal_code", "phone",
  "website_url", "linkedin_url", "contact_email", "telegram_handle", "instagram_handle", "description", "offerings",
];

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const privateIp = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|fc|fd)/.test(host);
    if (!/^https?:$/.test(url.protocol) || host === "localhost" || host.endsWith(".local") || privateIp) return null;
    return url;
  } catch {
    return null;
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 45_000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const openRouterModel = Deno.env.get("OPENROUTER_MODEL") ?? "openrouter/free";
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !supabaseAnonKey || !openRouterKey) return reply({ error: "La función no está configurada" }, 503);
  if (!authorization) return reply({ error: "No autenticado" }, 401);

  try {
    const { tenantId, url } = await req.json();
    if (typeof tenantId !== "string" || typeof url !== "string") return reply({ error: "Solicitud inválida" }, 400);
    const requestedUrl = safeUrl(url);
    if (!requestedUrl) return reply({ error: "Ingresá una URL pública HTTP/HTTPS válida" }, 400);

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userResult, error: userError } = await client.auth.getUser();
    if (userError || !userResult.user) return reply({ error: "No autenticado" }, 401);
    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", userResult.user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (membershipError || !membership) return reply({ error: "No tenés permisos para editar esta empresa" }, 403);

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10_000);
    const pageResponse = await fetch(requestedUrl, {
      redirect: "follow",
      signal: abort.signal,
      headers: { "User-Agent": "SEGEVIA Company Profile Assistant/1.0" },
    });
    clearTimeout(timer);
    if (!pageResponse.ok) return reply({ error: "No se pudo acceder a la página web indicada" }, 422);
    if (!safeUrl(pageResponse.url)) return reply({ error: "La página redirigió a una dirección no permitida" }, 422);
    const contentType = pageResponse.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return reply({ error: "La URL debe apuntar a una página web HTML" }, 422);
    const html = (await pageResponse.text()).slice(0, 500_000);
    const pageText = htmlToText(html);
    if (pageText.length < 80) return reply({ error: "No se encontró texto suficiente para proponer datos" }, 422);

    const schema = {
      type: "object",
      additionalProperties: false,
      required: fields,
      properties: Object.fromEntries(fields.map((field) => [field, { type: "string" }])),
    };
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          {
            role: "system",
            content: "Extraé únicamente información explícita o inequívoca del sitio. Devolvé texto vacío para cualquier campo que no esté respaldado. No inventes CUIT, razón social, dirección, teléfono, correo, redes, productos ni servicios. La descripción debe ser breve y factual, en español. El campo website_url debe contener la URL indicada o vacía.",
          },
          { role: "user", content: `URL: ${pageResponse.url}\n\nCONTENIDO DEL SITIO:\n${pageText}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "company_profile", strict: true, schema } },
        // Fuerza proveedores que implementen el parámetro requerido, en vez de
        // degradar silenciosamente a una respuesta de texto libre.
        provider: { require_parameters: true },
      }),
    });
    if (!aiResponse.ok) return reply({ error: "La IA no pudo analizar el sitio en este momento" }, 502);
    const aiPayload = await aiResponse.json();
    const profile = JSON.parse(aiPayload.choices?.[0]?.message?.content ?? "{}");
    return reply({ profile, sourceUrl: pageResponse.url });
  } catch (error) {
    console.error("enrich-company-profile", error);
    return reply({ error: "No se pudieron proponer datos desde esa página" }, 500);
  }
});
