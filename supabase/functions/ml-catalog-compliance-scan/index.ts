// Varre o catálogo já existente aplicando a mesma verificação de diretrizes do
// Mercado Livre que os importadores passaram a fazer na chegada do produto.
// Determinística (sem IA), em lotes limitados por chamada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { autoFixProduct, complianceColumns } from "../_shared/ml-compliance-precheck.ts";

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
    // Acesso: service role, token de reparo ou administrador autenticado.
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
    const limit = Math.min(Math.max(Number(body.limit ?? 500), 1), 2000);
    const recheckAll = body.recheck_all === true;

    let query = supabase
      .from("catalog_products")
      .select("id, title, description, images")
      .limit(limit);
    if (!recheckAll) query = query.eq("ml_compliance_status", "unchecked");

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const now = new Date().toISOString();
    const contagem: Record<string, number> = { ok: 0, needs_review: 0, blocked: 0 };
    let atualizados = 0;

    for (const row of rows ?? []) {
      // Além de verificar, já corrige: título higienizado e descrição reescrita.
      const corrigido = autoFixProduct(row);
      const veredito = corrigido.result;
      contagem[veredito.status] = (contagem[veredito.status] ?? 0) + 1;
      const { error: upErr } = await supabase
        .from("catalog_products")
        .update({
          title: corrigido.title || row.title,
          ...(row.description == null ? {} : { description: corrigido.description }),
          ...complianceColumns(veredito, now),
        })
        .eq("id", row.id);
      if (!upErr) atualizados++;
    }

    const { count: restantes } = await supabase
      .from("catalog_products")
      .select("id", { count: "exact", head: true })
      .eq("ml_compliance_status", "unchecked");

    return json({ ok: true, verificados: rows?.length ?? 0, atualizados, ...contagem, restantes });
  } catch (err) {
    console.error("[ml-catalog-compliance-scan]", err);
    return json({ error: String(err) }, 500);
  }
});
