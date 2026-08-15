// Enfileira as correções de conformidade dos anúncios já publicados no Mercado Livre.
// Ordem das fases: description -> title -> image.
// Cada job recebe um `scheduled_at` espaçado, para diluir a execução ao longo de
// horas (evita pico de atividade que o ML possa classificar como anormal).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isSuspiciousImageUrl, sanitizeTitle } from "../_shared/ml-content-sanitizer.ts";

// espaçamento entre chamadas ao ML, por tipo de correção (produção)
export const SPACING_MS: Record<string, number> = {
  description: 25_000, // ~144/h  -> 924 itens em ~6,5h
  title: 90_000, // ~40/h   -> 59 itens em ~1,5h
  image: 180_000, // dobro do título -> 39 itens em ~2h
};
const TEST_SPACING_MS = 15_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // --- auth: somente admin ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isServiceRole) {
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ error: "não autenticado" }, 401);
      const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!isAdmin) return json({ error: "acesso restrito a administradores" }, 403);
    }


    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "description");
    const mode = String(body.mode ?? "test"); // 'test' (5 itens) | 'full'
    if (!["description", "title", "image"].includes(kind)) {
      return json({ error: "kind inválido" }, 400);
    }

    // --- candidatos ---
    const { data: pubs } = await supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id, title, thumbnail, catalog_product_id")
      .in("status", ["active", "published"])
      .not("ml_item_id", "is", null)
      .limit(5000);

    let candidates = (pubs ?? []) as {
      id: string;
      user_id: string;
      ml_item_id: string;
      title: string;
      catalog_product_id: string | null;
    }[];

    if (kind === "title") {
      candidates = candidates.filter((p) => sanitizeTitle(p.title ?? "").removedTerms.length > 0);
    }

    if (kind === "image") {
      // Heurística barata: thumbnail suspeita (arte/banner/marca d'água) ou
      // imagens do produto de catálogo suspeitas. A checagem visual definitiva
      // é feita pelo worker, sobre as fotos reais do anúncio.
      const ids = candidates.map((p) => p.catalog_product_id).filter(Boolean) as string[];
      const dirty = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: prods } = await supabase
          .from("catalog_products")
          .select("id, images")
          .in("id", ids.slice(i, i + 200));
        for (const p of prods ?? []) {
          const imgs = Array.isArray(p.images) ? p.images : [];
          if (imgs.some((u: unknown) => isSuspiciousImageUrl(String(u)))) dirty.add(String(p.id));
        }
      }
      candidates = candidates.filter((p) =>
        isSuspiciousImageUrl(String((p as { thumbnail?: string }).thumbnail ?? "x")) ||
        (p.catalog_product_id ? dirty.has(p.catalog_product_id) : false)
      );
    }


    // já enfileirados não entram de novo
    const { data: existing } = await supabase
      .from("ml_compliance_fixes")
      .select("ml_item_id")
      .eq("kind", kind);
    const already = new Set((existing ?? []).map((r) => r.ml_item_id));
    candidates = candidates.filter((p) => !already.has(p.ml_item_id));

    const batch = mode === "test" ? "test" : "full";
    if (mode === "test") candidates = candidates.slice(0, Number(body.limit ?? 5));

    const spacing = mode === "test" ? TEST_SPACING_MS : SPACING_MS[kind];
    const start = Date.now() + 10_000;
    const rows = candidates.map((p, i) => ({
      kind,
      ml_item_id: p.ml_item_id,
      publication_id: p.id,
      seller_id: p.user_id,
      batch,
      before_value: kind === "title" ? p.title : null,
      scheduled_at: new Date(start + i * spacing).toISOString(),
    }));

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("ml_compliance_fixes").insert(rows.slice(i, i + 500));
      if (error) return json({ error: error.message }, 500);
    }

    return json({
      kind,
      mode,
      enqueued: rows.length,
      spacing_seconds: Math.round(spacing / 1000),
      estimated_finish: rows.length
        ? new Date(start + (rows.length - 1) * spacing).toISOString()
        : null,
    });
  } catch (err) {
    console.error("[ml-compliance-enqueue]", err);
    return json({ error: String(err) }, 500);
  }
});
