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
    r.can_list, r.codes, r.checked_at, r.last_error,
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
    WHEN b.tem_token IS NOT TRUE THEN 'conexao_expirada'
    WHEN b.last_error IN ('conexao_expirada','ml_http_401','ml_http_403') THEN 'conexao_expirada'
    WHEN b.erro_code IS NOT NULL THEN 'erro_ao_publicar'
    WHEN b.can_list IS FALSE THEN 'sem_perfil_vendedor'
    WHEN b.can_list IS TRUE THEN 'apto_nunca_tentou'
    ELSE 'desconhecido'
  END,
  CASE
    WHEN b.last_error IN ('conexao_expirada','ml_http_401','ml_http_403') THEN 'precisa reconectar o Mercado Livre'
    WHEN b.erro_code IS NOT NULL AND b.conectado_em IS NOT NULL THEN coalesce(b.erro_msg, b.erro_code)
    WHEN b.can_list IS FALSE THEN array_to_string(b.codes, ', ')
    WHEN b.fila > 0 THEN 'anúncio pronto esperando na fila'
    WHEN b.checked_at IS NULL THEN 'conta ainda não verificada'
    ELSE NULL
  END,
  b.can_list,
  b.conectado_em,
  b.checked_at
FROM base b
ORDER BY b.pago_em ASC;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_paid_not_published(integer) TO authenticated;