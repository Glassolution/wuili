import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.177.0/hash/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_KEY = "531606";

/** MD5 sign: appSecret + sorted(key+value) + appSecret → uppercase hex */
function generateSign(params: Record<string, string>, appSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  const hash = createHash("md5");
  hash.update(appSecret + sorted + appSecret);
  return hash.toString("hex").toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const nicho: string = body.nicho || body.keywords || "";
    if (!nicho) {
      return new Response(JSON.stringify({ error: "Nicho é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET") ?? "";
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

    const params: Record<string, string> = {
      method: "aliexpress.affiliate.product.query",
      app_key: APP_KEY,
      timestamp,
      format: "json",
      v: "2.0",
      sign_method: "md5",
      keywords: nicho,
      target_currency: "BRL",
      target_language: "PT",
      tracking_id: "wuilli",
      page_no: "1",
      page_size: "5",
      sort: "SALE_PRICE_ASC",
    };

    if (appSecret) {
      params.sign = await generateSign(params, appSecret);
    }

    const url = new URL("https://api-sg.aliexpress.com/sync");
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    console.log("Calling AliExpress Affiliate API, keywords:", nicho);

    const res = await fetch(url.toString());
    const data = await res.json();

    const rawProducts: any[] =
      data?.aliexpress_affiliate_product_query_response?.resp_result?.result
        ?.products?.product ?? [];

    if (rawProducts.length === 0) {
      console.warn("AliExpress returned no products. Response:", JSON.stringify(data).slice(0, 300));
    }

    const products = rawProducts.slice(0, 5).map((p: any) => {
      const precoCusto = parseFloat(p.target_sale_price || p.sale_price || "0");
      const precoVenda = parseFloat((precoCusto * 1.6).toFixed(2));
      const margem = precoVenda > 0
        ? Math.round(((precoVenda - precoCusto) / precoVenda) * 100)
        : 40;
      return {
        nome: (p.product_title ?? "Produto").slice(0, 60),
        imagem: p.product_main_image_url ?? "",
        url: p.promotion_link || p.product_detail_url || "",
        precoCusto,
        precoVenda,
        margem: `${margem}%+`,
        vendas: p.lastest_volume ? String(p.lastest_volume) : "—",
        score: "Alta",
      };
    });

    return new Response(
      JSON.stringify({ products, source: products.length > 0 ? "aliexpress" : "empty" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("aliexpress-products error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
