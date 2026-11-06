-- Regra única da bolinha: existe mensagem NÃO interna do cliente (sender='user')
-- mais nova que admin_last_seen_at (ou qualquer uma, se nunca visto).
-- Independe de needs_human, ai_active e de a IA ter respondido.
CREATE OR REPLACE FUNCTION public.support_ticket_is_unread(p_ticket_id uuid, p_seen timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_messages sm
    WHERE sm.ticket_id = p_ticket_id AND sm.sender = 'user' AND NOT coalesce(sm.internal, false)
      AND (p_seen IS NULL OR sm.created_at > p_seen))
$$;
REVOKE ALL ON FUNCTION public.support_ticket_is_unread(uuid, timestamptz) FROM public, anon, authenticated;

CREATE INDEX IF NOT EXISTS support_messages_ticket_sender_created_idx
  ON public.support_messages (ticket_id, sender, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_support_unread_count()
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;
  SELECT count(*) INTO v_count FROM support_tickets t
  WHERE public.support_ticket_is_unread(t.id, t.admin_last_seen_at);
  RETURN coalesce(v_count, 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_support_tickets_page(
  p_search text DEFAULT NULL, p_status text DEFAULT 'open', p_view text DEFAULT 'all',
  p_date text DEFAULT 'all', p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_term text := NULLIF(btrim(coalesce(p_search,'')), ''); v_since timestamptz; v jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;
  v_since := CASE p_date WHEN 'today' THEN date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
    WHEN '7d' THEN now() - interval '7 days' WHEN '30d' THEN now() - interval '30 days' ELSE NULL END;
  WITH base AS (
    -- Sem busca: abertos + 50 fechados mais recentes + qualquer ticket com mensagem não lida. Com busca: todos.
    SELECT t.* FROM support_tickets t WHERE (v_term IS NOT NULL OR t.status <> 'closed')
    UNION
    SELECT t.* FROM (SELECT * FROM support_tickets WHERE status = 'closed' AND v_term IS NULL ORDER BY updated_at DESC LIMIT 50) t
    UNION
    SELECT t.* FROM support_tickets t WHERE v_term IS NULL AND t.status = 'closed'
      AND public.support_ticket_is_unread(t.id, t.admin_last_seen_at)
      AND t.updated_at > now() - interval '90 days'
  ), enriched AS (
    SELECT b.*, p.display_name, p.email, p.avatar_url,
      lm.message AS last_message, lm.sender AS last_message_sender, lm.created_at AS last_message_at,
      st.message_count, st.has_admin_reply,
      public.support_ticket_is_unread(b.id, b.admin_last_seen_at) AS unread,
      (SELECT count(*) FROM support_tickets o WHERE o.user_id = b.user_id AND o.id <> b.id) AS previous_ticket_count
    FROM base b
    LEFT JOIN profiles p ON p.user_id = b.user_id
    LEFT JOIN LATERAL (SELECT sm.message, sm.sender, sm.created_at FROM support_messages sm
      WHERE sm.ticket_id = b.id AND NOT coalesce(sm.internal,false) AND sm.sender <> 'ai'
      ORDER BY sm.created_at DESC LIMIT 1) lm ON true
    LEFT JOIN LATERAL (SELECT count(*) AS message_count, bool_or(sm.sender = 'admin') AS has_admin_reply
      FROM support_messages sm WHERE sm.ticket_id = b.id AND NOT coalesce(sm.internal,false)) st ON true
  ), filtered AS (
    SELECT e.*, coalesce(e.last_message_at, e.updated_at, e.created_at) AS activity_at FROM enriched e
    WHERE (p_status = 'all' OR e.status = p_status OR (e.unread AND p_status = 'open'))
      AND (v_since IS NULL OR coalesce(e.last_message_at, e.updated_at, e.created_at) >= v_since)
      AND (v_term IS NULL OR concat_ws(' ', e.display_name, e.email, e.subject, e.last_message, e.category) ILIKE '%' || v_term || '%')
  ), viewed AS (
    SELECT f.* FROM filtered f WHERE p_view = 'all'
      OR (p_view = 'new' AND f.last_message_sender = 'user')
      OR (p_view = 'in_progress' AND f.last_message_sender IS DISTINCT FROM 'user' AND coalesce(f.has_admin_reply,false))
      OR (p_view = 'human' AND f.needs_human)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM viewed),
    'open_count', (SELECT count(*) FROM support_tickets WHERE status = 'open'),
    'counts', (SELECT jsonb_build_object('all', count(*),
        'new', count(*) FILTER (WHERE last_message_sender = 'user'),
        'in_progress', count(*) FILTER (WHERE last_message_sender IS DISTINCT FROM 'user' AND coalesce(has_admin_reply,false)),
        'human', count(*) FILTER (WHERE needs_human)) FROM filtered),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.activity_at DESC) FROM (
        SELECT id, user_id, status, category, subject, created_at, updated_at, ai_paused, needs_human, needs_human_reason,
          admin_last_seen_at, unread, display_name, email, avatar_url, left(last_message, 2000) AS last_message, last_message_sender,
          last_message_at, message_count, coalesce(has_admin_reply,false) AS has_admin_reply, previous_ticket_count, activity_at
        FROM viewed ORDER BY activity_at DESC LIMIT greatest(1, least(p_limit, 200)) OFFSET greatest(p_offset, 0)) r), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.admin_support_tickets_page(text,text,text,text,int,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_support_tickets_page(text,text,text,text,int,int) TO authenticated;