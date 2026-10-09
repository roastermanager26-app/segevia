-- SEGEVIA · Telegram por tenant. El token vive exclusivamente en Vault.

create table public.telegram_bot_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  integration_id uuid not null unique references public.integrations(id) on delete cascade,
  bot_name text not null check (char_length(bot_name) between 2 and 80),
  bot_username text,
  authorized_chat_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger telegram_bot_configs_updated_at before update on public.telegram_bot_configs for each row execute function public.set_updated_at();

alter table public.telegram_bot_configs enable row level security;
create policy telegram_bot_configs_select on public.telegram_bot_configs for select to authenticated
  using (public.has_tenant_role(tenant_id, 'viewer'));

create or replace function public.store_telegram_bot(
  p_tenant_id uuid,
  p_bot_name text,
  p_bot_username text,
  p_token text,
  p_authorized_chat_ids bigint[],
  p_actor_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid; v_integration_id uuid;
begin
  if not exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = p_actor_id and role >= 'admin'
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select id into v_integration_id from public.integrations
  where tenant_id = p_tenant_id and provider = 'telegram' limit 1;
  if v_integration_id is null then
    insert into public.integrations(tenant_id, provider, display_name, status, created_by)
    values (p_tenant_id, 'telegram', 'Telegram', 'disconnected', p_actor_id)
    returning id into v_integration_id;
  end if;

  select vault.create_secret(p_token, 'segevia:' || p_tenant_id::text || ':telegram', 'Token de bot de Telegram') into v_secret_id;
  update public.integrations
  set secret_id = v_secret_id, status = 'connected', last_error = null, last_synced_at = now()
  where id = v_integration_id;

  insert into public.telegram_bot_configs(tenant_id, integration_id, bot_name, bot_username, authorized_chat_ids)
  values (p_tenant_id, v_integration_id, p_bot_name, nullif(p_bot_username, ''), coalesce(p_authorized_chat_ids, '{}'))
  on conflict (tenant_id) do update set
    integration_id = excluded.integration_id,
    bot_name = excluded.bot_name,
    bot_username = excluded.bot_username,
    authorized_chat_ids = excluded.authorized_chat_ids;
  return v_integration_id;
end;
$$;

revoke all on function public.store_telegram_bot(uuid,text,text,text,bigint[],uuid) from public, anon, authenticated;
grant execute on function public.store_telegram_bot(uuid,text,text,text,bigint[],uuid) to service_role;
