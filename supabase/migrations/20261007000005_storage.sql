-- =============================================================================
-- SEGEVIA · Release 0 · 05 — Storage aislado por tenant
-- Convención obligatoria de rutas: <bucket>/<tenant_id>/<resto>
-- Buckets privados: se sirven siempre con URLs firmadas.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('content-images', 'content-images', false, 10485760,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('brand-assets', 'brand-assets', false, 10485760,
   array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Extrae el tenant del primer segmento de la ruta; null si no es un UUID válido.
create or replace function public.storage_object_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

create policy "segevia_objects_select" on storage.objects for select to authenticated
  using (
    bucket_id in ('content-images', 'brand-assets')
    and public.has_tenant_role(public.storage_object_tenant(name), 'viewer')
  );

create policy "segevia_content_images_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  );

create policy "segevia_content_images_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  )
  with check (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  );

create policy "segevia_content_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'content-images'
    and public.has_tenant_role(public.storage_object_tenant(name), 'operator')
  );

create policy "segevia_brand_assets_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  );

create policy "segevia_brand_assets_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  )
  with check (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  );

create policy "segevia_brand_assets_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and public.has_tenant_role(public.storage_object_tenant(name), 'admin')
  );
