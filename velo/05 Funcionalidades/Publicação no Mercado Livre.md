---
atualizado: 2026-11-11
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
- Fotos: três aprovadas pelos dois modelos, incluindo principal; reutiliza evidência de qualquer revisão em dois níveis e cache explícito, sem analisar fotos desconhecidas se já há suficientes.
- Instabilidade de IA: pedido durável na mesma fila, deduplicação atômica, limites antes de enfileirar, disjuntor persistente e execução única; fotos reprovadas/sem veredito nunca são enviadas.
- Notificação após publicação e ticket de suporte após 24h; rotina gerenciada a cada 5 minutos (288 verificações/dia). Ativação ao enfileirar/pausa ao esvaziar bloqueadas pelo serviço de agendamento; vazio não chama IA.
- Verificação 11/11: 295 dos 820 ativos com estoque têm evidência suficiente; 525 dependem de IA. Gateway confirmou 402, pausa gravada; publicação real não testada.

## Onde está no código
Front: `src/lib/publicacaoMercadoLivre.ts`, `publicacaoPendente.ts`, `src/pages/dashboard/PublicationsPage.tsx`. Servidor: `ml-publish` + `_shared/ml-*`, `catalogLink.ts`, `refundCooldown.ts`.

Ver também: [[Mercado Livre]], [[Tabelas - Publicações ML]].
