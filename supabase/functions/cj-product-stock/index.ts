import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function getCjAccessToken(supabase: any): Promise<string | null> {
  const { data: cached } = await supabase
    .from("cj_token_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .single();

  if (cached?.access_token && new Date(cached.expires_at as string) > new Date()) {
    return cached.access_token as string;
  }

  const apiKey = Deno.env.get("CJ_API_KEY");
  if (!apiKey) return null;

  const res = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    },
  );
  const j = await res.json();
  if (!j?.result || j?.code !== 200) return null;

  const { accessToken } = j.data;
  await supabase.from("cj_token_cache").upsert({
    id: 1,
    access_token: accessToken,
    refresh_token: j.data.refreshToken,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return accessToken;
}

function extractStock(p: Record<string, unknown>): number {
  const direct =
    (p.inventory as number) ??
    (p.sellableQuantity as number) ??
    (p.stock as number) ??
    (p.availableQuantity as number) ??
    (p.sellInventory as number);
  if (typeof direct === "number" && direct > 0) return direct;

  if (Array.isArray(p.variants) && p.variants.length > 0) {
    const total = (p.variants as Record<string, unknown>[]).reduce((sum, v) => {
      const qty =
        (v.inventory as number) ??
        (v.sellableQuantity as number) ??
        (v.stock as number) ??
        (v.sellInventory as number) ??
        (v.availableQuantity as number) ??
        0;
      return sum + (typeof qty === "number" ? qty : parseInt(String(qty)) || 0);
    }, 0);
    if (total > 0) return total;
  }

  if (Array.isArray(p.productSku) && p.productSku.length > 0) {
    const total = (p.productSku as Record<string, unknown>[]).reduce((sum, sku) => {
      const inv = sku.inventory as Record<string, unknown> | number | undefined;
      const qty =
        (typeof inv === "object" ? (inv?.sellInventory as number) : undefined) ??
        (sku.sellInventory as number) ??
        (typeof inv === "number" ? inv : undefined) ??
        (sku.stock as number) ??
        (sku.createCount as number) ??
        0;
      return sum + (typeof qty === "number" ? qty : parseInt(String(qty)) || 0);
    }, 0);
    if (total > 0) return total;
  }

  // Product is listed/active on CJ — assume available
  if (p.status === "VALID" || p.status === "ON_SALE" || p.productNameEn || p.productName) {
    return 999;
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let pid = url.searchParams.get("pid");
    if (!pid && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      pid = body?.pid ?? body?.external_id ?? null;
    }
    if (!pid) return json({ error: "pid é obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const accessToken = await getCjAccessToken(supabase);
    if (!accessToken) return json({ error: "Falha ao autenticar na CJ" }, 502);

    const detailRes = await fetch(
      `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(pid)}`,
      { headers: { "CJ-Access-Token": accessToken } },
    );
    const detailJson = await detailRes.json();

    if (detailJson?.code !== 200 || !detailJson?.data) {
      return json({ stock: 0, available: false, source: "cj-empty" });
    }

    const stock = extractStock(detailJson.data);
    return json({
      stock,
      available: stock > 0,
      source: "cj-live",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return json({ error: message, stock: 0, available: false }, 500);
  }
});
