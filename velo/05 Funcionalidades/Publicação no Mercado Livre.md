---
atualizado: 2026-11-16
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
- Fotos: somente Gemini 3.8 em novas análises; vereditos explícitos são globais por URL e nunca reanalisados, inclusive entre clientes/produtos. Todas as fotos são avaliadas na solicitação, sem parada após três aprovadas.
- Inconclusiva/erro: no máximo duas tentativas e depois 24h; falta de crédito não conta tentativa. Sem teto de gasto ou limite diário; admin recebe notificação quando o uso de IA de fotos passa de 5 créditos/dia.
- Instabilidade de IA: pedido durável na mesma fila e publicação automática quando a IA voltar; fotos reprovadas/sem veredito nunca são enviadas. Produto inteiro com vereditos suficientes publica sem chamar IA.
- Crédito Lovable esgotado usa Gemini direto pela `GEMINI_API_KEY` do suporte. Em 16/11 a reserva também estava sem saldo pré-pago; nenhuma publicação real foi testada.
- Notificação após publicação e ticket de suporte após 24h; rotina gerenciada a cada 5 minutos. Crons de auditoria, geração e correção de imagens em lote estão pausados.

## Onde está no código
Front: `src/lib/publicacaoMercadoLivre.ts`, `publicacaoPendente.ts`, `src/pages/dashboard/PublicationsPage.tsx`. Servidor: `ml-publish` + `_shared/ml-*`, `catalogLink.ts`, `refundCooldown.ts`.

Ver também: [[Mercado Livre]], [[Tabelas - Publicações ML]].
