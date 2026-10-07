-- =============================================================================
-- SEGEVIA · Release 0 · 01 — Fundaciones multi-tenant
-- tenants, profiles, memberships, audit_logs y la función única de autorización.
-- =============================================================================

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Orden ascendente a propósito: permite comparar roles con >= (viewer < ... < owner).
create type public.membership_role as enum ('viewer', 'operator', 'admin', 'owner');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  plan        text not null default 'trial',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  job_title   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.membership_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  actor_id     uuid references auth.users (id) on delete set null,
  actor_type   text not null default 'user' check (actor_type in ('user', 'system', 'agent')),
  action       text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type  text not null,
  entity_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_logs_tenant_created_idx on public.audit_logs (tenant_id, created_at desc);

create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Función ÚNICA de autorización por tenant (design.md §5).
-- Toda política RLS de datos de tenant debe usar esta función.
-- SECURITY DEFINER evita recursión de RLS sobre memberships.
-- -----------------------------------------------------------------------------
create or replace function public.has_tenant_role(
  p_tenant_id uuid,
  p_min_role  public.membership_role default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
      and m.role >= p_min_role
  );
$$;

-- ¿El usuario actual comparte al menos un tenant con p_user_id?
create or replace function public.shares_tenant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke execute on function public.has_tenant_role(uuid, public.membership_role) from public, anon;
revoke execute on function public.shares_tenant_with(uuid) from public, anon;
grant execute on function public.has_tenant_role(uuid, public.membership_role) to authenticated, service_role;
grant execute on function public.shares_tenant_with(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Auditoría: escritura solo vía función server-side; inmutable.
-- -----------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_tenant_id   uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   text default null,
  p_metadata    jsonb default '{}'::jsonb,
  p_actor_type  text default 'user'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (tenant_id, actor_id, actor_type, action, entity_type, entity_id, metadata)
  values (p_tenant_id, (select auth.uid()), p_actor_type, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke execute on function public.write_audit_log(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.write_audit_log(uuid, text, text, text, jsonb, text) to service_role;

create or replace function public.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% es inmutable (append-only)', tg_table_name using errcode = '42501';
end;
$$;

create trigger audit_logs_immutable before update on public.audit_logs
  for each row execute function public.prevent_mutation();

-- Auditoría automática de cambios de membresía/permisos.
create or replace function public.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.memberships;
begin
  v_row := coalesce(new, old);
  -- Si el tenant se está borrando en cascada, no hay nada que auditar.
  if not exists (select 1 from public.tenants t where t.id = v_row.tenant_id) then
    return null;
  end if;
  perform public.write_audit_log(
    v_row.tenant_id,
    'membership.' || lower(tg_op),
    'membership',
    v_row.id::text,
    jsonb_build_object(
      'user_id', v_row.user_id,
      'old_role', case when tg_op <> 'INSERT' then old.role end,
      'new_role', case when tg_op <> 'DELETE' then new.role end
    )
  );
  return null;
end;
$$;

create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.audit_membership_change();

-- Una organización nunca puede quedarse sin owner.
create or replace function public.ensure_tenant_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.tenants t where t.id = old.tenant_id)
     and not exists (
       select 1 from public.memberships m
       where m.tenant_id = old.tenant_id and m.role = 'owner' and m.id <> old.id
     )
  then
    raise exception 'La organización debe conservar al menos un owner' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_owner before update or delete on public.memberships
  for each row execute function public.ensure_tenant_has_owner();

-- -----------------------------------------------------------------------------
-- Alta automática de profile al registrarse
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RPC: crear organización (el creador queda como owner)
-- -----------------------------------------------------------------------------
create or replace function public.create_tenant(p_name text, p_slug text)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_tenant public.tenants;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  insert into public.tenants (name, slug)
  values (trim(p_name), lower(trim(p_slug)))
  returning * into v_tenant;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant.id, v_uid, 'owner');

  perform public.write_audit_log(v_tenant.id, 'tenant.created', 'tenant', v_tenant.id::text,
    jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug));

  return v_tenant;
