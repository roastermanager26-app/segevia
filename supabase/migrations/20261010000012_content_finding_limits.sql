-- SEGEVIA · Límites de contenido para hallazgos.

update public.content_findings
set summary = array_to_string((regexp_split_to_array(trim(summary), '[[:space:]]+'))[1:200], ' ');

update public.content_findings
set relevance_reason = left(relevance_reason, 180);

alter table public.content_findings add constraint content_findings_summary_max_words
  check (array_length(regexp_split_to_array(trim(summary), '[[:space:]]+'), 1) <= 200);
alter table public.content_findings add constraint content_findings_relevance_max_chars
  check (char_length(relevance_reason) <= 180);
