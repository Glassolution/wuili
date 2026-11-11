-- Conferência gradual de fotos: só registra resultados (nunca publica, bloqueia ou altera produto).
CREATE TABLE public.catalog_vision_review_control (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lease_owner uuid, lease_token bigint NOT NULL DEFAULT 0, lease_expires_at timestamptz,
  paused boolean NOT NULL DEFAULT false, pause_kind text CHECK (pause_kind IN ('credit','denied','rate','temporary','config')),
  pause_message text, paused_at timestamptz, paused_until timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0, armed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.catalog_vision_review_control(id) VALUES (1);
CREATE TABLE public.catalog_vision_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  gallery_hash text NOT NULL, criterion_version text NOT NULL, models text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','eligible','no_primary','insufficient','inconclusive')),
  claimed_token bigint, claimed_at timestamptz, completed_at timestamptz, outcome jsonb,
  enqueued_by uuid, enqueued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, gallery_hash, criterion_version, models)
);
CREATE INDEX catalog_vision_review_queue_pending_idx ON public.catalog_vision_review_queue(enqueued_at) WHERE status IN ('pending','claimed');
GRANT SELECT ON public.catalog_vision_review_control, public.catalog_vision_review_queue TO authenticated;
GRANT ALL ON public.catalog_vision_review_control, public.catalog_vision_review_queue TO service_role;
ALTER TABLE public.catalog_vision_review_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_vision_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY cvr_control_admin_read ON public.catalog_vision_review_control FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY cvr_queue_admin_read ON public.catalog_vision_review_queue FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE FUNCTION public.cvr_acquire(p_owner uuid, p_ttl integer) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t bigint; BEGIN
  UPDATE public.catalog_vision_review_control SET lease_owner=p_owner, lease_token=lease_token+1,
    lease_expires_at=now()+make_interval(secs=>least(greatest(p_ttl,30),900)),
    paused=false, pause_kind=NULL, pause_message=NULL, paused_until=NULL, updated_at=now()
  WHERE id=1 AND (lease_expires_at IS NULL OR lease_expires_at<now())
    AND (NOT paused OR (pause_kind='rate' AND paused_until IS NOT NULL AND paused_until<=now()))
  RETURNING lease_token INTO t;
  RETURN t; END $$;

CREATE FUNCTION public.cvr_lease_valid(p_token bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.catalog_vision_review_control WHERE id=1 AND lease_token=p_token AND lease_expires_at>now()) $$;

CREATE FUNCTION public.cvr_claim(p_token bigint, p_limit integer) RETURNS TABLE(id uuid, product_id uuid, title text, urls jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.cvr_lease_valid(p_token) THEN RETURN; END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT q.id FROM public.catalog_vision_review_queue q
    WHERE q.status='pending' OR (q.status='claimed' AND q.claimed_token<p_token)
    ORDER BY q.enqueued_at LIMIT least(greatest(p_limit,0),20) FOR UPDATE SKIP LOCKED)
  UPDATE public.catalog_vision_review_queue q SET status='claimed', claimed_token=p_token, claimed_at=now()
  FROM picked, public.catalog_products c WHERE q.id=picked.id AND c.id=q.product_id
  RETURNING q.id, q.product_id, c.title, c.images;
END $$;

