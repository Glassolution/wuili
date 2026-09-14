// Cria uma página de produto com IA via PagePilot e registra em ai_product_pages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createPage, PagePilotError } from "../_shared/pagepilot.ts";

const RATE_LIMIT_SECONDS = 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isHttpUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as {
      product_url?: string;
      catalog_product_id?: string;
      language?: string;
      image_count?: number;
    };

    const language = typeof body.language === "string" && body.language.trim() ? body.language.trim() : "pt-BR";
    const imageCount = Math.min(Math.max(Number.isFinite(body.image_count) ? Number(body.image_count) : 4, 0), 6);

    let productUrl = typeof body.product_url === "string" ? body.product_url.trim() : "";
    let catalogProductId: string | null = null;

    if (body.catalog_product_id) {
      const { data: product, error: prodErr } = await admin
        .from("catalog_products")
        .select("id, product_url")
        .eq("id", body.catalog_product_id)
        .maybeSingle();
      if (prodErr || !product) return json({ error: "product_not_found" }, 404);
      catalogProductId = product.id;
      if (!productUrl) productUrl = String(product.product_url ?? "").trim();
    }

    if (!productUrl || !isHttpUrl(productUrl)) return json({ error: "invalid_product_url" }, 400);

    // Rate limit por usuário: 1 geração a cada 60s (ignora tentativas com erro).
    const { data: lastRow } = await admin
      .from("ai_product_pages")
      .select("created_at")
      .eq("user_id", userId)
      .neq("status", "erro")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRow?.created_at) {
      const elapsed = (Date.now() - new Date(lastRow.created_at).getTime()) / 1000;
      if (elapsed < RATE_LIMIT_SECONDS) {
        return json(
          { error: "rate_limited", retry_after_seconds: Math.ceil(RATE_LIMIT_SECONDS - elapsed) },
          429,
        );
      }
    }

    let providerPageId: string;
    try {
      const created = await createPage({ productUrl, language, imageCount });
      providerPageId = created.providerPageId;
    } catch (e) {
      if (e instanceof PagePilotError) {
        if (e.code === "plan_required") return json({ error: "plan_required" }, 403);
        if (e.code === "rate_limited") return json({ error: "rate_limited", retry_after_seconds: RATE_LIMIT_SECONDS }, 429);
        console.error("pagepilot create error:", e.code, e.message);
        return json({ error: "provider_error", message: e.message }, e.status);
      }
      throw e;
    }

    const { data: inserted, error: insErr } = await admin
      .from("ai_product_pages")
      .insert({
        user_id: userId,
        catalog_product_id: catalogProductId,
        source_url: productUrl,
        language,
        image_count: imageCount,
        provider: "pagepilot",
        provider_page_id: providerPageId,
        status: "gerando",
      })
      .select("id, status, created_at")
      .single();

    if (insErr) {
      console.error("ai_product_pages insert error:", insErr);
      return json({ error: "insert_failed", message: insErr.message }, 500);
    }

    return json(inserted);
  } catch (e) {
    console.error("ai-page-create error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
