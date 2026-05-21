// Edge Function: get-curated-products
// Busca produtos populares do CJ Dropshipping, calcula margem (preço sugerido = custo × 2.2)
// e retorna os top 3 com melhor combinação de volume de vendas + margem >= 30%.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_MULTIPLIER = 2.2;
const USD_TO_BRL = 5.0;
const MIN_MARGIN = 30;
const MIN_FETCH = 20;
const TOP_N = 3;

type CJProduct = {
  pid?: string;
  productSku?: string;
  productNameEn?: string;
  productName?: string;
  productImage?: string;
  productImageSet?: string;
  sellPrice?: number | string;
  categoryName?: string;
  listedNum?: number | string;
};

type Curated = {
  id: string;
  name: string;
  image: string;
  cost: number;
  suggested_price: number;
  margin_percent: number;
  category: string;
};

async function getCJToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: cached } = await supabase
    .from("cj_token_cache")
    .select("*")
    .eq("id", 1)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return cached.access_token as string;
  }

  const apiKey = Deno.env.get("CJ_API_KEY");
  if (!apiKey) throw new Error("CJ_API_KEY não configurada");

  const res = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    },
  );
  const json = await res.json();
  if (!json?.result || json?.code !== 200) {
    throw new Error("Falha ao autenticar na CJ: " + JSON.stringify(json));
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("cj_token_cache").upsert({
    id: 1,
    access_token: json.data.accessToken,
    refresh_token: json.data.refreshToken,
    expires_at: expiresAt,
  });

  return json.data.accessToken as string;
}

function parseFirstImage(p: CJProduct): string {
  if (p.productImage) return p.productImage;
  if (p.productImageSet) {
    const first = p.productImageSet.split(/[,;]/)[0]?.trim();
    if (first) return first;
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const accessToken = await getCJToken(supabase);

    // Busca produtos populares (ordenados por vendas/listagens)
    const url = new URL("https://developers.cjdropshipping.com/api2.0/v1/product/list");
    url.searchParams.set("pageNum", "1");
    url.searchParams.set("pageSize", String(Math.max(MIN_FETCH, 40)));

    const cjRes = await fetch(url.toString(), {
      method: "GET",
      headers: { "CJ-Access-Token": accessToken, "Content-Type": "application/json" },
    });
    const cjJson = await cjRes.json();

    if (!cjJson?.result || cjJson?.code !== 200) {
      throw new Error("CJ retornou erro: " + JSON.stringify(cjJson).slice(0, 300));
    }

    const list: CJProduct[] = cjJson?.data?.list ?? [];

    const curated: (Curated & { _sales: number; _score: number })[] = list
      .map((p) => {
        const costUsd = Number(p.sellPrice ?? 0);
        if (!costUsd || costUsd <= 0) return null;
        const cost = +(costUsd * USD_TO_BRL).toFixed(2);
        const suggested = +(cost * PRICE_MULTIPLIER).toFixed(2);
        const margin = Math.round(((suggested - cost) / suggested) * 100);
        const sales = Number(p.listedNum ?? 0);
        const image = parseFirstImage(p);
        if (!image) return null;
        return {
          id: String(p.pid ?? p.productSku ?? crypto.randomUUID()),
          name: p.productNameEn || p.productName || "Produto sem nome",
          image,
          cost,
          suggested_price: suggested,
          margin_percent: margin,
          category: p.categoryName || "Geral",
          _sales: sales,
          _score: sales * 0.6 + margin * 0.4,
        };
      })
      .filter((p): p is Curated & { _sales: number; _score: number } =>
        p !== null && p.margin_percent >= MIN_MARGIN,
      )
      .sort((a, b) => b._score - a._score)
      .slice(0, TOP_N);

    const products: Curated[] = curated.map(({ _sales, _score, ...rest }) => rest);

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-curated-products] erro:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
