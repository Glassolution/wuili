// Atlas Search — interpreta texto livre via Lovable AI (Gemini) e busca
// produtos reais em catalog_products.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_SOURCES = ["b2drop", "c7drop"];
const RESULT_LIMIT = 24;

type AtlasFilters = {
  categoria: string | null;
  palavras_chave: string[];
  ordenar_por: "margem" | "vendas" | "preco_asc" | "preco_desc" | null;
  estoque_minimo: number | null;
};

const DEFAULT_FILTERS: AtlasFilters = {
  categoria: null,
  palavras_chave: [],
  ordenar_por: null,
  estoque_minimo: null,
};

function extractJson(raw: string): AtlasFilters {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Tenta JSON puro; se falhar, tenta achar o primeiro {...}
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return { ...DEFAULT_FILTERS };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { ...DEFAULT_FILTERS };
    }
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const ordenar = typeof obj.ordenar_por === "string" ? obj.ordenar_por : null;
  const validOrdenar: AtlasFilters["ordenar_por"] =
    ordenar === "margem" || ordenar === "vendas" ||
    ordenar === "preco_asc" || ordenar === "preco_desc"
      ? ordenar
      : null;

  const keywords = Array.isArray(obj.palavras_chave)
    ? obj.palavras_chave
        .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => k.trim())
        .slice(0, 8)
    : [];

  return {
    categoria:
      typeof obj.categoria === "string" && obj.categoria.trim().length > 0
        ? obj.categoria.trim()
        : null,
    palavras_chave: keywords,
    ordenar_por: validOrdenar,
    estoque_minimo:
      typeof obj.estoque_minimo === "number" && obj.estoque_minimo > 0
        ? Math.floor(obj.estoque_minimo)
        : null,
  };
}

async function inferFiltersWithAI(
  userText: string,
  apiKey: string,
): Promise<AtlasFilters | null> {
  const systemPrompt =
    `Você é um interpretador de buscas de catálogo de dropshipping em português brasileiro.
Receba o texto do usuário e responda APENAS com um JSON válido (sem markdown, sem comentários) no formato:
{"categoria": string|null, "palavras_chave": string[], "ordenar_por": "margem"|"vendas"|"preco_asc"|"preco_desc"|null, "estoque_minimo": number|null}

Regras:
- "categoria": uma palavra/expressão curta da categoria principal (ex: "pesca", "beleza", "casa", "eletrônicos"), ou null se não houver.
- "palavras_chave": 1 a 6 termos relevantes para busca textual no título do produto.
- "ordenar_por": use "margem" se o usuário pedir lucro/margem; "vendas" se pedir popularidade/viralizar/mais vendido; "preco_asc" para "barato/baixo preço"; "preco_desc" para "caro/premium"; null caso não esteja claro.
- "estoque_minimo": número se o usuário pedir estoque alto/disponibilidade; null caso contrário.
Responda SOMENTE o JSON.`;

  try {
    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText },
          ],
        }),
      },
    );

    if (!resp.ok) {
      console.error("Lovable AI gateway error", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return extractJson(content);
  } catch (err) {
    console.error("AI inference failed", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json().catch(() => ({ query: "" }));
    const userText = typeof query === "string" ? query.trim() : "";

    if (!userText) {
      return new Response(
        JSON.stringify({ error: "missing_query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let filters: AtlasFilters | null = null;
    let usedFallback = false;

    if (apiKey) {
      filters = await inferFiltersWithAI(userText, apiKey);
    }
    if (!filters) {
      usedFallback = true;
      filters = {
        ...DEFAULT_FILTERS,
        palavras_chave: userText.split(/\s+/).filter((w) => w.length > 2).slice(0, 4),
      };
    }

    // Monta query
    let q = supabase
      .from("catalog_products")
      .select("id")
      .in("source", ALLOWED_SOURCES)
      .eq("is_blocked", false)
      .gt("stock_quantity", filters.estoque_minimo && filters.estoque_minimo > 0 ? filters.estoque_minimo - 1 : 0);

    // Categoria: tenta ILIKE em category
    if (filters.categoria) {
      q = q.ilike("category", `%${filters.categoria}%`);
    }

    // Palavras-chave: OR de ILIKE em title (e fallback em description/category)
    if (filters.palavras_chave.length > 0) {
      const ors = filters.palavras_chave
        .map((kw) => {
          const safe = kw.replace(/[%,]/g, " ").trim();
          return `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`;
        })
        .join(",");
      q = q.or(ors);
    }

    switch (filters.ordenar_por) {
      case "margem":
        q = q.order("margin_percent", { ascending: false, nullsFirst: false });
        break;
      case "vendas":
        q = q
          .order("orders_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
        break;
      case "preco_asc":
        q = q.gt("cost_price", 0).order("cost_price", { ascending: true, nullsFirst: false });
        break;
      case "preco_desc":
        q = q.order("cost_price", { ascending: false, nullsFirst: false });
        break;
      default:
        // Relevância simples: prioriza popularidade + recência
        q = q
          .order("orders_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
    }

    q = q.limit(RESULT_LIMIT);

    let { data, error } = await q;

    // Fallback: se a query retornar vazia ou erro de OR, tenta ILIKE simples no texto bruto
    if (error || !data || data.length === 0) {
      if (error) console.error("Primary query failed", error);
      const safe = userText.replace(/[%,]/g, " ").trim();
      const fb = await supabase
        .from("catalog_products")
        .select("id")
        .in("source", ALLOWED_SOURCES)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .or(`title.ilike.%${safe}%,category.ilike.%${safe}%`)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .limit(RESULT_LIMIT);
      data = fb.data ?? [];
      usedFallback = true;
    }

    const ids = (data ?? []).map((r) => r.id as string);

    return new Response(
      JSON.stringify({
        ids,
        count: ids.length,
        filters,
        used_fallback: usedFallback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("atlas-search error", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
