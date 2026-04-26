import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USD_TO_BRL = 5.0;
const MIN_PRICE_BRL = 8;

const CURATED_CATEGORIES = [
  { keyword: "beauty skincare", name: "Beleza e Cuidados Pessoais" },
  { keyword: "home kitchen organizer", name: "Casa e Jardim" },
  { keyword: "wireless earbuds gadget", name: "Eletrônicos e Gadgets" },
  { keyword: "women fashion accessories", name: "Moda Feminina" },
  { keyword: "fitness yoga sport", name: "Esporte e Lazer" },
  { keyword: "pet dog cat accessories", name: "Pet" },
  { keyword: "baby kids toys", name: "Bebês e Crianças" },
  { keyword: "storage organizer bathroom", name: "Organização e Utilidades" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(titles: string[]): Promise<string[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || titles.length === 0) return titles;

  const prompt = `Traduza os seguintes títulos de produtos do inglês para português brasileiro. 
Retorne APENAS um JSON array de strings traduzidas, na mesma ordem. 
Mantenha nomes de marcas em inglês. Seja conciso e natural, como um título de produto em loja brasileira.
Não adicione aspas extras, apenas o JSON array.

Títulos:
${JSON.stringify(titles)}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[cj-sync] Translation API error:", res.status);
      return titles;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("[cj-sync] Could not parse translation response");
      return titles;
    }

    const translated = JSON.parse(match[0]);
    if (Array.isArray(translated) && translated.length === titles.length) {
      console.log(`[cj-sync] Translated ${translated.length} titles`);
      return translated;
    }
    return titles;
  } catch (err) {
    console.error("[cj-sync] Translation error:", err);
    return titles;
  }
}

function passesQualityFilter(p: any): boolean {
  const hasImage =
    (Array.isArray(p.productImageSet) && p.productImageSet.length > 0) ||
    p.productImage;
  if (!hasImage) return false;

  const title = p.productNameEn || p.productName || "";
  if (title.length < 10) return false;

  const priceUsd = parseFloat(p.sellPrice || p.productSku?.[0]?.sellPrice || "0");
  if (priceUsd * USD_TO_BRL < MIN_PRICE_BRL) return false;

  return true;
}

function mapProduct(p: any, categoryName: string, translatedTitle?: string) {
  const costUsd = parseFloat(p.sellPrice || p.productSku?.[0]?.sellPrice || "0");
  const costBrl = Math.round(costUsd * USD_TO_BRL * 100) / 100;
  const originalUsd = parseFloat(p.retailPrice || p.sellPrice || "0");
  const originalBrl = Math.round(originalUsd * USD_TO_BRL * 100) / 100;

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

  const skuList = Array.isArray(p.productSku) ? p.productSku : [];
  const variants = skuList.map((sku: any) => ({
    skuId: sku.skuId || sku.vid || "",
    name: sku.skuName || sku.variantName || "",
    price: parseFloat(sku.sellPrice || "0") * USD_TO_BRL,
    image: sku.skuImage || null,
  }));

  const rating = parseFloat(p.productEvaluation || "0");
  const ordersCount = parseInt(p.listingCount || p.salesCount || "0", 10);

  const originalTitle = p.productNameEn || p.productName || "Sem título";

  return {
    source: "cj",
    external_id: String(p.pid),
    title: translatedTitle || originalTitle,
    description: p.description || originalTitle,
    images: JSON.stringify(images),
    cost_price: costBrl,
    original_price: originalBrl,
    suggested_price: suggestedBrl,
    margin_percent: margin,
    category: categoryName,
    supplier_name: p.supplierName || "CJ Dropshipping",
    supplier_contact: null,
    stock_quantity: 999,
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
    let totalNew = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    // Snapshot de external_ids existentes para distinguir novos de atualizados
    const { data: existingRows } = await supabase
      .from("catalog_products")
      .select("external_id");
    const existingIds = new Set((existingRows || []).map((r: any) => r.external_id));

    // Rotate pages to fetch different products each sync (1–10)
    const syncPage = String(Math.floor(Math.random() * 10) + 1);
    console.log(`[cj-sync] Using page ${syncPage} for this sync`);

    for (let i = 0; i < CURATED_CATEGORIES.length; i++) {
      const cat = CURATED_CATEGORIES[i];
      if (i > 0) await sleep(1500);

      try {
        const params = new URLSearchParams({
          productNameEn: cat.keyword,
          pageNum: syncPage,
          pageSize: "50",
        });

        const url = `https://developers.cjdropshipping.com/api2.0/v1/product/list?${params}`;
        const res = await fetch(url, {
          headers: { "CJ-Access-Token": accessToken },
        });
        const json = await res.json();

        console.log(`[cj-sync] ${cat.name}: code=${json.code}, raw=${json.data?.list?.length || 0}`);

        if (json.code !== 200 || !json.data?.list) {
          errors.push(`${cat.name}: API code ${json.code} - ${json.message || ''}`);
          summary[cat.name] = 0;
          continue;
        }

        let filtered = json.data.list.filter(passesQualityFilter);

        filtered = filtered.filter((p: any) => {
          const price = parseFloat(p.sellPrice || p.productSku?.[0]?.sellPrice || "0");
          return price >= 1 && price <= 40;
        });

        filtered.sort((a: any, b: any) => {
          const wa = parseFloat(a.productWeight || "9999");
          const wb = parseFloat(b.productWeight || "9999");
          const lightA = wa <= 0.5 ? 0 : 1;
          const lightB = wb <= 0.5 ? 0 : 1;
          return lightA - lightB;
        });

        const top20 = filtered.slice(0, 20);

        // Translate titles to Portuguese
        const englishTitles = top20.map((p: any) => p.productNameEn || p.productName || "");
        const translatedTitles = await translateBatch(englishTitles);

        const rows = top20.map((p: any, idx: number) => mapProduct(p, cat.name, translatedTitles[idx]));

        if (rows.length > 0) {
          const { error } = await supabase
            .from("catalog_products")
            .upsert(rows, { onConflict: "external_id" });

          if (error) {
            console.error(`[cj-sync] Upsert error ${cat.name}:`, error);
            errors.push(`${cat.name}: upsert - ${error.message}`);
          } else {
            const newInCat = rows.filter((r: any) => !existingIds.has(r.external_id)).length;
            const updatedInCat = rows.length - newInCat;
            totalNew += newInCat;
            totalUpdated += updatedInCat;
            console.log(`[cj-sync] ${cat.name}: ${rows.length} synced (${newInCat} novos, ${updatedInCat} atualizados)`);
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
        added: totalNew,
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