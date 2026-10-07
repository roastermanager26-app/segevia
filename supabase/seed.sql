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
