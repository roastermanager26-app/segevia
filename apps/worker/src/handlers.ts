import { isKnownJobType, parseJobPayload, type JobType } from "@segevia/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { isIP } from "node:net";

export interface JobRow {
  id: string;
  tenant_id: string;
  type: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

export interface JobContext {
  job: JobRow;
  db: SupabaseClient;
  log: (msg: string, extra?: Record<string, unknown>) => void;
}

/** Error que indica que reintentar no tiene sentido (payload inválido, permisos, etc.). */
export class NonRetryableError extends Error {
  override name = "NonRetryableError";
}

type Handler<T extends JobType> = (
  payload: ReturnType<typeof parseJobPayload<T>>,
  ctx: JobContext,
) => Promise<unknown>;

type Source = {
  id: string; tenant_id: string; kind: "file" | "url" | "manual"; source_url: string | null;
  storage_path: string | null; mime_type: string | null; title: string;
};
type ExtractedPart = { text: string; page?: number };
type EmbeddingConfig = { id: string; integration_id: string; model_id: string; slot: "primary" | "backup" };

const MAX_BYTES = 20 * 1024 * 1024;
const cleanText = (value: string) => value.replace(/\s+/g, " ").trim();

function chunkParts(parts: ExtractedPart[], size = 1_000, overlap = 150) {
  const chunks: Array<{ content: string; page_number: number | null }> = [];
  for (const part of parts) {
    const text = cleanText(part.text);
    for (let start = 0; start < text.length; start += size - overlap) {
      const content = text.slice(start, start + size).trim();
      if (content.length >= 60) chunks.push({ content, page_number: part.page ?? null });
      if (start + size >= text.length) break;
    }
  }
  return chunks;
}

function assertExternalHttpUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const privateIpv4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
  if (!(url.protocol === "https:" || url.protocol === "http:") || host === "localhost" || host.endsWith(".local") || isIP(host) === 6 || privateIpv4) {
    throw new NonRetryableError("La URL debe ser HTTP(S) pública.");
  }
  return url;
}

async function extractSource(db: SupabaseClient, source: Source): Promise<ExtractedPart[]> {
  if (source.kind === "url") {
    const url = assertExternalHttpUrl(source.source_url ?? "");
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`No se pudo leer la URL (${response.status}).`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new NonRetryableError("La página supera 20 MB.");
    const html = await response.text();
    if (html.length > MAX_BYTES) throw new NonRetryableError("La página supera 20 MB.");
    const text = cleanText(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
    return [{ text }];
  }
  if (!source.storage_path) throw new NonRetryableError("La fuente no tiene archivo asociado.");
  const { data, error } = await db.storage.from("kb-documents").download(source.storage_path);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el archivo.");
  if (data.size > MAX_BYTES) throw new NonRetryableError("El archivo supera 20 MB.");
  const buffer = Buffer.from(await data.arrayBuffer());
  if (source.mime_type === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      if (result.total > 200) throw new NonRetryableError("El PDF supera 200 páginas.");
      return result.pages.map((page) => ({ text: page.text, page: page.num }));
    } finally { await parser.destroy(); }
  }
  if (source.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return [{ text: result.value }];
  }
  return [{ text: buffer.toString("utf8") }];
}

