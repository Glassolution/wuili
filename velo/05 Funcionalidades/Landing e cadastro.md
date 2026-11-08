---
atualizado: 2026-11-08
fontes: [CLAUDE.md §11]
---
# Landing e cadastro

Regras completas no `CLAUDE.md` §11. Resumo:
- `/` = `src/pages/Index.tsx`, otimizada para celular 4G. Imagens WebP em `public/landing/` (script `scripts/otimizar-imagens-landing.sh`); use `<ImagemResponsiva>`, nunca `<picture>`.
- Botão principal → `/cadastro` (`LoginPage` no passo "Crie sua conta"). `/login` para quem já tem conta.
- Números reais via `landing-stats` (piso `LANDING_MIN_ASSINANTES`=50).
- Proibido: números/depoimentos inventados, promessa de ganho, "grátis" → [[Regras de comunicação]].
- Onboarding/quiz pós-cadastro: `/bem-vindo`, `/onboarding/*`, `src/lib/perfilDoQuiz.ts`.

Medição: [[Pixels e medição]].
