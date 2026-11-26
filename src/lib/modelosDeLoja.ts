/*
  Catálogo dos modelos que o Atlas usa para montar a loja na tela do editor
  (AtlasEditorAoVivo). Cada modelo diz o que dá para personalizar; a montagem
  primeiro desenha o modelo "puro" (cinza, textos de exemplo) e depois troca
  cada ponto pelas escolhas e produtos da pessoa.

  Por enquanto há um modelo, a "Vitrine editorial": topo com a marca no centro,
  capa grande com foto, grade de novidades com abas por categoria e um mosaico
  de destaques. Layout no estilo de lojas de moda; nenhum texto, foto ou marca
  de terceiros.

  Ainda não é um template do editor de lojas (loja-1/loja-2 em
  GeneratedStoreEditorPage): a loja gravada continua usando aqueles. Virar
  "loja-3" de verdade é o próximo passo (ver velo/Próximos passos.md).
*/

import type { TipoDeLoja } from "@/lib/briefingDaLoja";

export type PontoPersonalizavel =
  | "logo"
  | "nome"
  | "fonte"
  | "cores"
  | "menu"
  | "capa"
  | "chamada"
  | "produtos"
  | "precos"
  | "categorias"
  | "destaques";

export type ModeloDeLoja = {
  id: string;
  nome: string;
  descricao: string;
  /** Tipos de loja em que o modelo funciona bem. */
  paraTipos: TipoDeLoja[];
  /** Seções na ordem em que aparecem. */
  secoes: { id: string; nome: string }[];
  personalizaveis: { ponto: PontoPersonalizavel; onde: string }[];
  /** Quantos produtos a grade mostra. */
  produtosNaGrade: number;
};

export const VITRINE_EDITORIAL: ModeloDeLoja = {
  id: "vitrine-editorial",
  nome: "Vitrine editorial",
  descricao: "Capa grande com foto, grade de novidades por categoria e mosaico de destaques. Feito para moda, casa e produtos com foto bonita.",
  paraTipos: ["fisico", "infoproduto", "curso", "servico", "jogo"],
  secoes: [
    { id: "topo", nome: "Topo" },
    { id: "capa", nome: "Capa" },
    { id: "novidades", nome: "Novidades" },
    { id: "destaques", nome: "Destaques" },
  ],
  personalizaveis: [
    { ponto: "logo", onde: "Topo, no centro" },
    { ponto: "nome", onde: "Topo, ao lado da logo" },
    { ponto: "menu", onde: "Topo, à esquerda" },
    { ponto: "fonte", onde: "Títulos das seções" },
    { ponto: "cores", onde: "Preço e bloco azul do mosaico" },
    { ponto: "capa", onde: "Foto de fundo da capa" },
    { ponto: "chamada", onde: "Etiqueta, título e botão da capa" },
    { ponto: "categorias", onde: "Abas acima da grade" },
    { ponto: "produtos", onde: "Grade de novidades (foto, nome, categoria)" },
    { ponto: "precos", onde: "Abaixo do nome de cada produto" },
    { ponto: "destaques", onde: "Mosaico: capa, fotos dos produtos e a frase da loja" },
  ],
  produtosNaGrade: 8,
};

/**
 * Loja de roupa, calçado e acessório. Estrutura de loja de moda brasileira
 * (inspirada em lojas de moda fitness/atacado): aviso, topo escuro, capa larga,
 * categorias, chamada escura, duas vitrines de 4, atalhos com foto, avaliações
 * (só as de verdade), frase da marca, newsletter e rodapé. Nada de foto, texto
 * ou marca da loja de referência: tudo vem da pessoa.
 */
export const VITRINE_MODA: ModeloDeLoja = {
  id: "vitrine-moda",
  nome: "Vitrine moda",
  descricao: "Topo escuro, capa larga, categorias, duas vitrines de produtos, atalhos e rodapé completo. Para roupa, calçado e acessório.",
  paraTipos: ["fisico"],
  secoes: [
    { id: "topo", nome: "Aviso e topo" },
    { id: "capa", nome: "Capa" },
    { id: "categorias", nome: "Categorias" },
    { id: "chamada", nome: "Chamada" },
    { id: "novidades", nome: "Novidades" },
    { id: "essenciais", nome: "Essenciais" },
    { id: "atalhos", nome: "Atalhos" },
    { id: "avaliacoes", nome: "Avaliações" },
    { id: "frase", nome: "Frase da marca" },
    { id: "newsletter", nome: "Newsletter" },
    { id: "rodape", nome: "Rodapé" },
  ],
  personalizaveis: [
    { ponto: "logo", onde: "Topo, à esquerda" },
    { ponto: "nome", onde: "Topo, aviso, chamada, newsletter e rodapé" },
    { ponto: "menu", onde: "Topo" },
    { ponto: "cores", onde: "Tom do topo, da chamada, dos botões e do rodapé (um toque da cor, sem exagero)" },
    { ponto: "capa", onde: "Foto larga da capa" },
    { ponto: "chamada", onde: "Etiqueta, título e botão da capa; faixa escura" },
    { ponto: "categorias", onde: "Cartões de categoria (das categorias dos produtos)" },
    { ponto: "produtos", onde: "Novidades (4 primeiros) e Essenciais (4 seguintes)" },
    { ponto: "precos", onde: "Abaixo do nome de cada produto" },
    { ponto: "destaques", onde: "Três atalhos com foto" },
  ],
  produtosNaGrade: 8,
};

export const MODELOS_DE_LOJA: ModeloDeLoja[] = [VITRINE_EDITORIAL, VITRINE_MODA];
