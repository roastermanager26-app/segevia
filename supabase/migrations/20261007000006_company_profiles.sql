-- =============================================================================
-- SEGEVIA · Release 0 · 06 — Perfil comercial de la empresa
-- Un perfil por tenant. Los datos personales del administrador permanecen en
-- public.profiles; el email procede de auth.users y se muestra solo como lectura.
-- =============================================================================

create table public.company_profiles (
  tenant_id        uuid primary key references public.tenants (id) on delete cascade,
  legal_name       text,
  tax_id           text,
  address_street   text,
  address_number   text,
  city             text,
  province         text,
  country          text,
  postal_code      text,
  phone            text,
  website_url      text,
  linkedin_url     text,
  contact_email    text,
  telegram_handle  text,
  instagram_handle text,
  description      text,
  offerings        text,
  logo_path        text,
  primary_color    text not null default '#3525cd' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color  text not null default '#006a61' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint company_profiles_website_url_check
    check (website_url is null or website_url ~* '^https?://'),
  constraint company_profiles_linkedin_url_check
    check (linkedin_url is null or linkedin_url ~* '^https?://')
);

create trigger company_profiles_updated_at before update on public.company_profiles
  for each row execute function public.set_updated_at();

alter table public.company_profiles enable row level security;

create policy company_profiles_select on public.company_profiles for select to authenticated
  using (public.has_tenant_role(tenant_id, 'viewer'));

create policy company_profiles_insert on public.company_profiles for insert to authenticated
  with check (public.has_tenant_role(tenant_id, 'admin'));

create policy company_profiles_update on public.company_profiles for update to authenticated
  using (public.has_tenant_role(tenant_id, 'admin'))
  with check (public.has_tenant_role(tenant_id, 'admin'));

create policy company_profiles_delete on public.company_profiles for delete to authenticated
  using (public.has_tenant_role(tenant_id, 'owner'));
