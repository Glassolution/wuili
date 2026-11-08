---
fontes: [AGENTS.md]
---
# Token ML morto não é renovado

**Decisão:** refresh com `invalid_grant` / "client_id does not match" (token do app antigo) marca `user_integrations.refresh_failed_at` (`markRefreshTokenDead` em `_shared/mlSellerToken.ts`, avisa o usuário 1x/semana). Jobs pulam enquanto a marca existir; `ml-callback` limpa ao reconectar.
**Por quê:** evitava centenas de chamadas inúteis ao ML a cada cron. Ver [[Mercado Livre]].