CREATE FUNCTION public.cvr_complete(p_token bigint, p_id uuid, p_status text, p_outcome jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_status NOT IN ('eligible','no_primary','insufficient','inconclusive') OR NOT public.cvr_lease_valid(p_token) THEN RETURN false; END IF;
  UPDATE public.catalog_vision_review_queue SET status=p_status, outcome=p_outcome, completed_at=now()
  WHERE id=p_id AND status='claimed' AND claimed_token=p_token;
  RETURN FOUND; END $$;

CREATE FUNCTION public.cvr_release(p_token bigint, p_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.catalog_vision_review_queue SET status='pending', claimed_token=NULL, claimed_at=NULL
  WHERE id=p_id AND status='claimed' AND claimed_token=p_token $$;

CREATE FUNCTION public.cvr_pause(p_kind text, p_message text, p_delay_seconds integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_kind NOT IN ('credit','denied','rate','temporary','config') THEN RAISE EXCEPTION 'Pausa inválida'; END IF;
  UPDATE public.catalog_vision_review_control SET paused=true,
    pause_kind=CASE WHEN pause_kind IN ('credit','denied','config') THEN pause_kind ELSE p_kind END,
    pause_message=left(coalesce(p_message,''),500), paused_at=now(),
    paused_until=CASE WHEN p_kind='rate' AND p_delay_seconds IS NOT NULL THEN now()+make_interval(secs=>least(greatest(p_delay_seconds,60),3600)) ELSE NULL END,
    consecutive_failures=consecutive_failures+1, armed=false, updated_at=now()
  WHERE id=1; END $$;

CREATE FUNCTION public.cvr_end(p_token bigint, p_success boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE remaining integer; BEGIN
  SELECT count(*) INTO remaining FROM public.catalog_vision_review_queue WHERE status IN ('pending','claimed');
  UPDATE public.catalog_vision_review_control SET lease_expires_at=now(), armed=(remaining>0 AND NOT paused),
    consecutive_failures=CASE WHEN p_success THEN 0 ELSE consecutive_failures END, updated_at=now()
  WHERE id=1 AND lease_token=p_token;
  RETURN remaining; END $$;

CREATE FUNCTION public.cvr_resume(p_admin uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(p_admin) THEN RAISE EXCEPTION 'Somente admin'; END IF;
  UPDATE public.catalog_vision_review_control SET paused=false, pause_kind=NULL, pause_message=NULL, paused_until=NULL, updated_at=now() WHERE id=1; END $$;

-- Candidatos: C7Drop ativos, com estoque, sem bloqueio, sem evidência dupla atual na tabela. Nunca altera o produto.
CREATE FUNCTION public.cvr_candidates(p_criterion text, p_limit integer) RETURNS TABLE(product_id uuid, title text, photos integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.id, c.title, jsonb_array_length(c.images) FROM public.catalog_products c
  WHERE c.source='c7drop' AND c.is_active AND coalesce(c.stock_quantity,0)>0 AND NOT coalesce(c.is_blocked,false)
    AND jsonb_typeof(c.images)='array' AND jsonb_array_length(c.images)>=3
    AND NOT EXISTS (SELECT 1 FROM public.catalog_image_analysis_results r WHERE r.product_id=c.id AND r.criterion_version=p_criterion AND r.method='catalog_review_dual')
  ORDER BY c.stock_quantity DESC NULLS LAST, c.id LIMIT least(greatest(p_limit,0),2000) $$;

CREATE FUNCTION public.cvr_enqueue(p_admin uuid, p_ids uuid[], p_criterion text, p_models text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
  IF NOT public.is_admin(p_admin) THEN RAISE EXCEPTION 'Somente admin'; END IF;
  INSERT INTO public.catalog_vision_review_queue(product_id,gallery_hash,criterion_version,models,enqueued_by)
  SELECT c.id, coalesce(c.gallery_urls_hash, md5(c.images::text)), p_criterion, p_models, p_admin
  FROM public.catalog_products c WHERE c.id = ANY(p_ids) AND c.source='c7drop' AND c.is_active AND coalesce(c.stock_quantity,0)>0 AND NOT coalesce(c.is_blocked,false)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n>0 THEN UPDATE public.catalog_vision_review_control SET armed=true, updated_at=now() WHERE id=1; END IF;
  RETURN n; END $$;

-- Recuperação restrita: prévia somente leitura com manifesto congelado; execução só de IDs aprovados.
CREATE TABLE public.publication_recovery_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  frozen_ids uuid[] NOT NULL, items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','executed','reverted')),
  approved_by uuid, approved_at timestamptz, approved_ids uuid[], executed_at timestamptz, reverted_at timestamptz
);
CREATE TABLE public.publication_recovery_snapshots (
  manifest_id uuid NOT NULL REFERENCES public.publication_recovery_manifests(id), pending_id uuid NOT NULL,
  before_row jsonb NOT NULL, after_attempts integer NOT NULL, applied boolean NOT NULL, skip_reason text,
  executed_at timestamptz NOT NULL DEFAULT now(), reverted_at timestamptz, PRIMARY KEY (manifest_id, pending_id)
);
GRANT SELECT ON public.publication_recovery_manifests, public.publication_recovery_snapshots TO authenticated;
GRANT ALL ON public.publication_recovery_manifests, public.publication_recovery_snapshots TO service_role;
ALTER TABLE public.publication_recovery_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_recovery_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY prm_admin_read ON public.publication_recovery_manifests FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY prs_admin_read ON public.publication_recovery_snapshots FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Fotos aprovadas pelos DOIS modelos na mesma rodada (tabela) ou no cache dual.
CREATE FUNCTION public.dual_approved_photos(p_product uuid, p_role text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH urls AS (SELECT jsonb_array_elements_text(images) u FROM public.catalog_products WHERE id=p_product),
  t AS (SELECT r.image_url FROM public.catalog_image_analysis_results r JOIN urls ON urls.u=r.image_url
        WHERE r.product_id=p_product AND r.image_role=p_role AND r.criterion_version LIKE 'two-level-%' AND r.verdict='aprovada'
        GROUP BY r.image_url, r.run_id HAVING bool_or(r.model='google/gemini-3.8-flash') AND bool_or(r.model='openai/gpt-6.1-terra')),
  c AS (SELECT k.url FROM public.ml_image_vision_cache k JOIN urls ON urls.u=k.url
        WHERE k.reason ~ '^\[two-level-[^\]]*gemini-3\.8-flash\+gpt-6\.1-terra\] roles: '
          AND (substring(k.reason from ' roles: (.*)$'))::jsonb -> p_role ->> 'veredito' = 'aprovada')
  SELECT count(DISTINCT x)::int FROM (SELECT image_url x FROM t UNION SELECT url FROM c) s $$;

CREATE FUNCTION public.publication_recovery_check(p_pending uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.pending_publications; c public.catalog_products; prod uuid; checks jsonb; reasons text[] := '{}'; dup jsonb; sec int := 0; pri int := 0;
BEGIN
  SELECT * INTO p FROM public.pending_publications WHERE id=p_pending;
  IF p.id IS NULL THEN RETURN jsonb_build_object('eligible',false,'reasons',ARRAY['pedido não encontrado']); END IF;
  IF p.status<>'pending' THEN reasons := reasons || ('status '||p.status); END IF;
  BEGIN prod := p.product_id::uuid; EXCEPTION WHEN others THEN prod := NULL; END;
  IF prod IS NOT NULL THEN SELECT * INTO c FROM public.catalog_products WHERE id=prod; END IF;
  IF c.id IS NULL THEN reasons := reasons || 'produto fora do catálogo';
  ELSE
    IF NOT c.is_active THEN reasons := reasons || 'produto inativo'; END IF;
    IF coalesce(c.stock_quantity,0)<=0 THEN reasons := reasons || 'sem estoque'; END IF;
    IF coalesce(c.is_blocked,false) THEN reasons := reasons || 'produto bloqueado'; END IF;
    sec := public.dual_approved_photos(c.id,'secondary'); pri := public.dual_approved_photos(c.id,'primary');
    IF sec<3 THEN reasons := reasons || ('fotos aprovadas pelos dois modelos: '||sec); END IF;
    IF pri<1 THEN reasons := reasons || 'sem principal aprovada pelos dois modelos'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_integrations WHERE user_id=p.user_id AND platform='mercadolivre' AND access_token IS NOT NULL AND refresh_failed_at IS NULL)
    THEN reasons := reasons || 'conta do Mercado Livre desconectada ou token inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id=p.user_id AND status='active' AND (current_period_end IS NULL OR current_period_end>now()))
    THEN reasons := reasons || 'sem assinatura ativa'; END IF;
  -- Anúncio existente em QUALQUER estado (inclui legados) bloqueia; o publicador também revalida limites do plano.
  SELECT jsonb_agg(jsonb_build_object('id',u.id,'status',u.status,'ml_item_id',u.ml_item_id)) INTO dup FROM public.user_publications u
    WHERE u.user_id=p.user_id AND (u.catalog_product_id=prod OR (c.id IS NOT NULL AND lower(trim(u.title))=lower(trim(coalesce(p.title,c.title)))));
  IF dup IS NOT NULL THEN reasons := reasons || 'já existe anúncio do vendedor para este produto'; END IF;
  IF EXISTS (SELECT 1 FROM public.pending_publications o WHERE o.user_id=p.user_id AND o.product_id=p.product_id AND o.id<>p.id AND o.status='published')
    THEN reasons := reasons || 'pedido irmão já publicado'; END IF;
  RETURN jsonb_build_object('eligible', cardinality(reasons)=0, 'reasons', reasons, 'seller_id', p.user_id, 'product_id', p.product_id,
    'title', p.title, 'attempts', p.attempts, 'last_error', p.last_error, 'approved_photos', sec, 'approved_primary', pri, 'existing_publications', coalesce(dup,'[]'::jsonb));
END $$;

CREATE FUNCTION public.publication_recovery_preview(p_admin uuid, p_ids uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m uuid; ids uuid[]; BEGIN
  IF NOT public.is_admin(p_admin) THEN RAISE EXCEPTION 'Somente admin'; END IF;
  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO ids FROM public.pending_publications
   WHERE (p_ids IS NULL AND status='pending' AND attempts>=25) OR id = ANY(p_ids);
  INSERT INTO public.publication_recovery_manifests(created_by, frozen_ids, items)
  SELECT p_admin, ids, coalesce(jsonb_agg(public.publication_recovery_check(i) || jsonb_build_object('pending_id',i)), '[]') FROM unnest(ids) i
  RETURNING id INTO m;
  RETURN m; END $$;

CREATE FUNCTION public.publication_recovery_execute(p_manifest uuid, p_admin uuid, p_approved uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE man public.publication_recovery_manifests; i uuid; before public.pending_publications; chk jsonb; applied int := 0; skipped int := 0; BEGIN
  IF NOT public.is_admin(p_admin) THEN RAISE EXCEPTION 'Somente admin'; END IF;
  SELECT * INTO man FROM public.publication_recovery_manifests WHERE id=p_manifest FOR UPDATE;
  IF man.id IS NULL OR man.status<>'preview' THEN RAISE EXCEPTION 'Manifesto inválido ou já usado'; END IF;
  IF p_approved IS NULL OR cardinality(p_approved)=0 OR NOT (p_approved <@ man.frozen_ids) THEN RAISE EXCEPTION 'IDs aprovados precisam estar no manifesto congelado'; END IF;
  FOREACH i IN ARRAY p_approved LOOP
    SELECT * INTO before FROM public.pending_publications WHERE id=i FOR UPDATE;
    chk := public.publication_recovery_check(i);
    IF (chk->>'eligible')::boolean AND before.attempts>=25 THEN
      -- Uma única nova tentativa, com compare-and-set na linha congelada.
      UPDATE public.pending_publications SET attempts=24 WHERE id=i AND status='pending' AND attempts=before.attempts AND updated_at=before.updated_at;
      IF FOUND THEN applied := applied+1; ELSE skipped := skipped+1; END IF;
      INSERT INTO public.publication_recovery_snapshots VALUES (p_manifest, i, to_jsonb(before), 24, FOUND, CASE WHEN FOUND THEN NULL ELSE 'mudou desde a prévia' END, now(), NULL);
    ELSE
      skipped := skipped+1;
      INSERT INTO public.publication_recovery_snapshots VALUES (p_manifest, i, coalesce(to_jsonb(before),'{}'), coalesce(before.attempts,0), false, array_to_string(ARRAY(SELECT jsonb_array_elements_text(chk->'reasons')),'; '), now(), NULL);
    END IF;
  END LOOP;
  UPDATE public.publication_recovery_manifests SET status='executed', approved_by=p_admin, approved_at=now(), approved_ids=p_approved, executed_at=now() WHERE id=p_manifest;
  RETURN jsonb_build_object('applied',applied,'skipped',skipped); END $$;

CREATE FUNCTION public.publication_recovery_revert(p_manifest uuid, p_admin uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; n int := 0; BEGIN
  IF NOT public.is_admin(p_admin) THEN RAISE EXCEPTION 'Somente admin'; END IF;
  FOR s IN SELECT * FROM public.publication_recovery_snapshots WHERE manifest_id=p_manifest AND applied AND reverted_at IS NULL FOR UPDATE LOOP
    UPDATE public.pending_publications SET attempts=(s.before_row->>'attempts')::int WHERE id=s.pending_id AND status='pending' AND attempts=s.after_attempts;
    IF FOUND THEN n := n+1; UPDATE public.publication_recovery_snapshots SET reverted_at=now() WHERE manifest_id=p_manifest AND pending_id=s.pending_id; END IF;
  END LOOP;
  UPDATE public.publication_recovery_manifests SET status='reverted', reverted_at=now() WHERE id=p_manifest AND status='executed';
  RETURN n; END $$;

REVOKE ALL ON FUNCTION public.cvr_acquire(uuid,integer), public.cvr_lease_valid(bigint), public.cvr_claim(bigint,integer), public.cvr_complete(bigint,uuid,text,jsonb),
  public.cvr_release(bigint,uuid), public.cvr_pause(text,text,integer), public.cvr_end(bigint,boolean), public.cvr_resume(uuid), public.cvr_candidates(text,integer),
  public.cvr_enqueue(uuid,uuid[],text,text), public.dual_approved_photos(uuid,text), public.publication_recovery_check(uuid), public.publication_recovery_preview(uuid,uuid[]),
  public.publication_recovery_execute(uuid,uuid,uuid[]), public.publication_recovery_revert(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cvr_acquire(uuid,integer), public.cvr_lease_valid(bigint), public.cvr_claim(bigint,integer), public.cvr_complete(bigint,uuid,text,jsonb),
  public.cvr_release(bigint,uuid), public.cvr_pause(text,text,integer), public.cvr_end(bigint,boolean), public.cvr_resume(uuid), public.cvr_candidates(text,integer),
  public.cvr_enqueue(uuid,uuid[],text,text), public.dual_approved_photos(uuid,text), public.publication_recovery_check(uuid), public.publication_recovery_preview(uuid,uuid[]),
  public.publication_recovery_execute(uuid,uuid,uuid[]), public.publication_recovery_revert(uuid,uuid) TO service_role;