export type ValidatedNiche = {
  id: string;
  label: string;
  aliases: string[];
  catalogTerms: string[];
  marketQuery: string;
};

export type MarketSignal = {
  nicheId: string;
  label: string;
  source: "mercado_livre_public_search" | "internal_catalog_fallback";
  demand: number;
  competition: number;
  score: number;
  note: string;
};

export const BEGINNER_GUIDE_VERSION = "2026-08-05";

export const VALIDATED_NICHES: ValidatedNiche[] = [
  {
    id: "roupas",
    label: "Roupas",
    aliases: ["roupa", "roupas", "moda", "vestuario", "vestuário"],
    catalogTerms: ["moda", "roupa", "vestuario", "camiseta", "blusa", "calca", "short"],
    marketQuery: "roupas femininas masculinas moda",
  },
  {
    id: "calcados",
    label: "Calçados",
    aliases: ["calcado", "calçado", "calcados", "calçados", "sapato", "tenis", "tênis", "sandalia", "sandália"],
    catalogTerms: ["calcado", "sapato", "tenis", "sandalia", "chinelo"],
    marketQuery: "calçados tênis sapatos sandálias",
  },
  {
    id: "acessorios",
    label: "Acessórios",
    aliases: ["acessorio", "acessório", "acessorios", "acessórios", "bolsa", "carteira", "relogio", "relógio"],
    catalogTerms: ["acessorio", "bolsa", "carteira", "relogio", "oculos"],
    marketQuery: "acessórios moda bolsas relógios",
  },
  {
    id: "pets",
    label: "Pets",
    aliases: ["pet", "pets", "cachorro", "gato", "animal"],
    catalogTerms: ["pet", "cachorro", "gato", "animal", "coleira", "brinquedo pet"],
    marketQuery: "produtos para pets cachorro gato",
  },
  {
    id: "bebes",
    label: "Bebês",
    aliases: ["bebe", "bebê", "bebes", "bebês", "infantil", "crianca", "criança"],
    catalogTerms: ["bebe", "infantil", "crianca", "maternidade", "brinquedo"],
    marketQuery: "produtos para bebê maternidade infantil",
  },
  {
    id: "cama-mesa-banho",
    label: "Cama, mesa e banho",
    aliases: ["cama mesa banho", "cama", "mesa", "banho", "toalha", "lencol", "lençol"],
    catalogTerms: ["cama", "mesa", "banho", "toalha", "lencol", "cozinha"],
    marketQuery: "cama mesa banho toalha lençol",
  },
  {
    id: "perfumaria",
    label: "Perfumaria",
    aliases: ["perfumaria", "perfume", "fragrancia", "fragrância"],
    catalogTerms: ["perfume", "perfumaria", "fragrancia", "aroma"],
    marketQuery: "perfumaria perfume fragrância",
  },
  {
    id: "beleza-cosmeticos",
    label: "Beleza e cosméticos",
    aliases: ["beleza", "cosmetico", "cosmético", "cosmeticos", "cosméticos", "maquiagem", "skincare"],
    catalogTerms: ["beleza", "cosmetico", "maquiagem", "skincare", "cuidados pessoais", "cabelo"],
    marketQuery: "beleza cosméticos maquiagem skincare",
  },
  {
    id: "decoracao",
    label: "Decoração",
    aliases: ["decoracao", "decoração", "decorar", "casa decoracao", "casa decoração"],
    catalogTerms: ["decoracao", "casa", "jardim", "organizador", "luminaria"],
    marketQuery: "decoração casa itens decorativos",
  },
  {
    id: "eletronicos-acessorios",
    label: "Eletrônicos e acessórios",
    aliases: ["eletronico", "eletrônico", "eletronicos", "eletrônicos", "gadget", "celular", "fone", "carregador"],
    catalogTerms: ["eletronico", "gadget", "celular", "fone", "carregador", "usb", "bluetooth"],
    marketQuery: "eletrônicos acessórios celular fone carregador",
  },
  {
    id: "esportivos",
    label: "Artigos esportivos",
    aliases: ["esporte", "esportivo", "esportivos", "fitness", "academia"],
    catalogTerms: ["esporte", "fitness", "academia", "treino", "yoga"],
    marketQuery: "artigos esportivos fitness academia",
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    aliases: ["ferramenta", "ferramentas", "parafusadeira", "furadeira"],
    catalogTerms: ["ferramenta", "parafusadeira", "furadeira", "chave", "reparo"],
    marketQuery: "ferramentas casa parafusadeira furadeira",
  },
  {
    id: "utilidades-domesticas",
    label: "Utilidades domésticas",
    aliases: ["utilidade", "utilidades", "utilidades domesticas", "utilidades domésticas", "cozinha", "organizacao", "organização"],
    catalogTerms: ["utilidade", "cozinha", "organizador", "limpeza", "casa", "domestico"],
    marketQuery: "utilidades domésticas cozinha organização",
  },
  {
    id: "camping",
    label: "Camping",
    aliases: ["camping", "acampamento", "trilha", "outdoor"],
    catalogTerms: ["camping", "acampamento", "trilha", "lanterna", "barraca"],
    marketQuery: "camping acampamento trilha acessórios",
  },
  {
    id: "jardinagem",
    label: "Jardinagem",
    aliases: ["jardinagem", "jardim", "plantas", "horta"],
    catalogTerms: ["jardinagem", "jardim", "plantas", "horta", "vaso"],
    marketQuery: "jardinagem jardim plantas horta",
  },
];

export const normalizeGuideText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const findValidatedNiche = (text: string): ValidatedNiche | null => {
  const normalized = normalizeGuideText(text);
  let best: { niche: ValidatedNiche; score: number } | null = null;

  for (const niche of VALIDATED_NICHES) {
    let score = 0;
    for (const alias of [niche.label, ...niche.aliases, ...niche.catalogTerms]) {
      const cleanAlias = normalizeGuideText(alias);
      if (normalized.includes(cleanAlias)) score += Math.max(2, cleanAlias.length / 4);
    }
    if (!best || score > best.score) best = { niche, score };
  }

  return best && best.score >= 2 ? best.niche : null;
};

export const beginnerNicheSuggestions = (signals: MarketSignal[], count = 5) =>
  [...signals]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((signal) => signal.label);

