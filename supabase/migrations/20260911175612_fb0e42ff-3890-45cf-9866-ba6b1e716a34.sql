alter table public.ml_compliance_fixes drop constraint if exists ml_compliance_fixes_kind_check;
alter table public.ml_compliance_fixes add constraint ml_compliance_fixes_kind_check
  check (kind = any (array['description','title','image','noncompliant_repair']));

alter table public.ml_compliance_fixes drop constraint if exists ml_compliance_fixes_status_check;
alter table public.ml_compliance_fixes add constraint ml_compliance_fixes_status_check
  check (status = any (array['pending','processing','success','error','skipped','not_applicable','awaiting_reconnect','ok','needs_new_photos','ml_error','closed_needs_republish']));