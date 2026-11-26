/*
  Personalidade da marca, definida na conversa com o Atlas ("se a sua marca
  fosse uma pessoa, como ela seria?"). É o que faz duas lojas do mesmo nicho
  não saírem iguais: cada personalidade tem a sua voz (títulos, botões,
  chamada, frase), o seu jeito de título na vitrine e o clima das fotos.

  Exemplo do mesmo nicho com personalidades diferentes: uma loja fitness
  "minimalista" (estúdio cinza, fotos limpas, "Peças lisas · conferir agora")
  e outra "ousada" (contraste alto, frases curtas em caixa alta).

  Nada aqui promete frete, desconto, prazo ou número.
*/

export type Personalidade = "ousada" | "elegante" | "acolhedora" | "energia" | "minimalista";

export type Voz = {
  titulosDaCapa: [string, string][];
  botoes: string[];
  chamadaTitulos: string[];
  chamadaBotoes: string[];
  frases: string[];
};

export type DadosDaPersonalidade = {
  id: Personalidade;
  /** Rótulo do botão de resposta rápida (vai em `briefing.estilo`). */
  rotulo: string;
  /** Como a marca se comporta, numa linha (aparece na pergunta). */
  descricao: string;
  /** Clima das fotos, em inglês (vai no pedido da imagem). */
  clima: string;
  /** Use {nome} para o nome da loja. */
  voz: Voz;
};

export const PERSONALIDADES: DadosDaPersonalidade[] = [
  {
    id: "ousada",
    rotulo: "Ousada",
    descricao: "fala alto, frases curtas, chama atenção",
    clima: "bold, confident campaign: high contrast, punchy directional light, direct gaze, strong poses",
    voz: {
      titulosDaCapa: [["Sem pedir", "licença"], ["Feito pra", "chamar atenção"], ["Chegou", "pra ficar"]],
      botoes: ["Quero o meu", "Comprar agora"],
      chamadaTitulos: ["Monte o seu look!", "Ache o seu estilo!", "Vista {nome}!"],
      chamadaBotoes: ["Quero!", "Eu quero!"],
      frases: ["Ninguém passa despercebido de {nome}.", "Feita para quem não tem medo de aparecer."],
    },
  },
  {
    id: "elegante",
    rotulo: "Elegante",
    descricao: "discreta, sofisticada, poucas palavras",
    clima: "quiet luxury: soft diffused light, muted refined tones, calm composed poses, timeless",
    voz: {
      titulosDaCapa: [["A beleza", "do essencial"], ["Peças para", "durar"], ["Escolhas", "com cuidado"]],
      botoes: ["Descobrir a coleção", "Ver a coleção"],
      chamadaTitulos: ["O essencial, bem feito", "Para quem escolhe com calma", "Feito para durar"],
      chamadaBotoes: ["Descobrir", "Conhecer"],
      frases: ["Elegância é saber escolher. A {nome} escolhe com você.", "Poucas peças, bem escolhidas."],
    },
  },
  {
    id: "acolhedora",
    rotulo: "Acolhedora",
    descricao: "próxima, conversa como uma amiga que indica",
    clima: "warm and welcoming: golden natural light, genuine smiles, relaxed real moments, soft colors",
    voz: {
      titulosDaCapa: [["Do seu jeito,", "todo dia"], ["Feito pra você", "se sentir bem"], ["Pensado", "pra você"]],
      botoes: ["Vem ver", "Conhecer as peças"],
      chamadaTitulos: ["Vem montar o seu look", "Escolhe a sua favorita", "Feito pensando em você"],
      chamadaBotoes: ["Vem ver", "Quero ver"],
      frases: ["Na {nome}, cada peça foi escolhida pensando em você.", "Do jeito que você gosta, para usar todo dia."],
    },
  },
  {
    id: "energia",
    rotulo: "Cheia de energia",
    descricao: "vibrante, movimento, ritmo",
    clima: "energetic: dynamic movement caught mid-motion, crisp bright daylight, lively poses",
    voz: {
      titulosDaCapa: [["Movimento é", "o nosso estilo"], ["Energia", "que veste"], ["Bora", "pra cima"]],
      botoes: ["Bora ver", "Comprar agora"],
      chamadaTitulos: ["Bora montar o seu look!", "Energia que veste!", "Pra quem não para!"],
      chamadaBotoes: ["Bora!", "Quero!"],
      frases: ["Feita para acompanhar o seu ritmo.", "Pra quem não para: {nome}."],
    },
  },
  {
    id: "minimalista",
    rotulo: "Minimalista",
    descricao: "limpa, direta, sem excesso",
    clima: "minimal: clean seamless light-gray studio, simple styling, generous empty space, soft shadows",
    voz: {
      titulosDaCapa: [["Menos,", "melhor"], ["Só o que", "importa"], ["Simples", "assim"]],
      botoes: ["Ver peças", "Comprar"],
      chamadaTitulos: ["O essencial.", "Simples assim.", "Menos é mais."],
      chamadaBotoes: ["Ver peças", "Ver"],
      frases: ["Menos peças. Mais combinações.", "O básico, bem feito."],
    },
  },
];

const POR_ID = Object.fromEntries(PERSONALIDADES.map((p) => [p.id, p])) as Record<Personalidade, DadosDaPersonalidade>;
export const dadosDaPersonalidade = (id: Personalidade) => POR_ID[id];

const PALAVRAS: [Personalidade, RegExp][] = [
  ["ousada", /ousad|atrevid|chama aten|forte|marcante|rebeld|provocant|intens/i],
  ["elegante", /elegan|sofistic|luxo|cl[áa]ssic|refinad|discret|chique/i],
  ["acolhedora", /acolhed|pr[óo]xim|amig|carinh|aconcheg|calor|leve|natural|r[úu]stic/i],
  ["energia", /energ|vibrant|alegr|divertid|colorid|moviment|esport|animad|jovem/i],
  ["minimalista", /minimal|limp|simples|clean|b[áa]sic|modern|diret/i],
];

/** Lê a personalidade do rótulo ou do texto livre ("bem sofisticada" → elegante). Sem pista → null. */
export function personalidadeDe(texto = ""): Personalidade | null {
  // "Ousada (fala alto e é direta)": vale o rótulo do começo.
  const exato = PERSONALIDADES.find((p) => texto.trim().toLowerCase().startsWith(p.rotulo.toLowerCase()));
  if (exato) return exato.id;
  for (const [id, re] of PALAVRAS) if (re.test(texto)) return id;
  return null;
}

/**
 * Frase da pessoa sobre o diferencial da marca, pronta para a vitrine: no máximo
 * 140 caracteres, começa com maiúscula e termina com ponto. Usada como está:
 * são as palavras dela, não uma promessa inventada.
 */
export function fraseDoDiferencial(texto = ""): string | null {
  const limpo = texto.replace(/\s+/g, " ").trim().replace(/^(?:o\s+)?(?:diferencial|meu diferencial)\s*(?:[ée]|:)\s*/i, "").slice(0, 140).trim();
  if (limpo.length < 8) return null;
  const comMaiuscula = limpo[0].toUpperCase() + limpo.slice(1);
  return /[.!?]$/.test(comMaiuscula) ? comMaiuscula : `${comMaiuscula}.`;
}
