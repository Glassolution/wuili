---
atualizado: 2026-11-08
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
