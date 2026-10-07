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
