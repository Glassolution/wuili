---
atualizado: 2026-11-09
---
# Founder Mode isolado — proposta, não implantada

- Etapa 0 reconferida: histórico Drizzle 0000–0050 consistente; 0051 apenas candidato, sem reserva externa comprovada.
- Etapa 1 preparada para revisão: entitlement próprio, sem mudar admin global nem estender app_role.
- Execução manual proposta com aquisição atômica, lease e fencing; não reutilizar read/upsert de job_locks como garantia de exclusão.
- Qualidade de dados recebe apenas agregados de consultas fechadas/versionadas; não transporta contatos, tokens ou linhas brutas.
- Evidência por execução é preservada; silêncio sem sinal independente fica inconclusivo e duplicidade exige contrato verificável.
- Nenhuma migration, deploy, concessão de acesso ou cron foi executado.
- Design Founder Mode está no Mac, indisponível no checkout: não recriar; integração aguarda os arquivos originais.
- Recuperação seletiva dos SQLs 0045–0050, snapshots e journal foi preparada com hashes, sem reaplicação.

Onde está a proposta: `.lovable/plan.md` (arquivada automaticamente após decisão).
Ver [[Painel admin]], [[Migrations pendentes]], [[Próximos passos]].