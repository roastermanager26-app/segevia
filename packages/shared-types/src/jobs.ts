import { z } from "zod";

/** Estados de un job. Deben coincidir con el enum `job_status` en Postgres. */
export const JobStatus = z.enum(["queued", "running", "succeeded", "failed", "dead"]);
export type JobStatus = z.infer<typeof JobStatus>;

/**
 * Catálogo de tipos de job con el schema de su payload.
 * Cada nuevo tipo de trabajo asíncrono se registra acá para que web y worker
 * compartan el mismo contrato.
 */
export const JobPayloads = {
  "system.ping": z.object({ message: z.string().max(200) }),
} as const;

export type JobType = keyof typeof JobPayloads;
export type JobPayload<T extends JobType> = z.infer<(typeof JobPayloads)[T]>;

export function parseJobPayload<T extends JobType>(type: T, payload: unknown): JobPayload<T> {
  return JobPayloads[type].parse(payload) as JobPayload<T>;
}

export function isKnownJobType(type: string): type is JobType {
  return Object.prototype.hasOwnProperty.call(JobPayloads, type);
}

/** Backoff exponencial con tope, en segundos. Espejo de `public.fail_job` en SQL. */
export function backoffSeconds(attempt: number, baseSeconds = 15, maxSeconds = 3600) {
  return Math.min(maxSeconds, baseSeconds * 2 ** Math.max(0, attempt - 1));
}
