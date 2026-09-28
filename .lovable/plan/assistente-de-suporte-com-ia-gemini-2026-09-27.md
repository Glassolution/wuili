# Assistente de suporte com IA (Gemini)

## O que o usuário vai ver
- No painel, um botão flutuante "Ajuda" (canto inferior direito) abre um chat com o assistente de suporte da Velo.
- Ele responde em português, com respostas curtas, e sabe:
  - **Verificar a conta do Mercado Livre do próprio usuário** e dizer exatamente o que falta (CEP, endereço, celular, documento, conta não conectada, token expirado etc.), com o passo a passo para resolver.
  - **Consultar a Central de Ajuda** e responder com base nos artigos, com link para o artigo.
- Uma conversa única por usuário, salva no banco: ao voltar ao painel, o histórico continua lá. Um botão "Nova conversa" limpa o histórico.
- Quando o assistente não resolver (erro desconhecido, assunto fora da base, ou o usuário pede um humano), ele abre um pedido de suporte humano **sem mostrar botão nem aviso de "escalar"** — apenas responde algo natural como "Vou pedir para alguém da equipe olhar isso com você; a resposta aparece aqui e no Suporte."

## O que o admin vai ver
- No painel admin de Suporte, uma nova aba **"Assistente IA"** com a fila de pedidos abertos pelo assistente: usuário, motivo resumido pela IA, resultado da verificação da conta ML, data, status (aberto / em atendimento / resolvido).
- Ao abrir um pedido, o admin vê **toda a conversa** com o assistente e pode assumir: responder, mudar status. A resposta do admin aparece no chat do usuário, marcada como "Equipe Velo".
- Contador de pendentes na aba.

## Chave do Gemini
- Depois da aprovação, abro um campo seguro para você colar a chave (`GEMINI_API_KEY`). Ela fica só no servidor, nunca no código nem no navegador. Se já houver uma chave com esse nome, pergunto se quer substituí-la.

## Detalhes técnicos
- **Banco (migração nova, com GRANT + RLS):**
  - `support_ai_messages` (user_id, role `user|assistant|admin`, content, tool_calls jsonb, created_at). RLS: usuário lê/insere as próprias mensagens `user`; `assistant`/`admin` só via service role ou admin (`has_role`).
  - `support_escalations` (user_id, status, reason, summary, ml_diagnostic jsonb, assigned_admin, created_at, updated_at, resolved_at). RLS: só admins leem/atualizam; inserção só pelo servidor. Um pedido aberto por usuário por vez (índice parcial único), novas escalações reaproveitam o aberto.
- **Função de servidor `support-assistant`** (Deno), autenticada por JWT:
  - Chama o Gemini direto (`generativelanguage.googleapis.com`, modelo `gemini-3.8-flash`) com function calling, usando `Deno.env.get("GEMINI_API_KEY")`.
  - Ferramentas:
    - `verificar_conta_mercado_livre`: reaproveita a mesma lógica da consulta admin (`ml-seller-readiness-refresh` / `ml_seller_readiness`), extraída para `_shared/`, sempre restrita ao `user_id` do token. Tokens do ML nunca vão para o modelo nem para o cliente; só o diagnóstico traduzido (campos faltando, bloqueios de `/users/me` como `address_pending`, `phone`, etc.).
    - `buscar_central_de_ajuda`: usa a função de busca já existente da Central de Ajuda e devolve título, trecho e link.
    - `acionar_suporte_humano`: grava/atualiza `support_escalations` com resumo e diagnóstico; o modelo é instruído a chamá-la silenciosamente nos três casos pedidos.
  - Limite de uso por usuário (ex.: 40 mensagens/dia) para não estourar custo; erros 429/402/403 do Gemini viram mensagem amigável e, em falha repetida, abre escalação automaticamente.
- **Frontend:** `SupportAssistantWidget` no layout do painel (só logado), nova aba no `AdminSupportPage` com lista + visualização da conversa + resposta do admin. Textos em pt-BR, cores do painel existente.
- Não altera o Atlas, o chat de suporte atual nem os tickets existentes.
