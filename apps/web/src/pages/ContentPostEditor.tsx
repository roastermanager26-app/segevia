import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { useActiveTenant, useTenant } from "../tenant/TenantProvider";
import { db } from "../lib/supabase";
import { functionErrorMessage } from "../lib/functionError";
import { useFeedback } from "../components/FeedbackProvider";
import { CHANNEL_CHARACTER_LIMITS, type ContentChannel } from "../lib/contentRules";
import { Badge, Button, Card, Field, Icon, inputClass } from "../components/ui";

type EditorKey = "title" | "subtitle" | "body" | "company_help" | "call_to_action" | "image_prompt";
type Post = {
  id: string;
  topic_id: string | null;
  channel: ContentChannel | "mailing";
  language: "es" | "en" | "pt";
  status: "draft" | "approved" | "pending_publish" | "published" | "archived";
  title: string;
  subtitle: string;
  body: string;
  company_help: string;
  call_to_action: string;
  hashtags: string[];
  image_prompt: string;
  image_url: string | null;
  image_created_by_ai: boolean;
};
type Topic = { id: string; name: string };

const channelLabels: Record<Post["channel"], string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x: "X",
  facebook: "Facebook",
  mailing: "Mailing",
};
const source = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const unicodeBold = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";
const unicodeItalic = "𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧0123456789";
const stylize = (value: string, format: "bold" | "italic") =>
  [...value]
    .map((character) => {
      const index = source.indexOf(character);
      return index < 0 ? character : [...(format === "bold" ? unicodeBold : unicodeItalic)][index];
    })
    .join("");

