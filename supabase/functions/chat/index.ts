import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a IA da Wuilli, plataforma de dropshipping para iniciantes brasileiros.
Guie o usuário neste fluxo:
1) Pergunte o nicho de produtos que ele quer vender.
2) Quando o usuário informar o nicho, retorne SOMENTE este JSON (sem texto extra):
   {"tipo":"produtos_request","keywords":"palavras-chave do nicho em português"}
3) Após os produtos serem exibidos, crie um anúncio para o produto escolhido retornando SOMENTE:
   {"tipo":"anuncio","titulo":"","descricao":"","preco":"","plataforma":"Mercado Livre"}
4) Confirme a publicação de forma amigável.
Seja direto e use linguagem simples.`;

/* ── AliExpress Affiliate API ────────────────────────── */
const APP_KEY = "531606";

function generateSign(params: Record<string, string>, appSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return createHash("md5")
    .update(appSecret + sorted + appSecret)
    .digest("hex")
    .toUpperCase();
}

async function fetchAliProducts(keywords: string): Promise<object[]> {
  const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET") ?? "";
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

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

  if (raw.length === 0) {
    console.warn("AliExpress returned no products for:", keywords, JSON.stringify(data));
  }

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
      vendas: p.lastest_volume ? String(p.lastest_volume) : "—",
      score: "Alta",
    };
  });
}

/* ── Main handler ───────────────────────────────────── */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...(messages || []).map((m: { role: string; content: string }) => ({
              role: m.role === "ai" ? "assistant" : m.role,
              content: m.content,
            })),
          ],
          temperature: 0.8,
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione fundos na sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiMessage: string =
      data.choices?.[0]?.message?.content ||
      "Desculpe, não consegui processar sua mensagem.";

    /* ── Intercept product request ──────────────────── */
    const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tipo === "produtos_request" && parsed.keywords) {
          const produtos = await fetchAliProducts(parsed.keywords);
          const reply = JSON.stringify({ tipo: "produtos", lista: produtos });
          return new Response(
            JSON.stringify({ response: reply }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch { /* not valid JSON, continue */ }
    }

    return new Response(
      JSON.stringify({ response: aiMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
