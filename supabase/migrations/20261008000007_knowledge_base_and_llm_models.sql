-- SEGEVIA · Release 1 — Knowledge Base y configuración de modelos por tenant.

create type public.kb_source_kind as enum ('file', 'url', 'manual');
create type public.kb_category as enum ('product', 'service', 'pricing', 'company', 'faq', 'case_study', 'legal', 'other');
create type public.kb_source_status as enum ('draft', 'processing', 'review', 'indexed', 'error', 'archived');
create type public.llm_capability as enum ('text', 'image', 'embedding');
create type public.llm_slot as enum ('primary', 'backup');
create type public.model_health as enum ('unknown', 'healthy', 'unhealthy');

create table public.kb_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind public.kb_source_kind not null,
  title text not null check (char_length(title) between 2 and 240),
  description text,
  category public.kb_category not null,
  tags text[] not null default '{}',
  language text not null default 'es',
  effective_from date,
  source_url text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes <= 20971520),
  page_count integer check (page_count is null or page_count <= 200),
  status public.kb_source_status not null default 'draft',
  chunks_count integer not null default 0,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'url') = (source_url is not null)),
  check (kind <> 'file' or storage_path is not null)
);
create index kb_sources_tenant_status_idx on public.kb_sources(tenant_id, status, updated_at desc);
create index kb_sources_tags_idx on public.kb_sources using gin(tags);
create trigger kb_sources_updated_at before update on public.kb_sources for each row execute function public.set_updated_at();

-- vector sin dimensión fija: el proveedor de embeddings es configurable por tenant.
-- Las búsquedas siempre filtran por modelo para evitar comparar espacios vectoriales distintos.
create table public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_id uuid not null references public.kb_sources(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  page_number integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector,
  embedding_model text,
  created_at timestamptz not null default now(),
  unique(source_id, chunk_index)
);
create index kb_chunks_source_idx on public.kb_chunks(source_id, chunk_index);

create table public.llm_model_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  capability public.llm_capability not null,
  slot public.llm_slot not null,
  model_id text not null,
  model_name text not null,
  is_active boolean not null default true,
  health public.model_health not null default 'unknown',
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, capability, slot)
);
create trigger llm_model_configs_updated_at before update on public.llm_model_configs for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kb-documents', 'kb-documents', false, 20971520,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown'])
on conflict (id) do nothing;
create policy "kb_documents_select" on storage.objects for select to authenticated using (
  bucket_id = 'kb-documents' and public.has_tenant_role(public.storage_object_tenant(name), 'viewer')
);
create policy "kb_documents_write" on storage.objects for insert to authenticated with check (
  bucket_id = 'kb-documents' and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
);
create policy "kb_documents_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'kb-documents' and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
);

alter table public.kb_sources enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.llm_model_configs enable row level security;

create policy kb_sources_select on public.kb_sources for select to authenticated using (public.has_tenant_role(tenant_id, 'viewer'));
create policy kb_sources_insert on public.kb_sources for insert to authenticated with check (public.has_tenant_role(tenant_id, 'admin'));
create policy kb_sources_update on public.kb_sources for update to authenticated using (public.has_tenant_role(tenant_id, 'admin')) with check (public.has_tenant_role(tenant_id, 'admin'));
create policy kb_sources_delete on public.kb_sources for delete to authenticated using (public.has_tenant_role(tenant_id, 'admin'));
create policy kb_chunks_select on public.kb_chunks for select to authenticated using (public.has_tenant_role(tenant_id, 'viewer'));
create policy llm_model_configs_select on public.llm_model_configs for select to authenticated using (public.has_tenant_role(tenant_id, 'viewer'));
create policy llm_model_configs_write on public.llm_model_configs for all to authenticated using (public.has_tenant_role(tenant_id, 'admin')) with check (public.has_tenant_role(tenant_id, 'admin'));

-- El cliente nunca recibe tokens. Estos RPCs se invocan únicamente desde una Edge Function
-- usando service_role después de validar al usuario y su membresía.
create or replace function public.store_llm_token(p_tenant_id uuid, p_provider text, p_token text, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid; v_integration_id uuid;
begin
  if not exists (select 1 from public.memberships where tenant_id = p_tenant_id and user_id = p_actor_id and role >= 'admin') then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id into v_integration_id from public.integrations where tenant_id = p_tenant_id and provider = p_provider limit 1;
  if v_integration_id is null then
    insert into public.integrations(tenant_id, provider, display_name, status, created_by) values(p_tenant_id, p_provider, initcap(p_provider), 'disconnected', p_actor_id) returning id into v_integration_id;
  end if;
  select vault.create_secret(p_token, 'segevia:' || p_tenant_id::text || ':' || p_provider, 'Token de proveedor LLM') into v_secret_id;
  update public.integrations set secret_id = v_secret_id, status = 'connected', last_error = null, last_synced_at = now() where id = v_integration_id;
  return v_integration_id;
end; $$;

create or replace function public.read_llm_token(p_integration_id uuid)
returns text language sql security definer set search_path = '' as $$
  select ds.decrypted_secret from vault.decrypted_secrets ds join public.integrations i on i.secret_id = ds.id where i.id = p_integration_id
$$;
revoke all on function public.store_llm_token(uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.read_llm_token(uuid) from public, anon, authenticated;
grant execute on function public.store_llm_token(uuid,text,text,uuid) to service_role;
grant execute on function public.read_llm_token(uuid) to service_role;

create or replace function public.match_kb_chunks(p_tenant_id uuid, p_embedding extensions.vector, p_embedding_model text, p_limit integer default 8, p_categories public.kb_category[] default null, p_tags text[] default null)
returns table(chunk_id uuid, source_id uuid, title text, category public.kb_category, source_url text, storage_path text, page_number integer, content text, similarity double precision)
language sql stable security definer set search_path = '' as $$
  select c.id, s.id, s.title, s.category, s.source_url, s.storage_path, c.page_number, c.content, 1 - (c.embedding OPERATOR(extensions.<=>) p_embedding) as similarity
  from public.kb_chunks c join public.kb_sources s on s.id = c.source_id
  where c.tenant_id = p_tenant_id and s.status = 'indexed' and c.embedding_model = p_embedding_model
    and (p_categories is null or s.category = any(p_categories))
    and (p_tags is null or s.tags && p_tags)
  order by c.embedding OPERATOR(extensions.<=>) p_embedding limit greatest(1, least(p_limit, 20))
$$;
revoke all on function public.match_kb_chunks(uuid,extensions.vector,text,integer,public.kb_category[],text[]) from public, anon;
grant execute on function public.match_kb_chunks(uuid,extensions.vector,text,integer,public.kb_category[],text[]) to authenticated, service_role;
