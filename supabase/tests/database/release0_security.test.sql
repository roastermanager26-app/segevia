-- =============================================================================
-- SEGEVIA · Pruebas de seguridad Release 0 (pgTAP) — `supabase test db`
-- Verifica aislamiento entre tenants, permisos por rol, inmutabilidad,
-- cola de jobs y presupuesto.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Fixtures (como superusuario)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-00000000000a', 'owner-a@test.local'),
  ('b0000000-0000-4000-a000-00000000000b', 'owner-b@test.local'),
  ('c0000000-0000-4000-a000-00000000000c', 'viewer-a@test.local');

insert into public.tenants (id, name, slug) values
  ('aaaaaaaa-0000-4000-a000-000000000001', 'Tenant A', 'tenant-a-test'),
  ('bbbbbbbb-0000-4000-a000-000000000002', 'Tenant B', 'tenant-b-test');

insert into public.memberships (tenant_id, user_id, role) values
  ('aaaaaaaa-0000-4000-a000-000000000001', 'a0000000-0000-4000-a000-00000000000a', 'owner'),
  ('bbbbbbbb-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-00000000000b', 'owner'),
  ('aaaaaaaa-0000-4000-a000-000000000001', 'c0000000-0000-4000-a000-00000000000c', 'viewer');

insert into public.usage_events (tenant_id, provider, operation, unit_type, units, cost_usd) values
  ('aaaaaaaa-0000-4000-a000-000000000001', 'gemini', 'generate', 'output_tokens', 1000, 1.00),
  ('bbbbbbbb-0000-4000-a000-000000000002', 'gemini', 'generate', 'output_tokens', 1000, 2.00);

insert into storage.objects (bucket_id, name) values
  ('content-images', 'aaaaaaaa-0000-4000-a000-000000000001/a.png'),
  ('content-images', 'bbbbbbbb-0000-4000-a000-000000000002/b.png');

insert into public.budgets (tenant_id, scope, limit_usd, on_exhaust) values
  ('bbbbbbbb-0000-4000-a000-000000000002', 'tenant', 3.00, 'pause');

-- Helper para actuar como un usuario autenticado.
create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Owner A
-- ---------------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-4000-a000-00000000000a');

select is((select count(*) from public.tenants)::int, 1, 'owner A ve solo su tenant');
select is((select count(*) from public.memberships
           where tenant_id = 'bbbbbbbb-0000-4000-a000-000000000002')::int, 0,
          'owner A no ve memberships de B');
select is((select coalesce(sum(cost_usd), 0) from public.usage_events)::numeric, 1.00::numeric,
          'owner A ve solo consumos de A');
select is((select count(*) from storage.objects where bucket_id = 'content-images')::int, 1,
          'owner A ve solo objetos de Storage de A');
select is((select count(*) from public.profiles
           where id = 'b0000000-0000-4000-a000-00000000000b')::int, 0,
          'owner A no ve el profile de un usuario de otro tenant');

select throws_ok(
  $$ insert into public.usage_events (tenant_id, provider, operation, unit_type, units, cost_usd)
     values ('aaaaaaaa-0000-4000-a000-000000000001', 'x', 'generate', 'request', 1, 0) $$,
  '42501', null, 'el cliente no puede escribir el ledger de consumos');

select throws_ok(
  $$ select * from public.claim_jobs('intruso', 1) $$,
  '42501', null, 'el cliente no puede reclamar jobs');

select throws_ok(
  $$ select public.reserve_budget('aaaaaaaa-0000-4000-a000-000000000001', 1) $$,
  '42501', null, 'el cliente no puede reservar presupuesto');

select throws_ok(
  $$ select public.enqueue_job('bbbbbbbb-0000-4000-a000-000000000002', 'system.ping', '{}') $$,
  '42501', null, 'owner A no puede encolar trabajos en B');

select lives_ok(
  $$ select public.enqueue_job('aaaaaaaa-0000-4000-a000-000000000001', 'system.ping',
                               '{"message":"hola"}', 'ping-1') $$,
  'owner A encola un job en su tenant');

select is(
  (select (public.enqueue_job('aaaaaaaa-0000-4000-a000-000000000001', 'system.ping',
                              '{"message":"otra"}', 'ping-1')).payload ->> 'message'),
  'hola', 'enqueue_job es idempotente por idempotency_key');

select throws_ok(
  $$ delete from public.memberships where user_id = 'a0000000-0000-4000-a000-00000000000a' $$,
  'P0001', null, 'no se puede eliminar al último owner');

select lives_ok(
  $$ select public.create_tenant('Nueva Org', 'nueva-org-test') $$,
  'un usuario autenticado puede crear una organización');
select is((select count(*) from public.tenants)::int, 2,
          'el creador queda como owner de la nueva organización');

-- ---------------------------------------------------------------------------
-- Viewer A
-- ---------------------------------------------------------------------------
select pg_temp.act_as('c0000000-0000-4000-a000-00000000000c');

update public.tenants set name = 'Hackeado' where id = 'aaaaaaaa-0000-4000-a000-000000000001';
select is((select name from public.tenants where id = 'aaaaaaaa-0000-4000-a000-000000000001'),
          'Tenant A', 'un viewer no puede editar la organización');

select throws_ok(
  $$ select public.enqueue_job('aaaaaaaa-0000-4000-a000-000000000001', 'system.ping', '{}') $$,
  '42501', null, 'un viewer no puede encolar trabajos');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('content-images', 'aaaaaaaa-0000-4000-a000-000000000001/x.png') $$,
  '42501', null, 'un viewer no puede subir archivos');

select is((select count(*) from public.audit_logs)::int, 0, 'un viewer no lee auditoría');

-- ---------------------------------------------------------------------------
-- Worker (service_role): cola y presupuesto
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select is((select count(*) from public.claim_jobs('w1', 10))::int, 1, 'worker reclama el job encolado');
select is((select count(*) from public.claim_jobs('w2', 10))::int, 0, 'un job no se reclama dos veces');

select is(
  (select public.fail_job(id, 'w1', 'boom') from public.jobs where idempotency_key = 'ping-1'),
  'failed'::public.job_status, 'un fallo reintentable vuelve a failed con backoff');

select ok(
  (select run_at > now() from public.jobs where idempotency_key = 'ping-1'),
  'el reintento queda programado en el futuro');

select is(
  (select (public.reserve_budget('bbbbbbbb-0000-4000-a000-000000000002', 0.50)) ->> 'action'),
  'proceed', 'reserva dentro del límite se acepta');
select is(
  (select (public.reserve_budget('bbbbbbbb-0000-4000-a000-000000000002', 1.00)) ->> 'action'),
  'block', 'reserva que excede el límite en modo pause se bloquea');

select * from finish();
rollback;
