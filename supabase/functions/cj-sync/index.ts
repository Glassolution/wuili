import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USD_TO_BRL = 5.0;
const MIN_PRICE_BRL = 8;

const CURATED_CATEGORIES = [
  { categoryId: "2447", name: "Beleza e Cuidados Pessoais" },
  { categoryId: "2448", name: "Casa e Jardim" },
  { categoryId: "2446", name: "Eletrônicos e Gadgets" },
  { categoryId: "2440", name: "Moda Feminina" },
  { categoryId: "2453", name: "Esporte e Lazer" },
  { categoryId: "2458", name: "Pet" },
  { categoryId: "2450", name: "Bebês e Crianças" },
  { categoryId: "2449", name: "Organização e Utilidades" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function passesQualityFilter(p: any): boolean {
  // Must have images
  const hasImage =
    (Array.isArray(p.productImageSet) && p.productImageSet.length > 0) ||
    p.productImage;
  if (!hasImage) return false;

  // Title min 10 chars
  const title = p.productNameEn || p.productName || "";
  if (title.length < 10) return false;

  // Min price
  const priceUsd = parseFloat(p.sellPrice || p.productSku?.[0]?.sellPrice || "0");
  if (priceUsd * USD_TO_BRL < MIN_PRICE_BRL) return false;

  return true;
}

function mapProduct(p: any, categoryName: string) {
  const costUsd = parseFloat(p.sellPrice || p.productSku?.[0]?.sellPrice || "0");
  const costBrl = Math.round(costUsd * USD_TO_BRL * 100) / 100;
  const originalUsd = parseFloat(p.retailPrice || p.sellPrice || "0");
  const originalBrl = Math.round(originalUsd * USD_TO_BRL * 100) / 100;

  // Dynamic margin based on cost bracket
  let multiplier: number;
  if (costBrl < 20) multiplier = 3.0;
  else if (costBrl < 50) multiplier = 2.8;
  else if (costBrl < 100) multiplier = 2.5;
  else if (costBrl < 300) multiplier = 2.2;
  else multiplier = 2.0;

  const suggestedBrl = Math.round(costBrl * multiplier * 100) / 100;
  const margin =
    suggestedBrl > 0
      ? Math.round(((suggestedBrl - costBrl) / suggestedBrl) * 10000) / 100
      : 0;

  const images = p.productImageSet?.length
    ? p.productImageSet.map((img: any) =>
        typeof img === "string" ? img : img.imageUrl || img
      )
    : p.productImage
    ? [p.productImage]
    : [];

  const weight = parseFloat(p.productWeight || p.packWeight || "0");

  // Variants from SKUs
  const variants =
    p.productSku?.map((sku: any) => ({
      skuId: sku.skuId || sku.vid,
      name: sku.skuName || sku.variantName || "",
      price: parseFloat(sku.sellPrice || "0") * USD_TO_BRL,
      image: sku.skuImage || null,
    })) || [];

  const rating = parseFloat(p.productEvaluation || "0");
  const ordersCount = parseInt(p.listingCount || p.salesCount || "0", 10);

  return {
    source: "cj",
    external_id: String(p.pid),
    title: p.productNameEn || p.productName || "Sem título",
    description: p.description || p.productNameEn || null,
    images: JSON.stringify(images),
    cost_price: costBrl,
    original_price: originalBrl,
    suggested_price: suggestedBrl,
    margin_percent: margin,
    category: categoryName,
    supplier_name: p.supplierName || "CJ Dropshipping",
    supplier_contact: null,
    stock_quantity: 999, // CJ manages stock
    is_active: true,
    weight,
    variants: JSON.stringify(variants),
    rating,
    orders_count: ordersCount,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get CJ access token
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
    const summary: Record<string, number> = {};
    let totalSynced = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    for (let i = 0; i < CURATED_CATEGORIES.length; i++) {
      const cat = CURATED_CATEGORIES[i];
      if (i > 0) await sleep(1500); // Rate limiting

      try {
        const params = new URLSearchParams({
          categoryId: cat.categoryId,
          pageNum: "1",
          pageSize: "50",
          orderBy: "ORDERS",
          minPrice: "5",
          maxPrice: "200",
        });

        const url = `https://developers.cjdropshipping.com/api2.0/v1/product/list?${params}`;
        const res = await fetch(url, {
          headers: { "CJ-Access-Token": accessToken },
        });
        const json = await res.json();

        console.log(`[cj-sync] ${cat.name} (${cat.categoryId}): code=${json.code}, total=${json.data?.list?.length || 0}`);

        if (json.code !== 200 || !json.data?.list) {
          errors.push(`${cat.name}: API code ${json.code}`);
          summary[cat.name] = 0;
          continue;
        }

        // Quality filter + sort by weight (lighter first for cheaper shipping)
        let filtered = json.data.list.filter(passesQualityFilter);

        // Prioritize lighter products (< 500g)
        filtered.sort((a: any, b: any) => {
          const wa = parseFloat(a.productWeight || "9999");
          const wb = parseFloat(b.productWeight || "9999");
          const lightA = wa <= 0.5 ? 0 : 1;
          const lightB = wb <= 0.5 ? 0 : 1;
          return lightA - lightB;
        });

        // Take top 20
        const top20 = filtered.slice(0, 20);
        const rows = top20.map((p: any) => mapProduct(p, cat.name));

        if (rows.length > 0) {
          const { error, count } = await supabase
            .from("catalog_products")
            .upsert(rows, { onConflict: "external_id", count: "exact" });

          if (error) {
            console.error(`[cj-sync] Upsert error ${cat.name}:`, error);
            errors.push(`${cat.name}: upsert error`);
          } else {
            console.log(`[cj-sync] ${cat.name}: ${rows.length} products synced`);
          }
        }

        summary[cat.name] = rows.length;
        totalSynced += rows.length;
      } catch (catErr) {
        console.error(`[cj-sync] Error ${cat.name}:`, catErr);
        errors.push(`${cat.name}: ${String(catErr)}`);
        summary[cat.name] = 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        updated: totalUpdated,
        byCategory: summary,
        errors,
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
