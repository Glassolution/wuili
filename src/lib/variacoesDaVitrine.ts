/*
  Variações da Vitrine moda: cada loja gerada pelo Atlas sai com uma combinação
  de desenho (por enquanto, o topo), para não ficar tudo igual.

  A escolha é determinística a partir do nome e do nicho: a mesma loja sempre
  sai igual (reabrir o editor, gravar, mostrar de novo), lojas diferentes saem
  diferentes.

  Também aqui: o menu e as categorias da loja de moda, tirados dos produtos da
  pessoa (categoria do catálogo ou a primeira palavra do produto que ela
  listou, no plural). Nada inventado.
*/

export type VariacaoDoTopo = "escuro" | "centralizado" | "claro" | "escuro-centralizado";

export const VARIACOES_DO_TOPO: { id: VariacaoDoTopo; nome: string }[] = [
  { id: "escuro", nome: "Escuro, menu em linha" },
  { id: "centralizado", nome: "Claro, marca no centro" },
  { id: "claro", nome: "Claro, menu no centro" },
  { id: "escuro-centralizado", nome: "Escuro, marca no centro" },
];

/** Hash FNV-1a de 32 bits (estável entre navegadores). */
export function semente(texto: string): number {
  let h = 0x811c9dc5;
  for (const ch of texto.toLowerCase().trim()) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Capas da Vitrine moda. Cada uma tem enquadramento de foto, fonte, textos e
 * botões próprios, e pede à IA uma cena que combine (generate-store-banner).
 */
export type VariacaoDaCapa = "cheia" | "estudio" | "cartao" | "marca";

export const VARIACOES_DA_CAPA: {
  id: VariacaoDaCapa;
  nome: string;
  /** Tem linha de texto abaixo do título. */
  comTexto: boolean;
  /** Tem segundo botão (contorno). */
  doisBotoes: boolean;
  /** Cena pedida à IA da imagem (em inglês, como o resto do prompt). */
  cena: string;
}[] = [
  {
    id: "cheia",
    nome: "Foto cheia, título forte",
    comTexto: false,
    doisBotoes: false,
    cena: "Low camera angle looking up. Two models in the right half, framed from the thighs up, against a clear open sky that fills the whole background. Bold, confident streetwear attitude.",
  },
  {
    id: "estudio",
    nome: "Estúdio claro, título em serifa",
    comTexto: true,
    doisBotoes: true,
    cena: "Bright minimalist photo studio with smooth light walls and soft natural shadows. A couple standing together in the right half, framed from the knees up, relaxed and elegant. The left half is clean light wall.",
  },
  {
    id: "cartao",
    nome: "Cartão editorial",
    comTexto: true,
    doisBotoes: false,
    cena: "One model standing slightly right of center against a sunlit textured plaster wall with a strong diagonal shadow, framed from the thighs up, relaxed pose, warm natural light, quiet editorial mood.",
  },
  {
    id: "marca",
    nome: "Marca no centro",
    comTexto: false,
    doisBotoes: false,
    cena: "One model in a dynamic pose in the center of the frame on a plain seamless light studio backdrop, full body or knees up, clean and minimal, soft even light.",
  },
];

/** Escolhe um item de uma lista pela semente (com um "sal" para cada escolha não andar junto). */
export function escolher<T>(lista: T[], s: number, sal: number): T {
  const misturado = Math.imul((s ^ sal) >>> 0, 0x9e3779b1) >>> 0;
  return lista[(misturado >>> 7) % lista.length];
}

export type VariacoesDaVitrine = {
  topo: VariacaoDoTopo;
  nomeDoTopo: string;
  capa: VariacaoDaCapa;
  nomeDaCapa: string;
  /** Semente para escolher os textos. */
  semente: number;
};

export function variacoesDaVitrine(dados: { nome: string; etiqueta: string }): VariacoesDaVitrine {
  const s = semente(`${dados.nome}|${dados.etiqueta}`);
  // Misturado (não `s % 4`): os bits baixos do FNV saem desequilibrados e um topo quase não aparecia.
  const topo = escolher(VARIACOES_DO_TOPO, s, 0x70b0);
  const capa = escolher(VARIACOES_DA_CAPA, s, 0x51a7);
  return { topo: topo.id, nomeDoTopo: topo.nome, capa: capa.id, nomeDaCapa: capa.nome, semente: s };
}

export const dadosDaCapa = (id: VariacaoDaCapa) => VARIACOES_DA_CAPA.find((c) => c.id === id) ?? VARIACOES_DA_CAPA[0];

/** Quem aparece na foto, pelo nicho ("roupas masculinas" → homens). */
export function modelosDaFoto(nicho: string): string {
  if (/masculin|homem|homens|men\b/i.test(nicho)) return "male models";
  if (/feminin|mulher|mulheres|lingerie|moda praia feminina/i.test(nicho)) return "female models";
  if (/infantil|crian[cç]a|kids|beb[eê]/i.test(nicho)) return "child models with a parent";
  return "models (men and women)";
}

/* ----- Categorias e menu da loja de moda ----- */

/** Palavras estrangeiras comuns na moda que fazem plural só com "s". */
const PLURAL_COM_S = /^(blazer|short|top|cropped|legging|jogger|kit|body|tricot|polo|look|baby ?look|trench)$/i;

/** "camisa de linho" → "Camisas"; "Blazer azul" → "Blazers"; "Calção" → "Calções". */
export function categoriaDoProduto(titulo: string): string | null {
  const palavra = titulo.trim().split(/\s+/)[0]?.replace(/[^\p{L}-]/gu, "") ?? "";
  if (palavra.length < 3) return null;
  const base = palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
  if (/s$/i.test(base)) return base;
  if (/ão$/i.test(base)) return base.replace(/ão$/i, "ões");
  if (/[aeiouáéíóú]$/i.test(base) || PLURAL_COM_S.test(base)) return `${base}s`;
  if (/m$/i.test(base)) return base.replace(/m$/i, "ns");
  return base;
}

/** Categorias da loja: as do catálogo ou, para itens da pessoa, a primeira palavra no plural. */
export function categoriasDosItens(itens: { titulo: string; categoria?: string | null }[], limite = 7): string[] {
  const todas = itens.map((i) => i.categoria || categoriaDoProduto(i.titulo)).filter((c): c is string => !!c);
  return [...new Set(todas)].slice(0, limite);
}

/** Menu da loja de moda: "Todos os produtos" e as categorias (ou o menu padrão, sem categoria). */
export function menuDaLojaDeModa(categorias: string[], padrao: string[]): string[] {
  return categorias.length > 0 ? ["Todos os produtos", ...categorias.slice(0, 7)] : padrao;
}
