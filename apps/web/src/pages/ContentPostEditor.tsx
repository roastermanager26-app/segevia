import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { useActiveTenant, useTenant } from "../tenant/TenantProvider";
import { db } from "../lib/supabase";
import { CHANNEL_CHARACTER_LIMITS, type ContentChannel } from "../lib/contentRules";
import { Badge, Button, Card, Field, inputClass } from "../components/ui";

type EditorKey = "title" | "subtitle" | "body" | "company_help" | "call_to_action" | "image_prompt";
type Post = {
  id: string; topic_id: string | null; channel: ContentChannel | "mailing";
  language: "es" | "en" | "pt"; status: "draft" | "approved" | "pending_publish" | "published" | "archived";
  title: string; subtitle: string; body: string; company_help: string; call_to_action: string;
  hashtags: string[]; image_prompt: string; image_url: string | null; image_created_by_ai: boolean;
};
type Topic = { id: string; name: string };

const channelLabels: Record<Post["channel"], string> = {
  linkedin: "LinkedIn", instagram: "Instagram", x: "X", facebook: "Facebook", mailing: "Mailing",
};
const source = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const unicodeBold = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";
const unicodeItalic = "𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧0123456789";
const stylize = (value: string, format: "bold" | "italic") =>
  [...value].map((character) => {
    const index = source.indexOf(character);
    return index < 0 ? character : [...(format === "bold" ? unicodeBold : unicodeItalic)][index];
  }).join("");

