import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const sources = ["react", "window", "promise"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !auth) return reply({ error: "No autenticado" }, 401);

  try {
    const { tenantId, source, message, route, appVersion } = await req.json();
    if (
      typeof tenantId !== "string" ||
      !sources.includes(source) ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 1000 ||
      typeof route !== "string" ||
      route.length > 500 ||
      typeof appVersion !== "string" ||
      appVersion.length > 40
    ) {
      return reply({ error: "Reporte inválido." }, 400);
    }

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: authData } = await userClient.auth.getUser();
    const user = authData.user;
    const { data: membership } = user
      ? await userClient
          .from("memberships")
          .select("tenant_id")
          .eq("tenant_id", tenantId)
          .eq("user_id", user.id)
          .maybeSingle()
      : { data: null };
    if (!user || !membership) return reply({ error: "No autorizado" }, 403);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { error } = await admin.from("audit_logs").insert({
      tenant_id: tenantId,
      actor_id: user.id,
      actor_type: "user",
      action: "app.error",
      entity_type: "client_error",
      metadata: {
        source,
        route,
        app_version: appVersion,
        message: message.trim(),
      },
    });
    if (error) throw error;
    return reply({ recorded: true });
  } catch (error) {
    console.error(error);
    return reply({ error: "No se pudo registrar el error." }, 500);
  }
});
