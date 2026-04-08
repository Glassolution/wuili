import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Category mapping for AliExpress feed
const nichoToCategoryId: Record<string, string> = {
  "eletronicos": "44",
  "eletrônicos": "44",
  "moda": "200000346",
  "beleza": "66",
  "casa": "15",
  "esporte": "18",
  "brinquedos": "26",
  "joias": "36",
  "automotivo": "34",
  "pet": "200003655",
  "bebes": "1501",
  "ferramentas": "1420",
};

async function hmacSha256Hex(key: Uint8Array, message: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function generateSign(params: Record<string, string>, apiPath: string, appSecret: string): Promise<string> {
  const sorted = Object.keys(params).sort();
  let baseString = apiPath;
  for (const key of sorted) {
    baseString += key + params[key];
  }
  const encoder = new TextEncoder();
  return hmacSha256Hex(encoder.encode(appSecret), encoder.encode(baseString));
}

function getMockProducts(nicho: string) {
  const mocksByNicho: Record<string, any[]> = {
    "eletronicos": [
      { nome: "Fone Bluetooth TWS i12", precoCusto: 15.90, precoVenda: 25.44, margem: "40%+", vendas: "5.2k", imagem: "", url: "", product_id: "mock1" },
      { nome: "Smartwatch D20 Fitness", precoCusto: 22.50, precoVenda: 36.00, margem: "40%+", vendas: "8.1k", imagem: "", url: "", product_id: "mock2" },
      { nome: "Mini Câmera WiFi HD", precoCusto: 35.00, precoVenda: 56.00, margem: "40%+", vendas: "3.4k", imagem: "", url: "", product_id: "mock3" },
      { nome: "Caixa de Som Bluetooth", precoCusto: 28.90, precoVenda: 46.24, margem: "40%+", vendas: "6.7k", imagem: "", url: "", product_id: "mock4" },
    ],
    "moda": [
      { nome: "Tênis Casual Unissex", precoCusto: 45.00, precoVenda: 72.00, margem: "40%+", vendas: "4.3k", imagem: "", url: "", product_id: "mock5" },
      { nome: "Óculos Polarizado UV400", precoCusto: 12.50, precoVenda: 20.00, margem: "40%+", vendas: "9.1k", imagem: "", url: "", product_id: "mock6" },
      { nome: "Mochila Urbana Impermeável", precoCusto: 32.00, precoVenda: 51.20, margem: "40%+", vendas: "5.5k", imagem: "", url: "", product_id: "mock7" },
    ],
  };
  const defaultProducts = [
    { nome: "LED Ring Light 10\"", precoCusto: 25.00, precoVenda: 40.00, margem: "40%+", vendas: "4.8k", imagem: "", url: "", product_id: "mock9" },
    { nome: "Organizador Multiuso", precoCusto: 14.90, precoVenda: 23.84, margem: "40%+", vendas: "6.3k", imagem: "", url: "", product_id: "mock10" },
    { nome: "Garrafa Térmica 500ml", precoCusto: 19.90, precoVenda: 31.84, margem: "40%+", vendas: "8.9k", imagem: "", url: "", product_id: "mock11" },
    { nome: "Luminária LED USB", precoCusto: 11.50, precoVenda: 18.40, margem: "40%+", vendas: "5.1k", imagem: "", url: "", product_id: "mock12" },
  ];
  const key = nicho.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return mocksByNicho[key] || defaultProducts;
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

    const APP_KEY = Deno.env.get("ALIEXPRESS_APP_KEY") || "531606";
    const APP_SECRET = Deno.env.get("ALIEXPRESS_APP_SECRET");

    if (!APP_SECRET) {
      console.warn("ALIEXPRESS_APP_SECRET not set, returning mock data");
      return new Response(JSON.stringify({ products: getMockProducts(nicho), source: "mock" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nichoKey = nicho.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const categoryId = nichoToCategoryId[nichoKey] || nichoToCategoryId[nicho.toLowerCase()] || "44";

    const apiPath = "/sync";
    const method = "aliexpress.ds.recommend.feed.get";
    const timestamp = Date.now().toString();

    const params: Record<string, string> = {
      app_key: APP_KEY,
      method,
      sign_method: "sha256",
      timestamp,
      v: "2.0",
      format: "json",
      category_id: categoryId,
      page_no: "1",
      page_size: "10",
      target_currency: "BRL",
      target_language: "pt",
      sort: "SALE_PRICE_ASC",
      country: "BR",
    };

    params.sign = await generateSign(params, apiPath, APP_SECRET);

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    const url = `https://api-sg.aliexpress.com/sync?${queryString}`;

    console.log("Calling AliExpress API for category:", categoryId);

    const response = await fetch(url, { method: "POST" });
    const data = await response.json();

    if (data.error_response) {
      console.error("AliExpress API error:", JSON.stringify(data.error_response));
      return new Response(JSON.stringify({ products: getMockProducts(nicho), source: "mock" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawProducts = data.aliexpress_ds_recommend_feed_get_response?.result?.products || [];

    const formatted = rawProducts.slice(0, 6).map((p: any) => {
      const precoCusto = parseFloat(p.target_sale_price || p.target_original_price || "0");
      const precoVenda = parseFloat((precoCusto * 1.6).toFixed(2));
      return {
        nome: p.product_title || "Produto AliExpress",
        precoCusto,
        precoVenda,
        margem: "40%+",
        imagem: p.product_main_image_url || "",
        url: p.promotion_link || p.product_detail_url || "",
        vendas: p.lastest_volume ? String(p.lastest_volume) : "—",
        score: "Alta",
        product_id: p.product_id || "",
      };
    });

    if (formatted.length === 0) {
      return new Response(JSON.stringify({ products: getMockProducts(nicho), source: "mock" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ products: formatted, source: "aliexpress" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("aliexpress-products error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
