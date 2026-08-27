import { supabase, supabaseAnonKey, supabaseUrl } from "@/integrations/supabase/client";

/**
 * Núcleo da publicação no Mercado Livre.
 *
 * Vive aqui, e não dentro do modal do catálogo, porque agora existem dois
 * lugares que publicam: o modal de sempre e o Atlas, que conduz a publicação
 * dentro da própria conversa. Inferência de marca, montagem de atributos e a
 * chamada da `ml-publish` precisam ser as mesmas nos dois — um anúncio publicado
 * pelo chat não pode sair diferente do publicado pelo catálogo.
 */

export type ProdutoDoCatalogo = {
  id: string;
  title: string;
  description: string | null;
  // O catálogo grava `images`, `variants` e `ml_attributes` como json solto; o
  // formato varia por fornecedor e é normalizado na hora do uso.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  images: any;
  cost_price: number;
  suggested_price: number;
  margin_percent: number;
  category: string | null;
  source: string;
  original_url?: string;
  stock_quantity?: number | null;
  external_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variants?: any;
  brand?: string | null;
  model?: string | null;
  supplier_name?: string | null;
  weight?: number | null;
  product_url?: string | null;
};

/** Teto de caracteres do título de anúncio no Mercado Livre. */
export const MAX_TITULO_ML = 60;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const KNOWN_BRANDS: Array<{ label: string; patterns: string[] }> = [
  { label: "Panini", patterns: ["panini"] },
  { label: "X-Cell", patterns: ["x-cell", "x cell", "xcell"] },
  { label: "Laikou", patterns: ["laikou"] },
  { label: "Hegai", patterns: ["hegai"] },
  { label: "Vortita", patterns: ["vortita"] },
  { label: "Queen Oil", patterns: ["queen oil", "queenoil"] },
  { label: "OleAura", patterns: ["oleaura", "ole aura"] },
  { label: "Samsung", patterns: ["samsung"] },
  { label: "Apple", patterns: ["apple", "iphone", "ipad", "macbook"] },
  { label: "Xiaomi", patterns: ["xiaomi", "redmi", "poco"] },
  { label: "Motorola", patterns: ["motorola", "moto g", "moto e"] },
  { label: "LG", patterns: ["lg"] },
  { label: "Philips", patterns: ["philips"] },
  { label: "Mondial", patterns: ["mondial"] },
  { label: "Britânia", patterns: ["britania"] },
  { label: "Philco", patterns: ["philco"] },
  { label: "Cadence", patterns: ["cadence"] },
  { label: "Oster", patterns: ["oster"] },
  { label: "Arno", patterns: ["arno"] },
  { label: "Tramontina", patterns: ["tramontina"] },
  { label: "Stanley", patterns: ["stanley"] },
  { label: "JBL", patterns: ["jbl"] },
  { label: "Sony", patterns: ["sony"] },
  { label: "Intelbras", patterns: ["intelbras"] },
  { label: "Multilaser", patterns: ["multilaser"] },
  { label: "Positivo", patterns: ["positivo"] },
  { label: "Logitech", patterns: ["logitech"] },
  { label: "Baseus", patterns: ["baseus"] },
  { label: "Ugreen", patterns: ["ugreen"] },
  { label: "Anker", patterns: ["anker"] },
  { label: "Lenovo", patterns: ["lenovo"] },
  { label: "Dell", patterns: ["dell"] },
  { label: "HP", patterns: ["hp"] },
  { label: "Canon", patterns: ["canon"] },
  { label: "Epson", patterns: ["epson"] },
  { label: "Elgin", patterns: ["elgin"] },
  { label: "WAP", patterns: ["wap"] },
  { label: "Karcher", patterns: ["karcher", "kärcher"] },
  { label: "Black+Decker", patterns: ["black+decker", "black decker", "black-decker"] },
  { label: "Fisher-Price", patterns: ["fisher-price", "fisher price"] },
  { label: "Hot Wheels", patterns: ["hot wheels"] },
  { label: "Barbie", patterns: ["barbie"] },
  { label: "Lego", patterns: ["lego"] },
  { label: "Hasbro", patterns: ["hasbro"] },
  { label: "Mattel", patterns: ["mattel"] },
  { label: "Nike", patterns: ["nike"] },
  { label: "Adidas", patterns: ["adidas"] },
  { label: "Puma", patterns: ["puma"] },
  { label: "Olympikus", patterns: ["olympikus"] },
  { label: "Mizuno", patterns: ["mizuno"] },
  { label: "Asics", patterns: ["asics"] },
  { label: "Havaianas", patterns: ["havaianas"] },
  { label: "Crocs", patterns: ["crocs"] },
  { label: "Nivea", patterns: ["nivea", "nívea"] },
  { label: "L'Oréal", patterns: ["loreal", "l'oreal", "l'oréal"] },
  { label: "Garnier", patterns: ["garnier"] },
  { label: "Maybelline", patterns: ["maybelline"] },
  { label: "Ruby Rose", patterns: ["ruby rose"] },
  { label: "Macrilan", patterns: ["macrilan"] },
  { label: "Vult", patterns: ["vult"] },
  { label: "Eudora", patterns: ["eudora"] },
  { label: "Natura", patterns: ["natura"] },
  { label: "O Boticário", patterns: ["o boticario", "boticario"] },
  { label: "Avon", patterns: ["avon"] },
  { label: "Pantene", patterns: ["pantene"] },
  { label: "Dove", patterns: ["dove"] },
  { label: "Oral-B", patterns: ["oral-b", "oral b"] },
  { label: "Colgate", patterns: ["colgate"] },
  { label: "Gillette", patterns: ["gillette"] },
];

