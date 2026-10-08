import type { JobStatus, MembershipRole } from "./contracts";
export * from "./contracts";

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

export interface CompanyProfile {
  tenant_id: string;
  legal_name: string | null;
  tax_id: string | null;
  address_street: string | null;
  address_number: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  contact_email: string | null;
  telegram_handle: string | null;
  instagram_handle: string | null;
  description: string | null;
  offerings: string | null;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
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