async function createEmbeddings(db: SupabaseClient, tenantId: string, chunks: string[], log: JobContext["log"]) {
  const { data, error } = await db.from("llm_model_configs").select("id,integration_id,model_id,slot").eq("tenant_id", tenantId).eq("capability", "embedding").eq("is_active", true).order("slot");
  if (error) throw error;
  const configs = (data ?? []) as EmbeddingConfig[];
  if (!configs.length) throw new NonRetryableError("Configurá un modelo de embeddings en Integraciones antes de procesar esta fuente.");
  let lastError = "No se pudo generar embeddings.";
  for (const config of configs.sort((a, b) => a.slot === "primary" ? -1 : b.slot === "primary" ? 1 : 0)) {
    try {
      const { data: token, error: tokenError } = await db.rpc("read_llm_token", { p_integration_id: config.integration_id });
      if (tokenError || !token) throw tokenError ?? new Error("Token del proveedor no disponible.");
      const vectors: number[][] = [];
      for (let i = 0; i < chunks.length; i += 32) {
        const response = await fetch("https://openrouter.ai/api/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model_id, input: chunks.slice(i, i + 32) }) });
        if (!response.ok) throw new Error(`OpenRouter respondió ${response.status}.`);
        const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
        const batch = payload.data?.map((entry) => entry.embedding).filter((entry): entry is number[] => Array.isArray(entry)) ?? [];
        if (batch.length !== Math.min(32, chunks.length - i)) throw new Error("OpenRouter devolvió embeddings incompletos.");
        vectors.push(...batch);
      }
      await db.from("llm_model_configs").update({ health: "healthy", last_checked_at: new Date().toISOString(), last_error: null }).eq("id", config.id);
      return { model: config.model_id, vectors };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      log("falló modelo de embeddings; se prueba backup", { model: config.model_id, error: lastError });
      await db.from("llm_model_configs").update({ health: "unhealthy", last_checked_at: new Date().toISOString(), last_error: lastError }).eq("id", config.id);
    }
  }
  throw new Error(lastError);
}

/**
 * Registro de handlers por tipo de job. Cada release agrega los suyos
 * (kb.ingest_source, content.generate_post, content.generate_image, …).
 */
export const handlers: { [K in JobType]: Handler<K> } = {
  "system.ping": async (payload, ctx) => {
    ctx.log("pong", { message: payload.message });
    return { pong: payload.message, at: new Date().toISOString() };
  },
  "kb.ingest_source": async (payload, ctx) => {
    const { data, error } = await ctx.db.from("kb_sources").select("id,tenant_id,kind,source_url,storage_path,mime_type,title").eq("id", payload.sourceId).eq("tenant_id", ctx.job.tenant_id).single();
    if (error || !data) throw new NonRetryableError("La fuente no existe o no pertenece al tenant.");
    const source = data as Source;
    await ctx.db.from("kb_sources").update({ status: "processing", last_error: null }).eq("id", source.id);
    try {
      const parts = await extractSource(ctx.db, source);
      const chunks = chunkParts(parts);
      if (!chunks.length) throw new NonRetryableError("No se encontró texto utilizable en la fuente.");
      const { model, vectors } = await createEmbeddings(ctx.db, source.tenant_id, chunks.map((chunk) => chunk.content), ctx.log);
      const { error: deleteError } = await ctx.db.from("kb_chunks").delete().eq("source_id", source.id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await ctx.db.from("kb_chunks").insert(chunks.map((chunk, index) => ({ tenant_id: source.tenant_id, source_id: source.id, chunk_index: index, content: chunk.content, page_number: chunk.page_number, metadata: { title: source.title }, embedding: `[${vectors[index]?.join(",")}]`, embedding_model: model })));
      if (insertError) throw insertError;
      const { error: updateError } = await ctx.db.from("kb_sources").update({ status: "review", chunks_count: chunks.length, last_error: null }).eq("id", source.id);
      if (updateError) throw updateError;
      return { source_id: source.id, chunks: chunks.length, embedding_model: model, status: "review" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.db.from("kb_sources").update({ status: "error", last_error: message }).eq("id", source.id);
      throw error;
    }
  },
};

export async function runJob(job: JobRow, ctx: JobContext): Promise<unknown> {
  if (!isKnownJobType(job.type)) {
    throw new NonRetryableError(`Tipo de job desconocido: ${job.type}`);
  }
  let payload;
  try {
    payload = parseJobPayload(job.type, job.payload);
  } catch (err) {
    throw new NonRetryableError(`Payload inválido: ${(err as Error).message}`);
  }
  const handler = handlers[job.type] as Handler<typeof job.type>;
  return handler(payload, ctx);
}
