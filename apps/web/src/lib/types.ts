import type { JobStatus, MembershipRole } from "@segevia/shared-types";

// Tipos mínimos de lectura. Se reemplazarán por los generados con `pnpm db:types`.

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface Membership {
  role: MembershipRole;
  tenant: Tenant;
}

export interface Profile {
  id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
}

export interface BudgetStatus {
  budget_id: string;
  scope: "tenant" | "agent" | "channel";
  scope_ref: string | null;
  limit_usd: number;
  spent_usd: number;
  reserved_usd: number;
  used_pct: number;
  on_exhaust: "alert" | "degrade" | "pause";
}

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  finished_at: string | null;
}
