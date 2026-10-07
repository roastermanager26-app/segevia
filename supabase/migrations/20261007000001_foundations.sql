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
