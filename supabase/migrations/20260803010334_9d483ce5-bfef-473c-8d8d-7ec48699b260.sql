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

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'commission_value')::numeric DESC), '[]'::jsonb)
  INTO v_ranking
  FROM (
    SELECT jsonb_build_object(
      'affiliate_code', x.code,
      'display_name', pr.display_name,
      'email', pr.email,
      'conversions', x.conversions,
      'commission_value', x.commission_value,
      'gmv', x.gmv,
      'clicks', COALESCE(cl.clicks, 0),
      'signups', COALESCE(cl.signups, 0)
    ) AS r
    FROM (
      SELECT upper(v.affiliate_code) AS code,
             COUNT(*) AS conversions,
             COALESCE(SUM(v.commission_value) FILTER (WHERE v.status <> 'refunded'), 0) AS commission_value,
             COALESCE(SUM(v.plan_value), 0) AS gmv
      FROM public.affiliate_conversions v
      WHERE v.created_at >= p_from AND v.created_at < p_to
      GROUP BY 1
    ) x
    LEFT JOIN (
      SELECT upper(c.affiliate_code) AS code,
             COUNT(*) AS clicks,
             COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL) AS signups
      FROM public.affiliate_clicks c
      WHERE c.created_at >= p_from AND c.created_at < p_to
      GROUP BY 1
    ) cl ON cl.code = x.code
    LEFT JOIN public.affiliates a ON upper(a.code) = x.code
    LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
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
  WHERE upper(a.code) = upper(v_q)
     OR lower(coalesce(pr.email, '')) = lower(v_q)
     OR lower(coalesce(pr.email, '')) LIKE '%' || lower(v_q) || '%'
     OR lower(coalesce(pr.display_name, '')) LIKE '%' || lower(v_q) || '%'
  ORDER BY (upper(a.code) = upper(v_q)) DESC, a.created_at ASC
  LIMIT 1;

  IF v_code IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'code', upper(a.code),
    'link', a.link,
    'is_active', a.is_active,
    'commission_rate', a.commission_rate,
    'created_at', a.created_at,
    'user_id', a.user_id,
    'display_name', pr.display_name,
    'email', pr.email
  )
  INTO v_affiliate
  FROM public.affiliates a
  LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
  WHERE upper(a.code) = v_code
  LIMIT 1;

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