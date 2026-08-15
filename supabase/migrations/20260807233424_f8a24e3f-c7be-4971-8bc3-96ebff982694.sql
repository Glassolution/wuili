ALTER TABLE public.ml_compliance_fixes DROP CONSTRAINT IF EXISTS ml_compliance_fixes_status_check;
ALTER TABLE public.ml_compliance_fixes ADD CONSTRAINT ml_compliance_fixes_status_check
  CHECK (status = ANY (ARRAY['pending','processing','success','error','skipped','not_applicable','awaiting_reconnect']));