-- Funil por coorte: só pessoas novas do período, mesma janela em todas as etapas.
CREATE OR REPLACE FUNCTION public.rpc_admin_cohort_funnel(
  p_days integer DEFAULT 30,
  p_offset_days integer DEFAULT 0,
  p_origem text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_browser text DEFAULT NULL
) RETURNS TABLE(
  ordem integer,
  etapa text,
  definicao text,
  pessoas bigint,
  nao_precisava bigint,
  medicao_desde timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
WITH adm AS (SELECT public.is_admin(auth.uid()) AS ok),
per AS (
  SELECT (now() - make_interval(days => greatest(p_days,1) + greatest(coalesce(p_offset_days,0),0))) AS ini,
         (now() - make_interval(days => greatest(coalesce(p_offset_days,0),0))) AS fim
),
src AS (
  SELECT
    (SELECT min(created_at) FROM public.landing_events WHERE event = 'landing_view') AS landing_ini,
    (SELECT min(created_at) FROM public.landing_events WHERE event LIKE 'onboarding%') AS onb_ini,
    (SELECT min(created_at) FROM public.mobile_home_events) AS app_ini
),
le AS (
  SELECT e.* FROM public.landing_events e, per, adm
  WHERE adm.ok AND e.created_at >= per.ini AND e.created_at < per.fim
    AND (p_device IS NULL OR e.device = p_device)
    AND (p_origem IS NULL OR coalesce(nullif(e.origem,''), nullif(e.referrer,''), 'direto') ILIKE '%'||p_origem||'%')
    AND (p_browser IS NULL OR coalesce(e.browser_kind,'normal') = p_browser)
),
-- Coorte: contas criadas DENTRO do período, sem assinatura paga anterior ao período.
coorte AS (
  SELECT p.user_id, p.created_at, p.visitor_id
  FROM public.profiles p, per, adm
  WHERE adm.ok AND p.user_id IS NOT NULL
    AND p.created_at >= per.ini AND p.created_at < per.fim
    AND (p_origem IS NULL OR coalesce(nullif(p.utm_source,''), nullif(p.signup_source,''), 'direto') ILIKE '%'||p_origem||'%')
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s, per p2
      WHERE s.user_id = p.user_id AND s.status IN ('active','paid') AND s.created_at < p2.ini
    )
),
ev AS (
  SELECT m.* FROM public.mobile_home_events m, per
  WHERE m.created_at >= per.ini AND m.created_at < per.fim
    AND m.user_id IN (SELECT user_id FROM coorte)
    AND (p_device IS NULL OR m.device IS NULL OR m.device = p_device)
    AND (p_browser IS NULL OR coalesce(m.browser_kind,'normal') = p_browser)
),
pv AS (
  SELECT v.* FROM public.user_page_views v, per
  WHERE v.viewed_at >= per.ini AND v.viewed_at < per.fim
    AND v.user_id IN (SELECT user_id FROM coorte)
    AND (p_device IS NULL OR v.device IS NULL OR v.device = p_device)
),
-- quem já tinha Mercado Livre ligado antes do período (não precisa conectar de novo)
ja_ml AS (
  SELECT count(DISTINCT i.user_id) n
  FROM public.user_integrations i, per
  WHERE i.platform = 'mercadolivre' AND i.created_at < per.ini
    AND i.user_id IN (SELECT user_id FROM coorte)
)
SELECT 1, 'Visitou a landing', 'Visitantes diferentes que abriram a página inicial no período',
  (SELECT count(DISTINCT visitor_id) FROM le WHERE event = 'landing_view'), 0::bigint,
  (SELECT greatest(per.ini, coalesce(src.landing_ini, per.ini)) FROM per, src)
UNION ALL SELECT 2, 'Clicou em criar conta', 'Visitante que tocou em algum botão de criar conta na landing',
  (SELECT count(DISTINCT visitor_id) FROM le WHERE event LIKE 'cta_%signup%' OR event IN ('cta_primary_click','cta_offer_click')), 0::bigint,
  (SELECT greatest(per.ini, coalesce(src.landing_ini, per.ini)) FROM per, src)
UNION ALL SELECT 3, 'Conta criada', 'Contas novas criadas no período (a coorte deste funil)',
  (SELECT count(*) FROM coorte), 0::bigint, (SELECT ini FROM per)
UNION ALL SELECT 4, 'Onboarding concluído', 'Concluiu as perguntas iniciais (evento de conclusão ou marca no perfil)',
  (SELECT count(DISTINCT c.user_id) FROM coorte c
    WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = c.user_id AND p.onboarding_completed)
       OR EXISTS (SELECT 1 FROM public.landing_events e WHERE e.event = 'onboarding_complete' AND e.visitor_id = c.visitor_id AND nullif(c.visitor_id,'') IS NOT NULL)),
  0::bigint, (SELECT greatest(per.ini, coalesce(src.onb_ini, per.ini)) FROM per, src)
