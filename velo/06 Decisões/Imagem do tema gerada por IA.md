---
atualizado: 2026-11-25
fontes: [src/lib/construcaoDaLoja.ts]
---
# Imagem do tema gerada por IA

**Decisão (25/11/2026):** na loja criada pelo chat do [[Atlas]], a imagem de capa do tema (ex.: loja do agro → campo, colheita) é **gerada por IA** com a função `generate-store-banner`, e não buscada no Pinterest ou no Google Imagens.

**Por quê:** foto do Pinterest/Google tem dono; pôr na loja de um seller sem licença expõe o seller e a Velo a pedido de remoção e cobrança de direito autoral. Se um dia quisermos fotos reais, o caminho é um banco com licença de uso comercial (Pexels, Unsplash) via edge function → [[Próximos passos]].

**Revisão (25/11/2026):** a geração pura ainda erra (tarjas, metade da imagem, nome da marca escrito na foto). O dono pediu "buscar banner no Pinterest/Google e pôr uma IA por cima para ajustar". Pinterest/Google continuam fora (foto com dono; ajuste por IA não tira o direito autoral). Proposta no lugar: buscar foto de moda num banco com licença comercial (Pexels/Unsplash) pelo nicho e pelas cores, e usar a IA só para ajustar (tons da paleta, alargar para 16:9, tirar texto). Precisa de chave da API do banco (secret) e deploy de função → [[Próximos passos]].
