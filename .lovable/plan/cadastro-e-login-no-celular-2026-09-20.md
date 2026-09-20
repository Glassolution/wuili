# Cadastro e login no celular

Objetivo: fazer mais visitantes novos concluírem o cadastro no celular, sem erro e sem passos desnecessários.

## O que existe hoje (confirmado no código)

- Já existe **uma única tela** (`/login`). `/cadastro` e `/auth` redirecionam para ela. Ela começa pedindo o e-mail e decide sozinha se é login ou cadastro.
- Quem vem do botão da landing (`?novo=1`) já cai direto em "Criar conta" — isso funciona.
- O título padrão da tela ainda é "Entre na Velo", com cara de quem já é cliente.
- O cadastro pede **nome, e-mail, senha e dois aceites separados** (Termos e Privacidade).
- O botão do Google não trata o caso do navegador interno do Instagram/TikTok: a pessoa vê o erro cru do Google.
- As mensagens de erro em alguns casos mostram o texto técnico em inglês vindo do sistema.
- Não existe nenhuma medição desta tela.

## O que vou mudar

1. **Uma tela, um caminho claro.** Visitante novo vê "Crie sua conta Velo"; "Já tenho conta" fica como link discreto. Quem digita um e-mail já cadastrado segue para a senha automaticamente, como hoje.
2. **Cadastro só com o essencial:** e-mail e senha. O nome sai do cadastro — o sistema já preenche o nome a partir do e-mail e a pessoa ajusta depois no Perfil. Nada quebra.
3. **Um único aceite**, em uma linha: "Ao criar a conta você aceita os Termos e a Política de Privacidade", com data e hora do aceite gravadas no perfil como comprovação. Remove o aceite duplicado do rodapé.
4. **Google dentro do Instagram/TikTok:** detectando o navegador interno, o botão do Google não tenta abrir e falhar. Em vez disso aparece uma orientação simples ("Abra no navegador do celular") com botão de copiar o link, e o caminho por e-mail continua ali do lado.
5. **Conforto no celular:** teclado de e-mail e de senha corretos, preenchimento automático ativo, botão principal sempre visível com o teclado aberto, mostrar/ocultar senha e correção sugerida para erros comuns de digitação (gmail.con, hotmial.com etc.).
6. **Erros em português simples** que dizem o que fazer, nunca o texto técnico do sistema.
7. **Origem do visitante:** UTM e referência gravados no momento do cadastro.
8. **Medição do funil:** tela vista, começou a preencher, enviou, concluiu, clicou no Google, estava em navegador interno e erros por tipo — usando a mesma tabela de eventos da landing, visível depois no Rastreio.

## Confirmação de e-mail — minha recomendação

Hoje o cadastro manda para a tela de "confirme seu e-mail" quando a confirmação está ligada. Isso derruba muita gente vinda de rede social, que não troca de app para abrir o e-mail.
**Recomendo liberar o acesso imediatamente após o cadastro** (sem exigir a confirmação para entrar), mantendo o e-mail de boas-vindas e pedindo a confirmação só quando a pessoa for pagar. Isso é uma mudança de configuração da conta e **não vou aplicar sem a sua autorização** — me diga se concorda.

## Riscos

- Mexer em autenticação pode travar quem já tem conta. Por isso não altero nada no login existente nem no contexto de sessão: só a tela e o que ela envia.
- Remover o nome do cadastro exige que o perfil continue sendo criado com nome válido — já é o caso hoje.
- A detecção de navegador interno é por identificação do aplicativo; vou usá-la só para mostrar orientação, nunca para bloquear ninguém.

## Detalhes técnicos

- `src/pages/LoginPage.tsx`: remoção do campo nome e do aceite duplicado, aceite único com timestamp, detecção de in-app browser, correção de typo de e-mail, `inputMode`/`autoComplete`, CTA fixo no rodapé em mobile, tradução de erros.
- Nova migration: coluna de aceite (`terms_accepted_at`) e de origem (`signup_source`, `utm_*`) em `profiles`, mais eventos de funil `signup_*` em `landing_events` e RPC administrativa de funil de cadastro.
- Página `/admin/rastreio`: novo bloco com o funil de cadastro.
- Desktop preservado; mudanças de layout condicionadas ao mobile.
