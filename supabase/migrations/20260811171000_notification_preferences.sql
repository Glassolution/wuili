alter table public.profiles
  add column if not exists notification_preferences jsonb not null default
  '{
    "new_sale": true,
    "product_published": true,
    "publication_error": true,
    "product_paused": true,
    "product_activated": true,
    "order_in_transit": false,
    "weekly_report": true,
    "support_reply": true
  }'::jsonb;

comment on column public.profiles.notification_preferences is
  'Preferencias do usuario para alertas em tempo real, som e historico de notificacoes.';
