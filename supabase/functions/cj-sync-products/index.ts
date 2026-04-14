import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const USD_TO_BRL = 5.0;

const categories = [
  { keyword: "electronics", name: "Eletrônicos" },
  { keyword: "phone accessories", name: "Telefones e Acessórios" },
  { keyword: "beauty", name: "Beleza e Saúde" },
  { keyword: "home garden", name: "Casa e Jardim" },
  { keyword: "sports", name: "Esportes" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      
      // Rate limit: wait 1.5s between requests
      if (i > 0) await sleep(1500);

      try {
        const url = "https://developers.cjdropshipping.com/api2.0/v1/product/list?" +
          new URLSearchParams({
            productNameEn: cat.keyword,
            pageNum: "1",
            pageSize: "25",
          }).toString();

        const res = await fetch(url, {
          headers: { "CJ-Access-Token": accessToken },
        });

        const json = await res.json();
        console.log(`Category ${cat.name}: code=${json.code}, count=${json.data?.list?.length || 0}`);

        if (json.code !== 200 || !json.data?.list) {
          console.log(`${cat.name} response:`, JSON.stringify(json).substring(0, 300));
          results[cat.name] = 0;
          continue;
        }

        const products = json.data.list.filter(
          (p: any) => (p.sellPrice || p.productSku?.[0]?.sellPrice) > 0
        );

        const rows = products.map((p: any) => {
          const costUsd = parseFloat(p.sellPrice || p.productSku?.[0]?.sellPrice || "0");
          const costBrl = Math.round(costUsd * USD_TO_BRL * 100) / 100;
          const suggestedBrl = Math.round(costBrl * 2.5 * 100) / 100;
          const margin = suggestedBrl > 0
            ? Math.round(((suggestedBrl - costBrl) / suggestedBrl) * 10000) / 100
            : 0;

          const images = p.productImageSet?.length
            ? p.productImageSet.map((img: any) => typeof img === "string" ? img : img.imageUrl || img)
            : p.productImage ? [p.productImage] : [];

          // Get real stock from CJ API response
          const stockQty = p.inventory?.sellInventory ?? p.sellInventory ?? p.productSku?.[0]?.inventory?.sellInventory ?? p.productSku?.[0]?.sellInventory ?? 0;

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
            stock_quantity: typeof stockQty === 'number' ? stockQty : parseInt(stockQty) || 0,
            is_active: true,
          };
        });

        if (rows.length > 0) {
          const { error } = await supabase
            .from("catalog_products")
            .upsert(rows, { onConflict: "external_id" });
          if (error) console.error(`Upsert error ${cat.name}:`, error);
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
