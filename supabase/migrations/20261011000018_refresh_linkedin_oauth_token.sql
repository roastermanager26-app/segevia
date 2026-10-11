-- SEGEVIA · LinkedIn OAuth: una reconexión actualiza el secreto existente.
-- Vault exige nombres únicos; crear uno nuevo en cada OAuth impedía renovar la conexión.

create or replace function public.store_linkedin_account(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_account_id text,
  p_display_name text,
  p_token text,
  p_expires_at timestamptz,
  p_scopes text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_integration_id uuid;
  v_secret_name text := 'segevia:' || p_tenant_id::text || ':linkedin:' || p_account_id;
begin
  if not exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = p_actor_id and role >= 'admin'
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select id, secret_id
    into v_integration_id, v_secret_id
  from public.integrations
  where tenant_id = p_tenant_id
    and provider = 'linkedin'
    and external_account_id = p_account_id
  limit 1;

  if v_secret_id is null then
    select vault.create_secret(p_token, v_secret_name, 'Token OAuth de LinkedIn')
      into v_secret_id;
  else
    perform vault.update_secret(
      v_secret_id,
      p_token,
      v_secret_name,
      'Token OAuth de LinkedIn'
    );
  end if;

  insert into public.integrations (
    tenant_id, provider, display_name, status, scopes,
    external_account_id, secret_id, expires_at, last_synced_at, last_error, created_by
  )
  values (
    p_tenant_id, 'linkedin', nullif(p_display_name, ''), 'connected', coalesce(p_scopes, '{}'),
    p_account_id, v_secret_id, p_expires_at, now(), null, p_actor_id
  )
  on conflict (tenant_id, provider, external_account_id) do update set
    display_name = excluded.display_name,
    status = 'connected',
    scopes = excluded.scopes,
    secret_id = excluded.secret_id,
    expires_at = excluded.expires_at,
    last_synced_at = now(),
    last_error = null,
    created_by = excluded.created_by
  returning id into v_integration_id;

  return v_integration_id;
end;
$$;

revoke all on function public.store_linkedin_account(uuid,uuid,text,text,text,timestamptz,text[]) from public, anon, authenticated;
grant execute on function public.store_linkedin_account(uuid,uuid,text,text,text,timestamptz,text[]) to service_role;
