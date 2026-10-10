-- SEGEVIA · Content Studio: temas y hallazgos de tendencias por tenant.

create type public.content_finding_status as enum ('active', 'used', 'expired', 'error');

create table public.content_topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  keywords text[] not null check (cardinality(keywords) between 5 and 10),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, name)
);
create index content_topics_active_tenant_idx on public.content_topics(tenant_id, is_active, updated_at);
create trigger content_topics_updated_at before update on public.content_topics for each row execute function public.set_updated_at();

create table public.content_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  topic_id uuid not null references public.content_topics(id) on delete cascade,
  provider text not null check (provider in ('tavily', 'searchapi')),
  canonical_url text not null check (canonical_url ~* '^https?://'),
  source_name text,
  title text not null check (char_length(trim(title)) between 2 and 500),
  published_at timestamptz,
  summary text not null check (array_length(regexp_split_to_array(trim(summary), '[[:space:]]+'), 1) <= 500),
  relevance_reason text not null,
  language text,
  status public.content_finding_status not null default 'active',
  discovered_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, canonical_url)
);
create index content_findings_active_tenant_idx on public.content_findings(tenant_id, status, expires_at desc);
create index content_findings_topic_idx on public.content_findings(topic_id, discovered_at desc);
create trigger content_findings_updated_at before update on public.content_findings for each row execute function public.set_updated_at();

alter table public.content_topics enable row level security;
alter table public.content_findings enable row level security;

create policy content_topics_select on public.content_topics for select to authenticated using (public.has_tenant_role(tenant_id, 'viewer'));
create policy content_topics_write on public.content_topics for all to authenticated using (public.has_tenant_role(tenant_id, 'admin')) with check (public.has_tenant_role(tenant_id, 'admin'));
create policy content_findings_select on public.content_findings for select to authenticated using (public.has_tenant_role(tenant_id, 'viewer'));
create policy content_findings_write on public.content_findings for all to authenticated using (public.has_tenant_role(tenant_id, 'admin')) with check (public.has_tenant_role(tenant_id, 'admin'));

-- La purga se ejecutará por worker/scheduler con service_role. Los hallazgos usados
-- se preservan hasta que el usuario elimine el contenido asociado.
create or replace function public.expire_content_findings()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.content_findings
  set status = 'expired'
  where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_content_findings() from public, anon, authenticated;
grant execute on function public.expire_content_findings() to service_role;
