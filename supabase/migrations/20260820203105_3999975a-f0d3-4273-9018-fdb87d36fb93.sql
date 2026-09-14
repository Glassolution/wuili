INSERT INTO public.ml_compliance_fixes (kind, ml_item_id, publication_id, seller_id, batch, status, scheduled_at)
SELECT 'image', p.ml_item_id, p.id, p.user_id, 'fotos-arte-2026-08', 'pending', now()
FROM public.user_publications p
WHERE p.status = 'active'
  AND p.ml_item_id IS NOT NULL
  AND p.created_at > now() - interval '90 days'
ON CONFLICT (kind, ml_item_id) DO NOTHING;