export function ContentPostEditor() {
  const { postId } = useParams();
  const { tenant } = useActiveTenant();
  const { can } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, notify } = useFeedback();
  const [localPost, setLocalPost] = useState<Post | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [history, setHistory] = useState<Post[]>([]);
  const activeInput = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const activeKey = useRef<EditorKey>("body");

  const postQuery = useQuery({
    queryKey: ["content-post", tenant.id, postId],
    enabled: Boolean(postId),
    queryFn: async () => {
      const { data, error } = await db()
        .from("content_posts")
        .select(
          "id,topic_id,channel,language,status,title,subtitle,body,company_help,call_to_action,hashtags,image_prompt,image_url,image_created_by_ai",
        )
        .eq("id", postId)
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (error || !data) throw error ?? new Error("No se encontró la publicación.");
      return data as Post;
    },
  });
  const post = localPost ?? postQuery.data;

  const { data: topics = [] } = useQuery({
    queryKey: ["content-topics", tenant.id],
    queryFn: async () => {
      const { data, error } = await db()
        .from("content_topics")
        .select("id,name")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Topic[];
    },
  });

  useEffect(() => {
    if (!post?.image_url) {
      setImagePreview(null);
      return;
    }
    db()
      .storage.from("content-images")
      .createSignedUrl(post.image_url, 3600)
      .then(({ data }) => setImagePreview(data?.signedUrl ?? null));
  }, [post?.image_url]);

  useEffect(() => {
    setHistory([]);
  }, [postId]);

  const set = <Key extends keyof Post>(key: Key, value: Post[Key]) => {
    if (!post) return;
    setHistory((current) => [...current.slice(-49), post]);
    setLocalPost({ ...post, [key]: value });
  };
  const undoLastChange = () => {
    setHistory((current) => {
      const previous = current.at(-1);
      if (previous) setLocalPost(previous);
      return current.slice(0, -1);
    });
  };
  const save = useMutation({
    mutationFn: async (status?: Post["status"]) => {
      if (!post) return;
      const { error } = await db()
        .from("content_posts")
        .update({ ...post, status: status ?? post.status })
        .eq("id", post.id)
        .eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setLocalPost(null);
      setMessage("Cambios guardados.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-post", tenant.id, postId] }),
        queryClient.invalidateQueries({ queryKey: ["content-posts", tenant.id] }),
      ]);
    },
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar."),
  });
  const updateImageAttribution = useMutation({
    mutationFn: async (imageCreatedByAi: boolean) => {
      if (!post) return;
      const { error } = await db()
        .from("content_posts")
        .update({ image_created_by_ai: imageCreatedByAi })
        .eq("id", post.id)
        .eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: async (_, imageCreatedByAi) => {
      setLocalPost((current) =>
        current ? { ...current, image_created_by_ai: imageCreatedByAi } : current,
      );
      notify(
        imageCreatedByAi
          ? "La imagen quedó marcada como creada con IA."
          : "La imagen ya no está marcada como creada con IA.",
      );
      await queryClient.invalidateQueries({ queryKey: ["content-post", tenant.id, postId] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar la atribución de la imagen.";
      setErrorMessage(message);
      notify(message, "error");
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { error } = await db()
        .from("content_posts")
        .delete()
        .eq("id", post.id)
        .eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => navigate("/content-studio/publicaciones"),
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo eliminar la publicación.",
      ),
  });
  const publishLinkedIn = useMutation({
    mutationFn: async () => {
      if (!post) return;
      if (post.channel !== "linkedin") {
        throw new Error("La publicación directa todavía está disponible solo para LinkedIn.");
      }
      const { data, error } = await db().functions.invoke("publish-linkedin-post", {
        body: { tenantId: tenant.id, postId: post.id },
      });
      if (error)
        throw new Error(await functionErrorMessage(error, "No se pudo publicar en LinkedIn."));
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: async () => {
      setLocalPost(null);
      setMessage("Publicación enviada a LinkedIn.");
      notify("Publicación enviada a LinkedIn.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-post", tenant.id, postId] }),
        queryClient.invalidateQueries({ queryKey: ["content-posts", tenant.id] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No se pudo publicar en LinkedIn.";
      setErrorMessage(message);
      notify(message, "error");
    },
  });

  const preview = useMemo(
    () =>
      post
        ? [
            stylize(post.title, "bold"),
            stylize(post.subtitle, "italic"),
            post.body,
            post.company_help,
            post.call_to_action,
            post.hashtags.join(" "),
          ]
            .filter(Boolean)
            .join("\n\n")
        : "",
    [post],
  );
  const characterLimit =
    post?.channel === "mailing" ? 10000 : post ? CHANNEL_CHARACTER_LIMITS[post.channel] : 0;
  const register =
    (key: EditorKey) => (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      activeInput.current = event.currentTarget;
      activeKey.current = key;
    };
  const formatSelection = (format: "bold" | "italic") => {
    if (!post || !activeInput.current) return;
    const input = activeInput.current;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const key = activeKey.current;
    if (start === end) {
      setErrorMessage("Seleccioná texto para aplicar formato.");
      return;
    }
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
    requestAnimationFrame(() =>
      input.setSelectionRange(start + emoji.length, start + emoji.length),
    );
  };
  const addBullets = () => {
    if (!post || !activeInput.current) return;
    const input = activeInput.current;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const key = activeKey.current;
    const value = String(post[key]);
    const blockStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf("\n", end);
    const blockEnd = nextBreak === -1 ? value.length : nextBreak;
    const bulletBlock = value
      .slice(blockStart, blockEnd)
      .split("\n")
      .map((line) => (line.trimStart().startsWith("• ") ? line : `• ${line}`))
      .join("\n");
    set(key, `${value.slice(0, blockStart)}${bulletBlock}${value.slice(blockEnd)}`);
    requestAnimationFrame(() =>
      input.setSelectionRange(blockStart, blockStart + bulletBlock.length),
    );
  };

  useEffect(() => {
    const handleUndoShortcut = (event: KeyboardEvent) => {
      if (
        activeInput.current &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        undoLastChange();
      }
    };
    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  });
  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setErrorMessage("Usá PNG, JPG o WebP de hasta 10 MB.");
      return;
    }
    const path = `${tenant.id}/posts/${post?.id}/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await db()
      .storage.from("content-images")
      .upload(path, file, { contentType: file.type });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
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

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      <header className="flex justify-between border-b border-hairline pb-space-md">
        <div>
          <Link to="/content-studio/publicaciones" className="text-body-sm text-primary">
            ← Volver a publicaciones
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="font-headline text-headline-lg font-bold">Editar publicación</h1>
            <Badge tone={post.status === "approved" ? "verified" : "neutral"}>
              {post.status === "approved" ? "Aprobada" : "Borrador"}
            </Badge>
            <select
              value={post.topic_id ?? ""}
              disabled={!can("admin")}
              onChange={(event) => set("topic_id", event.target.value || null)}
              className="h-7 rounded-full border border-hairline px-2 text-label-sm"
            >
              <option value="">Sin tema</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            {channelLabels[post.channel]} · {post.language}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>
            Guardar
          </Button>
          {post.status !== "approved" ? (
            <Button onClick={() => save.mutate("approved")}>Aprobar</Button>
          ) : post.channel === "linkedin" ? (
            <Button loading={publishLinkedIn.isPending} onClick={() => publishLinkedIn.mutate()}>
              Publicar
            </Button>
          ) : null}
        </div>
      </header>
      {message && <p className="text-secondary">{message}</p>}
      {errorMessage && <p className="text-error">{errorMessage}</p>}
      <div className="grid gap-space-lg xl:grid-cols-2">
        <Card className="flex flex-col gap-space-md">
          <h2 className="font-headline text-headline-md font-bold">Borrador editable</h2>
          <Field label="Título">
            <input
              value={post.title}
              onFocus={register("title")}
              onChange={(event) => set("title", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Subtítulo">
            <input
              value={post.subtitle}
              onFocus={register("subtitle")}
              onChange={(event) => set("subtitle", event.target.value)}
              className={inputClass}
            />
          </Field>
          <TextTools
            onBold={() => formatSelection("bold")}
            onItalic={() => formatSelection("italic")}
            onEmoji={insertEmoji}
            onBullets={addBullets}
            onUndo={undoLastChange}
            canUndo={history.length > 0}
          />
          <Field label="Desarrollo">
            <textarea
              value={post.body}
              onFocus={register("body")}
              onChange={(event) => set("body", event.target.value)}
              className={`${inputClass} h-40 py-2`}
            />
          </Field>
          <Field label="Cómo puede ayudar tu empresa">
            <textarea
              value={post.company_help}
              onFocus={register("company_help")}
              onChange={(event) => set("company_help", event.target.value)}
              className={`${inputClass} h-24 py-2`}
            />
          </Field>
          <Field label="Call to action">
            <textarea
              value={post.call_to_action}
              onFocus={register("call_to_action")}
              onChange={(event) => set("call_to_action", event.target.value)}
              className={`${inputClass} h-20 py-2`}
            />
          </Field>
          <Field label="Hashtags">
            <input
              value={post.hashtags.join(" ")}
              onChange={(event) => set("hashtags", event.target.value.split(/\s+/).filter(Boolean))}
              className={inputClass}
            />
          </Field>
          <Field label="Prompt sugerido para imagen">
            <textarea
              value={post.image_prompt}
              onFocus={register("image_prompt")}
              onChange={(event) => set("image_prompt", event.target.value)}
              className={`${inputClass} h-20 py-2`}
            />
          </Field>
          <Field label="Tu imagen">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void uploadImage(event.target.files?.[0])}
            />
          </Field>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-container-low px-3 py-2.5 text-body-sm">
            <span>
              <span className="block font-semibold text-on-surface">Imagen creada con IA</span>
              <span className="text-on-surface-variant">
                Se guarda automáticamente y se identifica en la vista previa.
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {post.image_created_by_ai && (
                <Badge tone="ai" icon="auto_awesome">
                  Marcada
                </Badge>
              )}
              <input
                type="checkbox"
                checked={post.image_created_by_ai}
                disabled={!can("admin") || updateImageAttribution.isPending}
                onChange={(event) => {
                  const imageCreatedByAi = event.target.checked;
                  set("image_created_by_ai", imageCreatedByAi);
                  updateImageAttribution.mutate(imageCreatedByAi);
                }}
                className="h-5 w-5 accent-primary disabled:cursor-not-allowed"
              />
            </span>
          </label>
        </Card>
        <Card>
          <div className="flex justify-between">
            <h2 className="font-headline text-headline-md font-bold">Vista previa</h2>
            <Badge tone={preview.length > characterLimit ? "human" : "verified"}>
              {preview.length}/{characterLimit}
            </Badge>
          </div>
          <div className="mt-space-lg rounded-xl bg-surface-container-low p-space-lg">
            <p className="font-semibold">{tenant.name}</p>
            <p className="text-body-sm">{channelLabels[post.channel]} · Ahora</p>
            <div className="mt-space-lg whitespace-pre-wrap">{preview}</div>
            {post.image_created_by_ai && (
              <div className="mt-space-md">
                <Badge tone="ai" icon="auto_awesome">
                  Imagen creada con IA
                </Badge>
              </div>
            )}
            {imagePreview && (
              <div className="relative mt-space-lg">
                <img className="w-full rounded-xl" src={imagePreview} alt="Publicación" />
                {post.image_created_by_ai && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-1 text-label-sm text-white">
                    <Icon name="auto_awesome" className="text-sm" /> Creada con IA
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-space-md">
        <Button variant="secondary" onClick={() => navigate("/content-studio/publicaciones")}>
          Cancelar
        </Button>
        {post.status !== "approved" && (
          <Button loading={save.isPending} onClick={() => save.mutate("approved")}>
            Aprobar
          </Button>
        )}
        {post.status === "approved" && (
          <>
            {post.channel === "linkedin" && (
              <Button loading={publishLinkedIn.isPending} onClick={() => publishLinkedIn.mutate()}>
                Publicar
              </Button>
            )}
            <Button variant="secondary" icon="content_copy" onClick={() => void copyPost()}>
              Copiar publicación
            </Button>
          </>
        )}
        <Button
          variant="danger"
          icon="delete"
          disabled={!can("admin")}
          loading={remove.isPending}
          onClick={() => {
            void confirm({
              title: "Eliminar publicación",
              message: "¿Eliminar esta publicación? Esta acción no se puede deshacer.",
              confirmLabel: "Eliminar",
              tone: "error",
            }).then((accepted) => {
              if (accepted) remove.mutate();
            });
          }}
        >
          Eliminar
        </Button>
      </div>
    </div>
  );
}

function TextTools({
  onBold,
  onItalic,
  onEmoji,
  onBullets,
  onUndo,
  canUndo,
}: {
  onBold: () => void;
  onItalic: () => void;
  onEmoji: (emoji: string) => void;
  onBullets: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const emojis = [
    "✨",
    "💡",
    "🚀",
    "✅",
    "📈",
    "🤖",
    "🔥",
    "🎯",
    "📌",
    "💬",
    "🌟",
    "🙌",
    "👋",
    "⚡",
    "🔎",
    "💼",
    "📊",
    "🧠",
    "🛡️",
    "🌐",
    "⏱️",
    "🎉",
    "👉",
    "👇",
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low p-3">
      <Button variant="secondary" onClick={onBold}>
        𝐁 Negrita
      </Button>
      <Button variant="secondary" onClick={onItalic}>
        𝘐 Cursiva
      </Button>
      <Button variant="secondary" icon="format_list_bulleted" onClick={onBullets}>
        Viñetas
      </Button>
      <Button variant="secondary" icon="undo" disabled={!canUndo} onClick={onUndo}>
        Deshacer
      </Button>
      <span className="hidden h-6 w-px bg-hairline sm:block" aria-hidden="true" />
      <div className="flex flex-wrap gap-1" aria-label="Emoticones">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onEmoji(emoji)}
            className="rounded-lg border border-hairline px-1.5 py-1 text-base hover:bg-white"
            title={`Agregar ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
