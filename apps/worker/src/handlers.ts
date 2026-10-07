import { isKnownJobType, parseJobPayload, type JobType } from "@segevia/shared-types";

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

/**
 * Registro de handlers por tipo de job. Cada release agrega los suyos
 * (kb.ingest_source, content.generate_post, content.generate_image, …).
 */
export const handlers: { [K in JobType]: Handler<K> } = {
  "system.ping": async (payload, ctx) => {
    ctx.log("pong", { message: payload.message });
    return { pong: payload.message, at: new Date().toISOString() };
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
