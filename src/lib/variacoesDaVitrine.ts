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

/** Onde a pessoa fica na foto; o título da capa vai para o outro lado. */
export type LadoDaFoto = "direita" | "esquerda" | "centro";

export const VARIACOES_DA_CAPA: {
  id: VariacaoDaCapa;
  nome: string;
  /** Tem linha de texto abaixo do título. */
  comTexto: boolean;
  /** Tem segundo botão (contorno). */
  doisBotoes: boolean;
  /** Cenários possíveis (cena em inglês, como o resto do prompt; nome para mostrar); um por loja. */
  cenarios: { nome: string; cena: string }[];
  /** Quantas pessoas cabem nesse desenho. */
  pessoas: (1 | 2 | 3)[];
}[] = [
  {
    id: "cheia",
    nome: "Foto cheia, título forte",
    comTexto: false,
    doisBotoes: false,
    cenarios: [
      { nome: "Céu aberto visto de baixo", cena: "Low-angle 35mm shot against a clear deep sky, bright sun, crisp shadows." },
      { nome: "Terraço na hora dourada", cena: "Rooftop at golden hour, open sky behind, warm low sun, long shadows." },
      { nome: "Concreto ao sol do meio-dia", cena: "Pale concrete steps outdoors under hard midday sun, graphic shadows." },
    ],
    pessoas: [1, 2, 1, 2, 3],
  },
  {
    id: "estudio",
    nome: "Estúdio claro, título em serifa",
    comTexto: true,
    doisBotoes: true,
    cenarios: [
      { nome: "Estúdio com luz de janela", cena: "Sunlit studio, warm side window light, off-white plaster wall." },
      { nome: "Estúdio bege minimalista", cena: "Minimal studio, warm beige seamless backdrop, soft window light from one side." },
      { nome: "Estúdio branco de parede curva", cena: "Bright studio with a curved white wall, soft directional light." },
    ],
    pessoas: [1, 2, 1, 2, 3],
  },
  {
    id: "cartao",
    nome: "Cartão editorial",
    comTexto: true,
    doisBotoes: false,
    cenarios: [
      { nome: "Parede ao sol com sombra diagonal", cena: "Textured plaster wall, strong diagonal sunlight shadow, golden hour, film grain." },
      { nome: "Esquina de pedra ao sol", cena: "Quiet street corner, sunlit stone wall, warm light, subtle film grain." },
    ],
    pessoas: [1, 1, 2],
  },
  {
    id: "marca",
    nome: "Marca no centro",
    comTexto: false,
    doisBotoes: false,
    cenarios: [
      { nome: "Fundo na cor da loja com flash", cena: "Seamless backdrop in a soft palette tone, crisp direct flash, clean floor shadow." },
      { nome: "Estúdio cinza quente", cena: "Plain warm-grey studio, soft key light from one side." },
    ],
    // O nome da loja vai por cima: uma pessoa só, no centro.
    pessoas: [1],
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
  /** Onde a pessoa fica na foto (o título vai para o outro lado). */
  lado: LadoDaFoto;
  /** Semente para escolher os textos. */
  semente: number;
};

export function variacoesDaVitrine(dados: { nome: string; etiqueta: string }): VariacoesDaVitrine {
  const s = semente(`${dados.nome}|${dados.etiqueta}`);
  // Misturado (não `s % 4`): os bits baixos do FNV saem desequilibrados e um topo quase não aparecia.
  const topo = escolher(VARIACOES_DO_TOPO, s, 0x70b0);
  const capa = escolher(VARIACOES_DA_CAPA, s, 0x51a7);
  // Marca no centro: o nome vai por cima da pessoa. Nas outras, a pessoa fica de um lado e o título do outro.
  const lado: LadoDaFoto = capa.id === "marca" ? "centro" : escolher<LadoDaFoto>(["direita", "esquerda"], s, 0x1ad0);
  return { topo: topo.id, nomeDoTopo: topo.nome, capa: capa.id, nomeDaCapa: capa.nome, lado, semente: s };
}

export const dadosDaCapa = (id: VariacaoDaCapa) => VARIACOES_DA_CAPA.find((c) => c.id === id) ?? VARIACOES_DA_CAPA[0];

/** Quem aparece na foto, pelo nicho ("roupas masculinas" → homens). */
export function modelosDaFoto(nicho: string): string {
  if (/masculin|homem|homens|men\b/i.test(nicho)) return "male models";
  if (/feminin|mulher|mulheres|lingerie|moda praia feminina/i.test(nicho)) return "female models";
  if (/infantil|crian[cç]a|kids|beb[eê]/i.test(nicho)) return "child models with a parent";
  return "models (men and women)";
}

/*
  Cena da foto da capa, montada por partes para não sair sempre igual (as
  campanhas de marcas grandes variam lado, quantas pessoas, pose, objeto e
  enquadramento): cenário da capa + quantas pessoas + pose + lado + look da
  moda. Tudo escolhido pela semente da loja (a mesma loja sempre igual) e pelo
  público. Nada de marca, texto ou logo na foto.
*/
type Publico = "masculino" | "feminino" | "infantil" | "misto";

const LOOKS: Record<Publico, string[]> = {
  masculino: [
    "relaxed tailoring: unstructured blazer over a plain tee, wide-leg pleated trousers, loafers",
    "oversized knit sweater, straight light-wash jeans, thin silver chain, sunglasses",
    "linen overshirt open over a tank top, relaxed chinos, suede loafers",
    "boxy cropped jacket, heavyweight tee, wide cargo pants, clean sneakers",
  ],
  feminino: [
    "oversized blazer over a slip dress, minimal gold jewelry, sunglasses",
    "fitted knit top, high-waist wide-leg tailored trousers, pointed flats",
    "cropped cardigan, long satin midi skirt, ballet flats",
    "oversized denim jacket, white tank top, straight jeans, chunky sneakers",
  ],
  infantil: [
    "soft cotton matching sets, clean sneakers, playful but tidy styling",
    "denim overalls, striped tees, canvas sneakers, relaxed and joyful",
  ],
  misto: [
    "relaxed tailoring and oversized knits, wide-leg trousers, minimal jewelry, sunglasses",
    "elevated basics: boxy tees, overshirts, straight jeans, loafers and clean sneakers",
    "quiet luxury: soft knits, tailored trousers, long coats, neutral leather accessories",
  ],
};

const LOOKS_FITNESS: Record<Exclude<Publico, "infantil">, string[]> = {
  feminino: [
    "matching sports bra and high-waist biker shorts set, chunky trainers",
    "seamless ribbed leggings set with an oversized zip jacket, trainers",
  ],
  masculino: [
    "fitted training tee, tapered joggers, running shoes",
    "sleeveless training top, technical shorts, trainers",
  ],
  misto: ["coordinated activewear sets in the palette, clean trainers"],
};

// Enquadramento sempre perto: corpo inteiro só quando a pessoa ocupa a altura toda.
const POSES_SOZINHO = [
  "walking toward the camera mid-stride, clothes in motion, filling the frame height",
  "seated on a low stool, elbows on knees, leaning toward the camera, knees up",
  "crouching low, one knee down, looking up past the camera, filling the frame height",
  "caught turning, looking back over the shoulder, from the thighs up",
  "leaning back on the wall, one leg bent, hands in pockets, from the thighs up",
  "holding a plain unbranded paper shopping bag, looking at the camera, knees up",
];
const POSES_SOZINHO_FITNESS = [
  "in a deep lunge holding a black dumbbell, hand on the knee, intense gaze, filling the frame",
  "seated on the floor in a wide stretch, torso turned to the camera",
  "mid-stretch, one arm overhead, looking away, from the thighs up",
  "kneeling beside a plain unbranded shopping bag and dumbbells, looking at the camera",
];
const POSES_DUPLA = [
  "back to back, both looking at the camera, from the thighs up",
  "one seated on a low block, the other standing behind, hand on their shoulder, knees up",
  "walking side by side mid-conversation, one laughing, from the knees up",
  "one close to the camera, the other a step behind and softly out of focus",
];
const POSES_DUPLA_FITNESS = [
  "one in a lunge with a dumbbell, the other stretching beside, filling the frame",
  "sitting on the floor side by side after training, relaxed, laughing",
];
// Grupo: gente de verdade junta (contato, conversa, alturas diferentes), nunca enfileirada.
const POSES_TRIO = [
  "laughing together, one with an arm around another, different heights, from the knees up",
  "one seated on a low block in front, two leaning in behind, close and relaxed, knees up",
  "a tight group, shoulders touching, one turned to another mid-talk, from the thighs up",
];
const POSES_INFANTIL = [
  "A child jumping mid-air with a parent laughing beside, filling the frame height",
  "A child on a parent's shoulders, both smiling, from the knees up",
  "A child and a parent walking hand in hand toward the camera, from the knees up",
];

// "Metade livre" fazia a IA dividir a imagem num painel liso: aqui o fundo é
// um só e continua até a outra borda (é ali que entra o título).
const ONDE: Record<LadoDaFoto, string> = {
  direita: "on the right; the same lit background continues unbroken to the left edge",
  esquerda: "on the left; the same lit background continues unbroken to the right edge",
  centro: "centered, the same background all around",
};

/*
  Direção de arte que vale para toda capa. Nasceu de uma capa ruim (trio de
  clones enfileirado, pequeno no quadro, metade da foto parede chapada com
  emenda, bloco cortado na borda, sombra sem origem, luz chapada): ver
  velo/06 Decisões/Imagem do tema gerada por IA.md.
*/
export const DIRECAO_DE_ARTE =
  "People fill most of the frame height, heads in the top third. Each person wears a different coordinated outfit; natural interaction. Directional light, real shadows. Candid.";

const QUANTOS = { 1: "One model", 2: "Two models", 3: "Three models" } as const;

function publicoDaFoto(nicho: string): Publico {
  const pessoas = modelosDaFoto(nicho);
  if (pessoas === "male models") return "masculino";
  if (pessoas === "female models") return "feminino";
  if (pessoas.startsWith("child")) return "infantil";
  return "misto";
}

const ehFitness = (nicho: string) => /fitness|academia|treino|esportiv|yoga|crossfit|corrida|activewear/i.test(nicho);

/** Limite do campo `scene` em generate-store-banner (passou disso, a função recusa). */
export const LIMITE_DA_CENA = 600;

export type CenaDaCapa = {
  texto: string;
  pessoas: 1 | 2 | 3;
  pose: string;
  cenario: string;
  /** Estilo criativo da loja: o mesmo cenário, luz e look valem para todas as imagens dela. */
  estilo: { nome: string; cenario: string; look: string; /** Quem aparece nos detalhes ("male model"), para não perder o público da loja. */ modelo: string };
};

const MODELO_DO_DETALHE: Record<Publico, string> = {
  masculino: "male model",
  feminino: "female model",
  infantil: "child model",
  misto: "model",
};

/** Cena completa pedida à IA. Sempre cabe em LIMITE_DA_CENA. */
export function cenaDaCapa(dados: { capa: VariacaoDaCapa; lado: LadoDaFoto; nicho: string; semente: number }): CenaDaCapa {
  const s = dados.semente;
  const capa = dadosDaCapa(dados.capa);
  const publico = publicoDaFoto(dados.nicho);
  const fitness = ehFitness(dados.nicho) && publico !== "infantil";
  const { cena: cenario, nome: nomeDoCenario } = escolher(capa.cenarios, s, 0x5ce1);
  const pessoas = publico === "infantil" ? 2 : escolher(capa.pessoas, s, 0xc0);
  const lista =
    publico === "infantil"
      ? POSES_INFANTIL
      : pessoas === 1
        ? fitness ? POSES_SOZINHO_FITNESS : POSES_SOZINHO
        : pessoas === 2
          ? fitness ? POSES_DUPLA_FITNESS : POSES_DUPLA
          : POSES_TRIO;
  const pose = escolher(lista, s, 0x905e);
  const quem = publico === "infantil" ? pose : `${QUANTOS[pessoas]}, ${pose}`;
  const looks = fitness ? LOOKS_FITNESS[publico as Exclude<Publico, "infantil">] : LOOKS[publico];
  const look = escolher(looks, s, 0x10c5);
  const texto = `${cenario} ${quem}, ${ONDE[dados.lado]}. Styling: ${look}, in the palette. ${DIRECAO_DE_ARTE}`;
  return { texto: texto.slice(0, LIMITE_DA_CENA), pessoas, pose, cenario, estilo: { nome: nomeDoCenario, cenario, look, modelo: MODELO_DO_DETALHE[publico] } };
}

/*
  Imagens pequenas da loja (cards de categoria e atalhos), no mesmo estilo
  criativo da capa: mesmo cenário, luz, paleta e look, como fotos da mesma
  campanha. São recortes fechados (a peça em foco, rosto fora), não outra capa.
*/
export const DIRECAO_DOS_DETALHES =
  "One single real photograph (never a web page, screenshot, mockup or collage). Same campaign, light and palette as the store hero. Tight editorial crop, the piece in sharp focus, real fabric texture, directional light, real shadows.";

/*
  Peça de cada categoria em inglês: o nome em português entre aspas fazia a IA
  desenhar uma página de loja com menu e texto inventados. A categoria nunca vai
  escrita na cena. `parte` = onde fica o recorte.
*/
type Parte = "pes" | "acessorio" | "cima" | "baixo" | "inteira";
const PECAS: [RegExp, string, Parte][] = [
  [/t[eê]nis|sneaker/i, "sneakers", "pes"],
  [/sand[aá]li/i, "sandals", "pes"],
  [/bota/i, "boots", "pes"],
  [/chinel/i, "slides", "pes"],
  [/mocassi/i, "loafers", "pes"],
  [/sapat|cal[cç]ad/i, "shoes", "pes"],
  [/bols/i, "bag", "acessorio"],
  [/bon[eé]/i, "cap", "acessorio"],
  [/chap[eé]u/i, "hat", "acessorio"],
  [/[oó]culos/i, "sunglasses", "acessorio"],
  [/rel[oó]gio/i, "watch", "acessorio"],
  [/cint/i, "belt", "acessorio"],
  [/colar/i, "necklace", "acessorio"],
  [/brinc/i, "earrings", "acessorio"],
  [/pulseir/i, "bracelet", "acessorio"],
  [/anel|an[eé]is/i, "rings", "acessorio"],
  [/carteir/i, "wallet", "acessorio"],
  [/mochil/i, "backpack", "acessorio"],
  [/len[cç]o/i, "scarf", "acessorio"],
  [/acess[oó]rio/i, "accessories", "acessorio"],
  [/camiset/i, "t-shirt", "cima"],
  [/camis/i, "shirt", "cima"],
  [/regat/i, "tank top", "cima"],
  [/blus/i, "blouse", "cima"],
  [/blazer/i, "blazer", "cima"],
  [/jaquet/i, "jacket", "cima"],
  [/casac/i, "coat", "cima"],
  [/moletom/i, "sweatshirt", "cima"],
  [/su[eé]ter|tric[oô]|tricot/i, "knit sweater", "cima"],
  [/cropped|\btops?\b/i, "top", "cima"],
  [/jeans/i, "jeans", "baixo"],
  [/cal[cç]a/i, "trousers", "baixo"],
  [/bermud|shorts?\b/i, "shorts", "baixo"],
  [/saia/i, "skirt", "baixo"],
  [/legging/i, "leggings", "baixo"],
  [/vestid/i, "dress", "inteira"],
  [/macac/i, "jumpsuit", "inteira"],
  [/terno|conjunto/i, "matching set", "inteira"],
  [/biqu[ií]ni|mai[oô]|praia/i, "swimwear", "inteira"],
  [/pijam/i, "pajamas", "inteira"],
];

/** Peça (em inglês) e recorte da foto de uma categoria; sem par conhecido, uma peça do próprio look. */
export function pecaDaCategoria(categoria: string): { peca: string; parte: Parte } {
  const achada = PECAS.find(([re]) => re.test(categoria));
  return achada ? { peca: achada[1], parte: achada[2] } : { peca: "the key piece of the look", parte: "inteira" };
}

function cenaDoDetalhe(estilo: CenaDaCapa["estilo"], tema: string, styling = estilo.look): string {
  const texto = `${estilo.cenario} ${tema}. Styling: ${styling}, in the palette. ${DIRECAO_DOS_DETALHES}`;
  return texto.slice(0, LIMITE_DA_CENA);
}

/** Cena da foto de um card de categoria, no estilo criativo da loja. */
export function cenaDaCategoria(estilo: CenaDaCapa["estilo"], categoria: string): string {
  const { peca, parte } = pecaDaCategoria(categoria);
  const quem = `one ${estilo.modelo}`;
  const tema: Record<Parte, string> = {
    pes: `Low close crop at ground level of ${quem}'s feet and lower legs wearing ${peca}, mid-step`,
    acessorio: `Close detail of the ${peca} worn or held by ${quem}, face out of frame`,
    cima: `Close crop of ${quem} from the shoulders to the hips, the ${peca} as the hero piece, fully visible with nothing covering it, face out of frame`,
    baixo: `Crop of ${quem} from the waist to the shoes, the ${peca} as the hero piece, fully visible`,
    inteira: `Crop of ${quem} from the shoulders to the knees, the ${peca} as the hero piece, face out of frame`,
  };
  // A peça manda no styling: com o look da capa (mesmo citado de leve) a IA vestia o blazer por cima da camisa.
  // O estilo continua no cenário, na luz e na paleta.
  const camada = parte === "cima" && !/blazer|jacket|coat/.test(peca) ? ", no jacket or layer over it" : "";
  return cenaDoDetalhe(estilo, tema[parte], `the ${peca} as the main garment${camada}, simple pieces around it`);
}

/** Cenas dos atalhos 1 (produtos) e 2 (contato); o atalho 0 usa a própria capa. */
export function cenasDosAtalhos(estilo: CenaDaCapa["estilo"]): [string, string] {
  return [
    cenaDoDetalhe(estilo, `Close crop of one ${estilo.modelo} from the chest to the knees, hands adjusting the outfit, face out of frame`),
    cenaDoDetalhe(estilo, `One ${estilo.modelo} from the waist up, walking and laughing, caught mid-step, relaxed and warm`),
  ];
}

type FotosDaLoja = {
  capa: string | null;
  itens: { titulo: string; categoria?: string | null; imagem: string | null }[];
  fotos?: { categorias?: Record<string, string>; atalhos?: (string | null)[] };
};

/** Foto do card de categoria: a de um produto real da categoria ou a gerada no estilo da loja. */
export function fotoDaCategoria(dados: FotosDaLoja, categoria: string): { src: string | null; gerada: boolean } {
  const real = dados.itens.find((i) => (i.categoria || categoriaDoProduto(i.titulo)) === categoria && i.imagem)?.imagem ?? null;
  if (real) return { src: real, gerada: false };
  const gerada = dados.fotos?.categorias?.[categoria] ?? null;
  return { src: gerada, gerada: !!gerada };
}

/** Foto do atalho i: 0 = capa; 1 e 2 = as geradas no estilo da loja ou, sem elas, a de um produto. */
export function fotoDoAtalho(dados: FotosDaLoja, i: number): { src: string | null; produto: boolean } {
  if (i === 0) return { src: dados.capa, produto: false };
  const gerada = dados.fotos?.atalhos?.[i] ?? null;
  if (gerada) return { src: gerada, produto: false };
  const produto = dados.itens[i - 1]?.imagem ?? null;
  return { src: produto, produto: !!produto };
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