UNION ALL SELECT 5, 'Viu o catálogo', 'Abriu a home ou a lista de produtos',
  (SELECT count(DISTINCT u) FROM (SELECT user_id u FROM ev WHERE event_name = 'home_view' UNION SELECT user_id FROM pv WHERE path LIKE '/dashboard/catalogo%') s),
  0::bigint, (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 6, 'Viu um produto', 'Abriu a tela de detalhes de um produto',
  (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'product_detail_view'), 0::bigint,
  (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 7, 'Clicou em publicar', 'Tocou no botão de publicar/importar o produto',
  (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'import_flow_open' OR (event_name = 'product_detail_action' AND detail LIKE 'publish%')),
  0::bigint, (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 8, 'Começou a conexão com o Mercado Livre', 'Abriu a tela de conectar a conta. Quem já estava conectado não precisava passar por aqui.',
  (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'ml_connect_open'), (SELECT n FROM ja_ml),
  (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 9, 'Conectou o Mercado Livre', 'Conexão concluída com sucesso no fluxo',
  (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'ml_connect_result' AND detail = 'success'), (SELECT n FROM ja_ml),
  (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 10, 'Concluiu a revisão do anúncio', 'Avançou da revisão para a etapa seguinte',
  (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'import_flow_advance' AND detail IN ('2_to_3','3_to_4')),
  0::bigint, (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 11, 'Viu a página de planos', 'Abriu a tela de planos. Quem já assinava não precisava ver.',
  (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'plans_open'),
  (SELECT count(DISTINCT s.user_id) FROM public.subscriptions s, per WHERE s.status IN ('active','paid') AND s.created_at < per.ini AND s.user_id IN (SELECT user_id FROM coorte)),
  (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 12, 'Iniciou o pagamento', 'Clicou para pagar um plano',
  (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'plan_checkout_clicked'), 0::bigint,
  (SELECT greatest(per.ini, coalesce(src.app_ini, per.ini)) FROM per, src)
UNION ALL SELECT 13, 'Pagamento confirmado', 'Assinatura paga registrada no período, para gente da coorte',
  (SELECT count(DISTINCT s.user_id) FROM public.subscriptions s, per
    WHERE s.status IN ('active','paid') AND coalesce(s.updated_at, s.created_at) >= per.ini AND coalesce(s.updated_at, s.created_at) < per.fim
      AND s.user_id IN (SELECT user_id FROM coorte)),
  0::bigint, (SELECT ini FROM per)
UNION ALL SELECT 14, 'Mercado Livre conectado', 'Tem conta do Mercado Livre ligada à Velo (não mede aptidão a vender)',
  (SELECT count(DISTINCT i.user_id) FROM public.user_integrations i, per
    WHERE i.platform = 'mercadolivre' AND i.created_at < per.fim AND i.user_id IN (SELECT user_id FROM coorte)),
  0::bigint, (SELECT ini FROM per)
UNION ALL SELECT 15, 'Anúncio publicado', 'Publicou de fato no Mercado Livre — é a prova real de que a conta vende',
  (SELECT count(DISTINCT u) FROM (
     SELECT user_id u FROM ev WHERE event_name = 'publish_result' AND detail IN ('success','partial')
     UNION
     SELECT p.user_id FROM public.user_publications p, per
      WHERE p.created_at >= per.ini AND p.created_at < per.fim AND p.user_id IN (SELECT user_id FROM coorte)
   ) s),
  0::bigint, (SELECT ini FROM per)
ORDER BY 1;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_cohort_funnel(integer,integer,text,text,text) TO authenticated;

-- Por onde a coorte entrou: landing ou direto no cadastro
CREATE OR REPLACE FUNCTION public.rpc_admin_cohort_entry(
  p_days integer DEFAULT 30,
  p_offset_days integer DEFAULT 0
) RETURNS TABLE(total bigint, via_landing bigint, direto bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
WITH adm AS (SELECT public.is_admin(auth.uid()) AS ok),
per AS (
  SELECT (now() - make_interval(days => greatest(p_days,1) + greatest(coalesce(p_offset_days,0),0))) AS ini,
         (now() - make_interval(days => greatest(coalesce(p_offset_days,0),0))) AS fim
),
coorte AS (
  SELECT p.user_id, p.visitor_id FROM public.profiles p, per, adm
  WHERE adm.ok AND p.user_id IS NOT NULL AND p.created_at >= per.ini AND p.created_at < per.fim
)
SELECT count(*),
       count(*) FILTER (WHERE nullif(c.visitor_id,'') IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.landing_events e WHERE e.visitor_id = c.visitor_id AND e.event = 'landing_view')),
       count(*) FILTER (WHERE nullif(c.visitor_id,'') IS NULL OR NOT EXISTS (
         SELECT 1 FROM public.landing_events e WHERE e.visitor_id = c.visitor_id AND e.event = 'landing_view'))
FROM coorte c;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_cohort_entry(integer,integer) TO authenticated;

-- Pagou sem conta de vendedor, restrito à mesma coorte
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
  SELECT DISTINCT s.user_id, min(coalesce(s.updated_at, s.created_at)) AS pago_em
  FROM public.subscriptions s, per
  WHERE s.status IN ('active','paid') AND coalesce(s.updated_at, s.created_at) >= per.ini
    AND s.user_id IN (SELECT user_id FROM coorte)
  GROUP BY s.user_id
),
sem_vendedor AS (
  SELECT g.user_id, g.pago_em,
         (SELECT min(i.created_at) FROM public.user_integrations i
           WHERE i.user_id = g.user_id AND i.platform = 'mercadolivre') AS ligou_em
  FROM pagos g
)
SELECT count(*) FILTER (WHERE ligou_em IS NULL OR ligou_em > pago_em),
       count(*) FILTER (WHERE ligou_em IS NOT NULL AND ligou_em > pago_em),
       round(avg(EXTRACT(epoch FROM (ligou_em - pago_em))/3600) FILTER (WHERE ligou_em IS NOT NULL AND ligou_em > pago_em)::numeric, 1),
       (SELECT count(DISTINCT r.user_id) FROM public.refund_requests r, per
         WHERE r.created_at >= per.ini AND r.user_id IN (SELECT user_id FROM coorte))
FROM sem_vendedor;
$fn$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_paid_without_seller_cohort(integer) TO authenticated;