export const GENERIC_BRAND = "Genérica";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasBrandPattern = (haystack: string, pattern: string) => {
  const normalizedPattern = normalizeText(pattern);
  if (/^[a-z0-9]{1,3}$/.test(normalizedPattern)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedPattern)}([^a-z0-9]|$)`).test(haystack);
  }
  return haystack.includes(normalizedPattern);
};

const cleanBrandCandidate = (value: string | null | undefined) => {
  const cleaned = (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[:"'`´\-–—\s]+|[:"'`´\-–—\s]+$/g, "")
    .replace(/\b(modelo|model|produto|product)\b.*$/i, "")
    .trim();

  const normalized = normalizeText(cleaned);
  const invalid = [
    "c7drop",
    "c7 drop",
    "fornecedor",
    "fornecedor verificado",
    "sem marca",
    "nao informado",
    "não informado",
    "generico",
    "genérico",
  ];

  if (!cleaned || cleaned.length > 36 || invalid.includes(normalized)) return "";
  if (/^(maquina|descascador|caixa|kit|suporte|envelope|produto|album|figurinha)\b/i.test(cleaned)) return "";
  return cleaned;
};

const extractExplicitBrand = (value: string) => {
  const match = value.match(/\b(?:marca|brand)\s*[:\-–—]\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9&+.'’\-\s]{1,34})/i);
  return cleanBrandCandidate(match?.[1]);
};

/** Quantas vezes o custo a Velo sugere cobrar. É também o valor inicial do slider. */
export const MULTIPLICADOR_SUGERIDO = 2.5;

export const isStickerAlbumProduct = (product: ProdutoDoCatalogo | null, title: string) => {
  const haystack = normalizeText(`${title} ${product?.title ?? ""} ${product?.category ?? ""}`);
  return (
    haystack.includes("figurinha") ||
    haystack.includes("album") ||
    haystack.includes("copa do mundo") ||
    haystack.includes("fifa")
  );
};

export const inferProductBrand = (product: ProdutoDoCatalogo | null, title: string) => {
  const savedBrand = cleanBrandCandidate(product?.brand);
  if (savedBrand) return savedBrand;

  const sourceText = [
    title,
    product?.title,
    product?.description,
    product?.category,
    product?.supplier_name,
  ].filter(Boolean).join(" ");

  if (isStickerAlbumProduct(product, title)) return "Panini";

  const explicitBrand = extractExplicitBrand(sourceText);
  if (explicitBrand) return explicitBrand;

  const normalizedSource = normalizeText(sourceText);
  const knownBrand = KNOWN_BRANDS.find((entry) =>
    entry.patterns.some((pattern) => hasBrandPattern(normalizedSource, pattern))
  );
  if (knownBrand) return knownBrand.label;

  const supplierBrand = cleanBrandCandidate(product?.supplier_name);
  if (supplierBrand) return supplierBrand;

  return GENERIC_BRAND;
};

export const inferStickerAlbumName = (product: ProdutoDoCatalogo | null, title: string) => {
  const haystack = normalizeText(`${title} ${product?.title ?? ""}`);
  if (haystack.includes("fifa") || haystack.includes("copa do mundo")) return "Copa do Mundo FIFA 2026";
  return "Álbum colecionável";
};

// ── Imagens ─────────────────────────────────────────────────────────────────

/** O catálogo grava `images` ora como array, ora como string json. */
export const listaDeImagens = (images: unknown): string[] => {
  try {
    const bruto = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(bruto) ? bruto.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export const primeiraImagemDoProduto = (images: unknown): string | null => listaDeImagens(images)[0] ?? null;

// ── Atributos do anúncio ────────────────────────────────────────────────────

export type AtributoMl = { id: string; value_id?: string; value_name?: string };

/** "Unidade" e "Kit" têm id fixo no Mercado Livre. */
const FORMATO_DE_VENDA = {
  unit: { id: "SALE_FORMAT", value_id: "1359391", value_name: "Unidade" },
  kit: { id: "SALE_FORMAT", value_id: "1359392", value_name: "Kit" },
} as const;

export type FormatoDeVenda = keyof typeof FORMATO_DE_VENDA;

/**
 * Atributos obrigatórios do anúncio.
 *
 * Marca e modelo o Mercado Livre exige em boa parte das categorias; nome do
 * álbum e formato de venda só entram em figurinhas, onde a publicação é
 * recusada sem eles.
 */
export const montarAtributosMl = (dados: {
  marca?: string;
  modelo?: string;
  nomeDoAlbum?: string;
  formatoDeVenda?: FormatoDeVenda;
  exigeAtributosDeAlbum?: boolean;
}): AtributoMl[] => [
  ...(dados.marca?.trim() ? [{ id: "BRAND", value_name: dados.marca.trim() }] : []),
  ...(dados.modelo?.trim() ? [{ id: "MODEL", value_name: dados.modelo.trim() }] : []),
  ...(dados.exigeAtributosDeAlbum && dados.nomeDoAlbum?.trim()
    ? [{ id: "ALBUM_NAME", value_name: dados.nomeDoAlbum.trim() }]
    : []),
  ...(dados.exigeAtributosDeAlbum ? [{ ...FORMATO_DE_VENDA[dados.formatoDeVenda ?? "unit"] }] : []),
];

// ── Publicação ──────────────────────────────────────────────────────────────

/**
 * Erro de publicação com o código que a `ml-publish` devolve.
 *
 * O código importa: `ML_SELLER_CANNOT_LIST` abre o tutorial de verificação da
 * conta, e os de categoria pedem outra mensagem. Sem ele, quem chama só teria
 * um texto solto para tentar interpretar.
 */
export class ErroDePublicacao extends Error {
  codigo?: string;
  /**
   * Códigos crus que o Mercado Livre devolve quando bloqueia a conta do
   * vendedor (ex.: "address_pending", "phone_pending"). É com eles que a UI
   * monta o modal explicando exatamente o que falta preencher no cadastro.
   */
  sellerCodes?: string[];

  constructor(mensagem: string, codigo?: string, sellerCodes?: string[]) {
    super(mensagem);
    this.name = "ErroDePublicacao";
    this.codigo = codigo;
    this.sellerCodes = sellerCodes;
  }
}

export type ResultadoDaPublicacao = { permalink: string; item_id: string };

export type DadosDaPublicacao = {
  produto: ProdutoDoCatalogo;
  titulo: string;
  preco: number;
  descricao: string;
  marca: string;
  modelo: string;
  atributos: AtributoMl[];
  /** Teto de 10 unidades por anúncio, igual ao modal do catálogo. */
  estoque: number;
  override?: { categoryId?: string; sizeGridId?: string };
};

/**
 * Publica o anúncio chamando a Edge Function `ml-publish`.
 *
 * Usa `fetch` direto em vez de `supabase.functions.invoke` de propósito: o
 * invoke consome o corpo da resposta em status não-2xx (o Response já chega
 * drenado dentro do FunctionsHttpError), e aí o código do erro
 * (CATEGORY_REQUIRES_MANUAL, ML_SELLER_CANNOT_LIST) se perde. Com fetch, status
 * e corpo saem de uma leitura só.
 */
export const publicarNoMercadoLivre = async (dados: DadosDaPublicacao): Promise<ResultadoDaPublicacao> => {
  const { produto } = dados;
  const { data: sessao } = await supabase.auth.getSession();
  const accessToken = sessao?.session?.access_token ?? supabaseAnonKey;

  const corpo = {
    product: {
      id: produto.id,
      external_id: produto.external_id,
      cj_product_id: null,
      cj_product_url: produto.original_url ?? null,
      cj_variant_id: null,
      title: dados.titulo.trim(),
      price: dados.preco,
      cost_price: produto.cost_price ?? 0,
      description: dados.descricao || `${dados.titulo} - Produto de alta qualidade com envio rápido.`,
      images: listaDeImagens(produto.images),
      available_quantity: Math.min(dados.estoque, 10),
      condition: "new",
      brand: dados.marca.trim() || null,
      model: dados.modelo.trim() || null,
      ml_attributes: dados.atributos,
      weight: typeof produto.weight === "number" ? produto.weight : null,
      product_url: produto.product_url ?? null,
      override_category_id: dados.override?.categoryId,
      size_grid_id: dados.override?.sizeGridId,
    },
  };

  let status = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta da função, formato varia por erro
  let resposta: any = null;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ml-publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(corpo),
    });
    status = res.status;
    const bruto = await res.text();
    try {
      resposta = bruto ? JSON.parse(bruto) : null;
    } catch {
      resposta = { raw: bruto };
    }
  } catch (erroDeRede) {
    throw new ErroDePublicacao(
      erroDeRede instanceof Error ? erroDeRede.message : "Erro de rede ao publicar",
      "NETWORK",
    );
  }

  if (status < 200 || status >= 300 || resposta?.error) {
    const sellerCodes = Array.isArray(resposta?.seller_codes)
      ? resposta.seller_codes.filter((c: unknown): c is string => typeof c === "string")
      : undefined;
    throw new ErroDePublicacao(
      resposta?.error || resposta?.message || "Erro ao publicar",
      resposta?.code,
      sellerCodes,
    );
  }

  return { permalink: resposta?.permalink, item_id: resposta?.item_id };
};

