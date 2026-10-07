import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processBatch } from "./worker.js";

function fakeDb(jobs: unknown[]) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "claim_jobs") return { data: jobs, error: null };
      if (fn === "complete_job") return { data: true, error: null };
      if (fn === "fail_job") return { data: "failed", error: null };
      return { data: null, error: null };
    }),
  } as unknown as SupabaseClient;
  return { db, calls };
}

const opts = { workerId: "test", batchSize: 5, pollIntervalMs: 10 };

describe("processBatch", () => {
  it("completa un job válido", async () => {
    const { db, calls } = fakeDb([
      { id: "1", tenant_id: "t", type: "system.ping", payload: { message: "hola" }, attempts: 1, max_attempts: 5 },
    ]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await processBatch(db, opts)).toBe(1);
    expect(calls.map((c) => c.fn)).toEqual(["claim_jobs", "complete_job"]);
  });

  it("manda a dead-letter (no reintentable) un tipo desconocido", async () => {
    const { db, calls } = fakeDb([
      { id: "2", tenant_id: "t", type: "nope.unknown", payload: {}, attempts: 1, max_attempts: 5 },
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await processBatch(db, opts);
    const fail = calls.find((c) => c.fn === "fail_job");
    expect(fail?.args.p_retryable).toBe(false);
  });

  it("manda a dead-letter un payload inválido", async () => {
    const { db, calls } = fakeDb([
      { id: "3", tenant_id: "t", type: "system.ping", payload: { message: 42 }, attempts: 1, max_attempts: 5 },
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await processBatch(db, opts);
    expect(calls.find((c) => c.fn === "fail_job")?.args.p_retryable).toBe(false);
  });
});
