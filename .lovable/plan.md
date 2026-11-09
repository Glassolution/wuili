# Founder Mode — etapa 1 revisável, sem implantação

## Entrega e limites
Preparar o primeiro agente **Qualidade de dados**, determinístico, com acesso próprio, consultas agregadas e histórico verificável. Nesta rodada, a entrega é a especificação revisável e o pacote de recuperação: **não executar migrations, deploy, runner ou alterações de dados**.

- Não alterar `AdminRoute`, `AuthContext`, `is_admin`, `private.has_role`, `user_roles`, `profiles`, policies existentes ou crons.
- Não recriar a tela Founder Mode: o design está no Mac e seus arquivos não estão neste checkout. Integrar posteriormente apenas contratos de dados e guardas nos arquivos originais, preservando layout, cores e componentes. Nenhuma tela substituta.
- Admin atual conserva rotas e permissões; founder não recebe admin implicitamente. Nenhuma conta será promovida ou receberá entitlement sem identificação e autorização explícitas.
- Sem agentes de pagamento, correções automáticas de dados, leitura de contatos/tokens, MCP adicional, IA paga ou SQL livre.

## Reconciliação e recuperação
Código base: `3758697cd549b46bb3efdc948387bdf0b6640d7f`. Nova inspeção em 09/11/2026, aproximadamente 20:19 UTC: 51 entradas Drizzle (`0000`–`0050`), sem divergência na ferramenta de histórico; maior timestamp `1794177226732`, maior id 51.

`0051` está disponível **como candidato no histórico e checkout observados**, não reservado; trabalho externo no Mac ou outra sessão não é visível. Nenhuma migration numerada será criada nesta rodada. Repetir a inspeção imediatamente antes da criação autorizada; se a sequência avançar, escolher o próximo número real. SQL proposto fica fora de `drizzle/migrations/`; aplicação posterior exclusivamente pela ferramenta de migration, que aplica imediatamente.

Pacote seletivo: seis SQLs `0045`–`0050`, seis snapshots correspondentes e `_journal.json` completo, byte-exatos, com manifesto SHA-256 e instruções. Não inclui `.git`, dependências, builds ou secrets. O journal completo referencia também `0000`–`0044`: **não substituir cegamente** journal/snapshots do Mac, especialmente se houver trabalho posterior; comparar prefixo, hashes e cadeia antes de incorporar. Snapshots customizados vazios não representam todo o banco. Não reexecutar SQL já aplicado.

## Autorização própria
**Proposta:** entitlement dedicado `founder_entitlements`, sem estender `app_role` nem tocar no admin legado.

- Chave `user_id uuid` única, sem FK para `auth.users`; `granted_at`, `granted_by` e `revoked_at`. Nenhum email ou token.
- Escrita somente por operação administrativa explícita no servidor; não haverá endpoint público de autoatribuição ou seed automático.
- `founder_has_access()` usa apenas `auth.uid()` e entitlement não revogado, SECURITY DEFINER, search_path fixo. Não aceita um ID arbitrário do cliente.
- `founder_access()` autenticada devolve apenas `{ allowed }`. `FounderRoute` usa esse resultado, não metadata/localStorage; o servidor reconfirma acesso a cada requisição.
- Acesso Founder e acesso Administração são independentes. Diálogo Administração, se existir no Mac, deve envolver os componentes diretamente em `AdminRoute`/guarda equivalente e preservar os endpoints admin existentes. Esconder o botão não substitui autorização.
- Novas tabelas: CREATE → GRANT mínimo → ENABLE RLS → policies. Sem grants anon. Authenticated lê entitlement próprio e resultados via autorização Founder; nenhum INSERT/UPDATE/DELETE direto. Service role tem grants necessários. Helpers/RPCs revogam EXECUTE de PUBLIC/anon; funções de execução são service-role-only.

## Execuções atômicas e histórico
Não reutilizar `job_locks`: o consumidor inspecionado usa leitura seguida de upsert, permite corrida e contorna o lease para admin.

