// Peso e medidas da embalagem — regra única usada tanto na publicação
// (ml-publish) quanto na correção em massa dos anúncios já no ar
// (ml-fix-dimensions). Sem estes dados o Mercado Livre aplica a tabela de
// "pacote grande" e o frete fica absurdo.

export type PesoMedidas = {
  weightGrams: number;
  dimsCm: [number, number, number];
  /** "AxBxC,cm" — formato dos atributos SELLER_PACKAGE_DIMENSIONS */
  dimsValName: string;
  /** "AxBxC,gramas" — formato de shipping.dimensions */
  shippingDimensions: string;
  weightValName: string;
  estimado: boolean;
};

const PESO_POR_CATEGORIA: Array<[RegExp, number]> = [
  [/beleza|cosm|maquiag|cabelo/, 0.2],
  [/moda|roupa|vestu|calc|acess/, 0.3],
  [/bebê|beb[eê]|crian/, 0.4],
  [/eletr[oô]n|gadget|fone|celular/, 0.5],
  [/pet/, 0.5],
  [/organiza|utilid/, 0.6],
  [/esport|lazer|fitness/, 0.8],
  [/casa|jardim|cozinh/, 0.8],
];

export function pesoPorCategoria(categoria: string | null | undefined): number {
  const cat = (categoria ?? "").toString().toLowerCase();
  const match = PESO_POR_CATEGORIA.find(([re]) => re.test(cat));
  return match ? match[1] : 0.4;
}

export function medidasPorPeso(rawWeightKg: number): [number, number, number] {
  if (rawWeightKg <= 0.3) return [20, 15, 5];
  if (rawWeightKg <= 1) return [25, 20, 10];
  if (rawWeightKg <= 3) return [35, 25, 15];
  if (rawWeightKg <= 6) return [40, 30, 20];
  return [50, 40, 30];
}

export function montarPesoMedidas(
  rawWeightKg: number | null | undefined,
  categoria?: string | null,
): PesoMedidas {
  const estimado = !(typeof rawWeightKg === "number" && rawWeightKg > 0);
  const peso = estimado ? pesoPorCategoria(categoria) : (rawWeightKg as number);
  const weightGrams = Math.max(50, Math.round(peso * 1000));
  const dimsCm = medidasPorPeso(peso);
  return {
    weightGrams,
    dimsCm,
    dimsValName: `${dimsCm[0]}x${dimsCm[1]}x${dimsCm[2]},cm`,
    shippingDimensions: `${dimsCm[0]}x${dimsCm[1]}x${dimsCm[2]},${weightGrams}`,
    weightValName: `${weightGrams} g`,
    estimado,
  };
}

type ItemML = {
  shipping?: { dimensions?: string | null } | null;
  attributes?: Array<{ id?: string; value_name?: string | null }> | null;
};

/** Um anúncio só é considerado OK quando tem medidas E peso gravados no ML. */
export function anuncioTemMedidas(item: ItemML | null | undefined): boolean {
  const dims = item?.shipping?.dimensions;
  const attrs = item?.attributes ?? [];
  const get = (id: string) =>
    attrs.find((a) => String(a?.id ?? "").toUpperCase() === id)?.value_name ?? null;
  const attrDims = get("SELLER_PACKAGE_DIMENSIONS");
  const attrPeso = get("SELLER_PACKAGE_WEIGHT");
  const temDims = Boolean(
    (typeof dims === "string" && /\d+x\d+x\d+/.test(dims)) ||
      (typeof attrDims === "string" && /\d+x\d+x\d+/.test(attrDims)),
  );
  const temPeso = Boolean(
    (typeof dims === "string" && /,\s*\d+/.test(dims)) ||
      (typeof attrPeso === "string" && /\d/.test(attrPeso)),
  );
  return temDims && temPeso;
}

export type ResultadoGarantia = {
  ok: boolean;
  jaEstavaOk: boolean;
  corrigido: boolean;
  antes: string | null;
  depois: string | null;
  erro?: string;
};

/**
 * Lê o anúncio no ML; se estiver sem peso/medidas, envia a correção e lê de
 * novo para confirmar. Só faz GET e PUT dos campos de embalagem — não toca em
 * preço, título, fotos ou estoque.
 */
export async function garantirMedidasNoAnuncio(
  accessToken: string,
  itemId: string,
  pacote: PesoMedidas,
): Promise<ResultadoGarantia> {
  const ler = async (): Promise<ItemML | null> => {
    const res = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      console.log(`[mlPackage] GET ${itemId} falhou: ${res.status}`);
      return null;
    }
    return (await res.json()) as ItemML;
  };

  const antesItem = await ler();
  if (!antesItem) {
    return { ok: false, jaEstavaOk: false, corrigido: false, antes: null, depois: null, erro: "não foi possível ler o anúncio no Mercado Livre" };
  }
  const antes = antesItem.shipping?.dimensions ?? null;
  if (anuncioTemMedidas(antesItem)) {
    return { ok: true, jaEstavaOk: true, corrigido: false, antes, depois: antes };
  }

  const body = {
    shipping: { dimensions: pacote.shippingDimensions },
    attributes: [
      { id: "SELLER_PACKAGE_WEIGHT", value_name: pacote.weightValName },
      { id: "SELLER_PACKAGE_DIMENSIONS", value_name: pacote.dimsValName },
    ],
  };
  const put = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!put.ok) {
    const txtCombinado = await put.clone().text().catch(() => "");
    console.log(`[mlPackage] PUT combinado ${itemId} status=${put.status} ${txtCombinado.slice(0, 300)}`);
    // Algumas categorias recusam o PUT combinado; tenta só os atributos.
    const putAttrs = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: body.attributes }),
    });
    if (!putAttrs.ok) {
      const erro = await putAttrs.text().catch(() => "");
      return {
        ok: false,
        jaEstavaOk: false,
        corrigido: false,
        antes,
        depois: null,
        erro: `Mercado Livre recusou a atualização das medidas (${putAttrs.status}) ${erro.slice(0, 300)}`,
      };
    }
  }

  const depoisItem = await ler();
  const depois = depoisItem?.shipping?.dimensions ?? null;
  const ok = anuncioTemMedidas(depoisItem);
  if (!ok) {
    const attrsPacote = (depoisItem?.attributes ?? []).filter((a) =>
      String(a?.id ?? "").startsWith("SELLER_PACKAGE")
    );
    console.log(
      `[mlPackage] pos-PUT ${itemId} putStatus=${put.status} shipping.dimensions=${depois} attrs=${JSON.stringify(attrsPacote)}`,
    );
  }
  return {
    ok,
    jaEstavaOk: false,
    corrigido: ok,
    antes,
    depois,
    ...(ok ? {} : { erro: "o anúncio continuou sem peso/medidas após a correção" }),
  };
}

/** Pausa o anúncio — usado quando não foi possível gravar peso/medidas. */
export async function pausarAnuncio(accessToken: string, itemId: string): Promise<boolean> {
  const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "paused" }),
  });
  return res.ok;
}
