/*
  Briefing da loja montado na conversa com o Atlas.

  O Atlas pergunta, uma coisa por vez: que loja e do quê → já tem marca? →
  (com marca: cores da marca → fonte da marca) → pra quem é → personalidade
  da marca → (sem marca: cores) → diferencial → produtos próprios ou do
  catálogo da Velo. A personalidade (src/lib/personalidadeDaMarca.ts) muda a
  voz dos textos, o jeito dos títulos e o clima das fotos. Quem já tem marca não
  recebe paleta pronta: a loja usa as cores, a fonte e a logo dela. O briefing vai junto da mensagem
  do Atlas (`product_data.briefing`), então a conversa sabe em que etapa está
  só olhando a última resposta. Com tudo respondido, a resposta traz a ação
  `create_store` ("Criar meu site"), que abre o modal e depois a construção
  passo a passo (AtlasConstrucaoDaLoja).
*/

import { supabase, withFreshSupabaseSession } from "@/integrations/supabase/client";
import { proxyImageList } from "@/lib/imageProxy";
import { nomeDaCor } from "@/lib/nomeDaCor";
import { PERSONALIDADES } from "@/lib/personalidadeDaMarca";

export type TipoDeLoja = "fisico" | "infoproduto" | "curso" | "jogo" | "servico";
export type OrigemDosProdutos = "proprios" | "catalogo" | "ambos";
export type EtapaDoBriefing = "marca" | "publico" | "estilo" | "cores" | "fonte" | "diferencial" | "produtos" | "resumo" | "mudar";

/** Marca que a pessoa já tem. `fonte` null = não sabe (a loja escolhe pelo estilo). */
export type MarcaDaPessoa = { tem: boolean; fonte?: string | null };

export type BriefingDaLoja = {
  tipo: TipoDeLoja;
  ideia: string;
  nicho: string;
  termos: string[];
  /** Respondido na etapa "marca"; sem isso, a pergunta ainda não foi feita. */
  marca?: MarcaDaPessoa;
  /** Pra quem é a loja, nas palavras da pessoa; null = não sabe. */
  publico?: string | null;
  /** Personalidade da marca (rótulo de PERSONALIDADES ou texto livre). */
  estilo?: string;
  /** Por que comprariam dela, nas palavras da pessoa; null = pulou. */
  diferencial?: string | null;
  cores?: string;
  produtos?: OrigemDosProdutos;
  /** Quantos produtos do nicho o catálogo tem (null = não consultado). */
  noCatalogo?: number | null;
  etapa: EtapaDoBriefing;
  /** Mudando uma resposta a partir do resumo: depois dela, volta ao resumo. */
  revisando?: boolean;
};

export const ROTULO_DO_TIPO: Record<TipoDeLoja, string> = {
  fisico: "produtos físicos",
  infoproduto: "infoprodutos",
  curso: "cursos",
  jogo: "itens de jogos online",
  servico: "serviços",
};

/** Só produto físico existe no catálogo da Velo (fornecedores brasileiros). */
export const tipoUsaCatalogo = (tipo: TipoDeLoja) => tipo === "fisico";

const PALAVRAS_DO_TIPO: [TipoDeLoja, RegExp][] = [
  ["jogo", /\b(jogos?|games?|gamer|free ?fire|roblox|robux|minecraft|valorant|fortnite|lol|league of legends|cs ?2|csgo|gta|skins?|diamantes|gold|moedas? do jogo|itens? (de|do|em) jogos?|contas? de jogo|gift ?card)\b/i],
  ["curso", /\b(cursos?|aulas?|mentorias?|treinamentos?|ensinar|alunos?|membros|professora?)\b/i],
  ["infoproduto", /\b(infoprodutos?|e-?books?|ebooks?|pdfs?|planilhas?|templates?|modelos? prontos?|guias? digitais?|material digital|produtos? digita(l|is))\b/i],
  ["servico", /\b(servi[çc]os?|agendamentos?|consultorias?|consult[óo]rio|atendimentos?|freela|dentista|odonto|cl[íi]nica|psic[óo]log[oa]|nutricionista|advogad[oa]|manicure|barbearia|sal[ãa]o|est[ée]tica|fot[óo]graf[oa]|personal)\b/i],
];

