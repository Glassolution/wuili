// generate-sales-report — Gera relatório de vendas analítico via Lovable AI (Gemini)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE = ["paid", "delivered", "shipped", "approved", "completed"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const [ordersRes, pubsRes] = await Promise.all([
      admin.from("orders")
        .select("platform, product_title, sale_price, cost_price, profit, status, ordered_at, created_at, quantity")
        .eq("user_id", user.id)
        .order("ordered_at", { ascending: false })
        .limit(500),
      admin.from("user_publications")
        .select("title, price, cost_price, status, published_at")
        .eq("user_id", user.id)
        .limit(200),
    ]);

    const orders = ordersRes.data ?? [];
    const pubs = pubsRes.data ?? [];
    const active = orders.filter((o: any) => ACTIVE.includes(o.status));

    const revenue = active.reduce((s: number, o: any) => s + Number(o.sale_price ?? 0), 0);
    const profit = active.reduce(
      (s: number, o: any) => s + Number(o.profit ?? (Number(o.sale_price ?? 0) - Number(o.cost_price ?? 0))),
      0,
    );
    const ordersCount = active.length;
    const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Top produtos
    const productMap: Record<string, { sales: number; revenue: number }> = {};
    for (const o of active as any[]) {
      const k = o.product_title ?? "Sem título";
      productMap[k] ??= { sales: 0, revenue: 0 };
      productMap[k].sales += 1;
      productMap[k].revenue += Number(o.sale_price ?? 0);
    }
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, v]) => ({ name, ...v }));

    const activePubs = pubs.filter((p: any) => p.status === "active").length;

    const summaryPayload = {
      total_orders: orders.length,
      active_orders: ordersCount,
      revenue: Number(revenue.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      avg_ticket: Number(avgTicket.toFixed(2)),
      margin_pct: Number(margin.toFixed(1)),
      publications_total: pubs.length,
      publications_active: activePubs,
      top_products: topProducts,
    };

    const SYSTEM = `Você é um analista sênior de vendas do Mercado Livre e especialista em dropshipping brasileiro. Analise os dados reais do usuário e devolva UM JSON válido (sem markdown, sem texto fora do JSON) EXATAMENTE neste formato:

{
  "title": "Relatório de Vendas - <mês/ano ou período>",
  "overall_score": <número 0-10 com 1 casa decimal>,
  "scores": {
    "vendas": <0-10>,
    "produtos": <0-10>,
    "mercado_livre": <0-10>,
    "oportunidades": <0-10>
  },
  "summary": "Um parágrafo curto (2-3 frases) resumindo a saúde do negócio.",
  "sections": [
    { "title": "Visão Geral", "content": "Parágrafos analíticos em português..." },
    { "title": "Análise de Vendas", "content": "..." },
    { "title": "Produtos em Destaque", "content": "..." },
    { "title": "Diagnóstico Mercado Livre", "content": "..." },
    { "title": "Recomendações Práticas", "content": "..." }
  ]
}

Regras:
- Escreva em português brasileiro, tom consultivo, direto, com números reais.
- Cada 'content' pode ter parágrafos separados por \\n\\n e listas com "- ".
- Se não houver pedidos, dê recomendações para primeiro venda.
- Retorne SOMENTE o JSON, nada mais.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Dados do vendedor:\n${JSON.stringify(summaryPayload, null, 2)}` },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("gateway error", resp.status, text);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erro no serviço de IA", details: text }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const now = new Date();
    const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const title = parsed.title || `Relatório de Vendas — ${monthLabel}`;
    const overall = Math.max(0, Math.min(10, Number(parsed.overall_score ?? 0)));

    const metrics = {
      revenue: summaryPayload.revenue,
      profit: summaryPayload.profit,
      orders: summaryPayload.active_orders,
      avg_ticket: summaryPayload.avg_ticket,
      margin_pct: summaryPayload.margin_pct,
      publications_active: summaryPayload.publications_active,
    };

    const { data: inserted, error: insertErr } = await admin
      .from("sales_reports")
      .insert({
        user_id: user.id,
        title,
        overall_score: overall,
        scores: parsed.scores ?? {},
        metrics,
        sections: parsed.sections ?? [],
        summary: parsed.summary ?? "",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ report: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-sales-report error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
