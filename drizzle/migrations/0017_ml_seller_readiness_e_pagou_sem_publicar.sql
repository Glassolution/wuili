-- Aptidão real de vendedor no Mercado Livre, guardada por usuário.
CREATE TABLE IF NOT EXISTS public.ml_seller_readiness (
  user_id uuid PRIMARY KEY,
  can_list boolean,
  codes text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'check',
  ml_user_id bigint,
  last_error text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ml_seller_readiness TO authenticated;
GRANT ALL ON public.ml_seller_readiness TO service_role;

ALTER TABLE public.ml_seller_readiness ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dono le sua aptidao" ON public.ml_seller_readiness;
CREATE POLICY "dono le sua aptidao" ON public.ml_seller_readiness
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS ml_seller_readiness_checked_idx ON public.ml_seller_readiness (checked_at DESC);

-- Lista: pagou e ainda não publicou, com motivo provável.
CREATE OR REPLACE FUNCTION public.rpc_admin_paid_not_published(p_days integer DEFAULT 30)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  whatsapp text,
  plano text,
  pago_em timestamptz,
  dias_parado numeric,
  categoria text,
  detalhe text,
  apto boolean,
  conectado_em timestamptz,
  ultima_verificacao timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
WITH adm AS (SELECT public.is_admin(auth.uid()) AS ok),
per AS (SELECT (now() - make_interval(days => greatest(p_days,1))) AS ini, now() AS fim),
pagos AS (
  SELECT s.user_id, min(coalesce(s.updated_at, s.created_at)) AS pago_em,
         (array_agg(s.plan ORDER BY coalesce(s.updated_at, s.created_at) DESC))[1] AS plano
  FROM public.subscriptions s, per, adm
  WHERE adm.ok AND s.status IN ('active','paid','authorized')
    AND coalesce(s.updated_at, s.created_at) >= per.ini
    AND coalesce(s.updated_at, s.created_at) < per.fim
  GROUP BY s.user_id
),
sem_pub AS (
  SELECT g.* FROM pagos g
  WHERE NOT EXISTS (SELECT 1 FROM public.user_publications up WHERE up.user_id = g.user_id)
),
base AS (
  SELECT
    g.user_id, g.pago_em, g.plano,
    p.display_name, p.email, p.whatsapp,
    i.created_at AS conectado_em,
    i.expires_at,
    i.access_token IS NOT NULL AS tem_token,
    r.can_list, r.codes, r.checked_at,
    (SELECT e.mapped_message FROM public.ml_publish_errors e WHERE e.user_id = g.user_id ORDER BY e.created_at DESC LIMIT 1) AS erro_msg,
    (SELECT e.mapped_code FROM public.ml_publish_errors e WHERE e.user_id = g.user_id ORDER BY e.created_at DESC LIMIT 1) AS erro_code,
    (SELECT count(*) FROM public.pending_publications pp WHERE pp.user_id = g.user_id AND pp.status = 'pending') AS fila
  FROM sem_pub g
  LEFT JOIN public.profiles p ON p.user_id = g.user_id
  LEFT JOIN public.user_integrations i ON i.user_id = g.user_id AND i.platform = 'mercadolivre'
  LEFT JOIN public.ml_seller_readiness r ON r.user_id = g.user_id
)
SELECT
  b.user_id,
  b.display_name,
  b.email,
  b.whatsapp,
  b.plano,
  b.pago_em,
  round((EXTRACT(epoch FROM (now() - b.pago_em)) / 86400)::numeric, 1),
  CASE
    WHEN b.conectado_em IS NULL THEN 'ml_nao_conectado'
    WHEN b.tem_token IS NOT TRUE OR (b.expires_at IS NOT NULL AND b.expires_at < now() - interval '30 days') THEN 'conexao_expirada'
    WHEN b.erro_code IS NOT NULL THEN 'erro_ao_publicar'
    WHEN b.can_list IS FALSE THEN 'sem_perfil_vendedor'
    WHEN b.can_list IS TRUE THEN 'apto_nunca_tentou'
    ELSE 'desconhecido'
  END,
  CASE
    WHEN b.erro_code IS NOT NULL AND b.conectado_em IS NOT NULL THEN coalesce(b.erro_msg, b.erro_code)
    WHEN b.can_list IS FALSE THEN array_to_string(b.codes, ', ')
    WHEN b.fila > 0 THEN 'anúncio pronto esperando na fila'
    ELSE NULL
  END,
  b.can_list,
  b.conectado_em,
  b.checked_at
FROM base b
ORDER BY b.pago_em ASC;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_paid_not_published(integer) TO authenticated;

-- Resumo por categoria com mediana de dias parados.
CREATE OR REPLACE FUNCTION public.rpc_admin_paid_not_published_summary(p_days integer DEFAULT 30)
RETURNS TABLE(categoria text, pessoas bigint, mediana_dias numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
SELECT categoria, count(*)::bigint,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias_parado)::numeric, 1)
FROM public.rpc_admin_paid_not_published(p_days)
GROUP BY categoria
ORDER BY 2 DESC;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_paid_not_published_summary(integer) TO authenticated;

-- "Pagou antes da conta ficar pronta" passa a usar aptidão real (ou publicação feita).
CREATE OR REPLACE FUNCTION public.rpc_admin_paid_without_seller_cohort(p_days integer DEFAULT 30)
RETURNS TABLE(pagaram bigint, ativaram bigint, horas_medias numeric, reembolsos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
WITH adm AS (SELECT public.is_admin(auth.uid()) AS ok),
per AS (SELECT (now() - make_interval(days => greatest(p_days,1))) AS ini, now() AS fim),
coorte AS (
  SELECT p.user_id FROM public.profiles p, per, adm
  WHERE adm.ok AND p.user_id IS NOT NULL AND p.created_at >= per.ini AND p.created_at < per.fim
),
pagos AS (
  SELECT s.user_id, min(coalesce(s.updated_at, s.created_at)) AS pago_em
  FROM public.subscriptions s, per
  WHERE s.status IN ('active','paid') AND coalesce(s.updated_at, s.created_at) >= per.ini
    AND s.user_id IN (SELECT user_id FROM coorte)
  GROUP BY s.user_id
),
pronto AS (
  SELECT g.user_id, g.pago_em,
    LEAST(
      (SELECT min(r.checked_at) FROM public.ml_seller_readiness r WHERE r.user_id = g.user_id AND r.can_list IS TRUE),
      (SELECT min(up.created_at) FROM public.user_publications up WHERE up.user_id = g.user_id)
    ) AS pronto_em
  FROM pagos g
)
SELECT count(*) FILTER (WHERE pronto_em IS NULL OR pronto_em > pago_em),
       count(*) FILTER (WHERE pronto_em IS NOT NULL AND pronto_em > pago_em),
       round(avg(EXTRACT(epoch FROM (pronto_em - pago_em))/3600) FILTER (WHERE pronto_em IS NOT NULL AND pronto_em > pago_em)::numeric, 1),
       (SELECT count(DISTINCT r.user_id) FROM public.refund_requests r, per
         WHERE r.created_at >= per.ini AND r.user_id IN (SELECT user_id FROM coorte))
FROM pronto;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_paid_without_seller_cohort(integer) TO authenticated;