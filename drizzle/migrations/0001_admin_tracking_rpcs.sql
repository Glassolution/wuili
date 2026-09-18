CREATE OR REPLACE FUNCTION public.rpc_admin_traffic_daily(p_days integer DEFAULT 30)
RETURNS TABLE(dia date, sessoes bigint, usuarios bigint, mobile_usuarios bigint, desktop_usuarios bigint, page_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT date_trunc('day', started_at)::date AS d, user_id,
           COALESCE(NULLIF(device,''),
             CASE WHEN user_agent ~* 'Mobi|Android|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini' THEN 'mobile' ELSE 'desktop' END) AS dev
    FROM user_sessions
    WHERE public.is_admin(auth.uid())
      AND started_at >= now() - make_interval(days => p_days)
  ), agg AS (
    SELECT d,
      count(*) AS sessoes,
      count(DISTINCT user_id) AS usuarios,
      count(DISTINCT user_id) FILTER (WHERE dev IN ('mobile','tablet')) AS mobile_usuarios,
      count(DISTINCT user_id) FILTER (WHERE dev = 'desktop') AS desktop_usuarios
    FROM s GROUP BY d
  ), pv AS (
    SELECT date_trunc('day', viewed_at)::date AS d, count(*) AS page_views
    FROM user_page_views
    WHERE public.is_admin(auth.uid())
      AND viewed_at >= now() - make_interval(days => p_days)
    GROUP BY 1
  )
  SELECT agg.d, agg.sessoes, agg.usuarios, agg.mobile_usuarios, agg.desktop_usuarios, COALESCE(pv.page_views, 0)
  FROM agg LEFT JOIN pv ON pv.d = agg.d
  ORDER BY agg.d;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_paying_daily(p_days integer DEFAULT 30)
RETURNS TABLE(dia date, novos_pagantes bigint, cancelamentos bigint, reembolsos bigint, ativos_no_dia bigint, receita numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH dias AS (
    SELECT generate_series((now() - make_interval(days => p_days))::date, now()::date, '1 day')::date AS d
    WHERE public.is_admin(auth.uid())
  )
  SELECT dias.d,
    (SELECT count(*) FROM subscriptions s WHERE s.created_at::date = dias.d),
    (SELECT count(*) FROM subscriptions s WHERE s.cancelled_at::date = dias.d),
    (SELECT count(*) FROM refund_requests r WHERE r.created_at::date = dias.d),
    (SELECT count(*) FROM subscriptions s WHERE s.created_at::date <= dias.d
        AND (s.cancelled_at IS NULL OR s.cancelled_at::date > dias.d)
        AND (s.current_period_end IS NULL OR s.current_period_end::date >= dias.d)
        AND s.status IN ('active','authorized')),
    COALESCE((SELECT sum(s.amount) FROM subscriptions s WHERE s.created_at::date = dias.d), 0)
  FROM dias ORDER BY dias.d;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_top_pages(p_days integer DEFAULT 30, p_limit integer DEFAULT 25)
RETURNS TABLE(path text, views bigint, usuarios bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT regexp_replace(v.path, '/[0-9a-f]{8}-[0-9a-f-]{27,}|/[0-9]{3,}', '/:id', 'g') AS path,
         count(*)::bigint, count(DISTINCT v.user_id)::bigint
  FROM user_page_views v
  WHERE public.is_admin(auth.uid()) AND v.viewed_at >= now() - make_interval(days => p_days)
  GROUP BY 1 ORDER BY 2 DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_exit_pages(p_days integer DEFAULT 30, p_limit integer DEFAULT 25)
RETURNS TABLE(path text, saidas bigint, percentual numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ult AS (
    SELECT DISTINCT ON (COALESCE(v.session_id::text, v.user_id::text || date_trunc('hour', v.viewed_at)::text))
      regexp_replace(v.path, '/[0-9a-f]{8}-[0-9a-f-]{27,}|/[0-9]{3,}', '/:id', 'g') AS path
    FROM user_page_views v
    WHERE public.is_admin(auth.uid()) AND v.viewed_at >= now() - make_interval(days => p_days)
    ORDER BY COALESCE(v.session_id::text, v.user_id::text || date_trunc('hour', v.viewed_at)::text), v.viewed_at DESC
  )
  SELECT path, count(*)::bigint,
         round(100.0 * count(*) / NULLIF((SELECT count(*) FROM ult), 0), 1)
  FROM ult GROUP BY path ORDER BY 2 DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_refund_reasons(p_days integer DEFAULT 90)
RETURNS TABLE(motivo text, total bigint, ultima_pagina text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pedidos AS (
    SELECT COALESCE(NULLIF(trim(r.reason), ''), 'Sem motivo informado') AS motivo,
           r.user_id,
           (SELECT regexp_replace(v.path, '/[0-9a-f]{8}-[0-9a-f-]{27,}', '/:id', 'g')
              FROM user_page_views v WHERE v.user_id = r.user_id
             ORDER BY v.viewed_at DESC LIMIT 1) AS pagina
    FROM refund_requests r
    WHERE public.is_admin(auth.uid()) AND r.created_at >= now() - make_interval(days => p_days)
  )
  SELECT motivo, count(*)::bigint AS total,
         (SELECT p2.pagina FROM pedidos p2 WHERE p2.motivo = p.motivo AND p2.pagina IS NOT NULL
           GROUP BY p2.pagina ORDER BY count(*) DESC LIMIT 1) AS ultima_pagina
  FROM pedidos p GROUP BY motivo ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_traffic_daily(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_paying_daily(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_top_pages(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_exit_pages(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_refund_reasons(integer) TO authenticated;