CREATE OR REPLACE FUNCTION public.notify_overdue_image_publication(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE item public.pending_publications; overdue integer; d date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO item FROM public.pending_publications WHERE id=p_id FOR UPDATE;
  IF item.id IS NULL OR item.status<>'pending' OR item.support_notified_at IS NOT NULL OR item.reason<>'image_compliance_unavailable' OR item.created_at>now()-interval '24 hours' THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id,type,title,message,action_url,metadata)
  VALUES(item.user_id,'ml_publication_waiting','Seu anúncio continua na fila','A conferência das fotos está demorando mais que o esperado. Seu pedido continua salvo e será publicado assim que possível.','/dashboard/publicacoes',jsonb_build_object('pending_publication_id',p_id));
  UPDATE public.pending_publications SET support_notified_at=now() WHERE id=p_id;
  -- Grouped admin alert instead of one support ticket per item: at most once per day.
  PERFORM pg_advisory_xact_lock(hashtext('overdue_image_queue_digest'));
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE type='admin_image_queue_overdue' AND (metadata->>'day')=d::text) THEN
    SELECT count(*) INTO overdue FROM public.pending_publications WHERE status='pending' AND reason='image_compliance_unavailable' AND created_at<=now()-interval '24 hours';
    INSERT INTO public.notifications(user_id,type,title,message,action_url,metadata)
    SELECT ur.user_id,'admin_image_queue_overdue','Fila de fotos com pedidos atrasados',
      overdue||' pedido(s) aguardam a conferência de fotos há mais de 24h.','/admin',
      jsonb_build_object('day',d,'overdue',overdue)
    FROM public.user_roles ur WHERE ur.role='admin';
  END IF;
END $function$;