end;
$$;
revoke execute on function public.create_tenant(text, text) from public, anon;
grant execute on function public.create_tenant(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.tenants     enable row level security;
alter table public.profiles    enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_logs  enable row level security;

-- tenants: ver si soy miembro; editar si soy admin; borrar si soy owner. Alta solo vía RPC.
create policy tenants_select on public.tenants for select to authenticated
  using (public.has_tenant_role(id, 'viewer'));
create policy tenants_update on public.tenants for update to authenticated
  using (public.has_tenant_role(id, 'admin'))
  with check (public.has_tenant_role(id, 'admin'));
create policy tenants_delete on public.tenants for delete to authenticated
  using (public.has_tenant_role(id, 'owner'));

-- profiles: el propio y los de compañeros de organización; editar solo el propio.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_tenant_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- memberships: miembros ven el equipo; admins gestionan, pero solo un owner toca owners.
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.has_tenant_role(tenant_id, 'viewer'));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    public.has_tenant_role(tenant_id, 'admin')
    and (role <> 'owner' or public.has_tenant_role(tenant_id, 'owner'))
  );
create policy memberships_update on public.memberships for update to authenticated
  using (
    public.has_tenant_role(tenant_id, 'admin')
    and (role <> 'owner' or public.has_tenant_role(tenant_id, 'owner'))
  )
  with check (
    public.has_tenant_role(tenant_id, 'admin')
    and (role <> 'owner' or public.has_tenant_role(tenant_id, 'owner'))
  );
create policy memberships_delete on public.memberships for delete to authenticated
  using (
    public.has_tenant_role(tenant_id, 'admin')
    and (role <> 'owner' or public.has_tenant_role(tenant_id, 'owner'))
  );

-- audit_logs: lectura para admins; sin escritura directa desde el cliente.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.has_tenant_role(tenant_id, 'admin'));

revoke insert, update, delete on public.audit_logs from anon, authenticated;
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
-- =============================================================================
-- SEGEVIA · Release 0 · 03 — Ledger de consumos y presupuestos con reserva atómica
-- =============================================================================

create type public.budget_scope        as enum ('tenant', 'agent', 'channel');
create type public.budget_action       as enum ('alert', 'degrade', 'pause');
create type public.reservation_status  as enum ('active', 'committed', 'released', 'expired');

create table public.budgets (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  scope             public.budget_scope not null default 'tenant',
  scope_ref         text,  -- agent_id o nombre de canal; null para scope = tenant
  limit_usd         numeric(14, 4) not null check (limit_usd > 0),
  alert_thresholds  smallint[] not null default '{75,90,100}',
  on_exhaust        public.budget_action not null default 'alert',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((scope = 'tenant') = (scope_ref is null)),
  unique nulls not distinct (tenant_id, scope, scope_ref)
);

create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

create table public.budget_reservations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  budget_id   uuid not null references public.budgets (id) on delete cascade,
  amount_usd  numeric(14, 6) not null check (amount_usd > 0),
  actual_usd  numeric(14, 6) check (actual_usd >= 0),
  status      public.reservation_status not null default 'active',
  job_id      uuid,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  settled_at  timestamptz
);
create index budget_reservations_active_idx
  on public.budget_reservations (budget_id) where status = 'active';

-- Ledger inmutable: una fila por evento facturable.
create table public.usage_events (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  occurred_at      timestamptz not null default now(),
  provider         text not null,          -- openai, gemini, openrouter, fal, tavily…
  model            text,
  operation        text not null,          -- generate, embed, image, search…
  unit_type        text not null check (unit_type in
                     ('input_tokens', 'output_tokens', 'image', 'voice_minute', 'message', 'search', 'request')),
  units            numeric(18, 4) not null check (units >= 0),
  cost_usd         numeric(14, 6) not null check (cost_usd >= 0),
  agent_id         uuid,
  channel          text,
  job_id           uuid,
  reservation_id   uuid references public.budget_reservations (id) on delete set null,
  idempotency_key  text unique,
  metadata         jsonb not null default '{}'::jsonb
);
create index usage_events_tenant_time_idx on public.usage_events (tenant_id, occurred_at desc);

create trigger usage_events_immutable before update on public.usage_events
  for each row execute function public.prevent_mutation();

