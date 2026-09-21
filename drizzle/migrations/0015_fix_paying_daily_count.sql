CREATE OR REPLACE FUNCTION public.rpc_admin_paying_daily(p_days integer DEFAULT 30)
 RETURNS TABLE(dia date, novos_pagantes bigint, cancelamentos bigint, reembolsos bigint, ativos_no_dia bigint, receita numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH dias AS (
    SELECT generate_series(
      ((now() AT TIME ZONE 'America/Sao_Paulo') - make_interval(days => p_days))::date,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,
      '1 day')::date AS d
    WHERE public.is_admin(auth.uid())
  )
  SELECT dias.d,
    (SELECT count(*) FROM subscriptions s
       WHERE (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date = dias.d
         AND s.status IN ('active','authorized','paid')),
    (SELECT count(*) FROM subscriptions s WHERE (s.cancelled_at AT TIME ZONE 'America/Sao_Paulo')::date = dias.d),
    (SELECT count(*) FROM refund_requests r WHERE (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date = dias.d),
    (SELECT count(*) FROM subscriptions s WHERE (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= dias.d
        AND (s.cancelled_at IS NULL OR (s.cancelled_at AT TIME ZONE 'America/Sao_Paulo')::date > dias.d)
        AND (s.current_period_end IS NULL OR (s.current_period_end AT TIME ZONE 'America/Sao_Paulo')::date >= dias.d)
        AND s.status IN ('active','authorized')),
    COALESCE((SELECT sum(s.amount) FROM subscriptions s
       WHERE (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date = dias.d
         AND s.status IN ('active','authorized','paid')), 0)
  FROM dias ORDER BY dias.d;
$function$;