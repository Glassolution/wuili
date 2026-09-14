CREATE OR REPLACE FUNCTION public.rpc_admin_affiliates_summary(
  p_from timestamptz DEFAULT (now() - '30 days'::interval),
  p_to timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_funnel jsonb;
  v_commissions jsonb;
  v_rows jsonb;
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
    'pending_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status <> 'paid'), 0),
    'paid_value', COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status = 'paid'), 0),
    'gmv', COALESCE(SUM(v.plan_value), 0)
  )
  INTO v_commissions
  FROM public.affiliate_conversions v
  WHERE v.created_at >= p_from AND v.created_at < p_to;

  WITH conv AS (
    SELECT upper(v.affiliate_code) AS code,
           COUNT(DISTINCT v.subscriber_user_id) AS signups,
           COUNT(DISTINCT v.subscriber_user_id) FILTER (
             WHERE v.status IN ('reached_payment','paid','approved','active','authorized')
           ) AS reached_payment,
           COUNT(DISTINCT v.subscriber_user_id) FILTER (
             WHERE v.status IN ('paid','approved','active','authorized')
           ) AS payers,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status <> 'paid' AND v.status <> 'refunded'), 0) AS commission_pending,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.payout_status = 'paid'), 0) AS commission_paid,
           COALESCE(SUM(v.commission_value) FILTER (WHERE v.status <> 'refunded'), 0) AS commission_value,
           COALESCE(SUM(v.plan_value), 0) AS gmv,
           COUNT(*) AS conversions
    FROM public.affiliate_conversions v
    GROUP BY 1
  ),
  clicks AS (
    SELECT upper(c.affiliate_code) AS code,
           COUNT(*) AS clicks,
           COUNT(*) FILTER (WHERE c.signup_user_id IS NOT NULL) AS signups,
           COUNT(*) FILTER (WHERE c.reached_payment_at IS NOT NULL) AS reached_payment
    FROM public.affiliate_clicks c
    GROUP BY 1
  ),
  codes AS (
    SELECT upper(a.code) AS code
    FROM public.affiliates a
    WHERE a.removed_at IS NULL AND COALESCE(btrim(a.code), '') <> ''
    UNION
    SELECT cv.code FROM conv cv WHERE COALESCE(btrim(cv.code), '') <> ''
  )
  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'commission_pending')::numeric DESC, r->>'code'), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'affiliate_user_id', COALESCE(a.user_id, ap.user_id),
      'user_id', COALESCE(a.user_id, ap.user_id),
      'code', k.code,
      'affiliate_code', k.code,
      'link', 'https://velods.com.br/ref/' || k.code,
      'affiliate_name',
        COALESCE(
          NULLIF(btrim(pr.display_name), ''),
          NULLIF(btrim(au.raw_user_meta_data->>'full_name'), ''),
          NULLIF(btrim(ap.full_name), ''),
          NULLIF(split_part(COALESCE(au.email, ap.email, ''), '@', 1), ''),
          'Afiliado ' || k.code
        ),
      'display_name',
        COALESCE(NULLIF(btrim(pr.display_name), ''), NULLIF(btrim(ap.full_name), ''), 'Afiliado ' || k.code),
      'affiliate_email', COALESCE(NULLIF(btrim(pr.email), ''), au.email, NULLIF(btrim(ap.email), '')),
      'email', COALESCE(NULLIF(btrim(pr.email), ''), au.email, NULLIF(btrim(ap.email), '')),
      'is_active', COALESCE(a.is_active, false),
      'removed_at', a.removed_at,
      'application_status', ap.status,
      'created_at', COALESCE(a.created_at, ap.created_at, now()),
      'clicks', COALESCE(cl.clicks, 0),
      'signups', GREATEST(COALESCE(cl.signups, 0), COALESCE(cv.signups, 0)),
      'reached_payment', GREATEST(COALESCE(cl.reached_payment, 0), COALESCE(cv.reached_payment, 0)),
      'payers', COALESCE(cv.payers, 0),
      'commission_pending', COALESCE(cv.commission_pending, 0),
      'commission_paid', COALESCE(cv.commission_paid, 0),
      'commission_value', COALESCE(cv.commission_value, 0),
      'conversions', COALESCE(cv.conversions, 0),
      'gmv', COALESCE(cv.gmv, 0)
    ) AS r
    FROM codes k
    LEFT JOIN conv cv ON cv.code = k.code
    LEFT JOIN clicks cl ON cl.code = k.code
    LEFT JOIN public.affiliates a ON upper(a.code) = k.code AND a.removed_at IS NULL
    LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
    LEFT JOIN auth.users au ON au.id = a.user_id
    LEFT JOIN LATERAL (
      SELECT s.user_id, s.full_name, s.email, s.created_at, s.status
      FROM public.affiliate_applications s
      WHERE (a.user_id IS NOT NULL AND s.user_id = a.user_id)
         OR (a.user_id IS NULL AND upper(COALESCE(s.affiliate_code, '')) = k.code)
      ORDER BY s.created_at DESC
      LIMIT 1
    ) ap ON true
  ) t;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'funnel', v_funnel,
    'commissions', v_commissions,
    'ranking', v_rows,
    'affiliates', v_rows
  );
END;
$function$;