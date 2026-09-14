
CREATE TABLE public.ml_compliance_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('description','title','image')),
  ml_item_id text NOT NULL,
  publication_id uuid,
  seller_id uuid,
  ml_seller_id bigint,
  batch text NOT NULL DEFAULT 'test',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','success','error','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  before_value text,
  after_value text,
  error_message text,
  ml_status text,
  under_review boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ml_item_id)
);

CREATE INDEX idx_mlcf_pending ON public.ml_compliance_fixes (kind, status, scheduled_at);
CREATE INDEX idx_mlcf_seller ON public.ml_compliance_fixes (seller_id);

GRANT SELECT ON public.ml_compliance_fixes TO authenticated;
GRANT ALL ON public.ml_compliance_fixes TO service_role;

ALTER TABLE public.ml_compliance_fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view compliance fixes"
ON public.ml_compliance_fixes FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_mlcf_updated_at
BEFORE UPDATE ON public.ml_compliance_fixes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