/** Mensagem de erro pronta para o usuário, a partir do código da `ml-publish`. */
export const mensagemDoErroDePublicacao = (erro: unknown): string => {
  if (erro instanceof ErroDePublicacao) {
    if (erro.codigo === "CATEGORY_REQUIRES_MANUAL" || erro.codigo === "CATEGORY_LOW_CONFIDENCE") {
      return "Não foi possível publicar este produto no Mercado Livre no momento. Tente outro produto.";
    }
    return erro.message;
  }
  return erro instanceof Error ? erro.message : "Erro inesperado ao publicar";
};

// ── Descrição com IA ────────────────────────────────────────────────────────

/**
 * Descrição de anúncio escrita pela IA.
 *
 * O prompt é o mesmo do modal do catálogo, para o texto sair no mesmo padrão
 * independentemente de onde a pessoa publicou.
 */
export const gerarDescricaoComIa = async (dados: {
  titulo: string;
  categoria?: string | null;
  preco: number;
}): Promise<string> => {
  const preco = dados.preco.toFixed(2).replace(".", ",");
  const categoria = dados.categoria || "Não informada";
  const prompt = `Você é um especialista em copywriting para e-commerce brasileiro.
Gere uma descrição de produto persuasiva e completa para o Mercado Livre
com base nestas informações:

Nome: ${dados.titulo}
Categoria: ${categoria}
Preço: R$ ${preco}

A descrição deve ter:
- 4 a 6 parágrafos
- Parágrafo 1: apresentação do produto e principal benefício
- Parágrafo 2: características técnicas e diferenciais
- Parágrafo 3: para quem é indicado e situações de uso
- Parágrafo 4: garantia de qualidade e satisfação
- Parágrafo 5: call-to-action persuasivo
- Tom: confiante, vendedor e acessível
- Idioma: português brasileiro
- Não use bullet points, escreva em parágrafos corridos
- Mínimo 300 palavras

Retorne APENAS a descrição, sem introdução, sem comentários.`;

  const { data, error } = await supabase.functions.invoke("chat", {
    body: { mode: "product_description", messages: [{ role: "user", content: prompt }] },
  });

  if (error) {
    // O motivo real fica no console; o usuário recebe algo acionável.
    console.warn("[gerar-descricao] falha:", error);
    throw new Error("Erro ao gerar descrição. Tente novamente em instantes.");
  }

  const texto = data?.response || data?.choices?.[0]?.message?.content || "";
  if (typeof texto !== "string" || !texto.trim()) {
    throw new Error("Não foi possível gerar a descrição agora.");
  }
  return texto.trim();
};

