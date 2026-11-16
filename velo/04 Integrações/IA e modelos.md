---
atualizado: 2026-11-16
fontes: [supabase/functions/*]
---
# IA e modelos

Dois caminhos:
- **Gemini direto** (secret `GEMINI_API_KEY`): `support-assistant` (function calling), `chat` (descrições).
- **Lovable AI Gateway** (`ai.gateway.lovable.dev`, modelos `google/gemini-*`): `atlas-chat`, geração de imagens (`gemini-*-image`), páginas e textos.

Modelos citados no código (nov/2026): `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3.x-flash`, `gemini-3-pro-image`. Procure `gemini-` antes de trocar.

Regras: a IA nunca promete reembolso nem manda link livre da Central → [[Suporte com IA]]; cotas por plano → [[Planos e preços]].

## 16/11 — Reserva da validação de fotos
- Novas análises usam somente `google/gemini-3.8-flash`. Ao faltar crédito Lovable, `ml-vision-request.ts` chama Gemini direto com `GEMINI_API_KEY`, a mesma chave/provedor do `support-assistant`, sem consumir créditos Lovable.
- Teste real com imagem sintética e sem banco confirmou que a reserva direta também respondeu 402 por saldo pré-pago Google esgotado. Não houve nova tentativa nem troca de modelo; a fila permanece pendente até a IA voltar.

Ver também: [[Atlas]].
