import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const linkedInVersion = "202609";
const plain = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const unicodeBold = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";
const unicodeItalic = "𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧0123456789";
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const stylize = (value: string, format: "bold" | "italic") =>
  [...value]
    .map((character) => {
      const index = plain.indexOf(character);
      return index < 0 ? character : [...(format === "bold" ? unicodeBold : unicodeItalic)][index];
    })
    .join("");
const linkedInHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Linkedin-Version": linkedInVersion,
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
});
const providerError = async (response: Response) => {
  const detail = (await response.text()).slice(0, 500);
  return `LinkedIn respondió ${response.status}${detail ? `: ${detail}` : ""}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization)
    return reply({ error: "No autenticado" }, 401);
  try {
    const { tenantId, postId } = await req.json();
    if (typeof tenantId !== "string" || typeof postId !== "string")
      return reply({ error: "Publicación inválida." }, 400);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
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

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: post, error: postError } = await admin
      .from("content_posts")
      .select("id,title,subtitle,body,company_help,call_to_action,hashtags,image_url,status")
      .eq("id", postId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (postError || !post) return reply({ error: "No se encontró la publicación." }, 404);
    if (post.status !== "approved")
      return reply(
        { error: "La publicación debe estar aprobada antes de enviarla a LinkedIn." },
        422,
      );

    const { data: integration, error: integrationError } = await admin
      .from("integrations")
      .select("id,external_account_id,expires_at,scopes")
      .eq("tenant_id", tenantId)
      .eq("provider", "linkedin")
      .eq("status", "connected")
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (integrationError || !integration?.external_account_id)
      return reply({ error: "Conectá una cuenta de LinkedIn antes de publicar." }, 422);
    if (integration.expires_at && new Date(integration.expires_at).getTime() <= Date.now()) {
      await admin
        .from("integrations")
        .update({
          status: "expired",
          last_error: "El token de LinkedIn venció. Reconectá la cuenta.",
        })
        .eq("id", integration.id);
      return reply(
        { error: "La conexión de LinkedIn venció. Reconectala desde Integraciones." },
        422,
      );
    }
    if (!Array.isArray(integration.scopes) || !integration.scopes.includes("w_member_social")) {
      return reply(
        {
          error:
            "La cuenta de LinkedIn no autorizó permisos de publicación. Reconectala y aceptá los permisos.",
        },
        422,
      );
    }
    const { data: token, error: tokenError } = await admin.rpc("read_linkedin_token", {
      p_integration_id: integration.id,
    });
    if (tokenError || !token) throw tokenError ?? new Error("No se encontró el token de LinkedIn.");

    const commentary = [
      stylize(post.title, "bold"),
      stylize(post.subtitle ?? "", "italic"),
      post.body,
      post.company_help,
      post.call_to_action,
      Array.isArray(post.hashtags) ? post.hashtags.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!commentary.trim())
      return reply({ error: "La publicación no tiene contenido para enviar." }, 422);
    if (commentary.length > 3000)
      return reply(
        { error: "La publicación supera el máximo de 3000 caracteres de LinkedIn." },
        422,
      );

    const owner = `urn:li:person:${integration.external_account_id}`;
    let imageUrn: string | null = null;
    if (post.image_url) {
      const { data: imageFile, error: imageError } = await admin.storage
        .from("content-images")
        .download(post.image_url);
      if (imageError || !imageFile)
        throw imageError ?? new Error("No se pudo leer la imagen adjunta.");
      if (!["image/jpeg", "image/png", "image/gif"].includes(imageFile.type)) {
        return reply(
          {
            error:
              "LinkedIn admite imágenes JPG, PNG o GIF. Reemplazá la imagen adjunta antes de publicar.",
          },
          422,
        );
      }
      const initResponse = await fetch(
        "https://api.linkedin.com/rest/images?action=initializeUpload",
        {
          method: "POST",
          headers: linkedInHeaders(token),
          body: JSON.stringify({ initializeUploadRequest: { owner } }),
        },
      );
      const initBody = await initResponse.text();
      if (!initResponse.ok)
        throw new Error(
          `LinkedIn respondió ${initResponse.status}${initBody ? `: ${initBody.slice(0, 500)}` : ""}`,
        );
      const initPayload = JSON.parse(initBody) as {
        value?: { uploadUrl?: string; image?: string };
      };
      if (!initPayload.value?.uploadUrl || !initPayload.value.image)
        throw new Error("LinkedIn no devolvió los datos para cargar la imagen.");
      const uploadResponse = await fetch(initPayload.value.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": imageFile.type || "application/octet-stream" },
        body: await imageFile.arrayBuffer(),
      });
      if (!uploadResponse.ok)
        throw new Error(`LinkedIn no pudo cargar la imagen (${uploadResponse.status}).`);
      imageUrn = initPayload.value.image;
    }

    const createResponse = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: linkedInHeaders(token),
      body: JSON.stringify({
        author: owner,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
        ...(imageUrn
          ? { content: { media: { id: imageUrn, altText: post.title.slice(0, 120) } } }
          : {}),
      }),
    });
    if (!createResponse.ok) {
      const error = await providerError(createResponse);
      if (createResponse.status === 401 || createResponse.status === 403) {
        await admin
          .from("integrations")
          .update({ status: "error", last_error: error })
          .eq("id", integration.id);
      }
      throw new Error(error);
    }
    const externalPostId = createResponse.headers.get("x-restli-id") ?? null;
    const { error: updateError } = await admin
      .from("content_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        external_post_id: externalPostId,
        external_post_url: null,
        publish_error: null,
      })
      .eq("id", post.id)
      .eq("tenant_id", tenantId);
    if (updateError) throw updateError;
    await admin
      .from("integrations")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", integration.id);
    return reply({ externalPostId, imagePublished: Boolean(imageUrn) });
  } catch (error) {
    console.error(error);
    return reply(
      { error: error instanceof Error ? error.message : "No se pudo publicar en LinkedIn." },
      500,
    );
  }
});
