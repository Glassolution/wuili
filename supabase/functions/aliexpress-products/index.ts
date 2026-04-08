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

function generateSign(params: Record<string, string>, apiPath: string, appSecret: string): string {
  const sorted = Object.keys(params).sort();
  let baseString = apiPath;
  for (const key of sorted) {
    baseString += key + params[key];
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const msgData = encoder.encode(baseString);

  // Use Web Crypto HMAC-SHA256
  return hmacSha256Hex(keyData, msgData);
}

async function hmacSha256Hex(key: Uint8Array, message: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nicho } = await req.json();
    if (!nicho) {
      return new Response(JSON.stringify({ error: "Nicho é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const APP_KEY = Deno.env.get("ALIEXPRESS_APP_KEY");
    const APP_SECRET = Deno.env.get("ALIEXPRESS_APP_SECRET");

    if (!APP_KEY || !APP_SECRET) {
      console.error("Missing AliExpress credentials");
      return new Response(JSON.stringify({ error: "Credenciais AliExpress não configuradas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const sign = await generateSign(params, apiPath, APP_SECRET);
    params.sign = sign;

    const queryString = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const url = `https://api-sg.aliexpress.com/sync?${queryString}`;

    console.log("Calling AliExpress API for category:", categoryId);

    const response = await fetch(url, { method: "POST" });
    const data = await response.json();

    console.log("AliExpress response status:", response.status);

    if (data.error_response) {
      console.error("AliExpress API error:", JSON.stringify(data.error_response));
      // Fall back to mock data if API fails
      return new Response(JSON.stringify({ products: getMockProducts(nicho), source: "mock" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const products = data.aliexpress_ds_recommend_feed_get_response?.result?.products || [];

    const formatted = products.slice(0, 6).map((p: any) => {
      const costBRL = parseFloat(p.target_sale_price || p.target_original_price || "0");
      const sellPrice = Math.ceil(costBRL * 1.6); // 60% markup for 40%+ margin
      const margin = sellPrice > 0 ? Math.round(((sellPrice - costBRL) / sellPrice) * 100) : 40;
      return {
        nome: p.product_title || "Produto AliExpress",
        preco_custo: `R$ ${costBRL.toFixed(2)}`,
        preco_venda: `R$ ${sellPrice.toFixed(2)}`,
        margem: `${margin}%`,
        imagem: p.product_main_image_url || "",
        link: p.promotion_link || p.product_detail_url || "",
        vendas: p.lastest_volume || "0",
        avaliacao: p.evaluate_rate || "0",
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

function getMockProducts(nicho: string) {
  const mocksByNicho: Record<string, any[]> = {
    "eletronicos": [
      { nome: "Fone Bluetooth TWS i12", preco_custo: "R$ 15.90", preco_venda: "R$ 39.90", margem: "60%", vendas: "5.2k", imagem: "", product_id: "mock1" },
      { nome: "Smartwatch D20 Fitness", preco_custo: "R$ 22.50", preco_venda: "R$ 59.90", margem: "62%", vendas: "8.1k", imagem: "", product_id: "mock2" },
      { nome: "Mini Câmera WiFi HD", preco_custo: "R$ 35.00", preco_venda: "R$ 89.90", margem: "61%", vendas: "3.4k", imagem: "", product_id: "mock3" },
      { nome: "Caixa de Som Bluetooth", preco_custo: "R$ 28.90", preco_venda: "R$ 69.90", margem: "59%", vendas: "6.7k", imagem: "", product_id: "mock4" },
    ],
    "moda": [
      { nome: "Tênis Casual Unissex", preco_custo: "R$ 45.00", preco_venda: "R$ 119.90", margem: "62%", vendas: "4.3k", imagem: "", product_id: "mock5" },
      { nome: "Óculos Polarizado UV400", preco_custo: "R$ 12.50", preco_venda: "R$ 34.90", margem: "64%", vendas: "9.1k", imagem: "", product_id: "mock6" },
      { nome: "Mochila Urbana Impermeável", preco_custo: "R$ 32.00", preco_venda: "R$ 79.90", margem: "60%", vendas: "5.5k", imagem: "", product_id: "mock7" },
      { nome: "Relógio Digital Esportivo", preco_custo: "R$ 18.90", preco_venda: "R$ 49.90", margem: "62%", vendas: "7.2k", imagem: "", product_id: "mock8" },
    ],
  };
  const defaultProducts = [
    { nome: "LED Ring Light 10\"", preco_custo: "R$ 25.00", preco_venda: "R$ 64.90", margem: "61%", vendas: "4.8k", imagem: "", product_id: "mock9" },
    { nome: "Organizador Multiuso", preco_custo: "R$ 14.90", preco_venda: "R$ 39.90", margem: "63%", vendas: "6.3k", imagem: "", product_id: "mock10" },
    { nome: "Garrafa Térmica 500ml", preco_custo: "R$ 19.90", preco_venda: "R$ 49.90", margem: "60%", vendas: "8.9k", imagem: "", product_id: "mock11" },
    { nome: "Luminária LED USB", preco_custo: "R$ 11.50", preco_venda: "R$ 29.90", margem: "62%", vendas: "5.1k", imagem: "", product_id: "mock12" },
  ];
  const key = nicho.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return mocksByNicho[key] || defaultProducts;
}
