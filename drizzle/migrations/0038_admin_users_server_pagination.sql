CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_created_id_idx ON public.subscriptions(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS user_sessions_last_seen_user_idx ON public.user_sessions(last_seen_at DESC, user_id);
CREATE INDEX IF NOT EXISTS profiles_created_user_idx ON public.profiles(created_at DESC, user_id DESC);

CREATE OR REPLACE FUNCTION public.admin_user_segment(p_status text, p_kind text, p_end timestamptz, p_refresh_failed timestamptz, p_now timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_status IS DISTINCT FROM 'active' THEN 'sem_plano'
 WHEN p_kind IS DISTINCT FROM 'lifetime' AND (p_end IS NULL OR p_end <= p_now) THEN 'vencida'
 WHEN p_refresh_failed IS NOT NULL THEN 'risco' ELSE 'ativos' END
$$;
REVOKE ALL ON FUNCTION public.admin_user_segment(text,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_segment(text,text,timestamptz,timestamptz,timestamptz) TO service_role;

CREATE OR REPLACE VIEW public.admin_users_latest WITH (security_invoker=true) AS
SELECT p.user_id, p.display_name AS name, p.email, p.avatar_url, p.created_at,
 s.plan, s.status AS subscription_status,
 (i.user_id IS NOT NULL) AS ml_connected,
 public.admin_user_segment(s.status,s.purchase_kind,s.current_period_end,i.refresh_failed_at,now()) AS segment
FROM public.profiles p
LEFT JOIN (SELECT DISTINCT ON (user_id) user_id,plan,status,purchase_kind,current_period_end FROM public.subscriptions ORDER BY user_id,created_at DESC,id DESC) s ON s.user_id=p.user_id
LEFT JOIN public.user_integrations i ON i.user_id=p.user_id AND i.platform='mercadolivre';
REVOKE ALL ON public.admin_users_latest FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_users_latest TO service_role;

CREATE OR REPLACE FUNCTION public.admin_users_page(p_page integer DEFAULT 1,p_size integer DEFAULT 25,p_search text DEFAULT '',p_tab text DEFAULT 'ativos')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; pattern text;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<1 OR p_page>1000000 OR p_size IS NULL OR p_size NOT IN (10,25,50) OR p_tab IS NULL OR p_tab NOT IN ('ativos','risco','vencida','sem_plano','todos') OR p_search IS NULL OR length(p_search)>200 THEN RAISE EXCEPTION 'Parâmetros inválidos'; END IF;
 pattern := '%' || replace(replace(replace(trim(p_search), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
 WITH filtered AS MATERIALIZED (
 SELECT user_id,name,email,created_at,plan,subscription_status,ml_connected,segment
 FROM public.admin_users_latest
 WHERE (p_tab='todos' OR segment=p_tab OR (p_tab='ativos' AND segment='risco'))
 AND (trim(p_search)='' OR email ILIKE pattern OR name ILIKE pattern OR user_id::text ILIKE pattern)
 ), page_rows AS (
 SELECT * FROM filtered ORDER BY created_at DESC,user_id DESC LIMIT p_size OFFSET ((p_page-1)*p_size)
 ), enriched AS (
 SELECT r.*,p.avatar_url,
 (SELECT count(*) FROM public.orders o WHERE o.user_id=r.user_id) AS orders_count,
 (SELECT last_seen_at FROM public.user_sessions us WHERE us.user_id=r.user_id ORDER BY last_seen_at DESC LIMIT 1) AS last_seen_at
 FROM page_rows r JOIN public.profiles p USING(user_id)
 ) SELECT jsonb_build_object('users',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY created_at DESC,user_id DESC) FROM enriched e),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',p_page,'size',p_size) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_users_page(integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_users_page(integer,integer,text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_users_counts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('todos',count(*),'ativos',count(*) FILTER(WHERE segment IN ('ativos','risco')),'risco',count(*) FILTER(WHERE segment='risco'),'vencida',count(*) FILTER(WHERE segment='vencida'),'sem_plano',count(*) FILTER(WHERE segment='sem_plano'),'online',(SELECT count(DISTINCT us.user_id) FROM public.user_sessions us JOIN public.profiles p ON p.user_id=us.user_id WHERE us.last_seen_at>now()-interval '2 minutes')) INTO result FROM public.admin_users_latest;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_users_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_users_counts() TO authenticated,service_role;