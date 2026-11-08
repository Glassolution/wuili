---
data: 2026-11-06
fontes: [AGENTS.md]
---
# ME2 não bloqueia publicação

**Decisão:** `ml-publish` não bloqueia nem avisa o vendedor sobre Mercado Envios; só registra `SHIPPING_WITHOUT_ME2` em `ml_publish_errors`. Status fica em `ml_seller_readiness.mercadoenvios` para a IA de suporte.
**Por quê:** `status.mercadoenvios` de `/users/me` não é confiável (31 contas com etiqueta constavam `not_accepted`); `drop_off` também gera etiqueta. Não há sinal confiável para bloquear.
