---
data: 2026-10
fontes: [AGENTS.md, roadmap.md]
---
# Vitalício com pagamento único

**Decisão:** o plano anual saiu; entrou o **vitalício** com preços ONE_TIME na ValidaPay e marcador `purchase_kind` definido pelo servidor. Contratos recorrentes antigos não mudam.
**Problema:** ONE_TIME não tem webhook nem vínculo com a sessão de checkout. `_shared/lifetimeCharge.ts` casa a cobrança por e-mail + valor exato + janela de tempo (em `subscription-sync-self` e `expire-pending-charges`).
**Salvaguardas:** fallback só por tempo recusa cobrança de e-mail com conta Velo, sem e-mail, ou que outro checkout pendente do mesmo valor (3 dias) poderia reivindicar; índice único por charge ID. Prefere mandar casos ao suporte a entregar o plano à pessoa errada.
Ver: [[Planos e preços]].
