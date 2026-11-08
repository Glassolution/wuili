---
fontes: [AGENTS.md]
---
# Vínculo anúncio-catálogo

**Decisão:** publicação/venda sem `catalog_product_id` → `_shared/catalogLink.ts`: primeiro `SELLER_SKU` do anúncio = código do catálogo; depois RPC `resolve_catalog_product_for_listing` (título idêntico, foto, início do título; só resultado único). Grava o vínculo no anúncio.
**Por quê:** vendas apareciam como "Fornecedor indisponível". Ver [[Pedidos e dropshipping]].
