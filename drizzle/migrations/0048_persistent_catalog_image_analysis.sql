CREATE TABLE public.catalog_image_analysis_results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL,
 record_key text NOT NULL UNIQUE,
 product_id uuid,
 product_title text NOT NULL DEFAULT '',
 image_url text NOT NULL,
 image_role text NOT NULL DEFAULT 'secondary' CHECK (image_role IN ('primary','secondary')),
 verdict text NOT NULL CHECK (verdict IN ('aprovada','reprovada','inconclusiva')),
 reason_code text NOT NULL,
 evidence_location text NOT NULL,
 justification text NOT NULL,
 criterion_version text NOT NULL,
 model text NOT NULL,
 analyzed_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 method text NOT NULL,
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.catalog_image_analysis_results TO authenticated;
GRANT ALL ON public.catalog_image_analysis_results TO service_role;
ALTER TABLE public.catalog_image_analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_image_results_admin_read ON public.catalog_image_analysis_results FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY catalog_image_results_admin_insert ON public.catalog_image_analysis_results FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX catalog_image_results_product_version ON public.catalog_image_analysis_results(product_id, criterion_version, analyzed_at DESC);
CREATE INDEX catalog_image_results_run ON public.catalog_image_analysis_results(run_id);
COMMENT ON TABLE public.catalog_image_analysis_results IS 'Append-only per-image evidence, including inconclusive outcomes; does not modify catalog, cache or publications.';