export function ContentPostEditor() {
  const { postId } = useParams();
  const { tenant } = useActiveTenant();
  const { can } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [localPost, setLocalPost] = useState<Post | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const activeInput = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const activeKey = useRef<EditorKey>("body");

  const postQuery = useQuery({
    queryKey: ["content-post", tenant.id, postId], enabled: Boolean(postId),
    queryFn: async () => {
      const { data, error } = await db().from("content_posts")
        .select("id,topic_id,channel,language,status,title,subtitle,body,company_help,call_to_action,hashtags,image_prompt,image_url,image_created_by_ai")
        .eq("id", postId).eq("tenant_id", tenant.id).maybeSingle();
      if (error || !data) throw error ?? new Error("No se encontró la publicación.");
      return data as Post;
    },
  });
  const post = localPost ?? postQuery.data;

  const { data: topics = [] } = useQuery({
    queryKey: ["content-topics", tenant.id],
    queryFn: async () => {
      const { data, error } = await db().from("content_topics").select("id,name")
        .eq("tenant_id", tenant.id).eq("is_active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Topic[];
    },
  });

  useEffect(() => {
    if (!post?.image_url) { setImagePreview(null); return; }
    db().storage.from("content-images").createSignedUrl(post.image_url, 3600)
      .then(({ data }) => setImagePreview(data?.signedUrl ?? null));
  }, [post?.image_url]);

  const set = <Key extends keyof Post>(key: Key, value: Post[Key]) => {
    if (post) setLocalPost({ ...post, [key]: value });
  };
  const save = useMutation({
    mutationFn: async (status?: Post["status"]) => {
      if (!post) return;
      const { error } = await db().from("content_posts").update({ ...post, status: status ?? post.status })
        .eq("id", post.id).eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setLocalPost(null); setMessage("Cambios guardados.");
      void queryClient.invalidateQueries({ queryKey: ["content-post", tenant.id, postId] });
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar."),
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { error } = await db().from("content_posts").delete().eq("id", post.id).eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => navigate("/content-studio/publicaciones"),
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la publicación."),
  });

  const preview = useMemo(() => post ? [
    stylize(post.title, "bold"), stylize(post.subtitle, "italic"), post.body,
    post.company_help, post.call_to_action, post.hashtags.join(" "),
  ].filter(Boolean).join("\n\n") : "", [post]);
  const characterLimit = post?.channel === "mailing" ? 10000 : post ? CHANNEL_CHARACTER_LIMITS[post.channel] : 0;
  const register = (key: EditorKey) => (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    activeInput.current = event.currentTarget;
    activeKey.current = key;
  };
  const formatSelection = (format: "bold" | "italic") => {
    if (!post || !activeInput.current) return;
    const input = activeInput.current;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const key = activeKey.current;
    if (start === end) { setErrorMessage("Seleccioná texto para aplicar formato."); return; }
    const value = String(post[key]);
    const formatted = stylize(value.slice(start, end), format);
    set(key, `${value.slice(0, start)}${formatted}${value.slice(end)}`);
    requestAnimationFrame(() => input.setSelectionRange(start, start + formatted.length));
  };
  const insertEmoji = (emoji: string) => {
    if (!post || !activeInput.current) return;
    const input = activeInput.current;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const value = String(post[activeKey.current]);
    set(activeKey.current, `${value.slice(0, start)}${emoji}${value.slice(end)}`);
  };
  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setErrorMessage("Usá PNG, JPG o WebP de hasta 10 MB."); return;
    }
    const path = `${tenant.id}/posts/${post?.id}/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await db().storage.from("content-images").upload(path, file, { contentType: file.type });
    if (error) { setErrorMessage(error.message); return; }
    set("image_url", path);
    setImagePreview(URL.createObjectURL(file));
  };
  const copyPost = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setMessage("Publicación copiada al portapapeles.");
    } catch {
      setErrorMessage("No se pudo copiar automáticamente. Seleccioná el texto de la vista previa.");
    }
  };

  if (postQuery.isLoading) return <p>Cargando publicación…</p>;
  if (!post) return <Card>No se encontró la publicación.</Card>;

  return <div className="flex flex-col gap-space-lg pb-12">
    <header className="flex justify-between border-b border-hairline pb-space-md">
      <div>
        <Link to="/content-studio/publicaciones" className="text-body-sm text-primary">← Volver a publicaciones</Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="font-headline text-headline-lg font-bold">Editar publicación</h1>
          <Badge tone={post.status === "approved" ? "verified" : "neutral"}>{post.status === "approved" ? "Aprobada" : "Borrador"}</Badge>
          <select value={post.topic_id ?? ""} disabled={!can("admin")} onChange={(event) => set("topic_id", event.target.value || null)} className="h-7 rounded-full border border-hairline px-2 text-label-sm">
            <option value="">Sin tema</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
          </select>
        </div>
        <p className="text-body-sm text-on-surface-variant">{channelLabels[post.channel]} · {post.language}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>Guardar</Button>
        <Button disabled={post.status === "approved"} onClick={() => save.mutate("approved")}>Aprobar</Button>
      </div>
    </header>
    {message && <p className="text-secondary">{message}</p>}
    {errorMessage && <p className="text-error">{errorMessage}</p>}
    <div className="grid gap-space-lg xl:grid-cols-2">
      <Card className="flex flex-col gap-space-md">
        <h2 className="font-headline text-headline-md font-bold">Borrador editable</h2>
        <Field label="Título"><input value={post.title} onFocus={register("title")} onChange={(event) => set("title", event.target.value)} className={inputClass} /></Field>
        <Field label="Subtítulo"><input value={post.subtitle} onFocus={register("subtitle")} onChange={(event) => set("subtitle", event.target.value)} className={inputClass} /></Field>
        <TextTools onBold={() => formatSelection("bold")} onItalic={() => formatSelection("italic")} onEmoji={insertEmoji} />
        <Field label="Desarrollo"><textarea value={post.body} onFocus={register("body")} onChange={(event) => set("body", event.target.value)} className={`${inputClass} h-40 py-2`} /></Field>
        <Field label="Cómo puede ayudar tu empresa"><textarea value={post.company_help} onFocus={register("company_help")} onChange={(event) => set("company_help", event.target.value)} className={`${inputClass} h-24 py-2`} /></Field>
        <Field label="Call to action"><textarea value={post.call_to_action} onFocus={register("call_to_action")} onChange={(event) => set("call_to_action", event.target.value)} className={`${inputClass} h-20 py-2`} /></Field>
        <Field label="Hashtags"><input value={post.hashtags.join(" ")} onChange={(event) => set("hashtags", event.target.value.split(/\s+/).filter(Boolean))} className={inputClass} /></Field>
        <Field label="Prompt sugerido para imagen"><textarea value={post.image_prompt} onFocus={register("image_prompt")} onChange={(event) => set("image_prompt", event.target.value)} className={`${inputClass} h-20 py-2`} /></Field>
        <Field label="Tu imagen"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadImage(event.target.files?.[0])} /></Field>
        <label><input type="checkbox" checked={post.image_created_by_ai} onChange={(event) => set("image_created_by_ai", event.target.checked)} /> Imagen creada con IA</label>
      </Card>
      <Card>
        <div className="flex justify-between"><h2 className="font-headline text-headline-md font-bold">Vista previa</h2><Badge tone={preview.length > characterLimit ? "human" : "verified"}>{preview.length}/{characterLimit}</Badge></div>
        <div className="mt-space-lg rounded-xl bg-surface-container-low p-space-lg"><p className="font-semibold">{tenant.name}</p><p className="text-body-sm">{channelLabels[post.channel]} · Ahora</p><div className="mt-space-lg whitespace-pre-wrap">{preview}</div>{imagePreview && <img className="mt-space-lg w-full rounded-xl" src={imagePreview} alt="Publicación" />}</div>
      </Card>
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-space-md">
      <Button variant="secondary" onClick={() => navigate("/content-studio/publicaciones")}>Cancelar</Button>
      {post.status !== "approved" && <Button loading={save.isPending} onClick={() => save.mutate("approved")}>Aprobar</Button>}
      {post.status === "approved" && <Button variant="secondary" icon="content_copy" onClick={() => void copyPost()}>Copiar publicación</Button>}
      <Button variant="danger" icon="delete" disabled={!can("admin")} loading={remove.isPending} onClick={() => { if (window.confirm("¿Eliminar esta publicación?")) remove.mutate(); }}>Eliminar</Button>
    </div>
  </div>;
}

function TextTools({ onBold, onItalic, onEmoji }: { onBold: () => void; onItalic: () => void; onEmoji: (emoji: string) => void }) {
  return <div className="flex flex-wrap gap-2 rounded-xl bg-surface-container-low p-3">
    <Button variant="secondary" onClick={onBold}>𝐁 Negrita</Button>
    <Button variant="secondary" onClick={onItalic}>𝘐 Cursiva</Button>
    {["✨", "💡", "🚀", "✅", "📈", "🤖"].map((emoji) => <button key={emoji} type="button" onClick={() => onEmoji(emoji)} className="rounded-lg border border-hairline px-2">{emoji}</button>)}
  </div>;
}
