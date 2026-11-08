ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS block_reasons jsonb;
COMMENT ON COLUMN public.catalog_products.block_reasons IS 'Recovery assessment reasons; NULL means historical cause unknown, not no restriction.';
CREATE TABLE public.catalog_recovery_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.catalog_products(id),
 before_state jsonb NOT NULL,
 after_state jsonb,
 evidence jsonb NOT NULL,
 decision text NOT NULL,
 applied_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,product_id)
);
GRANT SELECT ON public.catalog_recovery_audit TO authenticated;
GRANT ALL ON public.catalog_recovery_audit TO service_role;
ALTER TABLE public.catalog_recovery_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY recovery_admin_read ON public.catalog_recovery_audit FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin'));
CREATE POLICY recovery_service_all ON public.catalog_recovery_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TABLE public.catalog_recovery_retry_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.catalog_products(id),
 reason text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 max_attempts integer NOT NULL DEFAULT 3,
 state text NOT NULL DEFAULT 'awaiting_approval',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,product_id)
);
GRANT SELECT ON public.catalog_recovery_retry_queue TO authenticated;
GRANT ALL ON public.catalog_recovery_retry_queue TO service_role;
ALTER TABLE public.catalog_recovery_retry_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY retry_admin_read ON public.catalog_recovery_retry_queue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin'));
CREATE POLICY retry_service_all ON public.catalog_recovery_retry_queue FOR ALL TO service_role USING (true) WITH CHECK (true);