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

async function fetchStockForProduct(pid: string, accessToken: string): Promise<number> {
  try {
    // Try CJ product detail endpoint which includes variant/stock info
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${pid}`;
    const res = await fetch(url, {
      headers: { "CJ-Access-Token": accessToken },
    });
    const json = await res.json();
    if (json.code === 200 && json.data) {
      const p = json.data;
      // Try multiple stock fields
      if (typeof p.inventory === 'number' && p.inventory > 0) return p.inventory;
      if (typeof p.sellableQuantity === 'number') return p.sellableQuantity;
      if (typeof p.stock === 'number') return p.stock;
      // Sum stock from all variants/SKUs
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        const total = p.variants.reduce((sum: number, v: any) => {
          const qty = v.inventory ?? v.sellableQuantity ?? v.stock ?? 0;
          return sum + (typeof qty === 'number' ? qty : parseInt(qty) || 0);
        }, 0);
        if (total > 0) return total;
      }
      if (Array.isArray(p.productSku) && p.productSku.length > 0) {
        const total = p.productSku.reduce((sum: number, sku: any) => {
          const qty = sku.inventory?.sellInventory ?? sku.sellInventory ?? sku.inventory ?? 0;
          return sum + (typeof qty === 'number' ? qty : parseInt(qty) || 0);
        }, 0);
        if (total > 0) return total;
      }
    }
    return 0;
  } catch (err) {
    console.error(`Stock fetch error for ${pid}:`, err);
    return 0;
  }
}

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

        // Log first product structure to understand stock fields
        if (products.length > 0 && i === 0) {
          const sample = products[0];
          console.log("Sample product fields:", JSON.stringify({
            pid: sample.pid,
            sellPrice: sample.sellPrice,
            inventory: sample.inventory,
            sellInventory: sample.sellInventory,
            stock: sample.stock,
            sellableQuantity: sample.sellableQuantity,
            listingCount: sample.listingCount,
            productSkuSample: sample.productSku?.[0] ? {
              sellInventory: sample.productSku[0].sellInventory,
              inventory: sample.productSku[0].inventory,
            } : null,
          }));
        }

        // Fetch stock for each product (batch of 5 at a time to avoid rate limits)
        const stockMap: Record<string, number> = {};
        for (let j = 0; j < products.length; j += 5) {
          const batch = products.slice(j, j + 5);
          const stockResults = await Promise.all(
            batch.map((p: any) => fetchStockForProduct(String(p.pid), accessToken))
          );
          batch.forEach((p: any, idx: number) => {
            stockMap[String(p.pid)] = stockResults[idx];
          });
          if (j + 5 < products.length) await sleep(500);
        }

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

          // Use stock from detail API, fallback to list API fields
          const listStock = p.inventory?.sellInventory ?? p.sellInventory ?? p.productSku?.[0]?.inventory?.sellInventory ?? p.productSku?.[0]?.sellInventory ?? 0;
          const detailStock = stockMap[String(p.pid)] || 0;
          const finalStock = detailStock > 0 ? detailStock : (typeof listStock === 'number' ? listStock : parseInt(listStock) || 0);

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
            stock_quantity: finalStock,
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
