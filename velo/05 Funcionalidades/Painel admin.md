---
atualizado: 2026-11-08
fontes: [src/App.tsx, AGENTS.md, roadmap.md]
---
# Painel admin

`/admin/*`, guardado por `AdminRoute` + `is_admin()`.

| Tela | Para quê |
|---|---|
| `usuarios` | Paginação no servidor, abas/busca/contadores → [[Admin paginado no servidor]] |
| `suporte` | Tickets → [[Suporte com IA]] |
| `reembolsos` | Pedidos de reembolso → [[Cancelamento e reembolso]] |
| `vendas`, `rastreio`, `automacao-bot` | Pedidos e bot → [[Pedidos e dropshipping]] |
| `comissoes` | Afiliados → [[Afiliados]] |
| `central-de-ajuda` | Artigos → [[Central de Ajuda]] |
| `assistente-ia`, `evidencias`, `consulta`, `painel`, `dashboard`, `reporting` | Diagnóstico, evidências, métricas |

- Arquivos `*Old.tsx` são versões antigas; `*RoutePage.tsx` escolhe qual renderizar.
- Escopo da Fase 1 do admin: não mexer em Suporte, Reembolsos e pagamentos junto.
