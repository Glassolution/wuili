-- Canonicaliza links de afiliado antigos para o dominio oficial da Velo.
-- Formato esperado: https://velods.com.br/ref/CODIGO

update public.affiliates
set
  code = upper(coalesce(nullif(code, ''), nullif(ref, ''))),
  ref = upper(coalesce(nullif(code, ''), nullif(ref, ''))),
  link = 'https://velods.com.br/ref/' || upper(coalesce(nullif(code, ''), nullif(ref, ''))),
  updated_at = now()
where coalesce(nullif(code, ''), nullif(ref, '')) is not null
  and (
    link is null
    or link !~ '^https://velods\.com\.br/ref/[A-Z0-9]+$'
    or link ilike '%lovable.app%'
    or link ilike '%?ref=%'
    or link ilike '%/planos%'
  );
