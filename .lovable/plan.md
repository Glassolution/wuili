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

Pacote: seis SQLs `0045`–`0050`, seis snapshots e journal completo, byte-exatos, manifesto SHA-256. Sem `.git`, dependências, builds ou secrets. **Não substituir cegamente** journal do Mac: comparar prefixo `0000`–`0044`, hashes, cadeia e trabalho posterior. Snapshots vazios não representam o banco; não reexecutar SQL aplicado.

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

**Aquisição:** transação única serializa request key (advisory xact lock) e disputa lease por INSERT ON CONFLICT DO UPDATE condicionado a `leased_until <= clock_timestamp()`. Vencedor cria run/token/fence; perdedor recebe `busy`. Request concluída devolve resultado anterior; expirada retoma só por pedido explícito, nova tentativa/fence.

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

Projeções positivas: contagens, timestamps, enums e IDs de consulta. Sem contatos, IDs pessoais, URLs, user-agent, detail, payload, mensagens ou erros brutos; RPCs fechadas delimitam o runner service role.

Não chamar/alterar RPCs admin legadas: novas consultas usam entitlement e agregação independente. Comparar funis só com datas, filtros, estados, deduplicação e denominadores iguais.

Duplicidade por `visitor_id + evento + intervalo` não será achado confirmado. Sem contrato/ID idempotente, apenas observação heurística; não incluir detector automático de duplicação nesta versão.

## API proposta
Função isolada `founder-data-quality` (Deno): `access`, `run` com janela/request key UUID, `runs`/`findings` por cursor (25/50), `run_detail` agregado. JWT/entitlement antes de operar (401/403), sem impersonação. Schemas fechados; erros `QUERY_TIMEOUT`, `CONTRACT_MISMATCH`, `LEASE_LOST`, `SOURCE_UNAVAILABLE`, nunca stack/SQL. Persistir parâmetros, versões, janela, cobertura e IDs de consultas; ocorrências por run preservam resolução e reaparecimento, com fechamento só após verificação completa.

## Implementação posterior e critérios de revisão
Arquivos futuros: SQL não numerado em `docs/founder-mode/`, regras/contratos `_shared/founderDataQuality.ts`, função e testes separados. UI só nos originais do Mac; sem import/rota ativo agora.

Antes de aplicar: revisar SQL completo (helpers antes das policies, grants em cada tabela, sem auth FK/enum migration, funções service-role-only), reconferir número e EXPLAIN das consultas em janela máxima; sem índices globais novos sem necessidade medida.

Testar antes da implantação:
- Login/entitlement/revogação; founder sem admin recusado no diálogo e endpoints admin; admin atual inalterado.
- Aquisição concorrente única, idempotência, takeover/fencing, heartbeat perdido, abandono preservado.
- SQL/chaves extras/janelas inválidas rejeitados; janela completa, UTC e DISTINCT corretos.
- Silêncio sem sinal inconclusivo; repetição legítima não é duplicação; parcial não resolve; histórico preservado.
- Schemas/logs sem dados pessoais, URLs ou erros brutos, inclusive aninhados. Fixtures apenas em testes, não UI.

Concorrência/RLS e fluxo autenticado exigem ambiente isolado autorizado; não validados nesta rodada. Sem migration/deploy, o agente não roda.

## Pendências específicas
- Arquivos do Founder Mode do Mac para integrar sem redesenhar; não bloqueiam revisão dos contratos.
- Conta a receber acesso Founder e concessão explícita somente quando a implantação for autorizada.
- Aprovação do SQL completo e dos testes isolados antes de aplicação; nenhuma aprovação vaga autoriza migrations/deploy nesta etapa.