Propor tabelas isoladas:
1. `founder_agent_leases`: uma chave por agente, `run_id`, token de proprietário, contador fencing monotônico, `leased_until`.
2. `founder_agent_runs`: janela, versão das regras/contratos, request key, tentativa, início/fim, status e código de falha fechado.
3. `founder_findings`: identidade estável `(agent, rule_version, finding_key)`, estado atual e referências primeira/última ocorrência.
4. `founder_finding_occurrences`: evidência agregada imutável por execução/regra, incluindo confirmação, resolução e reaparecimento.

**Contrato de aquisição:** em uma única transação, serializar a request key (advisory xact lock) e disputar o lease do agente por INSERT ON CONFLICT DO UPDATE com condição `leased_until <= clock_timestamp()`. Só o vencedor recebe run/token/fence e cria a execução; o perdedor recebe `busy`, sem executar consultas. Request repetida concluída devolve o resultado anterior; tentativa expirada só retoma por pedido explícito, com nova tentativa e fence.

- Lease proposto de 180 segundos; renovar a cada 30 segundos; deadline total 120 segundos por tentativa. Valores revisáveis, não agendamentos ativos.
- Heartbeat, conclusão e persistência exigem run/token/fence atuais e lease válido; atualização/completion e gravação das ocorrências ocorrem numa única transação com row lock. Dono antigo não escreve depois de retomada, mesmo que sua consulta termine tarde.
- Expiração marca tentativa anterior como `abandoned` atomicamente na próxima aquisição; não apaga evidências. Revogação de acesso é reconferida antes da conclusão.
- Falha de consulta retorna `failed` ou `partial`, nunca “saudável”; não fecha achados se a consulta relevante não concluiu.
- Não haverá cron nesta etapa: execução manual autenticada. Futuro cron, retentativa ou disparo manual deverá passar pela mesma aquisição.

## Consultas fechadas do agente Qualidade de dados
Registro separado de **IDs de consultas**, versões, tabelas/fontes e projeções. Endpoint aceita apenas ação enumerada e janela; nunca SQL, nome de tabela/RPC arbitrário, path ou filtros livres.

Janela `[start,end)` UTC, fim no passado, máximo proposto 7 dias. Servidor normaliza a janela em minutos, registra exatamente os limites e aplica statement_timeout de 15 segundos por consulta. Cada consulta retorna schema fechado e no máximo cinco linhas de fontes, não 500 linhas de eventos. Sem colunas livres/JSON de origem.

| ID versionado | Fonte / saída permitida | Regra inicial |
|---|---|---|
| `dq.source_contract.v1` | pg_catalog/information_schema: existência, tipo/nulabilidade das colunas explicitamente exigidas, índice temporal; sem definições livres | Coluna ausente/incompatível ou índice esperado ausente: achado verificável de contrato/performance, não “coleta quebrada” |
| `dq.source_activity.v1` | landing_events/mobile_home_events/user_sessions/user_page_views/profiles: COUNT da janela, MAX do timestamp na janela, contagem de timestamps futuros além de tolerância | Recência e zero observado são informativos/inconclusivos sem heartbeat/baseline; futuros são anomalia temporal, não erro confirmado de coletor |
| `dq.session_links.v1` | user_page_views/user_sessions: total de views, session_id ausente, referência inexistente; apenas contagens, sem IDs | Referência inexistente é observação; só classificar como falha após confirmar contrato de retenção; ausência pode ser legítima |
| `dq.traffic_recount.v1` | sessões/views: totais e dias UTC, DISTINCT user_id calculado no banco; contagem separada de dias apenas com views | Recontagem completa; não somar distintos diários como distintos da janela. Omitir dias só de views na RPC legada é diferença conhecida de definição, não corrupção |

Somente projeções positivas: contagens inteiras, timestamps, enums e IDs de consulta. Nenhum email, contato, visitor/user/session ID, path, referrer, user-agent, detail, payload, mensagem ou erro bruto sai das consultas. Service role fica restrito por código e RPCs fechadas, não só pela allowlist MCP.

