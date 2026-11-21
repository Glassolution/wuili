---
atualizado: 2026-11-20
fontes: [src/lib/planPricing.ts, src/lib/planLimits.ts]
---
# Planos e preços

**Não existe plano gratuito.** Planos pagos: `base`, `pro`, `business` (há também `go`, com limites iguais ao base).

| Plano | Mensal | Vitalício | "De" (riscado) |
|---|---|---|---|
| Base | R$ 39,90 | R$ 89,90 | R$ 107,88 |
| Pro | R$ 79,80 | R$ 179,80 | R$ 215,76 |
| Business | R$ 189,90 | R$ 427,90 | R$ 513,48 |

- Ciclo anual foi substituído pelo **vitalício** (pagamento único) → [[Vitalício com pagamento único]]. Assinaturas anuais antigas continuam como estão.
- **Vitalício fora da venda (teste de 2 semanas, desde 2026-11-20):** `LIFETIME_PLAN_ENABLED = false` em `src/lib/planPricing.ts` esconde o seletor Mensal/Vitalício no modal de planos, no `/checkout` e na `PricingSection`, além do card "Base Vitalício" que ocupava o lugar do Business. Links `?cycle=lifetime|annual` ou `?plan|plano=vitalicio` voltam para `/checkout` só com o mensal. Quem já comprou continua vitalício (`subscriptions.purchase_kind = 'lifetime'`, status `active`). Para voltar a vender: `true`.

## Limites principais
| | Base/Go | Pro | Business |
|---|---|---|---|
| Anúncios ativos e novos/mês no ML | 50 | 300 | ilimitado |
| Publicação em massa, variações, sync automático | não | sim | sim |
| Imagens IA/mês | 20 | 100 | 300 |
| Vídeos IA/mês | 0 | 10 | 30 |
| Mensagens Atlas/dia | 40 | 150 | 400 |

- O bloqueio **real** é no servidor: `supabase/functions/_shared/plan-limits.ts`. O `src/lib/planLimits.ts` só espelha para a UI — mudou um, mude o outro.

## Onde está no código
`src/lib/planPricing.ts`, `src/lib/planLimits.ts`, `src/hooks/usePlan.ts`, `src/hooks/usePlanLimits.ts`, `src/components/PlansUpgradeModal.tsx`, `_shared/lifetimePlans.ts`.

Ver também: [[Assinatura e checkout]], [[ValidaPay]].
