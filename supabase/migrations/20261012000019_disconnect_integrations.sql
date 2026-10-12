-- SEGEVIA · Desconexión completa de integraciones por tenant.
-- Elimina la configuración relacionada, las referencias operativas y las
-- credenciales actuales o huérfanas almacenadas en Supabase Vault.

create or replace function public.disconnect_integration(
  p_tenant_id uuid,
  p_provider text,
  p_actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_secret_name text;
  v_deleted_count integer;
begin
  if p_provider !~ '^[a-z0-9_]+$' then
    raise exception 'Proveedor inválido' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.memberships
    where tenant_id = p_tenant_id
      and user_id = p_actor_id
      and role >= 'admin'
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Las versiones anteriores de una credencial pueden haber quedado sin
  -- referencia tras una reconexión. También se eliminan por su nombre aislado
  -- por tenant y proveedor.
  v_secret_name := 'segevia:' || p_tenant_id::text || ':' || p_provider;
  for v_secret_id in
    select distinct secret_id
    from public.integrations
    where tenant_id = p_tenant_id
      and provider = p_provider
      and secret_id is not null
    union
    select id
    from vault.secrets
    where name = v_secret_name
      or name like v_secret_name || ':%'
  loop
    perform vault.delete_secret(v_secret_id);
  end loop;

  -- Las claves foráneas con ON DELETE CASCADE eliminan llm_model_configs y
  -- telegram_bot_configs ligados a cada integración.
  delete from public.integrations
  where tenant_id = p_tenant_id
    and provider = p_provider;
  get diagnostics v_deleted_count = row_count;

  return v_deleted_count;
end;
$$;

revoke all on function public.disconnect_integration(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.disconnect_integration(uuid,text,uuid) to service_role;
