---
atualizado: 2026-11-18
fontes: [CLAUDE.md §11]
---
# Pixels e medição

Detalhes completos estão no `CLAUDE.md` §11 (não duplicar aqui).

- **TikTok** `src/lib/tiktokPixel.ts` (ID `DB63UB3C77UEG70QI8NG`): só `/`, `/login`, `/cadastro` e criação de conta. Cadastro também via servidor (`tiktok-events`, dedupe por `event_id` em `tiktok_events`); Purchase sai do `validapay-webhook`.
- **Meta** `src/lib/veloMetaPixel.ts` (ID `1471185231740534`): Lead, CompleteRegistration, InitiateCheckout, Purchase (+ Subscribe). Usa `trackSingle` porque divide o `fbq` com os pixels dos sellers (`src/lib/metaPixel.ts`).
  - **Purchase** em `/assinatura/confirmada` usa `eventID` = `purchase_<sid>` (o `?sid=` que a ValidaPay devolve = `subscription_id`), o mesmo `event_id` do envio pelo `validapay-webhook`, para a Meta deduplicar. Sem `sid` não dispara (só `console.warn`). Antes de disparar, `src/lib/assinaturaPaga.ts` lê `subscriptions.status` do `sid` (RLS "Users can view own subscriptions"): só `active` dispara; `pending` tenta de 3 em 3 s por até 30 s; sid inexistente/de outra pessoa ou outro status não dispara e o checkout pendente continua guardado.
  - **Clique do anúncio** (`src/lib/veloMetaClique.ts`): em qualquer rota com `?fbclid=`, guarda em `localStorage.velo_meta_click` `{fbclid, fbp, fbc, captured_at}`; `_fbc` montado como `fb.1.<ms>.<fbclid>` quando o cookie falta ou é de outro clique. Na criação da conta (`concluirCadastroNoTikTok`, e-mail e Google) `salvarCliqueMetaNoPerfil` grava em `profiles.meta_fbclid/meta_fbc/meta_fbp/meta_click_captured_at`, só se houver clique e com filtro `meta_fbclid IS NULL` (não sobrescreve). Erro vira `console.warn`.
- **Funil** `src/lib/landingFunnel.ts` → `dataLayer`/`gtag`/`fbq`; GA4 via `VITE_GA_MEASUREMENT_ID`.
- Eventos próprios no banco: `landing_events`, `mobile_home_events`, `user_page_views` + RPCs `rpc_admin_*_funnel`.

Ver também: [[Landing e cadastro]].