-- -----------------------------------------------------------------------------
-- Auditoría de cambios de presupuesto (incluye transiciones de modo de límite).
-- -----------------------------------------------------------------------------
create or replace function public.audit_budget_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.budgets;
begin
  v_row := coalesce(new, old);
  if not exists (select 1 from public.tenants t where t.id = v_row.tenant_id) then
    return null;
  end if;
  perform public.write_audit_log(
    v_row.tenant_id, 'budget.' || lower(tg_op), 'budget', v_row.id::text,
    jsonb_build_object(
      'scope', v_row.scope, 'scope_ref', v_row.scope_ref,
      'old_limit', case when tg_op <> 'INSERT' then old.limit_usd end,
      'new_limit', case when tg_op <> 'DELETE' then new.limit_usd end,
      'old_on_exhaust', case when tg_op <> 'INSERT' then old.on_exhaust end,
      'new_on_exhaust', case when tg_op <> 'DELETE' then new.on_exhaust end
    )
  );
  return null;
end;
$$;

create trigger budgets_audit after insert or update or delete on public.budgets
  for each row execute function public.audit_budget_change();

-- -----------------------------------------------------------------------------
-- Gasto del período actual (mes calendario UTC) para un presupuesto.
-- -----------------------------------------------------------------------------
create or replace function public.budget_spent_usd(p_budget public.budgets)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(u.cost_usd), 0)
  from public.usage_events u
  where u.tenant_id = p_budget.tenant_id
    and u.occurred_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
    and case p_budget.scope
          when 'tenant'  then true
          when 'agent'   then u.agent_id::text = p_budget.scope_ref
          when 'channel' then u.channel = p_budget.scope_ref
        end;
$$;

