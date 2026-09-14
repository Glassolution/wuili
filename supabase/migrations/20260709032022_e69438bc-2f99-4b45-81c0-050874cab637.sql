
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros'
    CHECK (category IN ('financeiro','bug','integracao','conta','reembolso','outros')),
  ADD COLUMN IF NOT EXISTS subject text;

CREATE INDEX IF NOT EXISTS idx_support_tickets_category_status
  ON public.support_tickets (category, status, updated_at DESC);
