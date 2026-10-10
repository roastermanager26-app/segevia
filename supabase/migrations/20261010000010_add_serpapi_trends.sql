-- SEGEVIA · Tercera fuente global de tendencias.

alter table public.content_findings drop constraint content_findings_provider_check;
alter table public.content_findings add constraint content_findings_provider_check
  check (provider in ('tavily', 'searchapi', 'serpapi'));
