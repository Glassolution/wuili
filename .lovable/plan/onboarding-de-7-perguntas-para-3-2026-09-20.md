# Onboarding: de 7 perguntas para 3

## O que confirmei no código

- Hoje são mesmo 7 perguntas em 3 blocos, cada uma exigindo tocar em "Continuar". A tela de boas-vindas diz "perguntas rápidas".
- Só duas respostas são realmente usadas no produto: **nicho** e (em menor grau) **perfil**, lidos para montar a vitrine de produtos recomendados. As demais (quantos produtos, dificuldade, como cria anúncios, como conheceu a Velo) **não são lidas por nenhuma tela, nem pelo painel admin, nem por e-mail**. Ficam só guardadas no cadastro do usuário.
- "Como conheceu a Velo" é de fato redundante: a origem já é capturada no cadastro.
- O nome saiu do cadastro; hoje o sistema cria um nome provisório a partir do e-mail. Ou seja, nada quebra, mas a saudação fica feia ("joao.silva").
- Os textos repetidos e o jargão ("operação consolidada", "Passar confiança") estão confirmados.

## O que vai mudar

### As 3 perguntas, nesta ordem

1. **"Como podemos te chamar?"** — só o primeiro nome, um campo, teclado abre sozinho.
   *Por quê primeiro:* é a pergunta mais fácil e pessoal, cria vínculo, e o nome já é usado na saudação da próxima tela. Também é a única que exige digitar — melhor tirar do caminho antes das escolhas rápidas.
2. **"Você já tem conta de vendedor no Mercado Livre?"** — duas opções, avança ao tocar.
   *Por quê segundo:* é a única resposta que muda o caminho da pessoa daqui pra frente.
3. **"Que tipo de produto você quer vender?"** — opcional, avança ao tocar, com "Ver tudo" bem visível.
   *Por quê por último e opcional:* personaliza o catálogo, mas ninguém precisa dela para começar.

Fim → catálogo.

### As perguntas que saem (não somem da sua análise)

- **Como conheceu a Velo:** eliminada de vez. Já temos a origem do cadastro, e o dado do quiz era menos confiável que o real.
- **Perfil / quantos produtos / maior dificuldade / como cria anúncios:** viram um convite discreto de **uma pergunta por vez** no painel, num cartão pequeno que aparece **depois da primeira publicação** e pode ser dispensado. As respostas vão para o mesmo lugar de hoje, então sua segmentação continua comparável com quem respondeu no formato antigo.

### Caminho de quem não tem conta no Mercado Livre

Tela curta com os passos de criação de conta e dois botões: "Criar conta no Mercado Livre" (abre em outra aba) e "Ver o catálogo agora". A pessoa não fica travada.
**Para você revisar:** vou escrever os passos apenas em termos genéricos (criar conta, virar vendedor, voltar e conectar). Não vou afirmar exigências específicas (documento, CNPJ, prazo) que eu não consiga confirmar — deixo marcado no código o trecho que você deve revisar.

### Interação e leitura

- Escolha única avança sozinha ao tocar; some o botão "Continuar" dessas telas.
- Voltar sempre disponível, com a resposta anterior já marcada.
- Cartões com fundo sólido (sem se misturar ao degradê), texto maior, altura mínima de toque de 60px, selecionado com borda azul grossa + marca de confirmação.
- Introdução honesta: "3 perguntas rápidas, menos de 1 minuto" (verdadeiro agora).
- Todos os subtítulos reescritos, um por pergunta, sem jargão.

### Dados

- Nome salvo no perfil (mesmo campo que a tela de Perfil usa) e no cadastro, então a saudação passa a mostrar o nome escolhido.
- As respostas continuam no mesmo formato de hoje; quem já respondeu o quiz antigo não perde nada e a vitrine continua funcionando.
- Quem não responder o nicho cai no catálogo geral, como já acontece.

### Medição

Por pergunta: viu, respondeu, pulou, abandonou. Mais o tempo entre criar a conta e ver o primeiro produto. Vou usar o mesmo mecanismo de medição do cadastro, para aparecer junto no painel de rastreio.

## Escopo

Só o onboarding. A tela inicial do painel fica para a próxima etapa. Desktop mantém o layout atual, com os mesmos textos e a mesma redução de perguntas.
