// Auditoria visual do catálogo: confere as FOTOS de cada produto com a mesma
// régua usada na publicação (`ml-publish`) e esconde do catálogo o produto que
// não tem o mínimo de fotos limpas exigido pelo Mercado Livre.
//
// Roda em lotes (cron). O veredito de cada foto fica em `ml_image_vision_cache`,
// então produtos já auditados custam praticamente nada para reconferir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { filterCleanImagesCached } from "../_shared/ml-image-vision.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const listaDeImagens = (images: unknown): string[] => {
  try {
    const raw = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(raw) ? raw.filter((i): i is string => typeof i === "string" && !!i) : [];
  } catch {
    return [];
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = !!token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const hasRepairToken = req.headers.get("x-repair-token") === Deno.env.get("ML_REPAIR_TOKEN");
    if (!isServiceRole && !hasRepairToken) {
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ error: "não autenticado" }, 401);
      const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!isAdmin) return json({ error: "acesso restrito a administradores" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 100);
    const recheckAll = body.recheck_all === true;
    const productId = typeof body.product_id === "string" ? body.product_id : null;

    let query = supabase
      .from("catalog_products")
      .select("id, title, images, is_blocked, ml_vision_checked_at")
      .eq("is_active", true)
      .order("ml_vision_checked_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (productId) query = supabase
      .from("catalog_products")
      .select("id, title, images, is_blocked, ml_vision_checked_at")
      .eq("id", productId);
    else if (!recheckAll) query = query.is("ml_vision_checked_at", null);

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 500);

    let aprovados = 0;
    let bloqueados = 0;

    for (const row of rows ?? []) {
      const imagens = listaDeImagens(row.images);
      const { clean } = await filterCleanImagesCached(supabase, imagens, { max: 6, maxChecks: 14 });
      // Mesma régua da publicação: basta uma foto dentro das diretrizes.
      const aprovado = clean.length >= 1;

      if (aprovado) aprovados++;
      else bloqueados++;

      await supabase
        .from("catalog_products")
        .update({
          ml_vision_clean_count: clean.length,
          ml_vision_clean_images: clean,
          ml_vision_checked_at: new Date().toISOString(),
          ml_clean_images_count: clean.length,
          ml_compliance_status: aprovado ? "ok" : "blocked",
          // Produto sem fotos suficientes some do catálogo em vez de aparecer
          // e falhar só na hora de publicar. Nunca DESbloqueamos aqui: o
          // bloqueio pode ter outra causa (conteúdo adulto, celular etc.).
          ...(aprovado ? {} : { is_blocked: true }),
        })
        .eq("id", row.id);
    }

    const { count: pendentes } = await supabase
      .from("catalog_products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("ml_vision_checked_at", null);

    return json({
      ok: true,
      auditados: rows?.length ?? 0,
      aprovados,
      bloqueados,
      pendentes: pendentes ?? 0,
    });
  } catch (err) {
    console.error("[ml-catalog-vision-audit]", err);
    return json({ error: String(err) }, 500);
  }
});
