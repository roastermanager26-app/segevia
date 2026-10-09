import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !auth) return reply({ error: "No autenticado" }, 401);
  try {
    const { tenantId, botName, token, authorizedChatIds } = await req.json();
    if (typeof tenantId !== "string" || typeof botName !== "string" || botName.trim().length < 2 || botName.trim().length > 80) return reply({ error: "Indicá un nombre de bot de entre 2 y 80 caracteres." }, 400);
    if (typeof token !== "string" || token.trim().length < 20) return reply({ error: "El token del bot de Telegram no parece válido." }, 400);
    if (!Array.isArray(authorizedChatIds) || authorizedChatIds.some((id) => typeof id !== "string" || !/^-?\d{1,19}$/.test(id))) return reply({ error: "Los IDs autorizados deben ser números de Telegram válidos." }, 400);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } }); const { data: authData } = await userClient.auth.getUser(); const user = authData.user;
    const { data: membership } = user ? await userClient.from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle() : { data: null };
    if (!user || !membership) return reply({ error: "No autorizado" }, 403);

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`, { signal: AbortSignal.timeout(15_000) });
    const telegram = await telegramResponse.json() as { ok?: boolean; result?: { username?: string; first_name?: string } };
    if (!telegramResponse.ok || !telegram.ok || !telegram.result) return reply({ error: "Telegram rechazó el token del bot. Revisalo e intentá nuevamente." }, 422);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: integrationId, error } = await admin.rpc("store_telegram_bot", { p_tenant_id: tenantId, p_bot_name: botName.trim(), p_bot_username: telegram.result.username ?? "", p_token: token.trim(), p_authorized_chat_ids: authorizedChatIds.map((id) => BigInt(id).toString()), p_actor_id: user.id });
    if (error) throw error;
    return reply({ integrationId, bot: { username: telegram.result.username ?? null, name: telegram.result.first_name ?? botName.trim() } });
  } catch (error) {
    console.error(error);
    const message = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError") ? "Telegram tardó demasiado en responder. Intentá nuevamente." : error instanceof Error ? error.message : "No se pudo configurar Telegram.";
    return reply({ error: message }, 500);
  }
});
