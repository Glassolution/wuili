---
fontes: [AGENTS.md]
---
# MCP somente leitura

**Decisão:** ferramentas do servidor MCP ficam em `src/lib/mcp/` (`supabase/functions/mcp` é gerado); só admins, via OAuth e RLS, **somente leitura** e sem tabelas de tokens.
**Por quê:** evitar exposição de credenciais e ações com dinheiro.