export function detectarTipoDeLoja(texto: string): TipoDeLoja {
  for (const [tipo, regex] of PALAVRAS_DO_TIPO) if (regex.test(texto)) return tipo;
  return "fisico";
}

const SEM_SENTIDO = new Set([
  "quero", "queria", "gostaria", "criar", "montar", "fazer", "abrir", "vender", "venda", "vendas", "loja",
  "lojas", "site", "online", "uma", "um", "para", "pra", "meu", "minha", "meus", "minhas", "com", "sem",
  "produtos", "produto", "coisas", "tipo", "como", "começar", "comecar", "catalogo", "catálogo", "itens",
  "item", "todo", "toda", "todos", "mais", "muito", "bem", "isso", "esse", "essa", "sobre", "pelo", "pela",
]);

/** Quando a pessoa não diz do quê ("quero uma loja online"). */
export const NICHO_GERAL = "produtos variados";

/** "Quero criar uma loja de roupas fitness" → "roupas fitness". */
export function extrairNicho(ideia: string): string {
  const linha = ideia.split("\n")[0].trim();
  const padroes = [
    /\b(?:loja|site|cat[áa]logo|p[áa]gina)\s+(?:online\s+)?(?:de|da|do|das|dos|para|pra)\s+(.+)/i,
    /\b(?:vender|vendo|ofere[çc]o|oferecer)\s+(?:meus?\s+|minhas?\s+)?(.+)/i,
  ];
  for (const padrao of padroes) {
    const achado = linha.match(padrao)?.[1];
    if (achado) return limparNicho(achado) || NICHO_GERAL;
  }
  // Sem "de/para ...": tira o pedido em volta ("quero criar uma loja online") e vê se sobra algo.
  const resto = limparNicho(
    linha.replace(/^(?:eu\s+)?(?:quero|queria|gostaria\s+de|preciso\s+de|vou)?\s*(?:criar|montar|abrir|fazer|ter)?\s*(?:uma|um|a|o|minha|meu)?\s*(?:loja|site|neg[óo]cio|e-?commerce)?\s*(?:online|virtual|na\s+internet)?\s*/i, ""),
  );
  return resto || NICHO_GERAL;
}

/** "produtos do agro." → "agro" (evita "loja de produtos de produtos do agro"). */
const limparNicho = (texto: string) =>
  texto
    .replace(/[.!?;].*$/, "")
    .replace(/^(?:os\s+|as\s+)?(?:produtos?|itens?|coisas?|artigos?)\s+(?:de|do|da|dos|das|para|pra)\s+/i, "")
    .trim()
    .slice(0, 60);

/** Palavras do nicho para buscar no catálogo. Só letras e números: vai num filtro do PostgREST. */
export function termosDoNicho(nicho: string): string[] {
  const palavras = nicho
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !SEM_SENTIDO.has(p))
    .map((p) => (p.length > 4 && p.endsWith("s") && !p.endsWith("ss") ? p.slice(0, -1) : p));
  return Array.from(new Set(palavras)).slice(0, 3);
}

export function novoBriefing(ideia: string): BriefingDaLoja {
  const nicho = extrairNicho(ideia);
  return {
    tipo: detectarTipoDeLoja(ideia),
    ideia: ideia.slice(0, 500),
    nicho,
    termos: nicho === NICHO_GERAL ? [] : termosDoNicho(nicho),
    etapa: "marca",
  };
}

/* ----- Visual ----- */

/** Personalidades da marca (a pergunta do "estilo"); ver src/lib/personalidadeDaMarca.ts. */
export const ESTILOS = PERSONALIDADES.map((p) => p.rotulo);
export const PALETAS = ["Azul e branco", "Verde e bege", "Preto e dourado", "Rosa e lilás", "Laranja e creme"];

export const ESTILO_PADRAO: Record<TipoDeLoja, { estilo: string; cores: string }> = {
  fisico: { estilo: "Minimalista", cores: "Azul e branco" },
  infoproduto: { estilo: "Minimalista", cores: "Verde e bege" },
  curso: { estilo: "Acolhedora", cores: "Azul e branco" },
  jogo: { estilo: "Cheia de energia", cores: "Roxo e preto" },
  servico: { estilo: "Elegante", cores: "Preto e dourado" },
};

