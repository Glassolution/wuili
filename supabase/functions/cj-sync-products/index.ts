import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const USD_TO_BRL = 5.0;

const categories = [
  { id: "CJP00000059", name: "Eletrônicos" },
  { id: "CJP00000010", name: "Telefones e Acessórios" },
  { id: "CJP00000058", name: "Beleza e Saúde" },
  { id: "CJP00000035", name: "Casa e Jardim" },
  { id: "CJP00000056", name: "Esportes" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get access token via cj-auth
    const authRes = await fetch(`${supabaseUrl}/functions/v1/cj-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    const authData = await authRes.json();
    if (!authData.accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to get CJ access token", details: authData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = authData.accessToken;
    const results: Record<string, number> = {};
    let totalSynced = 0;

    for (const cat of categories) {
      try {
        const url = new URL("https://developers.cjdropshipping.com/api2.0/v1/product/list");
        url.searchParams.set("categoryId", cat.id);
        url.searchParams.set("pageNum", "1");
        url.searchParams.set("pageSize", "25");

        const res = await fetch(url.toString(), {
          headers: { "CJ-Access-Token": accessToken },
        });
        const json = await res.json();

        if (json.code !== 200 || !json.data?.list) {
          results[cat.name] = 0;
          continue;
        }

        const products = json.data.list.filter(
          (p: any) =>
            p.sellPrice > 0 &&
            (p.productImage || (p.productImageSet && p.productImageSet.length > 0))
        );

        const rows = products.map((p: any) => {
          const costUsd = parseFloat(p.sellPrice) || 0;
          const costBrl = Math.round(costUsd * USD_TO_BRL * 100) / 100;
          const suggestedBrl = Math.round(costBrl * 2.5 * 100) / 100;
          const margin = suggestedBrl > 0
            ? Math.round(((suggestedBrl - costBrl) / suggestedBrl) * 10000) / 100
            : 0;

          const images = p.productImageSet && p.productImageSet.length > 0
            ? p.productImageSet.map((img: any) => img.imageUrl || img)
            : p.productImage
              ? [p.productImage]
              : [];

          return {
            source: "cj",
            external_id: String(p.pid),
            title: p.productNameEn || p.productName || "Sem título",
            description: p.description || null,
            images: JSON.stringify(images),
            cost_price: costBrl,
            suggested_price: suggestedBrl,
            margin_percent: margin,
            category: cat.name,
            supplier_name: p.supplierName || "CJ Dropshipping",
            supplier_contact: null,
            stock_quantity: 999,
            is_active: true,
          };
        });

        if (rows.length > 0) {
          const { error } = await supabase
            .from("catalog_products")
            .upsert(rows, { onConflict: "external_id" });
          if (error) {
            console.error(`Upsert error for ${cat.name}:`, error);
          }
        }

        results[cat.name] = rows.length;
        totalSynced += rows.length;
      } catch (catErr) {
        console.error(`Error syncing ${cat.name}:`, catErr);
        results[cat.name] = 0;
      }
    }

    return new Response(
      JSON.stringify({ success: true, totalSynced, byCategory: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
