---
atualizado: 2026-11-26
fontes: [src/lib/construcaoDaLoja.ts]
---
# Imagem do tema gerada por IA

**Decisão (25/11/2026):** na loja criada pelo chat do [[Atlas]], a imagem de capa do tema (ex.: loja do agro → campo, colheita) é **gerada por IA** com a função `generate-store-banner`, e não buscada no Pinterest ou no Google Imagens.

**Por quê:** foto do Pinterest/Google tem dono; pôr na loja de um seller sem licença expõe o seller e a Velo a pedido de remoção e cobrança de direito autoral. Se um dia quisermos fotos reais, o caminho é um banco com licença de uso comercial (Pexels, Unsplash) via edge function → [[Próximos passos]].

**Revisão (25/11/2026):** a geração pura ainda erra (tarjas, metade da imagem, nome da marca escrito na foto). O dono pediu "buscar banner no Pinterest/Google e pôr uma IA por cima para ajustar". Pinterest/Google continuam fora (foto com dono; ajuste por IA não tira o direito autoral). Proposta no lugar: buscar foto de moda num banco com licença comercial (Pexels/Unsplash) pelo nicho e pelas cores, e usar a IA só para ajustar (tons da paleta, alargar para 16:9, tirar texto). Precisa de chave da API do banco (secret) e deploy de função → [[Próximos passos]].

**Atualização (26/11/2026):** `generate-store-banner` publicada com os prompts originais preservados; o dono aprovou o nome disponível `google/gemini-3-pro-image`, em 16:9/4K, mantendo o fallback existente 2.5 Flash. Exige sessão validada por `auth.getUser`, grava sem recompressão em `assets/{user_id}/capas/{uuid}.{png|jpg}` com service role, devolve URL pública e mantém data URL se o upload falhar. Sem alteração no frontend, buckets ou policies. Logs registram modelo/configuração/dimensões/tempo, nunca o prompt ou dados pessoais. Os quatro primeiros testes reais atingiram limite de memória sem salvar imagens (3,916536 créditos); removidas cópias JSON e a conversão que criava um array intermediário enorme, com cinco testes Deno passando e correção publicada. Repetição das quatro cenas aguarda autorização de gasto; qualidade e resolução reais ainda não confirmadas.
