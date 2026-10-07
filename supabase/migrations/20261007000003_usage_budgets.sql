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
