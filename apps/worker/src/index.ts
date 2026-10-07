import { createClient } from "@supabase/supabase-js";
import { WorkerEnv } from "@segevia/shared-types";
import { startWorker } from "./worker.js";

const parsed = WorkerEnv.safeParse({
  // En local reutilizamos la URL pública si no hay una específica.
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  WORKER_ID: process.env.WORKER_ID,
  WORKER_POLL_INTERVAL_MS: process.env.WORKER_POLL_INTERVAL_MS,
  WORKER_BATCH_SIZE: process.env.WORKER_BATCH_SIZE,
});

if (!parsed.success) {
  console.error("Configuración inválida del worker. Revisá .env.local (ver .env.example).");
  console.error(parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n"));
  process.exit(1);
}

const env = parsed.data;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stop = startWorker(db, {
  workerId: env.WORKER_ID,
  batchSize: env.WORKER_BATCH_SIZE,
  pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
}
