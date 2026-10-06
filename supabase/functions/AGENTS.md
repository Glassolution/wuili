# Edge Functions — regras

- Escritas em Deno/TypeScript; nunca instalar pacotes Node.js para elas.
- Funções principais: `ml-publish`, `ml-connect`, `ml-callback` (salva token em `user_integrations`), `scrape-c7drop`, `catalog`, `chat` (Gemini).
- Suporte: a IA (`support-assistant`) responde tickets via gatilho no banco; avisos internos usam `support_messages.internal` e ficam ocultos do cliente pelas regras de acesso. Motivo: cobre todas as telas de envio de ticket.
- TikTok Events API: eventos de servidor passam por `_shared/tiktokEvents.ts` e ficam registrados em `tiktok_events` (event_id único). Motivo: evita duplicidade e permite reenviar falhas sem afetar o webhook de pagamento.
- Deploy: `supabase functions deploy <nome>`.
