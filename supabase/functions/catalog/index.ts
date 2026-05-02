import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceKey;
    const supabase = createClient(dbUrl, dbKey);

    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("catalog_products")
      .select(
        [
          "id",
          "source",
          "external_id",
          "title",
          "description",
          "images",
          "cost_price",
          "original_price",
          "suggested_price",
          "margin_percent",
          "category",
          "supplier_name",
          "stock_quantity",
          "is_active",
          "weight",
          "variants",
          "rating",
          "orders_count",
        ].join(","),
        { count: "exact" }
      )
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .order("orders_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (category && category !== "todos") {
      const categoryMap: Record<string, string> = {
        beleza: "Beleza e Cuidados Pessoais",
        casa: "Casa e Jardim",
        eletronicos: "Eletrônicos e Gadgets",
        moda: "Moda Feminina",
        esporte: "Esporte e Lazer",
        pet: "Pet",
        bebes: "Bebês e Crianças",
        organizacao: "Organização e Utilidades",
      };
      const mapped = categoryMap[category.toLowerCase()];
      if (mapped) {
        query = query.eq("category", mapped);
      }
    }

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        products: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
