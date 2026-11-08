---
atualizado: 2026-11-08
fontes: [roadmap.md, AGENTS.md]
---
# Publicação no Mercado Livre

Fluxo mobile em 4 etapas: **detalhes → conexão → revisão → plano → pagamento → verificação**.

- Rascunho preservado ao fechar ou ao sair para conectar o ML.
- Descrição gerada automaticamente com prévia editável → [[IA e modelos]].
- Exige plano pago; limites por plano (anúncios, variações, em massa) → [[Planos e preços]].
- Conta ML ainda sem permissão de vender → rascunho vai para `pending_publications` e `auto-publish-pending` publica quando liberar → [[Pagamento antes da conta de vendedor]].
- Mercado Envios: só registra `SHIPPING_WITHOUT_ME2`, não bloqueia → [[ME2 não bloqueia publicação]]. `MlMissingInfoModal` tem "Já fiz, verificar de novo".
- Cooldown após reembolso bloqueia publicar até nova assinatura paga → [[Cooldown de reembolso]].
- Medição: avanço, saída, erros e duração do fluxo.

## Onde está no código
Front: `src/lib/publicacaoMercadoLivre.ts`, `publicacaoPendente.ts`, `src/pages/dashboard/PublicationsPage.tsx`. Servidor: `ml-publish` + `_shared/ml-*`, `catalogLink.ts`, `refundCooldown.ts`.

Ver também: [[Mercado Livre]], [[Tabelas - Publicações ML]].
