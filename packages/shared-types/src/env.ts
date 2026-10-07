import { z } from "zod";

/**
 * Variables públicas de la web. Solo claves VITE_* seguras para el navegador.
 * La service role key NUNCA forma parte de este schema.
 */
export const WebEnv = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
});
export type WebEnv = z.infer<typeof WebEnv>;

/** Variables del worker (server-side). */
export const WorkerEnv = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  WORKER_ID: z.string().default("worker-local"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(5),
});
export type WorkerEnv = z.infer<typeof WorkerEnv>;