-- -----------------------------------------------------------------------------
-- reserve_budget: reserva atómica previa a una acción costosa.
-- El SELECT ... FOR UPDATE sobre el presupuesto serializa reservas concurrentes,
-- evitando sobreconsumo. Devuelve la decisión para que el worker actúe
-- (continuar, degradar modelo o abortar).
-- -----------------------------------------------------------------------------
create or replace function public.reserve_budget(
  p_tenant_id    uuid,
  p_amount_usd   numeric,
  p_scope        public.budget_scope default 'tenant',
  p_scope_ref    text default null,
  p_job_id       uuid default null,
  p_ttl_seconds  integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget          public.budgets;
  v_spent           numeric;
  v_reserved        numeric;
  v_projected_pct   numeric;
  v_reservation_id  uuid;
  v_action          text := 'proceed';
begin
  if p_amount_usd is null or p_amount_usd <= 0 then
    raise exception 'p_amount_usd debe ser > 0' using errcode = '22023';
  end if;

  select * into v_budget
  from public.budgets b
  where b.tenant_id = p_tenant_id
    and b.scope = p_scope
    and b.scope_ref is not distinct from p_scope_ref
    and b.is_active
  for update;

  if not found then
    return jsonb_build_object('allowed', true, 'action', 'proceed', 'reservation_id', null,
                              'reason', 'no_budget');
  end if;

  -- Liberar reservas vencidas de este presupuesto.
  update public.budget_reservations r
     set status = 'expired', settled_at = now()
   where r.budget_id = v_budget.id and r.status = 'active' and r.expires_at <= now();

  v_spent := public.budget_spent_usd(v_budget);

  select coalesce(sum(r.amount_usd), 0) into v_reserved
  from public.budget_reservations r
  where r.budget_id = v_budget.id and r.status = 'active';

  v_projected_pct := round(((v_spent + v_reserved + p_amount_usd) / v_budget.limit_usd) * 100, 2);

  if v_projected_pct > 100 then
    v_action := case v_budget.on_exhaust
                  when 'pause'   then 'block'
                  when 'degrade' then 'degrade'
                  else 'alert'
                end;
  end if;

  if v_action = 'block' then
    return jsonb_build_object('allowed', false, 'action', 'block', 'reservation_id', null,
                              'budget_id', v_budget.id, 'projected_pct', v_projected_pct);
  end if;

  insert into public.budget_reservations (tenant_id, budget_id, amount_usd, job_id, expires_at)
  values (p_tenant_id, v_budget.id, p_amount_usd, p_job_id, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_reservation_id;

  return jsonb_build_object('allowed', true, 'action', v_action, 'reservation_id', v_reservation_id,
                            'budget_id', v_budget.id, 'projected_pct', v_projected_pct);
end;
$$;

-- Cierra una reserva con el costo real (el usage_event se inserta aparte, con reservation_id).
create or replace function public.settle_budget_reservation(
  p_reservation_id uuid,
  p_actual_usd     numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.budget_reservations
     set status     = case when p_actual_usd is null then 'released' else 'committed' end::public.reservation_status,
         actual_usd = p_actual_usd,
         settled_at = now()
   where id = p_reservation_id and status = 'active';
  return found;
end;
$$;

-- Resumen para la UI (barra de consumo del sidebar / pantalla Consumos).
create or replace function public.tenant_budget_status(p_tenant_id uuid)
returns table (
  budget_id     uuid,
  scope         public.budget_scope,
  scope_ref     text,
  limit_usd     numeric,
  spent_usd     numeric,
  reserved_usd  numeric,
  used_pct      numeric,
  on_exhaust    public.budget_action
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.scope,
    b.scope_ref,
    b.limit_usd,
    public.budget_spent_usd(b),
    coalesce((select sum(r.amount_usd) from public.budget_reservations r
              where r.budget_id = b.id and r.status = 'active' and r.expires_at > now()), 0),
    round(public.budget_spent_usd(b) / b.limit_usd * 100, 2),
    b.on_exhaust
  from public.budgets b
  where b.tenant_id = p_tenant_id
    and b.is_active
    and public.has_tenant_role(p_tenant_id, 'viewer');
$$;

revoke execute on function public.budget_spent_usd(public.budgets) from public, anon, authenticated;
revoke execute on function public.reserve_budget(uuid, numeric, public.budget_scope, text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.settle_budget_reservation(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.tenant_budget_status(uuid) from public, anon;
grant execute on function public.budget_spent_usd(public.budgets) to service_role;
grant execute on function public.reserve_budget(uuid, numeric, public.budget_scope, text, uuid, integer) to service_role;
grant execute on function public.settle_budget_reservation(uuid, numeric) to service_role;
grant execute on function public.tenant_budget_status(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.budgets             enable row level security;
alter table public.budget_reservations enable row level security;
alter table public.usage_events        enable row level security;

create policy budgets_select on public.budgets for select to authenticated
  using (public.has_tenant_role(tenant_id, 'viewer'));
create policy budgets_insert on public.budgets for insert to authenticated
  with check (public.has_tenant_role(tenant_id, 'admin'));
create policy budgets_update on public.budgets for update to authenticated
  using (public.has_tenant_role(tenant_id, 'admin'))
  with check (public.has_tenant_role(tenant_id, 'admin'));
create policy budgets_delete on public.budgets for delete to authenticated
  using (public.has_tenant_role(tenant_id, 'admin'));

create policy budget_reservations_select on public.budget_reservations for select to authenticated
  using (public.has_tenant_role(tenant_id, 'admin'));

create policy usage_events_select on public.usage_events for select to authenticated
  using (public.has_tenant_role(tenant_id, 'viewer'));

-- Consumos y reservas solo los escribe el backend (service_role).
revoke insert, update, delete on public.usage_events        from anon, authenticated;
revoke insert, update, delete on public.budget_reservations from anon, authenticated;
-- =============================================================================
-- SEGEVIA · Release 0 · 04 — Cola de jobs persistente y outbox
-- Cola en Postgres (FOR UPDATE SKIP LOCKED): sin infraestructura extra, con
-- idempotencia, leases, reintentos exponenciales y dead-letter (status = 'dead').
-- El worker es agnóstico del hosting: cualquier proceso Node con service_role.
-- =============================================================================

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead');

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  type              text not null check (type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  payload           jsonb not null default '{}'::jsonb,
  status            public.job_status not null default 'queued',
  priority          smallint not null default 0,
  attempts          integer not null default 0,
  max_attempts      integer not null default 5 check (max_attempts between 1 and 20),
  run_at            timestamptz not null default now(),
  locked_by         text,
  locked_at         timestamptz,
  lease_expires_at  timestamptz,
  idempotency_key   text,
  last_error        text,
  result            jsonb,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  finished_at       timestamptz,
  unique (tenant_id, idempotency_key)
);
create index jobs_claimable_idx on public.jobs (priority desc, run_at)
  where status in ('queued', 'failed');
create index jobs_running_lease_idx on public.jobs (lease_expires_at)
  where status = 'running';
create index jobs_tenant_created_idx on public.jobs (tenant_id, created_at desc);

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_attempts (
  id           bigint generated always as identity primary key,
  job_id       uuid not null references public.jobs (id) on delete cascade,
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  attempt      integer not null,
  worker_id    text not null,
  status       text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  unique (job_id, attempt)
);

create table public.outbox_events (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  aggregate_type  text not null,
  aggregate_id    text not null,
  event_type      text not null check (event_type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  payload         jsonb not null default '{}'::jsonb,
  attempts        integer not null default 0,
  last_error      text,
  available_at    timestamptz not null default now(),
  locked_until    timestamptz,
  processed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index outbox_pending_idx on public.outbox_events (available_at)
  where processed_at is null;

-- -----------------------------------------------------------------------------
-- enqueue_job: alta idempotente. Requiere rol operator o superior.
-- Si ya existe un job con la misma idempotency_key en el tenant, lo devuelve.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_job(
  p_tenant_id        uuid,
  p_type             text,
  p_payload          jsonb default '{}'::jsonb,
  p_idempotency_key  text default null,
  p_run_at           timestamptz default now(),
  p_priority         smallint default 0,
  p_max_attempts     integer default 5
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_is_service boolean := (select auth.role()) = 'service_role';
begin
  if not v_is_service and not public.has_tenant_role(p_tenant_id, 'operator') then
    raise exception 'Permiso insuficiente para encolar trabajos' using errcode = '42501';
  end if;

  insert into public.jobs (tenant_id, type, payload, idempotency_key, run_at, priority, max_attempts, created_by)
  values (p_tenant_id, p_type, coalesce(p_payload, '{}'::jsonb), p_idempotency_key,
          coalesce(p_run_at, now()), coalesce(p_priority, 0), coalesce(p_max_attempts, 5),
          (select auth.uid()))
  on conflict (tenant_id, idempotency_key) do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job from public.jobs
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  end if;

  return v_job;
end;
$$;

-- -----------------------------------------------------------------------------
-- claim_jobs: toma hasta p_limit jobs listos, sin bloquear a otros workers.
-- Recupera jobs con lease vencido (worker caído) y manda a 'dead' los agotados.
-- -----------------------------------------------------------------------------
create or replace function public.claim_jobs(
  p_worker_id      text,
  p_limit          integer default 5,
  p_lease_seconds  integer default 300
)
returns setof public.jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Intentos huérfanos por lease vencido.
  update public.job_attempts a
     set status = 'failed', error = 'lease_expired', finished_at = now()
    from public.jobs j
   where a.job_id = j.id and a.status = 'running'
     and j.status = 'running' and j.lease_expires_at < now();

  -- Jobs con lease vencido que ya agotaron reintentos → dead-letter.
  update public.jobs
     set status = 'dead', last_error = 'lease_expired', locked_by = null,
         lease_expires_at = null, finished_at = now()
   where status = 'running' and lease_expires_at < now() and attempts >= max_attempts;

  return query
  with candidates as (
    select j.id
    from public.jobs j
    where (j.status in ('queued', 'failed') and j.run_at <= now())
       or (j.status = 'running' and j.lease_expires_at < now())
    order by j.priority desc, j.run_at
    limit greatest(1, least(p_limit, 50))
    for update skip locked
  ),
  claimed as (
    update public.jobs j
       set status = 'running',
           attempts = j.attempts + 1,
           locked_by = p_worker_id,
           locked_at = now(),
           lease_expires_at = now() + make_interval(secs => p_lease_seconds)
      from candidates c
     where j.id = c.id
    returning j.*
  ),
  new_attempts as (
    insert into public.job_attempts (job_id, tenant_id, attempt, worker_id)
    select c.id, c.tenant_id, c.attempts, p_worker_id from claimed c
  )
  select * from claimed;
end;
$$;

create or replace function public.complete_job(
  p_job_id     uuid,
  p_worker_id  text,
  p_result     jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt integer;
begin
  update public.jobs
     set status = 'succeeded', result = p_result, last_error = null,
         locked_by = null, lease_expires_at = null, finished_at = now()
   where id = p_job_id and locked_by = p_worker_id and status = 'running'
  returning attempts into v_attempt;

  if not found then
    return false;  -- lease perdido: otro worker lo retomó
  end if;

  update public.job_attempts
     set status = 'succeeded', finished_at = now()
   where job_id = p_job_id and attempt = v_attempt;
  return true;
end;
$$;

-- Backoff: 15s · 2^(intento-1), tope 1h. Espejo de backoffSeconds() en shared-types.
create or replace function public.fail_job(
  p_job_id     uuid,
  p_worker_id  text,
  p_error      text,
  p_retryable  boolean default true
)
returns public.job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job     public.jobs;
  v_status  public.job_status;
begin
  select * into v_job from public.jobs
  where id = p_job_id and locked_by = p_worker_id and status = 'running'
  for update;

  if not found then
    return null;
  end if;

  v_status := case
                when not p_retryable or v_job.attempts >= v_job.max_attempts then 'dead'
                else 'failed'
              end;

  update public.jobs
     set status = v_status,
         last_error = left(p_error, 2000),
         locked_by = null,
         lease_expires_at = null,
         run_at = case when v_status = 'failed'
                       then now() + make_interval(secs => least(3600, 15 * power(2, v_job.attempts - 1)))
                       else run_at end,
         finished_at = case when v_status = 'dead' then now() else null end
   where id = p_job_id;

  update public.job_attempts
     set status = 'failed', error = left(p_error, 2000), finished_at = now()
   where job_id = p_job_id and attempt = v_job.attempts;

  return v_status;
end;
$$;

-- Reencolar manualmente un job muerto (desde la UI de operaciones, admin+).
create or replace function public.retry_dead_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id;
  if not found then
    raise exception 'Job inexistente' using errcode = 'P0002';
  end if;
  if (select auth.role()) <> 'service_role' and not public.has_tenant_role(v_job.tenant_id, 'admin') then
    raise exception 'Permiso insuficiente' using errcode = '42501';
  end if;
  if v_job.status <> 'dead' then
    raise exception 'Solo se pueden reintentar jobs en estado dead' using errcode = 'P0001';
  end if;

  update public.jobs
     set status = 'queued', attempts = 0, run_at = now(), last_error = null, finished_at = null
   where id = p_job_id
  returning * into v_job;

  perform public.write_audit_log(v_job.tenant_id, 'job.retried', 'job', v_job.id::text,
                                 jsonb_build_object('type', v_job.type));
  return v_job;
end;
$$;

-- -----------------------------------------------------------------------------
-- Outbox: los cambios de dominio escriben eventos en la misma transacción;
-- el worker los despacha (a jobs o a proveedores externos).
-- -----------------------------------------------------------------------------
create or replace function public.claim_outbox_events(
  p_limit         integer default 20,
  p_lock_seconds  integer default 60
)
returns setof public.outbox_events
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select o.id from public.outbox_events o
    where o.processed_at is null
      and o.available_at <= now()
      and (o.locked_until is null or o.locked_until < now())
    order by o.id
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.outbox_events o
     set locked_until = now() + make_interval(secs => p_lock_seconds),
         attempts = o.attempts + 1
    from candidates c
   where o.id = c.id
  returning o.*;
$$;

create or replace function public.mark_outbox_event(
  p_event_id  bigint,
  p_error     text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outbox_events
     set processed_at = case when p_error is null then now() else null end,
         last_error   = left(p_error, 2000),
         locked_until = null,
         available_at = case when p_error is null then available_at
                             else now() + make_interval(secs => least(3600, 15 * power(2, attempts - 1)::int)) end
   where id = p_event_id;
$$;

-- Permisos: solo el backend opera la cola; usuarios encolan vía enqueue_job.
revoke execute on function public.enqueue_job(uuid, text, jsonb, text, timestamptz, smallint, integer) from public, anon;
revoke execute on function public.claim_jobs(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.retry_dead_job(uuid) from public, anon;
revoke execute on function public.claim_outbox_events(integer, integer) from public, anon, authenticated;
revoke execute on function public.mark_outbox_event(bigint, text) from public, anon, authenticated;

grant execute on function public.enqueue_job(uuid, text, jsonb, text, timestamptz, smallint, integer) to authenticated, service_role;
grant execute on function public.claim_jobs(text, integer, integer) to service_role;
grant execute on function public.complete_job(uuid, text, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text, text, boolean) to service_role;
grant execute on function public.retry_dead_job(uuid) to authenticated, service_role;
grant execute on function public.claim_outbox_events(integer, integer) to service_role;
grant execute on function public.mark_outbox_event(bigint, text) to service_role;

-- -----------------------------------------------------------------------------
-- RLS: lectura por tenant (observabilidad en UI); sin escritura directa.
-- -----------------------------------------------------------------------------
alter table public.jobs          enable row level security;
alter table public.job_attempts  enable row level security;
alter table public.outbox_events enable row level security;

create policy jobs_select on public.jobs for select to authenticated
  using (public.has_tenant_role(tenant_id, 'viewer'));
create policy job_attempts_select on public.job_attempts for select to authenticated
  using (public.has_tenant_role(tenant_id, 'operator'));
-- outbox_events: sin políticas → invisible para clientes.

revoke insert, update, delete on public.jobs          from anon, authenticated;
revoke insert, update, delete on public.job_attempts  from anon, authenticated;
revoke all                    on public.outbox_events from anon, authenticated;
-- =============================================================================
-- SEGEVIA · Release 0 · 05 — Storage aislado por tenant
-- Convención obligatoria de rutas: <bucket>/<tenant_id>/<resto>
-- Buckets privados: se sirven siempre con URLs firmadas.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('content-images', 'content-images', false, 10485760,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('brand-assets', 'brand-assets', false, 10485760,
   array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Extrae el tenant del primer segmento de la ruta; null si no es un UUID válido.
create or replace function public.storage_object_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

create policy "segevia_objects_select" on storage.objects for select to authenticated
  using (
    bucket_id in ('content-images', 'brand-assets')
    and public.has_tenant_role(public.storage_object_tenant(name), 'viewer')
  );

create policy "segevia_content_images_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  );

create policy "segevia_content_images_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  )
  with check (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  );

create policy "segevia_content_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  );

create policy "segevia_brand_assets_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  );

create policy "segevia_brand_assets_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  )
  with check (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  );

create policy "segevia_brand_assets_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  );
-- =============================================================================
-- SEGEVIA · Seed de desarrollo local — SOLO DATOS FICTICIOS
-- Usuario demo:  demo@segevia.local  /  segevia-demo-2026
-- Nunca ejecutar contra producción.
-- =============================================================================

do $$
declare
  v_user_id   uuid := '00000000-0000-4000-a000-000000000001';
  v_tenant_a  uuid := '10000000-0000-4000-a000-000000000001';
  v_tenant_b  uuid := '10000000-0000-4000-a000-000000000002';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    'demo@segevia.local', extensions.crypt('segevia-demo-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Usuario Demo"}', now(), now(),
    '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', 'demo@segevia.local', 'email_verified', true),
    'email', now(), now(), now()
  ) on conflict do nothing;

  update public.profiles set job_title = 'Director Comercial' where id = v_user_id;

  insert into public.tenants (id, name, slug, plan) values
    (v_tenant_a, 'Acme Argentina', 'acme-argentina', 'empresa'),
    (v_tenant_b, 'Demo Industrial SA', 'demo-industrial', 'trial')
  on conflict (id) do nothing;

  insert into public.memberships (tenant_id, user_id, role) values
    (v_tenant_a, v_user_id, 'owner'),
    (v_tenant_b, v_user_id, 'viewer')
  on conflict (tenant_id, user_id) do nothing;

  insert into public.budgets (tenant_id, scope, limit_usd, on_exhaust) values
    (v_tenant_a, 'tenant', 50, 'degrade')
  on conflict do nothing;

  insert into public.usage_events (tenant_id, provider, model, operation, unit_type, units, cost_usd, idempotency_key)
  values
    (v_tenant_a, 'gemini', 'gemini-2.5-flash', 'generate', 'output_tokens', 120000, 12.40, 'seed-1'),
    (v_tenant_a, 'fal', 'flux-schnell', 'image', 'image', 40, 9.60, 'seed-2'),
    (v_tenant_a, 'tavily', null, 'search', 'search', 300, 4.50, 'seed-3')
  on conflict (idempotency_key) do nothing;
end;
$$;
