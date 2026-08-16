ALTER TABLE public.atlas_usage_logs
  ADD COLUMN IF NOT EXISTS etapa text,
  ADD COLUMN IF NOT EXISTS modelo text,
  ADD COLUMN IF NOT EXISTS tokens_entrada integer,
  ADD COLUMN IF NOT EXISTS tokens_saida integer,
  ADD COLUMN IF NOT EXISTS tokens_cache integer,
  ADD COLUMN IF NOT EXISTS tokens_total integer,
  ADD COLUMN IF NOT EXISTS duracao_ms integer,
  ADD COLUMN IF NOT EXISTS erro text;

ALTER TABLE public.atlas_usage_logs DROP CONSTRAINT IF EXISTS atlas_usage_logs_origem_check;
ALTER TABLE public.atlas_usage_logs
  ADD CONSTRAINT atlas_usage_logs_origem_check CHECK (origem IN ('modelo', 'codigo', 'guia'));

CREATE INDEX IF NOT EXISTS idx_atlas_usage_logs_user_created
  ON public.atlas_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atlas_usage_logs_origem_user_created
  ON public.atlas_usage_logs (origem, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.rpc_atlas_usage_summary(p_days integer DEFAULT 7)
RETURNS TABLE(
  dia date,
  origem text,
  etapa text,
  modelo text,
  respostas bigint,
  usuarios bigint,
  tokens_entrada bigint,
  tokens_cache bigint,
  tokens_saida bigint,
  tokens_total bigint,
  tokens_medio_por_resposta numeric,
  duracao_media_ms numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
    l.origem,
    COALESCE(l.etapa, 'sem_etapa') AS etapa,
    COALESCE(l.modelo, l.model, 'sem_modelo') AS modelo,
    count(*) AS respostas,
    count(DISTINCT l.user_id) AS usuarios,
    COALESCE(sum(l.tokens_entrada), 0) AS tokens_entrada,
    COALESCE(sum(l.tokens_cache), 0) AS tokens_cache,
    COALESCE(sum(l.tokens_saida), 0) AS tokens_saida,
    COALESCE(sum(l.tokens_total), 0) AS tokens_total,
    ROUND(COALESCE(sum(l.tokens_total), 0)::numeric / GREATEST(count(*), 1), 1) AS tokens_medio_por_resposta,
    ROUND(COALESCE(avg(l.duracao_ms), 0)::numeric, 0) AS duracao_media_ms
  FROM public.atlas_usage_logs l
  WHERE public.is_admin(auth.uid())
    AND l.created_at >= now() - (GREATEST(COALESCE(p_days, 7), 1) || ' days')::interval
  GROUP BY 1, 2, 3, 4
  ORDER BY 1 DESC, respostas DESC
$$;

GRANT EXECUTE ON FUNCTION public.rpc_atlas_usage_summary(integer) TO authenticated;