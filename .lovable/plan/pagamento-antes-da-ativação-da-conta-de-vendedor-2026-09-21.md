# Pagamento antes da ativação da conta de vendedor

Inverter a ordem decidida no passo anterior: ninguém é bloqueado pela conta de vendedor antes de pagar. A ajuda para ativar a conta acontece depois do pagamento, com o anúncio já pronto e publicação automática quando a conta ficar apta.

## O que está assim hoje (confirmado no código)

- O fluxo de importar tem 4 etapas: Detalhes → Conexão → Revisão → Plano.
- Ao sair da Revisão, a Velo consulta o Mercado Livre e, se a conta não for de vendedor, **abre o tutorial e não deixa chegar ao plano**.
- Logo após conectar, uma verificação abre modal de tutorial/pendências **antes de qualquer pagamento**.
- Na etapa de conexão, quem disse no onboarding que não vende ainda vê primeiro um aviso amarelo "crie sua conta de vendedor".
- Na home, o passo do checklist só é dado como concluído se a conta estiver apta.

## O que muda

1. **Sem bloqueio antes do pagamento**
   - Sair da Revisão vai direto para a etapa de Plano, sem consultar a aptidão.
   - A verificação pós-conexão passa a rodar em segundo plano: registra o resultado e guarda o estado, sem abrir modal.
   - A etapa de Conexão deixa de empurrar o tutorial primeiro; quem não vende ainda continua conectando normalmente, com um link discreto de ajuda.
   - Na home, o passo "conectar Mercado Livre" volta a ficar concluído com a conta conectada; a pendência de vendedor aparece como aviso separado, só para quem já pagou.

2. **Aviso honesto antes de pagar**
   - Na etapa de Plano, uma linha simples: para publicar, a conta do Mercado Livre precisa estar habilitada a vender; se ainda não estiver, a Velo ajuda a resolver logo depois da assinatura. Sem cor de erro.

3. **Depois do pagamento**
   - Ao tentar publicar com conta inapta, abre o modal com texto e vídeo, botão "Já criei minha conta, verificar de novo" e ajuda humana.
   - O anúncio fica salvo como pendente (produto, título, preço, descrição, marca, modelo, estoque) e é publicado automaticamente assim que a conta ficar apta, com notificação no app.

4. **Publicação automática**
   - Nova tabela `pending_publications` (RLS por usuário + GRANTs) com o rascunho e o status.
   - Nova função `auto-publish-pending`, agendada, que confere a aptidão dos pendentes, publica os aptos reutilizando a mesma rotina de publicação e notifica o usuário. Também tenta na hora em que o próprio usuário clica em "verificar de novo".

5. **Lembretes para quem pagou e não publicou**
   - Canais propostos: notificação no app (já existe), banner na home e e-mail transacional (infra de e-mail já existe). WhatsApp fica como decisão sua, pois exige provedor.
   - Nesta etapa implemento notificação no app + banner; e-mail entra se você aprovar o gatilho (D+1 e D+3).

6. **Medição**
   - Eventos novos: pagou sem conta apta, tempo até ficar apta, publicação automática concluída, e cruzamento com pedidos de reembolso desses usuários.

## Riscos

- Cobrança e publicação são sensíveis: nada muda em `publicarNoMercadoLivre`, nos limites de plano ou no checkout. As mudanças são de ordem, texto e uma fila nova.
- A publicação automática só roda para rascunhos criados por tentativa real de publicação já paga, para não publicar nada sem intenção do usuário.

## O que preciso de você

- Aprovar o e-mail de lembrete (D+1 e D+3) e se quer WhatsApp.
- Confirmar se a publicação automática deve ser automática mesmo ou pedir um toque de confirmação.
