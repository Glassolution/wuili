import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` porque a factory do `vi.mock` sobe para o topo do arquivo e não
// enxerga uma const declarada normalmente aqui.
const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: { access_token: "token-de-teste" } } })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke: vi.fn() } },
  supabaseUrl: "https://projeto.supabase.co",
  supabaseAnonKey: "chave-anon",
}));

import {
  ErroDePublicacao,
  MAX_TITULO_ML,
  inferProductBrand,
  listaDeImagens,
  mensagemDoErroDePublicacao,
  montarAtributosMl,
  primeiraImagemDoProduto,
  publicarNoMercadoLivre,
  type ProdutoDoCatalogo,
} from "@/lib/publicacaoMercadoLivre";

/**
 * Este módulo é o que o modal do catálogo e o Atlas compartilham. Se ele mudar
 * de comportamento, um anúncio publicado pelo chat sai diferente do publicado
 * pelo catálogo — que é exatamente o que a extração veio evitar.
 */

const PRODUTO: ProdutoDoCatalogo = {
  id: "prod-1",
  title: "Fone Bluetooth TWS Com Case De Carga",
  description: null,
  images: '["https://exemplo.test/1.jpg","https://exemplo.test/2.jpg"]',
  cost_price: 40,
  suggested_price: 100,
  margin_percent: 60,
  category: "Fones de Ouvido",
  source: "c7drop",
  stock_quantity: 25,
  external_id: "ext-1",
  brand: null,
  model: "TWS-9",
  weight: 0.2,
  product_url: "https://fornecedor.test/p/1",
};

const publicar = (extra?: Partial<Parameters<typeof publicarNoMercadoLivre>[0]>) =>
  publicarNoMercadoLivre({
    produto: PRODUTO,
    titulo: " Fone Bluetooth TWS ",
    preco: 99.9,
    descricao: "Descrição completa do anúncio.",
    marca: "JBL",
    modelo: "TWS-9",
    atributos: montarAtributosMl({ marca: "JBL", modelo: "TWS-9" }),
    estoque: 25,
    ...extra,
  });

describe("listaDeImagens", () => {
  it("aceita json em string e array cru", () => {
    expect(listaDeImagens('["a","b"]')).toEqual(["a", "b"]);
    expect(listaDeImagens(["a"])).toEqual(["a"]);
  });

  it("devolve vazio no que não dá pra ler", () => {
    expect(listaDeImagens("nao é json")).toEqual([]);
    expect(listaDeImagens(null)).toEqual([]);
    expect(primeiraImagemDoProduto(null)).toBeNull();
  });
});

describe("montarAtributosMl", () => {
  it("manda marca e modelo quando existem", () => {
    expect(montarAtributosMl({ marca: " JBL ", modelo: "TWS-9" })).toEqual([
      { id: "BRAND", value_name: "JBL" },
      { id: "MODEL", value_name: "TWS-9" },
    ]);
  });

  it("omite o que veio em branco", () => {
    expect(montarAtributosMl({ marca: "JBL", modelo: "   " })).toEqual([{ id: "BRAND", value_name: "JBL" }]);
  });

  it("só inclui álbum e formato de venda em figurinhas", () => {
    const semAlbum = montarAtributosMl({ marca: "JBL", nomeDoAlbum: "Copa 2026" });
    expect(semAlbum.some((a) => a.id === "ALBUM_NAME")).toBe(false);
    expect(semAlbum.some((a) => a.id === "SALE_FORMAT")).toBe(false);

    const comAlbum = montarAtributosMl({
      marca: "Panini",
      nomeDoAlbum: "Copa 2026",
      formatoDeVenda: "kit",
      exigeAtributosDeAlbum: true,
    });
    expect(comAlbum).toContainEqual({ id: "ALBUM_NAME", value_name: "Copa 2026" });
    expect(comAlbum).toContainEqual({ id: "SALE_FORMAT", value_id: "1359392", value_name: "Kit" });
  });
});

describe("inferProductBrand", () => {
  it("reconhece marca conhecida no título", () => {
    expect(inferProductBrand(PRODUTO, "Fone JBL Tune 510")).toBe("JBL");
  });

  it("cai em Genérica quando não há pista nenhuma", () => {
    expect(inferProductBrand({ ...PRODUTO, model: null }, "Suporte articulado de mesa")).toBe("Genérica");
  });
});

describe("publicarNoMercadoLivre", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const responderCom = (status: number, corpo: unknown) => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status,
      text: async () => JSON.stringify(corpo),
    });
  };

  it("envia o anúncio com título aparado e estoque limitado a 10", async () => {
    responderCom(200, { permalink: "https://ml.test/MLB1", item_id: "MLB1" });

    const resultado = await publicar();

    expect(resultado).toEqual({ permalink: "https://ml.test/MLB1", item_id: "MLB1" });
    const [url, opcoes] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://projeto.supabase.co/functions/v1/ml-publish");
    const enviado = JSON.parse(opcoes.body).product;
    expect(enviado.title).toBe("Fone Bluetooth TWS");
    // Teto de 10 por anúncio, mesmo com 25 no catálogo.
    expect(enviado.available_quantity).toBe(10);
    expect(enviado.price).toBe(99.9);
    expect(enviado.cost_price).toBe(40);
    expect(enviado.images).toEqual(["https://exemplo.test/1.jpg", "https://exemplo.test/2.jpg"]);
    expect(opcoes.headers.Authorization).toBe("Bearer token-de-teste");
  });

  it("usa um texto padrão quando a descrição vem vazia", async () => {
    responderCom(200, { permalink: "p", item_id: "i" });

    await publicar({ descricao: "" });

    const enviado = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body).product;
    expect(enviado.description).toContain("Produto de alta qualidade");
  });

  it("preserva o código do erro devolvido pela função", async () => {
    responderCom(400, { error: "Conta não habilitada", code: "ML_SELLER_CANNOT_LIST" });

    await expect(publicar()).rejects.toMatchObject({
      codigo: "ML_SELLER_CANNOT_LIST",
      message: "Conta não habilitada",
    });
  });

  it("trata erro de rede como falha de publicação, não como sucesso", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));

    await expect(publicar()).rejects.toBeInstanceOf(ErroDePublicacao);
  });

  it("também falha quando a função responde 200 com erro no corpo", async () => {
    responderCom(200, { error: "Categoria não resolvida", code: "CATEGORY_LOW_CONFIDENCE" });

    await expect(publicar()).rejects.toMatchObject({ codigo: "CATEGORY_LOW_CONFIDENCE" });
  });
});

describe("mensagemDoErroDePublicacao", () => {
  it("troca os erros de categoria por uma orientação acionável", () => {
    expect(mensagemDoErroDePublicacao(new ErroDePublicacao("cru", "CATEGORY_REQUIRES_MANUAL"))).toMatch(
      /Tente outro produto/,
    );
  });

  it("repassa o texto dos demais erros", () => {
    expect(mensagemDoErroDePublicacao(new ErroDePublicacao("Preço inválido", "OUTRO"))).toBe("Preço inválido");
  });
});

describe("MAX_TITULO_ML", () => {
  it("segue o teto do Mercado Livre", () => {
    expect(MAX_TITULO_ML).toBe(60);
  });
});
