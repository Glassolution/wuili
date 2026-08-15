# Personagens de IA — ponteiros de imagem

Cada `*.asset.json` aqui é um **ponteiro**, não uma imagem: o Lovable grava o
caminho do arquivo no campo `url` e o componente lê `arquivo.url` como `src`.

Como vieram do Lovable, esses ponteiros apontavam para
`/__l5e/assets-v1/<asset_id>/<nome>` — um caminho que só a infraestrutura do
Lovable serve. Rodando localmente ou na Vercel, essa URL dá 404 e a tela do
TikTok abre com todas as fotos quebradas.

Por isso as imagens foram baixadas para `public/models/` e o `url` de cada
ponteiro reescrito para `/models/<nome>`, que funciona em qualquer ambiente.

**Se você reimportar esses assets pelo Lovable**, o `url` volta para
`/__l5e/...` e as imagens quebram de novo. Nesse caso, baixe os arquivos e
reescreva o campo `url` como está aqui.
