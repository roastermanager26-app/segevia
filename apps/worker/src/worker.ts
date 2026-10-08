import type { SupabaseClient } from "@supabase/supabase-js";
import { NonRetryableError, runJob, type JobRow } from "./handlers.js";

export interface WorkerOptions {
  workerId: string;
  batchSize: number;
  pollIntervalMs: number;
  leaseSeconds?: number;
}

function log(level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) {
  // Logs estructurados en una línea (JSON) para cualquier plataforma de hosting.
  console[level === "info" ? "log" : level](
    JSON.stringify({ level, msg, ts: new Date().toISOString(), ...extra }),
  );
}

export async function processBatch(db: SupabaseClient, opts: WorkerOptions): Promise<number> {
  const { data, error } = await db.rpc("claim_jobs", {
    p_worker_id: opts.workerId,
    p_limit: opts.batchSize,
    p_lease_seconds: opts.leaseSeconds ?? 300,
  });
  if (error) throw new Error(`claim_jobs: ${error.message}`);

  const jobs = (data ?? []) as JobRow[];
  await Promise.all(
    jobs.map(async (job) => {
      const ctx = {
        job,
        db,
        log: (msg: string, extra?: Record<string, unknown>) =>
          log("info", msg, { job_id: job.id, tenant_id: job.tenant_id, type: job.type, ...extra }),
      };
      try {
        const result = await runJob(job, ctx);
        const { data: ok, error: e } = await db.rpc("complete_job", {
          p_job_id: job.id,
          p_worker_id: opts.workerId,
          p_result: (result ?? null) as never,
        });
        if (e) throw e;
        if (!ok) log("warn", "lease perdido al completar", { job_id: job.id });
      } catch (err) {
        const retryable = !(err instanceof NonRetryableError);
        const message = err instanceof Error ? err.message : String(err);
        const { data: status } = await db.rpc("fail_job", {
          p_job_id: job.id,
          p_worker_id: opts.workerId,
          p_error: message,
          p_retryable: retryable,
        });
        log("error", "job fallido", { job_id: job.id, type: job.type, status, error: message });
      }
    }),
  );
  return jobs.length;
}

export function startWorker(db: SupabaseClient, opts: WorkerOptions) {
  let stopping = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    if (stopping) return;
    try {
      const n = await processBatch(db, opts);
      // Si el lote vino lleno, seguimos sin esperar.
      timer = setTimeout(tick, n >= opts.batchSize ? 0 : opts.pollIntervalMs);
    } catch (err) {
      log("error", "error en el ciclo del worker", { error: (err as Error).message });
      timer = setTimeout(tick, opts.pollIntervalMs * 2);
    }
  };

  log("info", "worker iniciado", { worker_id: opts.workerId });
  void tick();

  return () => {
    stopping = true;
    if (timer) clearTimeout(timer);
    log("info", "worker detenido", { worker_id: opts.workerId });
  };
}
