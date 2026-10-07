-- =============================================================================
-- SEGEVIA · Release 0 · 02 — Integraciones (metadatos, nunca secretos)
-- Los tokens/claves de cada tenant viven en Supabase Vault; acá solo guardamos
-- la referencia (secret_id) y metadatos operativos sanitizados.
-- =============================================================================

create type public.integration_status as enum ('disconnected', 'connected', 'error', 'expired');

create table public.integrations (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  provider             text not null check (provider ~ '^[a-z0-9_]+$'),
  display_name         text,
  status               public.integration_status not null default 'disconnected',
  scopes               text[] not null default '{}',
  external_account_id  text,
  secret_id            uuid,           -- referencia a vault.secrets; jamás el valor
  expires_at           timestamptz,
  last_synced_at       timestamptz,
  last_error           text,           -- mensaje sanitizado, sin tokens ni payloads
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique nulls not distinct (tenant_id, provider, external_account_id)
);
create index integrations_tenant_idx on public.integrations (tenant_id);

create trigger integrations_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

create or replace function public.audit_integration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.integrations;
begin
  v_row := coalesce(new, old);
  if not exists (select 1 from public.tenants t where t.id = v_row.tenant_id) then
    return null;
  end if;
  perform public.write_audit_log(
    v_row.tenant_id,
    'integration.' || lower(tg_op),
    'integration',
    v_row.id::text,
    jsonb_build_object(
      'provider', v_row.provider,
      'old_status', case when tg_op <> 'INSERT' then old.status end,
      'new_status', case when tg_op <> 'DELETE' then new.status end
    )
  );
  return null;
end;
$$;

create trigger integrations_audit after insert or update or delete on public.integrations
  for each row execute function public.audit_integration_change();

alter table public.integrations enable row level security;

create policy integrations_select on public.integrations for select to authenticated
  using (public.has_tenant_role(tenant_id, 'viewer'));
create policy integrations_insert on public.integrations for insert to authenticated
  with check (public.has_tenant_role(tenant_id, 'admin'));
create policy integrations_update on public.integrations for update to authenticated
  using (public.has_tenant_role(tenant_id, 'admin'))
  with check (public.has_tenant_role(tenant_id, 'admin'));
create policy integrations_delete on public.integrations for delete to authenticated
  using (public.has_tenant_role(tenant_id, 'admin'));
