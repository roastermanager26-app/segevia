-- SEGEVIA · Content Studio: borradores generados desde tendencias.

create type public.content_post_channel as enum ('linkedin', 'instagram', 'x', 'facebook', 'mailing');
create type public.content_post_status as enum ('draft', 'approved', 'published', 'archived');

create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  finding_id uuid references public.content_findings(id) on delete set null,
  topic_id uuid references public.content_topics(id) on delete set null,
  channel public.content_post_channel not null,
  language text not null check (language in ('es', 'en', 'pt')),
  status public.content_post_status not null default 'draft',
  title text not null check (char_length(trim(title)) between 2 and 500),
  body text not null default '',
  company_help text not null default '',
  call_to_action text not null default '',
  hashtags text[] not null default '{}',
  image_prompt text not null default '',
  image_url text,
  image_created_by_ai boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_posts_tenant_created_idx on public.content_posts(tenant_id, created_at desc);
create index content_posts_finding_idx on public.content_posts(finding_id);
create trigger content_posts_updated_at before update on public.content_posts for each row execute function public.set_updated_at();

alter table public.content_posts enable row level security;
create policy content_posts_select on public.content_posts for select to authenticated using (public.has_tenant_role(tenant_id, 'viewer'));
create policy content_posts_write on public.content_posts for all to authenticated using (public.has_tenant_role(tenant_id, 'admin')) with check (public.has_tenant_role(tenant_id, 'admin'));
