import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anon || !service || !auth) return reply({ error: "No autenticado" }, 401);

  try {
    const { tenantId, provider } = await req.json();
    if (
      typeof tenantId !== "string" ||
      typeof provider !== "string" ||
      !/^[a-z0-9_]+$/.test(provider)
    ) {
      return reply({ error: "Integración inválida." }, 400);
    }

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
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

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: disconnected, error } = await admin.rpc("disconnect_integration", {
      p_tenant_id: tenantId,
      p_provider: provider,
      p_actor_id: user.id,
    });
    if (error) throw error;
    return reply({ disconnected: disconnected ?? 0 });
  } catch (error) {
    console.error(error);
    return reply(
      { error: error instanceof Error ? error.message : "No se pudo desconectar la integración." },
      500,
    );
  }
});
