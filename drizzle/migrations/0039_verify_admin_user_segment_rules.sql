DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT * FROM (VALUES
 ('active future', 'active', 'recurring', '2026-12-06T00:00:00Z'::timestamptz, NULL::timestamptz, 'ativos'),
 ('active lifetime no end', 'active', 'lifetime', NULL, NULL, 'ativos'),
 ('active expired', 'active', 'recurring', '2026-11-05T00:00:00Z', NULL, 'vencida'),
 ('active missing end', 'active', 'recurring', NULL, NULL, 'vencida'),
 ('renewal failure on valid subscription', 'active', 'recurring', '2026-12-06T00:00:00Z', '2026-11-06T00:00:00Z', 'risco'),
 ('expired with renewal failure is not risk', 'active', 'recurring', '2026-11-05T00:00:00Z', '2026-11-06T00:00:00Z', 'vencida'),
 ('refunded lifetime', 'refunded', 'lifetime', NULL, NULL, 'sem_plano'),
 ('pending', 'pending', 'recurring', NULL, NULL, 'sem_plano'),
 ('never subscribed', NULL, NULL, NULL, NULL, 'sem_plano')
 ) AS cases(name,status,kind,period_end,refresh_failed,expected)
 LOOP
 IF public.admin_user_segment(r.status,r.kind,r.period_end,r.refresh_failed,'2026-11-06T19:20:00Z') IS DISTINCT FROM r.expected THEN RAISE EXCEPTION 'Failed admin rule: %',r.name; END IF;
 END LOOP;
END $$;