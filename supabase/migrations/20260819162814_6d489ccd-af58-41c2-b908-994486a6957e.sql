UPDATE public.refund_requests SET charge_id = v.charge_id, payment_id = COALESCE(NULLIF(payment_id,''), v.charge_id), provider_response = v.resp::jsonb, updated_at = now()
FROM (VALUES
 ('ad7086a7-3d9a-44fb-a5cd-ed2705e0156a'::uuid,'cha_1786973268936_m89qsfz8a','{"refundId":"ref_1787156751391_rz027a93i","status":"CONFIRMED","success":true,"amount":79.8,"paymentType":"PIX","reprocessed_at":"2026-08-19T16:27:00Z","note":"estorno real executado apos marcacao manual sem chamada ao provedor"}'),
 ('29e4dd00-f322-4dcb-abdd-ae1fed33b253'::uuid,'cha_1786882918960_zfjaubyzk','{"refundId":"ref_1787156771811_k5jdg9ahe","status":"CONFIRMED","success":true,"amount":39.9,"paymentType":"PIX","reprocessed_at":"2026-08-19T16:27:00Z"}'),
 ('3a5f91e9-a97b-4086-9a94-a3d65d8e40b9'::uuid,'cha_1786826048134_z1m0iiiay','{"refundId":"ref_1787156789689_4he6dufp1","status":"CONFIRMED","success":true,"amount":79.8,"paymentType":"PIX","reprocessed_at":"2026-08-19T16:27:00Z"}'),
 ('6924d89b-a3d9-465c-87d3-b566a783a687'::uuid,'cha_1786928153994_2jzwh5hmj','{"refundId":"ref_1787156803635_rgfp419wd","status":"CONFIRMED","success":true,"amount":39.9,"paymentType":"PIX","reprocessed_at":"2026-08-19T16:27:00Z"}'),
 ('7e105aca-91a2-4b29-a6c5-1b5d01aab0fc'::uuid,'cha_1786811817424_de2afipcn','{"refundId":"ref_1787156817530_qvx3e1pjt","status":"PROCESSING","amount":39.9,"paymentType":"CREDIT_CARD","reprocessed_at":"2026-08-19T16:27:00Z"}'),
 ('f14a2c41-08a7-46f8-b9a0-17cc786dd0a7'::uuid,'cha_1786810250698_sa11bpc4c','{"refundId":"ref_1787156830297_nlggxea0i","status":"PROCESSING","amount":39.9,"paymentType":"CREDIT_CARD","reprocessed_at":"2026-08-19T16:27:00Z"}')
) AS v(id, charge_id, resp)
WHERE public.refund_requests.id = v.id;