Não chamar as RPCs admin legadas sob sessão Founder: elas exigem is_admin do perfil. Consultas Founder novas usam entitlement próprio e agregação independente. Não alterar as RPCs existentes. Comparação com funis legados só será adicionada se datas, filtros, estado, deduplicação e denominadores coincidirem; esta etapa não declara divergência de conversão por contagens diferentes.

Duplicidade por `visitor_id + evento + intervalo` não será achado confirmado. Sem contrato/ID idempotente, apenas observação heurística; não incluir detector automático de duplicação nesta versão.

## API e persistência propostas
Nova função isolada `founder-data-quality` (Deno), sem implantação nesta rodada:
- `access`: booleano; `run`: janela limitada e request key UUID; `runs`/`findings`: paginação por cursor, máximo 25/50; `run_detail`: ID de execução, apenas resultados agregados.
- Verificar JWT no servidor e entitlement antes de qualquer operação; 401 sem sessão, 403 sem acesso. Sem parâmetros de usuário para impersonação.
- Contratos versionados com validação de entrada/saída e chaves extras rejeitadas; códigos sanitizados (`QUERY_TIMEOUT`, `CONTRACT_MISMATCH`, `LEASE_LOST`, `SOURCE_UNAVAILABLE`). Nunca devolver stack/SQL/erros do banco.
- Persistência guarda parâmetros normalizados, versão, início/fim, cobertura completa/parcial e IDs das consultas. Achados mantêm evidência por run; problema resolvido que reaparece gera nova ocorrência e reabre o achado. Fechamento apenas por verificação completa da mesma regra.

## Implementação posterior e critérios de revisão
Arquivos futuros separados: SQL proposto não numerado em `docs/founder-mode/`, contratos e regras puras `_shared/founderDataQuality.ts`, função nova, testes ao lado; integração da UI apenas após receber arquivos originais do Mac. Nenhum import/rota ativo nesta rodada.

Antes de aplicar: revisar SQL completo (helpers antes das policies, grants em cada tabela, sem auth FK/enum migration, funções service-role-only), reconferir número e EXPLAIN das consultas em janela máxima; sem índices globais novos sem necessidade medida.

Testes exigidos antes da implantação:
- Sem login/sem entitlement/entitlement revogado recusados; founder sem admin acessa apenas Founder, nunca Administração, mesmo acessando endpoint diretamente; admin atual continua com o mesmo acesso, sem entitlement implícito.
- Duas aquisições simultâneas → uma execução; mesma request key → idempotência; takeover após lease → fence antigo rejeitado; heartbeat/completion perdidos não gravam; tentativa abandonada preservada.
- Rejeitar SQL livre/chaves extras/janela >7 dias/fim futuro; consultas agregam janela inteira, sem truncamento; UTC/denominador uniforme; DISTINCT por janela versus dia distinto.
- Zero/baixa recência sem sinal independente → inconclusivo; evento legítimo repetido não é duplicação; consulta parcial não resolve achado; resolução e reaparecimento preservam ocorrências.
- Nenhuma saída ou log transporta campos pessoais/URLs/erro bruto, incluindo objetos aninhados; testes usam fixtures apenas, nunca dados fictícios na interface.

Testes SQL de concorrência/RLS e fluxo autenticado só em ambiente isolado autorizado depois: **não podem ser declarados validados nesta rodada sem aplicar o schema**. Sem migration/deploy, o agente ainda não roda.

## Pendências específicas
- Arquivos do Founder Mode do Mac para integrar sem redesenhar; não bloqueiam revisão dos contratos.
- Conta a receber acesso Founder e concessão explícita somente quando a implantação for autorizada.
- Aprovação do SQL completo e dos testes isolados antes de aplicação; nenhuma aprovação vaga autoriza migrations/deploy nesta etapa.