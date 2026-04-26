UPDATE public.user_integrations
SET 
  access_token = 'APP_USR-5831446135077053-042614-9cd46aaac87fd0cd5790030b11e7bcbe-600768209',
  refresh_token = 'TG-69ee52b7b1050a00018ee111-600768209',
  expires_at = now() + interval '21600 seconds',
  updated_at = now()
WHERE user_id = 'e0feadb3-1d01-40f4-8d98-9b2b82a0cd08'
  AND platform = 'mercadolivre';