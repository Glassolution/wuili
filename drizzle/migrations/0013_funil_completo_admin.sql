-- 1. Campos de origem/dispositivo/navegador nos eventos e ponte visitante -> conta
ALTER TABLE public.landing_events ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.landing_events ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.landing_events ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE public.landing_events ADD COLUMN IF NOT EXISTS browser_kind text;
ALTER TABLE public.mobile_home_events ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE public.mobile_home_events ADD COLUMN IF NOT EXISTS browser_kind text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS visitor_id text;

CREATE INDEX IF NOT EXISTS landing_events_created_event_idx ON public.landing_events (created_at, event);
CREATE INDEX IF NOT EXISTS mobile_home_events_created_event_idx ON public.mobile_home_events (created_at, event_name);

-- 2. Gravação com origem/navegador
DROP FUNCTION IF EXISTS public.rpc_landing_track(text, text, text, text);
CREATE FUNCTION public.rpc_landing_track(
  p_event text,
  p_visitor_id text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_browser text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_event NOT IN (
    'landing_view','cta_offer_click','cta_header_login_click','cta_hero_signup_click',
    'cta_how_it_works_click','cta_sticky_signup_click','cta_steps_signup_click',
    'cta_profit_signup_click','cta_final_signup_click','cta_primary_click',
    'how_it_works_click','login_link_click'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.landing_events (event, visitor_id, device, referrer, origem, utm_medium, utm_campaign, browser_kind)
  VALUES (p_event, left(coalesce(p_visitor_id,''),64), left(coalesce(p_device,''),20),
          left(coalesce(p_referrer,''),300), left(nullif(p_origem,''),80),
          left(nullif(p_utm_medium,''),80), left(nullif(p_utm_campaign,''),80),
          left(nullif(p_browser,''),20));
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_signup_track(text, text, text, text, text);
CREATE FUNCTION public.rpc_signup_track(
  p_event text,
  p_visitor_id text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_browser text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_event NOT IN (
    'signup_view','signup_start','signup_submit','signup_success','signup_error',
    'signup_google_click','signup_inapp_browser','login_submit','login_success','login_error',
    'onboarding_view','onboarding_start','onboarding_question_view','onboarding_answer',
    'onboarding_skip','onboarding_back','onboarding_complete','onboarding_ml_guide',
    'onboarding_first_product_view'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.landing_events (event, visitor_id, device, referrer, detail, origem, browser_kind)
  VALUES (p_event, left(coalesce(p_visitor_id,''),64), left(coalesce(p_device,''),20),
          left(coalesce(p_referrer,''),300), left(coalesce(p_detail,''),120),
          left(nullif(p_origem,''),80), left(nullif(p_browser,''),20));
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_landing_track(text,text,text,text,text,text,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_signup_track(text,text,text,text,text,text,text) TO PUBLIC;

-- 3. Funil completo (somente admin)
CREATE OR REPLACE FUNCTION public.rpc_admin_full_funnel(
  p_days integer DEFAULT 30,
  p_offset_days integer DEFAULT 0,
  p_origem text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_browser text DEFAULT NULL
) RETURNS TABLE(ordem integer, etapa text, definicao text, pessoas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'ml_connect_open')
UNION ALL SELECT 9, 'Conectou o Mercado Livre', 'Conexão concluída com sucesso',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'ml_connect_result' AND detail = 'success')
UNION ALL SELECT 10, 'Concluiu a revisão do anúncio', 'Avançou da revisão para a etapa seguinte',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'import_flow_advance' AND detail IN ('2_to_3','3_to_4'))
UNION ALL SELECT 11, 'Viu a página de planos', 'Abriu a tela de planos',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'plans_open')
UNION ALL SELECT 12, 'Iniciou o pagamento', 'Clicou para pagar um plano',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name = 'plan_checkout_clicked')
UNION ALL SELECT 13, 'Pagamento confirmado', 'Assinatura ativa/paga registrada no período',
       (SELECT count(DISTINCT s.user_id) FROM public.subscriptions s, per, adm WHERE adm.ok AND s.status IN ('active','paid') AND coalesce(s.updated_at, s.created_at) >= per.ini AND coalesce(s.updated_at, s.created_at) < per.fim AND s.user_id IN (SELECT user_id FROM usr))
UNION ALL SELECT 14, 'Conta de vendedor apta', 'Conta do Mercado Livre liberada para anunciar',
       (SELECT count(DISTINCT user_id) FROM ev WHERE event_name IN ('ml_seller_ready','seller_ready_after_paid'))
UNION ALL SELECT 15, 'Anúncio publicado', 'Publicação concluída no Mercado Livre',
       (SELECT count(DISTINCT u) FROM (
          SELECT user_id u FROM ev WHERE event_name = 'publish_result' AND detail IN ('success','partial')
          UNION
          SELECT p.user_id FROM public.user_publications p, per, adm WHERE adm.ok AND p.created_at >= per.ini AND p.created_at < per.fim AND p.user_id IN (SELECT user_id FROM usr)
        ) s)
ORDER BY 1;
$$;

-- 4. Pagou antes de ter conta de vendedor apta
CREATE OR REPLACE FUNCTION public.rpc_admin_paid_without_seller(p_days integer DEFAULT 30)
RETURNS TABLE(pagaram bigint, ativaram bigint, horas_medias numeric, reembolsos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH per AS (SELECT now() - make_interval(days => greatest(p_days,1)) AS ini),
base AS (
  SELECT m.user_id, min(m.created_at) AS pagou_em
  FROM public.mobile_home_events m, per
  WHERE public.is_admin(auth.uid()) AND m.event_name = 'paid_without_seller' AND m.created_at >= per.ini
  GROUP BY m.user_id
),
ativou AS (
  SELECT b.user_id, min(m.created_at) AS apto_em
  FROM base b JOIN public.mobile_home_events m
    ON m.user_id = b.user_id AND m.event_name IN ('seller_ready_after_paid','ml_seller_ready') AND m.created_at >= b.pagou_em
  GROUP BY b.user_id
)
SELECT (SELECT count(*) FROM base),
       (SELECT count(*) FROM ativou),
       (SELECT round(avg(extract(epoch FROM (a.apto_em - b.pagou_em))/3600)::numeric, 1) FROM ativou a JOIN base b USING (user_id)),
       (SELECT count(DISTINCT r.user_id) FROM public.refund_requests r WHERE r.user_id IN (SELECT user_id FROM base));
$$;

-- 5. Erros por tipo
CREATE OR REPLACE FUNCTION public.rpc_admin_error_breakdown(p_days integer DEFAULT 30)
RETURNS TABLE(tipo text, motivo text, ocorrencias bigint, pessoas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH per AS (SELECT now() - make_interval(days => greatest(p_days,1)) AS ini)
SELECT 'Cadastro/login', coalesce(nullif(e.detail,''),'não informado'), count(*)::bigint, count(DISTINCT e.visitor_id)::bigint
FROM public.landing_events e, per
WHERE public.is_admin(auth.uid()) AND e.created_at >= per.ini AND e.event IN ('signup_error','login_error')
GROUP BY 2
UNION ALL
SELECT 'Conexão com o Mercado Livre', coalesce(nullif(m.detail,''),'não informado'), count(*)::bigint, count(DISTINCT m.user_id)::bigint
FROM public.mobile_home_events m, per
WHERE public.is_admin(auth.uid()) AND m.created_at >= per.ini
  AND (m.event_name = 'ml_seller_not_ready' OR (m.event_name = 'ml_connect_result' AND m.detail <> 'success'))
GROUP BY 2
UNION ALL
SELECT 'Publicação', coalesce(nullif(m.detail,''),'não informado'), count(*)::bigint, count(DISTINCT m.user_id)::bigint
FROM public.mobile_home_events m, per
WHERE public.is_admin(auth.uid()) AND m.created_at >= per.ini AND m.event_name = 'import_flow_error'
GROUP BY 2
UNION ALL
SELECT 'Pagamento/reembolso', coalesce(nullif(r.reason,''),'não informado'), count(*)::bigint, count(DISTINCT r.user_id)::bigint
FROM public.refund_requests r, per
WHERE public.is_admin(auth.uid()) AND r.created_at >= per.ini
GROUP BY 2
ORDER BY 3 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_full_funnel(integer,integer,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_paid_without_seller(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_error_breakdown(integer) TO authenticated;