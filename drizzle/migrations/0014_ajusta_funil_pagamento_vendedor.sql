CREATE OR REPLACE FUNCTION public.rpc_admin_full_funnel(p_days integer DEFAULT 30, p_offset_days integer DEFAULT 0, p_origem text DEFAULT NULL::text, p_device text DEFAULT NULL::text, p_browser text DEFAULT NULL::text)
 RETURNS TABLE(ordem integer, etapa text, definicao text, pessoas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH per AS (
  SELECT (now() - make_interval(days => greatest(p_days,1) + greatest(coalesce(p_offset_days,0),0))) AS ini,
         (now() - make_interval(days => greatest(coalesce(p_offset_days,0),0))) AS fim
),
adm AS (SELECT public.is_admin(auth.uid()) AS ok),
le AS (
  SELECT e.* FROM public.landing_events e, per, adm
  WHERE adm.ok AND e.created_at >= per.ini AND e.created_at < per.fim
    AND (p_device IS NULL OR e.device = p_device)
    AND (p_origem IS NULL OR coalesce(nullif(e.origem,''), nullif(e.referrer,''), 'direto') ILIKE '%'||p_origem||'%')
    AND (p_browser IS NULL OR coalesce(e.browser_kind,'normal') = p_browser)
),
usr AS (
  SELECT p.user_id FROM public.profiles p, adm
  WHERE adm.ok AND p.user_id IS NOT NULL
    AND (p_origem IS NULL OR coalesce(nullif(p.utm_source,''), nullif(p.signup_source,''), 'direto') ILIKE '%'||p_origem||'%')
    AND (p_device IS NULL OR EXISTS (SELECT 1 FROM public.user_sessions s WHERE s.user_id = p.user_id AND s.device = p_device))
),
ev AS (
  SELECT m.* FROM public.mobile_home_events m, per
  WHERE m.created_at >= per.ini AND m.created_at < per.fim
    AND m.user_id IN (SELECT user_id FROM usr)
    AND (p_device IS NULL OR m.device IS NULL OR m.device = p_device)
    AND (p_browser IS NULL OR coalesce(m.browser_kind,'normal') = p_browser)
),
pv AS (
  SELECT v.* FROM public.user_page_views v, per
  WHERE v.viewed_at >= per.ini AND v.viewed_at < per.fim
    AND v.user_id IN (SELECT user_id FROM usr)
    AND (p_device IS NULL OR v.device IS NULL OR v.device = p_device)
)
SELECT 1, 'Visitou a landing', 'Pessoas diferentes que abriram a página inicial',
       (SELECT count(DISTINCT visitor_id) FROM le WHERE event = 'landing_view')
UNION ALL SELECT 2, 'Clicou em criar conta', 'Clique em qualquer botão de criar conta na landing',
       (SELECT count(DISTINCT visitor_id) FROM le WHERE event LIKE 'cta_%signup%' OR event IN ('cta_primary_click','cta_offer_click'))
UNION ALL SELECT 3, 'Conta criada', 'Contas realmente criadas no período (tabela de perfis)',
       (SELECT count(*) FROM public.profiles p, per, adm WHERE adm.ok AND p.created_at >= per.ini AND p.created_at < per.fim AND p.user_id IN (SELECT user_id FROM usr))
UNION ALL SELECT 4, 'Onboarding concluído', 'Perfis marcados como onboarding concluído',
       (SELECT count(*) FROM public.profiles p, per, adm WHERE adm.ok AND p.onboarding_completed AND coalesce(p.onboarding_completed_at, p.created_at) >= per.ini AND coalesce(p.onboarding_completed_at, p.created_at) < per.fim AND p.user_id IN (SELECT user_id FROM usr))
UNION ALL SELECT 5, 'Viu o catálogo', 'Abriu a home ou a lista de produtos',
       (SELECT count(DISTINCT u) FROM (SELECT user_id u FROM ev WHERE event_name = 'home_view' UNION SELECT user_id FROM pv WHERE path LIKE '/dashboard/catalogo%') s)
UNION ALL SELECT 6, 'Viu um produto', 'Abriu a tela de detalhes de um produto',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'product_detail_view')
UNION ALL SELECT 7, 'Clicou em publicar', 'Tocou no botão de publicar/importar o produto',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'import_flow_open' OR (event_name = 'product_detail_action' AND detail LIKE 'publish%'))
UNION ALL SELECT 8, 'Começou a conexão com o Mercado Livre', 'Abriu a tela de conectar a conta do Mercado Livre',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name IN ('ml_connect_open','ml_connect_start'))
UNION ALL SELECT 9, 'Conectou o Mercado Livre', 'Conexão concluída com sucesso',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'ml_connect_result' AND detail = 'success')
UNION ALL SELECT 10, 'Concluiu a revisão do anúncio', 'Avançou da revisão para a etapa seguinte',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'import_flow_advance' AND detail IN ('2_to_3','3_to_4'))
UNION ALL SELECT 11, 'Viu a página de planos', 'Abriu a tela de planos',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'plans_open')
UNION ALL SELECT 12, 'Iniciou o pagamento', 'Clicou para pagar um plano',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'plan_checkout_clicked')
UNION ALL SELECT 13, 'Pagamento confirmado', 'Assinatura paga criada no período',
       (SELECT count(DISTINCT s.user_id) FROM public.subscriptions s, per, adm WHERE adm.ok AND s.status IN ('active','paid') AND s.created_at >= per.ini AND s.created_at < per.fim AND s.user_id IN (SELECT user_id FROM usr))
UNION ALL SELECT 14, 'Conta de vendedor apta', 'Tem conta do Mercado Livre conectada entre quem usou o app no período',
       (SELECT count(DISTINCT i.user_id) FROM public.user_integrations i, adm
         WHERE adm.ok AND i.platform ILIKE '%mercado%'
           AND i.user_id IN (SELECT DISTINCT user_id FROM ev))
UNION ALL SELECT 15, 'Anúncio publicado', 'Publicação concluída no Mercado Livre',
       (SELECT count(DISTINCT u) FROM (
          SELECT user_id u FROM ev WHERE event_name = 'publish_result' AND detail IN ('success','partial')
          UNION
          SELECT p.user_id FROM public.user_publications p, per, adm WHERE adm.ok AND p.created_at >= per.ini AND p.created_at < per.fim AND p.user_id IN (SELECT user_id FROM usr)
        ) s)
ORDER BY 1;
$function$;