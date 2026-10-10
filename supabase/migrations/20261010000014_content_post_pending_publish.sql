-- Publicar sin integración de red: deja la publicación en cola de salida.
alter type public.content_post_status add value if not exists 'pending_publish' after 'approved';
