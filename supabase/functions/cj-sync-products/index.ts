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

async function fetchProductDetail(pid: string, accessToken: string): Promise<{ stock: number }> {
  try {
    const url = `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${pid}`;
    const res = await fetch(url, {
      headers: { "CJ-Access-Token": accessToken },
    });
    const json = await res.json();
    
    if (json.code === 200 && json.data) {
      const p = json.data;
      
      // Log first product detail to understand structure
      console.log(`Detail for ${pid}:`, JSON.stringify({
        inventory: p.inventory,
        sellableQuantity: p.sellableQuantity,
        stock: p.stock,
        status: p.status,
        listingCount: p.listingCount,
        variantCount: p.variants?.length,
        skuCount: p.productSku?.length,
        firstSku: p.productSku?.[0] ? {
          sellInventory: p.productSku[0].sellInventory,
          inventory: p.productSku[0].inventory,
          stock: p.productSku[0].stock,
          createCount: p.productSku[0].createCount,
        } : null,
        allKeys: Object.keys(p).filter(k => 
          k.toLowerCase().includes('stock') || 
          k.toLowerCase().includes('invent') || 
          k.toLowerCase().includes('quant') ||
          k.toLowerCase().includes('avail')
        ),
      }).substring(0, 500));

      // Try every possible stock field
      const directStock = p.inventory ?? p.sellableQuantity ?? p.stock ?? p.availableQuantity ?? p.sellInventory;
      if (typeof directStock === 'number' && directStock > 0) return { stock: directStock };

      // Sum from variants
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        const total = p.variants.reduce((sum: number, v: any) => {
          const qty = v.inventory ?? v.sellableQuantity ?? v.stock ?? v.sellInventory ?? v.availableQuantity ?? 0;
          return sum + (typeof qty === 'number' ? qty : parseInt(qty) || 0);
        }, 0);
        if (total > 0) return { stock: total };
      }

      // Sum from SKUs
      if (Array.isArray(p.productSku) && p.productSku.length > 0) {
        const total = p.productSku.reduce((sum: number, sku: any) => {
          const qty = sku.inventory?.sellInventory ?? sku.sellInventory ?? sku.inventory ?? sku.stock ?? sku.createCount ?? 0;
          return sum + (typeof qty === 'number' ? qty : parseInt(qty) || 0);
        }, 0);
        if (total > 0) return { stock: total };
      }

      // If product exists and is active on CJ, it's available for dropshipping
      // CJ handles fulfillment - if the product is listed, it's sellable
      if (p.status === 'VALID' || p.status === 'ON_SALE' || p.productNameEn || p.productName) {
        return { stock: 999 }; // CJ manages stock - product is available
      }
    }
    
    return { stock: 0 };
  } catch (err) {
    console.error(`Detail fetch error for ${pid}:`, err);
    return { stock: 0 };
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
    let detailChecked = false;

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
          results[cat.name] = 0;
          continue;
        }

        const products = json.data.list.filter(
          (p: any) => (p.sellPrice || p.productSku?.[0]?.sellPrice) > 0
        );

        // Log ALL stock-related fields from list API for first product
        if (products.length > 0 && !detailChecked) {
          detailChecked = true;
          const sample = products[0];
          console.log("LIST API - all fields:", Object.keys(sample).join(', '));
          console.log("LIST API - stock fields:", JSON.stringify({
            pid: sample.pid,
            inventory: sample.inventory,
            stock: sample.stock,
            sellInventory: sample.sellInventory,
            sellableQuantity: sample.sellableQuantity,
            listingCount: sample.listingCount,
            status: sample.status,
            productType: sample.productType,
            addMarkStatus: sample.addMarkStatus,
          }));
          
          // Check detail for first product only (to understand structure)
          await fetchProductDetail(String(sample.pid), accessToken);
          await sleep(500);
        }

        const rows = products.map((p: any) => {
          const costUsd = parseFloat(p.sellPrice || p.productSku?.[0]?.sellPrice || "0");
          const costBrl = Math.round(costUsd * USD_TO_BRL * 100) / 100;
          
          // Dynamic pricing: vary multiplier based on cost bracket
          let multiplier: number;
          if (costBrl < 20) multiplier = 3.0;       // cheap items → higher margin
          else if (costBrl < 50) multiplier = 2.8;
          else if (costBrl < 100) multiplier = 2.5;
          else if (costBrl < 300) multiplier = 2.2;
          else multiplier = 2.0;                     // expensive items → lower margin
          
          const suggestedBrl = Math.round(costBrl * multiplier * 100) / 100;
          const margin = suggestedBrl > 0
            ? Math.round(((suggestedBrl - costBrl) / suggestedBrl) * 10000) / 100
            : 0;

          const images = p.productImageSet?.length
            ? p.productImageSet.map((img: any) => typeof img === "string" ? img : img.imageUrl || img)
            : p.productImage ? [p.productImage] : [];

          // CJ is a dropshipping platform - if product is listed, it's available
          // The listingCount or presence in search results = available
          const isAvailable = (p.listingCount && p.listingCount > 0) || p.sellPrice > 0;
          const stockQty = isAvailable ? 999 : 0;

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
            stock_quantity: stockQty,
            is_active: true,
          };
        });

        if (rows.length > 0) {
          const { error } = await supabase
            .from("catalog_products")
            .upsert(rows, { onConflict: "external_id" });
          if (error) console.error(`Upsert error ${cat.name}:`, error);
          else console.log(`${cat.name}: ${rows.length} products synced, margins: ${rows.map(r => r.margin_percent.toFixed(0) + '%').slice(0, 3).join(', ')}...`);
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
