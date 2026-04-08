import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_KEY = "531606";

function generateSign(params: Record<string, string>, appSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  const raw = appSecret + sorted + appSecret;
  return createHash("md5").update(raw).digest("hex").toUpperCase();
}

export async function fetchAliProducts(keywords: string): Promise<object[]> {
  const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET") ?? "";

  const timestamp = new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  const params: Record<string, string> = {
    method: "aliexpress.affiliate.product.query",
    app_key: APP_KEY,
    timestamp,
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords,
    target_currency: "BRL",
    target_language: "PT",
    tracking_id: "wuilli",
    page_no: "1",
    page_size: "5",
    sort: "SALE_PRICE_ASC",
  };

  if (appSecret) {
    params.sign = generateSign(params, appSecret);
  }

  const url = new URL("https://api-sg.aliexpress.com/sync");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  const data = await res.json();

  const raw: object[] =
    data?.aliexpress_affiliate_product_query_response?.resp_result?.result
      ?.products?.product ?? [];

  return raw.map((p: any) => {
    const custo = parseFloat(p.target_sale_price || p.sale_price || "0");
    const venda = parseFloat((custo * 1.6).toFixed(2));
    return {
      nome: (p.product_title ?? "Produto").slice(0, 70),
      imagem: p.product_main_image_url ?? "",
      url: p.promotion_link || p.product_detail_url || "",
      precoCusto: custo,
      precoVenda: venda,
      margem: "40%+",
      vendas: p.lastest_volume ? `${p.lastest_volume}` : "—",
      score: "Alta",
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keywords } = await req.json();
    if (!keywords) {
      return new Response(JSON.stringify({ error: "Missing keywords" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const products = await fetchAliProducts(keywords);

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("aliexpress-products error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
