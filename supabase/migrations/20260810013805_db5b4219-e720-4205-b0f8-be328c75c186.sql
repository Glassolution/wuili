-- Nome do afiliado na lista do admin caía em "Afiliado <CODIGO>" / "Sem e-mail".
--
-- A identidade era resolvida só via `affiliates` -> `profiles`/`auth.users`. Quando não
-- existe linha em `affiliates` para o código (ou o perfil está vazio), tudo vem NULL e
-- sobra o fallback com o próprio código — foi o que apareceu para LUCA2AF6.
--
-- `affiliate_applications` guarda o nome e o e-mail que a própria pessoa preencheu no
-- formulário, então passa a ser mais uma fonte de identidade nas duas telas. Também
-- extende a resolução de código do detalhe, senão a linha listada não abre.

-- ---------------------------------------------------------------------------
-- Ranking: nome vindo do cadastro quando perfil/auth não resolvem
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_affiliates_summary(
  p_from timestamptz DEFAULT (now() - interval '30 days'),
  p_to timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funnel jsonb;
  v_commissions jsonb;
  v_ranking jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT jsonb_build_object(
    'clicks', COUNT(*),
    'signups', COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL),
    'checkouts', COUNT(*) FILTER (WHERE c.reached_payment_at IS NOT NULL),
    'conversions', COUNT(*) FILTER (WHERE c.converted_at IS NOT NULL)
  )
  INTO v_funnel
  FROM public.affiliate_clicks c
  WHERE c.created_at >= p_from AND c.created_at < p_to;

  SELECT jsonb_build_object(
    'total_value', COALESCE(SUM(v.commission_value), 0),
    'total_count', COUNT(*),
    'pending_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'pending'), 0),
    'pending_count', COUNT(*) FILTER (WHERE v.status = 'pending'),
    'approved_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'approved'), 0),
    'approved_count', COUNT(*) FILTER (WHERE v.status = 'approved'),
    'paid_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status = 'paid'), 0),
    'paid_count', COUNT(*) FILTER (WHERE v.payout_status = 'paid'),
    'refunded_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'refunded'), 0),
    'refunded_count', COUNT(*) FILTER (WHERE v.status = 'refunded'),
    'debt_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'refunded' AND v.payout_status = 'paid'), 0),
    'debt_count', COUNT(*) FILTER (WHERE v.status = 'refunded' AND v.payout_status = 'paid'),
    'gmv', COALESCE(SUM(v.plan_value), 0)
  )
  INTO v_commissions
  FROM public.affiliate_conversions v
  WHERE v.created_at >= p_from AND v.created_at < p_to;

  WITH period_conv AS (
    SELECT upper(v.affiliate_code) AS code,
           COUNT(*) AS conversions,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.status <> 'refunded'), 0) AS commission_value,
           COALESCE(SUM(v.plan_value), 0) AS gmv
    FROM public.affiliate_conversions v
    WHERE v.created_at >= p_from AND v.created_at < p_to
    GROUP BY 1
  ),
  period_clicks AS (
    SELECT upper(c.affiliate_code) AS code,
           COUNT(*) AS clicks,
           COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL) AS signups
    FROM public.affiliate_clicks c
    WHERE c.created_at >= p_from AND c.created_at < p_to
    GROUP BY 1
  ),
  codes AS (
    SELECT upper(a.code) AS code
    FROM public.affiliates a
    WHERE a.is_active = true AND COALESCE(btrim(a.code), '') <> ''
    UNION
    SELECT pc.code FROM period_conv pc WHERE COALESCE(btrim(pc.code), '') <> ''
  )
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'commission_value')::numeric DESC, r->>'affiliate_code'), '[]'::jsonb)
  INTO v_ranking
  FROM (
    SELECT jsonb_build_object(
      'affiliate_code', k.code,
      'user_id', COALESCE(a.user_id, ap.user_id),
      'display_name',
        COALESCE(
          NULLIF(btrim(pr.display_name), ''),
          NULLIF(btrim(au.raw_user_meta_data->>'full_name'), ''),
          NULLIF(btrim(au.raw_user_meta_data->>'name'), ''),
          NULLIF(btrim(ap.full_name), ''),
          NULLIF(split_part(COALESCE(au.email, ap.email, ''), '@', 1), ''),
          'Afiliado ' || k.code
        ),
      'email', COALESCE(NULLIF(btrim(pr.email), ''), au.email, NULLIF(btrim(ap.email), '')),
      'is_active', COALESCE(a.is_active, false),
      'created_at', a.created_at,
      'conversions', COALESCE(x.conversions, 0),
      'commission_value', COALESCE(x.commission_value, 0),
      'gmv', COALESCE(x.gmv, 0),
      'clicks', COALESCE(cl.clicks, 0),
      'signups', COALESCE(cl.signups, 0)
    ) AS r
    FROM codes k
    LEFT JOIN period_conv x ON x.code = k.code
    LEFT JOIN period_clicks cl ON cl.code = k.code
    LEFT JOIN public.affiliates a ON upper(a.code) = k.code
    LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
    LEFT JOIN auth.users au ON au.id = a.user_id
    -- Casa a solicitação pelo dono do link; sem linha em `affiliates`, casa pelo código.
    LEFT JOIN LATERAL (
      SELECT s.user_id, s.full_name, s.email
      FROM public.affiliate_applications s
      WHERE (a.user_id IS NOT NULL AND s.user_id = a.user_id)
         OR upper(btrim(COALESCE(s.affiliate_code, ''))) = k.code
      ORDER BY (a.user_id IS NOT NULL AND s.user_id = a.user_id) DESC, s.updated_at DESC
      LIMIT 1
    ) ap ON true
  ) ranked;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'funnel', COALESCE(v_funnel, '{}'::jsonb),
    'commissions', COALESCE(v_commissions, '{}'::jsonb),
    'ranking', v_ranking
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_affiliates_summary(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliates_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliates_summary(timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Detalhe: mesma identidade + abre código que só existe em cadastro/conversão
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_affiliate_details(
  p_query text,
  p_from timestamptz DEFAULT (now() - interval '365 days'),
  p_to timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_q text := btrim(coalesce(p_query, ''));
  v_code text;
  v_affiliate jsonb;
  v_funnel jsonb;
  v_commissions jsonb;
  v_conversions jsonb;
  v_clicks jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF v_q = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT upper(a.code) INTO v_code
  FROM public.affiliates a
  LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
  LEFT JOIN auth.users au ON au.id = a.user_id
  WHERE upper(a.code) = upper(v_q)
     OR lower(coalesce(pr.email, au.email, '')) = lower(v_q)
     OR lower(coalesce(pr.email, au.email, '')) LIKE '%' || lower(v_q) || '%'
     OR lower(coalesce(pr.display_name, au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')) LIKE '%' || lower(v_q) || '%'
  ORDER BY (upper(a.code) = upper(v_q)) DESC, a.created_at ASC
  LIMIT 1;

  -- Sem linha em `affiliates`: o código ainda pode existir no cadastro enviado...
  IF v_code IS NULL THEN
    SELECT upper(btrim(s.affiliate_code)) INTO v_code
    FROM public.affiliate_applications s
    WHERE upper(btrim(COALESCE(s.affiliate_code, ''))) = upper(v_q)
       OR lower(btrim(COALESCE(s.email, ''))) = lower(v_q)
       OR lower(btrim(COALESCE(s.full_name, ''))) LIKE '%' || lower(v_q) || '%'
    ORDER BY s.updated_at DESC
    LIMIT 1;
  END IF;

  -- ...ou só nas conversões já registradas.
  IF v_code IS NULL THEN
    SELECT upper(v.affiliate_code) INTO v_code
    FROM public.affiliate_conversions v
    WHERE upper(v.affiliate_code) = upper(v_q)
    LIMIT 1;
  END IF;

  IF v_code IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'code', k.code,
    'link', a.link,
    'is_active', COALESCE(a.is_active, false),
    'commission_rate', a.commission_rate,
    'created_at', a.created_at,
    'user_id', COALESCE(a.user_id, ap.user_id),
    'display_name',
      COALESCE(
        NULLIF(btrim(pr.display_name), ''),
        NULLIF(btrim(au.raw_user_meta_data->>'full_name'), ''),
        NULLIF(btrim(au.raw_user_meta_data->>'name'), ''),
        NULLIF(btrim(ap.full_name), ''),
        NULLIF(split_part(COALESCE(au.email, ap.email, ''), '@', 1), ''),
        'Afiliado ' || k.code
      ),
    'email', COALESCE(NULLIF(btrim(pr.email), ''), au.email, NULLIF(btrim(ap.email), ''))
  )
  INTO v_affiliate
  FROM (SELECT v_code AS code) k
  LEFT JOIN public.affiliates a ON upper(a.code) = k.code
  LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
  LEFT JOIN auth.users au ON au.id = a.user_id
  LEFT JOIN LATERAL (
    SELECT s.user_id, s.full_name, s.email
    FROM public.affiliate_applications s
    WHERE (a.user_id IS NOT NULL AND s.user_id = a.user_id)
       OR upper(btrim(COALESCE(s.affiliate_code, ''))) = k.code
    ORDER BY (a.user_id IS NOT NULL AND s.user_id = a.user_id) DESC, s.updated_at DESC
    LIMIT 1
  ) ap ON true;

  SELECT jsonb_build_object(
    'clicks', COUNT(*),
    'signups', COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL),
    'checkouts', COUNT(*) FILTER (WHERE c.reached_payment_at IS NOT NULL),
    'conversions', COUNT(*) FILTER (WHERE c.converted_at IS NOT NULL)
  )
  INTO v_funnel
  FROM public.affiliate_clicks c
  WHERE upper(c.affiliate_code) = v_code
    AND c.created_at >= p_from AND c.created_at < p_to;

  SELECT jsonb_build_object(
    'total_value', COALESCE(SUM(v.commission_value), 0),
    'pending_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'pending'), 0),
    'approved_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'approved'), 0),
    'paid_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status = 'paid'), 0),
    'refunded_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'refunded'), 0),
    'debt_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status = 'refunded' AND v.payout_status = 'paid'), 0),
    'available_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.status <> 'refunded' AND v.payout_status <> 'paid'), 0),
    'gmv', COALESCE(SUM(v.plan_value), 0),
    'count', COUNT(*)
  )
  INTO v_commissions
  FROM public.affiliate_conversions v
  WHERE upper(v.affiliate_code) = v_code
    AND v.created_at >= p_from AND v.created_at < p_to;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_conversions
  FROM (
    SELECT v.id, v.created_at, v.plan_name, v.plan_value, v.commission_rate, v.commission_value,
           v.status, v.payout_status, v.cycle_type, v.cycle_number, v.reference_month,
           v.refunded_at, v.paid_at, pr.email AS subscriber_email, pr.display_name AS subscriber_name
    FROM public.affiliate_conversions v
    LEFT JOIN public.profiles pr ON pr.user_id = v.subscriber_user_id
    WHERE upper(v.affiliate_code) = v_code
      AND v.created_at >= p_from AND v.created_at < p_to
    ORDER BY v.created_at DESC
    LIMIT 200
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_clicks
  FROM (
    SELECT c.id, c.created_at, c.referrer, c.visitor_id,
           c.signup_at, c.reached_payment_at, c.converted_at
    FROM public.affiliate_clicks c
    WHERE upper(c.affiliate_code) = v_code
      AND c.created_at >= p_from AND c.created_at < p_to
    ORDER BY c.created_at DESC
    LIMIT 200
  ) t;

  RETURN jsonb_build_object(
    'found', true,
    'affiliate', v_affiliate,
    'funnel', COALESCE(v_funnel, '{}'::jsonb),
    'commissions', COALESCE(v_commissions, '{}'::jsonb),
    'conversions', v_conversions,
    'clicks', v_clicks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_affiliate_details(text, timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliate_details(text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_affiliate_details(text, timestamptz, timestamptz) TO service_role;