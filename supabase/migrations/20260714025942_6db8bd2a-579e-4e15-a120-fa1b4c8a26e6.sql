
CREATE TABLE public.ml_republication_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  old_ml_item_id TEXT NOT NULL,
  new_ml_item_id TEXT,
  catalog_product_id TEXT,
  publication_id UUID,
  reason TEXT NOT NULL DEFAULT 'shipping_dimensions_fix',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  republished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ml_republication_log_user ON public.ml_republication_log(user_id);
CREATE INDEX idx_ml_republication_log_old_mlb ON public.ml_republication_log(old_ml_item_id);
CREATE INDEX idx_ml_republication_log_status ON public.ml_republication_log(status);

GRANT SELECT ON public.ml_republication_log TO authenticated;
GRANT ALL ON public.ml_republication_log TO service_role;

ALTER TABLE public.ml_republication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view republication log"
ON public.ml_republication_log
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE TRIGGER update_ml_republication_log_updated_at
BEFORE UPDATE ON public.ml_republication_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
