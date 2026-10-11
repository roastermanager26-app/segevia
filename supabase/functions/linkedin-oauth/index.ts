import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const authBaseUrl = "https://www.linkedin.com/oauth/v2";
const apiBaseUrl = "https://api.linkedin.com";
const callbackUrl = (supabaseUrl: string) => `${supabaseUrl}/functions/v1/linkedin-oauth`;
const textEncoder = new TextEncoder();
const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};
const fromBase64Url = (value: string) => {
  const padded =
    value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });
const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  )
    return (error as { message: string }).message;
  return fallback;
};
const html = (title: string, text: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;background:#f8f7ff;color:#172036;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:32rem;background:#fff;padding:2rem;border-radius:1rem;box-shadow:0 10px 30px #17203620"><h1>${title}</h1><p>${text}</p><p>Podés volver a SEGEVIA.</p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
type State = { tenantId: string; actorId: string; expiresAt: number; nonce: string };
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value))),
  );
}
async function createState(state: State, secret: string) {
  const payload = base64Url(JSON.stringify(state));
  return `${payload}.${await sign(payload, secret)}`;
}
async function readState(value: string | null, secret: string): Promise<State | null> {
  if (!value) return null;
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length || signature !== (await sign(payload, secret)))
    return null;
  try {
    const state = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as State;
    return typeof state.tenantId === "string" &&
      typeof state.actorId === "string" &&
      typeof state.expiresAt === "number" &&
      state.expiresAt > Date.now() &&
      typeof state.nonce === "string"
      ? state
      : null;
  } catch {
    return null;
  }
}
function config() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
  const stateSecret = Deno.env.get("LINKEDIN_OAUTH_STATE_SECRET");
  const appUrl = Deno.env.get("SEGEVIA_APP_URL");
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceKey ||
    !clientId ||
    !clientSecret ||
    !stateSecret ||
    !appUrl
  )
    throw new Error("La integración de LinkedIn todavía no está configurada.");
  return {
    supabaseUrl,
    anonKey,
    serviceKey,
    clientId,
    clientSecret,
    stateSecret,
    appUrl: appUrl.replace(/\/$/u, ""),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let settings: ReturnType<typeof config>;
  try {
    settings = config();
  } catch (error) {
    return req.method === "GET"
      ? html(
          "No se pudo conectar LinkedIn",
          error instanceof Error ? error.message : "Configuración incompleta.",
          500,
        )
      : reply({ error: error instanceof Error ? error.message : "Configuración incompleta." }, 500);
  }

  if (req.method === "POST") {
    try {
      const auth = req.headers.get("Authorization");
      if (!auth) return reply({ error: "No autenticado" }, 401);
      const { tenantId } = await req.json();
      if (typeof tenantId !== "string") return reply({ error: "Tenant inválido" }, 400);
      const userClient = createClient(settings.supabaseUrl, settings.anonKey, {
        global: { headers: { Authorization: auth } },
      });
      const { data: authData } = await userClient.auth.getUser();
      const user = authData.user;
      const { data: membership } = user
        ? await userClient
            .from("memberships")
            .select("role")
            .eq("tenant_id", tenantId)
            .eq("user_id", user.id)
            .in("role", ["owner", "admin"])
            .maybeSingle()
        : { data: null };
      if (!user || !membership) return reply({ error: "No autorizado" }, 403);
      const random = crypto.getRandomValues(new Uint8Array(18));
      const state = await createState(
        {
          tenantId,
          actorId: user.id,
          expiresAt: Date.now() + 10 * 60_000,
          nonce: base64Url(random),
        },
        settings.stateSecret,
      );
      const url = new URL(`${authBaseUrl}/authorization`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", settings.clientId);
      url.searchParams.set("redirect_uri", callbackUrl(settings.supabaseUrl));
      url.searchParams.set("state", state);
      url.searchParams.set("scope", "openid profile w_member_social");
      return reply({ authorizationUrl: url.toString() });
    } catch (error) {
      console.error(error);
      return reply(
        { error: errorMessage(error, "No se pudo iniciar la autorización.") },
        500,
      );
    }
  }

  if (req.method !== "GET") return reply({ error: "Método no permitido" }, 405);
  const requestUrl = new URL(req.url);
  const error = requestUrl.searchParams.get("error");
  if (error)
    return html(
      "Conexión cancelada",
      requestUrl.searchParams.get("error_description") ?? "LinkedIn no autorizó la conexión.",
      400,
    );
  const state = await readState(requestUrl.searchParams.get("state"), settings.stateSecret);
  const code = requestUrl.searchParams.get("code");
  if (!state || !code)
    return html(
      "Conexión inválida",
      "El enlace venció o no se pudo validar la autorización. Volvé a intentarlo desde SEGEVIA.",
      400,
    );

  try {
    const tokenResponse = await fetch(`${authBaseUrl}/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl(settings.supabaseUrl),
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
      }),
    });
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenPayload.access_token)
      throw new Error(tokenPayload.error_description ?? "LinkedIn no entregó un token de acceso.");
    const profileResponse = await fetch(`${apiBaseUrl}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });
    const profile = (await profileResponse.json()) as { sub?: string; name?: string };
    if (!profileResponse.ok || !profile.sub)
      throw new Error("No se pudo identificar la cuenta de LinkedIn autorizada.");
    const expiresAt = new Date(
      Date.now() + Math.max(60, Number(tokenPayload.expires_in ?? 0)) * 1000,
    ).toISOString();
    const admin = createClient(settings.supabaseUrl, settings.serviceKey, {
      auth: { persistSession: false },
    });
    const { error: storeError } = await admin.rpc("store_linkedin_account", {
      p_tenant_id: state.tenantId,
      p_actor_id: state.actorId,
      p_account_id: profile.sub,
      p_display_name: profile.name ?? "Cuenta de LinkedIn",
      p_token: tokenPayload.access_token,
      p_expires_at: expiresAt,
      p_scopes: String(tokenPayload.scope ?? "openid profile w_member_social").split(/\s+/u),
    });
    if (storeError) throw storeError;
    return Response.redirect(`${settings.appUrl}/integrations?linkedin=connected`, 302);
  } catch (error) {
    console.error(error);
    return html(
      "No se pudo conectar LinkedIn",
      errorMessage(error, "Ocurrió un error al guardar la autorización."),
      500,
    );
  }
});
