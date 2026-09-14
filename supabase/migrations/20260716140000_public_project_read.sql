-- Leitura pública de projetos publicados (para renderizar /loja/:slug sem login).
-- Só expõe projetos com status='publicado' e visibilidade não-privada.
-- SECURITY DEFINER: contorna o RLS owner-only de user_projects, mas filtra
-- rigorosamente para nunca vazar rascunhos ou projetos privados.
CREATE OR REPLACE FUNCTION public.get_public_project(p_slug text)
RETURNS public.user_projects
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.user_projects p
  WHERE p.metadata->>'slug' = p_slug
    AND p.status = 'publicado'
    AND COALESCE(p.metadata->>'visibility', 'publico') <> 'privado'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_project(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_project(text) TO anon, authenticated, service_role;
