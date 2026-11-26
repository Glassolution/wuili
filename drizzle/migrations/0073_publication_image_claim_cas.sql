CREATE OR REPLACE FUNCTION public.claim_publication_image_analysis_v2(p_url text, p_owner uuid, p_observed_reason text DEFAULT NULL)
RETURNS TABLE(claimed boolean, reason text, clean boolean, retry_after timestamptz, inconclusive_attempts integer, claim_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ml_image_vision_cache%ROWTYPE;
BEGIN
 IF p_owner IS NULL OR p_url IS NULL OR btrim(p_url)='' OR length(p_url)>4096 THEN RAISE EXCEPTION 'Invalid image analysis claim'; END IF;
 INSERT INTO public.ml_image_vision_cache(url,clean,reason,checked_at) VALUES(p_url,NULL,NULL,now()) ON CONFLICT(url) DO NOTHING;
 SELECT * INTO r FROM public.ml_image_vision_cache WHERE url=p_url FOR UPDATE;
 IF r.analysis_lease_until>now() THEN
  RETURN QUERY SELECT false,r.reason,r.clean,r.retry_after,r.inconclusive_attempts,'analysis_in_progress'::text; RETURN;
 END IF;
 IF r.retry_after>now() THEN
  RETURN QUERY SELECT false,r.reason,r.clean,r.retry_after,r.inconclusive_attempts,'retry_wait'::text; RETURN;
 END IF;
 -- The service caller applies the publication parser first. CAS prevents
 -- overwriting a newly committed verdict while permitting incompatible legacy evidence.
 IF r.reason IS DISTINCT FROM p_observed_reason THEN
  RETURN QUERY SELECT false,r.reason,r.clean,r.retry_after,r.inconclusive_attempts,'verdict_changed'::text; RETURN;
 END IF;
 IF r.retry_after IS NOT NULL AND r.retry_after<=now() AND r.inconclusive_attempts>=2 THEN r.inconclusive_attempts:=0; END IF;
 UPDATE public.ml_image_vision_cache SET inconclusive_attempts=r.inconclusive_attempts,analysis_lease_owner=p_owner,analysis_lease_until=now()+interval '120 seconds',last_error=NULL WHERE url=p_url;
 RETURN QUERY SELECT true,r.reason,r.clean,r.retry_after,r.inconclusive_attempts,'claimed'::text;
END $$;
REVOKE ALL ON FUNCTION public.claim_publication_image_analysis_v2(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_publication_image_analysis_v2(text,uuid,text) TO service_role;
COMMENT ON FUNCTION public.claim_publication_image_analysis(text,uuid) IS 'DEPRECATED for publication: use claim_publication_image_analysis_v2 after parsing observed evidence; legacy regex completion can disagree with publication criteria.';