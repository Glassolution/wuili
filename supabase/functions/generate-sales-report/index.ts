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

    const [ordersRes, pubsRes, integrationsRes, profileRes] = await Promise.all([
      admin.from("orders")
        .select("platform, product_title, sale_price, cost_price, profit, status, ordered_at, created_at, quantity, buyer_state, fulfillment_status")
        .eq("user_id", user.id)
        .order("ordered_at", { ascending: false })
        .limit(1000),
      admin.from("user_publications")
        .select("title, price, cost_price, status, published_at, permalink")
        .eq("user_id", user.id)
        .order("published_at", { ascending: false })
        .limit(500),
      admin.from("user_integrations")
        .select("platform, connected_at, status")
        .eq("user_id", user.id),
      admin.from("profiles").select("full_name, plan").eq("id", user.id).maybeSingle(),
    ]);

    const orders = ordersRes.data ?? [];
    const pubs = pubsRes.data ?? [];
    const integrations = integrationsRes.data ?? [];
    const profile = profileRes.data ?? null;
    const active = orders.filter((o: any) => ACTIVE.includes(o.status));

    const revenue = active.reduce((s: number, o: any) => s + Number(o.sale_price ?? 0), 0);
    const profit = active.reduce(
      (s: number, o: any) => s + Number(o.profit ?? (Number(o.sale_price ?? 0) - Number(o.cost_price ?? 0))),
      0,
    );
    const ordersCount = active.length;
    const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Produtos
    const productMap: Record<string, { sales: number; revenue: number; profit: number }> = {};
    for (const o of active as any[]) {
      const k = o.product_title ?? "Sem título";
      productMap[k] ??= { sales: 0, revenue: 0, profit: 0 };
      productMap[k].sales += 1;
      productMap[k].revenue += Number(o.sale_price ?? 0);
      productMap[k].profit += Number(o.profit ?? (Number(o.sale_price ?? 0) - Number(o.cost_price ?? 0)));
    }
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8)
      .map(([name, v]) => ({
        name, sales: v.sales,
        revenue: Number(v.revenue.toFixed(2)),
        profit: Number(v.profit.toFixed(2)),
      }));

    // Vendas por plataforma
    const platformMap: Record<string, { orders: number; revenue: number }> = {};
    for (const o of active as any[]) {
      const p = o.platform ?? "outros";
      platformMap[p] ??= { orders: 0, revenue: 0 };
      platformMap[p].orders += 1;
      platformMap[p].revenue += Number(o.sale_price ?? 0);
    }
    const byPlatform = Object.entries(platformMap).map(([p, v]) => ({
      platform: p, orders: v.orders, revenue: Number(v.revenue.toFixed(2)),
    }));

    // Últimos 6 meses
    const monthMap: Record<string, { revenue: number; profit: number; orders: number }> = {};
    for (const o of active as any[]) {
      const d = new Date(o.ordered_at ?? o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] ??= { revenue: 0, profit: 0, orders: 0 };
      monthMap[key].revenue += Number(o.sale_price ?? 0);
      monthMap[key].profit += Number(o.profit ?? (Number(o.sale_price ?? 0) - Number(o.cost_price ?? 0)));
      monthMap[key].orders += 1;
    }
    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({
        month, orders: v.orders,
        revenue: Number(v.revenue.toFixed(2)),
        profit: Number(v.profit.toFixed(2)),
      }));

    // Estados dos compradores
    const stateMap: Record<string, number> = {};
    for (const o of active as any[]) {
      const s = (o.buyer_state ?? "").toString().toUpperCase();
      if (s) stateMap[s] = (stateMap[s] ?? 0) + 1;
    }
    const topStates = Object.entries(stateMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([state, count]) => ({ state, orders: count }));

    // Publicações
    const activePubs = pubs.filter((p: any) => p.status === "active");
    const pubsSample = pubs.slice(0, 15).map((p: any) => ({
      title: p.title, price: Number(p.price ?? 0), status: p.status,
    }));

    // Anúncios sem venda
    const soldTitles = new Set(topProducts.map(p => p.name));
    const unsoldPubs = activePubs.filter((p: any) => !soldTitles.has(p.title)).length;

    const mlConnected = integrations.some((i: any) => i.platform === "mercadolivre");

    const dataPayload = {
      seller: { name: profile?.full_name ?? "Vendedor", plan: profile?.plan ?? "free" },
      period: { start: monthly[0]?.month, end: monthly[monthly.length - 1]?.month },
      integrations: { mercado_livre_conectado: mlConnected },
      totals: {
        orders_total: orders.length,
        orders_ativos: ordersCount,
        receita: Number(revenue.toFixed(2)),
        lucro: Number(profit.toFixed(2)),
        ticket_medio: Number(avgTicket.toFixed(2)),
        margem_pct: Number(margin.toFixed(1)),
      },
      publicacoes: {
        total: pubs.length,
        ativas: activePubs.length,
        sem_vendas: unsoldPubs,
        amostra: pubsSample,
      },
      top_produtos: topProducts,
      vendas_por_plataforma: byPlatform,
      vendas_mensais: monthly,
      top_estados_compradores: topStates,
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

Regras OBRIGATÓRIAS:
- Escreva em português brasileiro, tom consultivo e direto.
- SEMPRE cite números REAIS extraídos dos dados (receita, lucro, ticket médio, margem, quantidade de pedidos, nomes exatos dos produtos, estados dos compradores).
- SEMPRE mencione pelo menos 2 produtos pelo nome exato ao falar de "Produtos em Destaque".
- Se o Mercado Livre não estiver conectado, deixe isso claro no "Diagnóstico Mercado Livre" e recomende conectar.
- Se houver muitas publicações sem vendas, aponte o número exato e sugira ações (foto, título, preço).
- Compare meses quando houver mais de um mês de dados.
- Cada 'content' pode ter parágrafos separados por \\n\\n e listas com "- ".
- Se não houver pedidos, foque em recomendações para a primeira venda com base nas publicações existentes.
- Retorne SOMENTE o JSON, nada mais.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Dados REAIS do vendedor (use estes números exatos na análise):\n${JSON.stringify(dataPayload, null, 2)}` },
        ],
        temperature: 0.4,
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