const CORES: [RegExp, string, string][] = [
  [/dourad/i, "#B08D57", "dourado"],
  [/azul/i, "#2563EB", "azul"],
  [/verde/i, "#3F6B3A", "verde"],
  [/rosa|pink/i, "#DB2777", "rosa"],
  [/lil[áa]s|roxo|violeta|lavanda/i, "#7C3AED", "roxo"],
  [/laranja/i, "#EA580C", "laranja"],
  [/vermelh/i, "#DC2626", "vermelho"],
  [/amarel/i, "#CA8A04", "amarelo"],
  [/bege|terros|marrom|caramelo|creme/i, "#8B5E3C", "terroso"],
  [/pret|black|escur/i, "#111111", "preto"],
];

/** Cor principal: a primeira cor citada na resposta (no "Preto e dourado", o dourado vira destaque). */
export function corPrincipal(cores = ""): { hex: string; nome: string } {
  // Cor escolhida no seletor ("Minhas cores: azul-marinho (#1E3A8A) e ..."): vale o primeiro código.
  const codigo = cores.match(/#[0-9a-f]{6}\b/i)?.[0];
  if (codigo) return { hex: codigo.toUpperCase(), nome: nomeDaCor(codigo) };
  if (/pret/i.test(cores) && /dourad/i.test(cores)) return { hex: "#B08D57", nome: "dourado" };
  let melhor: { indice: number; hex: string; nome: string } | null = null;
  for (const [regex, hex, nome] of CORES) {
    const indice = cores.search(regex);
    if (indice >= 0 && (!melhor || indice < melhor.indice)) melhor = { indice, hex, nome };
  }
  return melhor ? { hex: melhor.hex, nome: melhor.nome } : { hex: "#111111", nome: "preto" };
}

/** Cor de apoio (fundo): o segundo código escolhido no seletor, ou o creme/claro citado. */
export function corDeApoio(cores = ""): string | null {
  const codigos = cores.match(/#[0-9a-f]{6}\b/gi) ?? [];
  if (codigos[1]) return codigos[1].toUpperCase();
  if (codigos.length > 0) return null;
  if (/creme|bege|areia/i.test(cores)) return "#F5F0E6";
  return null;
}

/* ----- Marca que a pessoa já tem ----- */

/** "Já tenho" / "sim, a Botui" → true; "ainda não" / "vamos criar" → false; outra coisa → null. */
export function temMarca(texto: string): boolean | null {
  if (/\b(n[ãa]o|ainda|nenhuma|criar|cria|come[çc]ando|sem marca)\b/i.test(texto)) return false;
  if (/\b(sim|j[áa]|tenho|temos|possuo|claro|minha marca|uma marca)\b/i.test(texto)) return true;
  return null;
}

/**
 * Nome da fonte da marca ("montserrat" → "Montserrat"). Só letras, números e
 * espaço (vai na URL do Google Fonts). Não sabe → null.
 */
export function nomeDaFonte(texto: string): string | null {
  if (/n[ãa]o sei|escolhe|tanto faz|qualquer|n[ãa]o tenho|nenhuma/i.test(texto)) return null;
  const limpo = texto
    .replace(/^(?:a\s+)?(?:fonte|letra)(?:\s+(?:[ée]|da marca [ée]|que uso [ée]))?\s*:?\s*/i, "")
    .replace(/[^a-z0-9à-ÿ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  if (limpo.length < 2) return null;
  return limpo.replace(/\b([a-zà-ÿ])/g, (l) => l.toUpperCase());
}

/** Fonte da loja: a da marca, se a pessoa tiver; senão, a do estilo. */
export const fonteDaLoja = (b: Pick<BriefingDaLoja, "marca" | "estilo">) => b.marca?.fonte || fonteDoEstilo(b.estilo);

export function fonteDoEstilo(estilo = ""): string {
  if (/elegan|sofistic|cl[áa]ssic|luxo/i.test(estilo)) return "Georgia";
  if (/colorid|divertid|alegre|jovem|energ/i.test(estilo)) return "Plus Jakarta Sans";
  if (/natural|r[úu]stic|org[âa]nic|acolhed/i.test(estilo)) return "Helvetica Neue";
  return "Geist";
}

/** Os dois modelos de loja do editor: o 2 é o azul "mobile-first", o 1 é creme. */
export function modeloDaLoja(briefing: BriefingDaLoja): { id: string; nome: string } {
  return /azul/i.test(briefing.cores ?? "")
    ? { id: "loja-2", nome: "Marketly (azul, pensado para o celular)" }
    : { id: "loja-1", nome: "Vitrine clássica (fundo creme)" };
}

export function descreverProdutos(briefing: BriefingDaLoja): string {
  if (!tipoUsaCatalogo(briefing.tipo)) return "Seus próprios (o catálogo da Velo só tem produtos físicos)";
  if (briefing.produtos === "catalogo") return "Do catálogo da Velo, sem estoque";
  if (briefing.produtos === "ambos") return "Seus produtos e também do catálogo da Velo";
  return "Seus próprios produtos";
}

/* ----- Catálogo ----- */

export type ProdutoDoCatalogo = { id: string; title: string; imagem: string | null; preco: number | null; categoria: string | null };

/** Primeira foto de `catalog_products.images` (lista, ou lista em texto JSON). */
const primeiraImagem = (images: unknown): string | null => {
  let lista: unknown = images;
  if (typeof images === "string") {
    try {
      lista = JSON.parse(images);
    } catch {
      lista = [images];
    }
  }
  const url = Array.isArray(lista) ? lista.find((i): i is string => typeof i === "string" && i.trim().length > 0) : null;
  return url ? (proxyImageList([url])[0] ?? null) : null;
};

/** Produtos ativos e com estoque que combinam com o nicho (título ou categoria). */
export async function buscarNoCatalogo(termos: string[], limite = 8): Promise<ProdutoDoCatalogo[]> {
  const limpos = termos.map((t) => t.replace(/[^a-z0-9à-ÿ]/gi, "")).filter((t) => t.length >= 3);
  if (limpos.length === 0) return [];
  const { data, error } = await withFreshSupabaseSession(() =>
    supabase
      .from("catalog_products")
      .select("id,title,images,suggested_price,category")
      .eq("is_active", true)
      .eq("is_blocked", false)
      .gt("stock_quantity", 0)
      // Categoria que contém o termo, ou título que COMEÇA com ele: "Fone de ouvido" entra para
      // "fone", mas "Pastilha para máquina de lavar roupa" não entra para "roupa".
      .or(limpos.map((t) => `category.ilike.%${t}%,title.ilike.${t}%`).join(","))
      .order("orders_count", { ascending: false, nullsFirst: false })
      .limit(limite),
  );
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    imagem: primeiraImagem(p.images),
    preco: typeof p.suggested_price === "number" && p.suggested_price > 0 ? p.suggested_price : null,
    categoria: typeof p.category === "string" && p.category.trim() ? p.category.trim() : null,
  }));
}

/** Loja sem nicho ("produtos variados"): os mais vendidos do catálogo, ativos e com estoque. */
export async function buscarMaisVendidos(limite = 8): Promise<ProdutoDoCatalogo[]> {
  const { data, error } = await withFreshSupabaseSession(() =>
    supabase
      .from("catalog_products")
      .select("id,title,images,suggested_price,category")
      .eq("is_active", true)
      .eq("is_blocked", false)
      .gt("stock_quantity", 0)
      .order("orders_count", { ascending: false, nullsFirst: false })
      .limit(limite),
  );
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    imagem: primeiraImagem(p.images),
    preco: typeof p.suggested_price === "number" && p.suggested_price > 0 ? p.suggested_price : null,
    categoria: typeof p.category === "string" && p.category.trim() ? p.category.trim() : null,
  }));
}

/** Produtos para a loja: do nicho, ou os mais vendidos quando a pessoa não disse do quê. */
export const produtosParaALoja = (b: Pick<BriefingDaLoja, "nicho" | "termos">, limite = 8) =>
  b.nicho === NICHO_GERAL ? buscarMaisVendidos(limite) : buscarNoCatalogo(b.termos, limite);

/* ----- Pedido feito no modal "Criar meu site" ----- */

export type PedidoDeLoja = {
  briefing: BriefingDaLoja;
  nome: string;
  /** Logo reduzida (data URL, até 256px) ou null. */
  logo: string | null;
  descricao: string;
  /** Produtos ou serviços que a pessoa listou (um por linha), opcionais. */
  produtosPlanejados: string[];
};
