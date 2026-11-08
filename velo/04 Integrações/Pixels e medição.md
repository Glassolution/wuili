---
atualizado: 2026-11-08
fontes: [CLAUDE.md §11]
---
# Pixels e medição

Detalhes completos estão no `CLAUDE.md` §11 (não duplicar aqui).

- **TikTok** `src/lib/tiktokPixel.ts` (ID `DB63UB3C77UEG70QI8NG`): só `/`, `/login`, `/cadastro` e criação de conta. Cadastro também via servidor (`tiktok-events`, dedupe por `event_id` em `tiktok_events`); Purchase sai do `validapay-webhook`.
- **Meta** `src/lib/veloMetaPixel.ts` (ID `2170225700534826`): Lead, CompleteRegistration, InitiateCheckout, Purchase. Usa `trackSingle` porque divide o `fbq` com os pixels dos sellers (`src/lib/metaPixel.ts`).
- **Funil** `src/lib/landingFunnel.ts` → `dataLayer`/`gtag`/`fbq`; GA4 via `VITE_GA_MEASUREMENT_ID`.
- Eventos próprios no banco: `landing_events`, `mobile_home_events`, `user_page_views` + RPCs `rpc_admin_*_funnel`.

Ver também: [[Landing e cadastro]].
