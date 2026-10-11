-- Metadatos de publicación externa. El contenido y los tokens permanecen
-- siempre aislados por tenant.

alter table public.content_posts
  add column if not exists published_at timestamptz,
  add column if not exists external_post_id text,
  add column if not exists external_post_url text,
  add column if not exists publish_error text;

create or replace function public.read_linkedin_token(p_integration_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  join public.integrations i on i.secret_id = ds.id
  where i.id = p_integration_id and i.provider = 'linkedin'
$$;

revoke all on function public.read_linkedin_token(uuid) from public, anon, authenticated;
grant execute on function public.read_linkedin_token(uuid) to service_role;
