// Correção dos anúncios que o Mercado Livre marcou como "Inativo para revisar"
// ou deixou em revisão por descumprir as políticas de cadastro de produtos.
//
// Para cada anúncio: reescreve título e descrição pelas regras do ML e remove
// fotos que sejam arte/banner/marca d'água. Depois tenta reativar o anúncio.
//
// Uso (admin):
//   POST { apply: false, limit: 20 }            -> diagnóstico, não altera nada
//   POST { apply: true, limit: 20 }             -> aplica as correções
//   POST { apply: true, ml_item_ids: ["MLB..."] }
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { mlFetch } from "../_shared/mlClient.ts";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";
import {
  buildSafeDescription,
  filterCleanImages,
  looksLikeMLDom,
  sanitizeTitle,
  stripMLHtml,
} from "../_shared/ml-content-sanitizer.ts";

const MIN_REQUIRED_IMAGES = 3;
const GAP_MS = 4000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Pub = {
  id: string;
  user_id: string;
  ml_item_id: string;
  title: string | null;
  status: string | null;
};

type Result = {
  ml_item_id: string;
  status_before?: string;
  status_after?: string;
  title_fixed?: boolean;
  description_fixed?: boolean;
  images_fixed?: boolean;
  reactivated?: boolean;
  outcome: string;
  error?: string;
};

async function processItem(
  supabase: SupabaseClient,
  pub: Pub,
  apply: boolean,
): Promise<Result> {
  const out: Result = { ml_item_id: pub.ml_item_id, outcome: "ok" };

  const tokenRes = await getSellerAccessToken(supabase, pub.user_id);
  if (!tokenRes.ok) {
    return { ...out, outcome: "awaiting_reconnect", error: tokenRes.error };
  }
  const auth = { Authorization: `Bearer ${tokenRes.accessToken}` };

  const itemRes = await mlFetch(`https://api.mercadolibre.com/items/${pub.ml_item_id}`, { headers: auth });
  const item = await itemRes.json().catch(() => ({}));
  if (!itemRes.ok) {
    return { ...out, outcome: "ml_error", error: `GET ${itemRes.status}` };
  }

  const statusBefore = String(item.status ?? "");
  out.status_before = statusBefore;

  if (["closed", "under_review"].includes(statusBefore) === false && statusBefore !== "paused" && statusBefore !== "active" && statusBefore !== "inactive") {
    return { ...out, outcome: "skipped" };
  }
  if (statusBefore === "closed") {
    // anúncio encerrado pelo ML: só um novo anúncio resolve
    if (apply) {
      await supabase.from("user_publications").update({ status: "closed" }).eq("id", pub.id);
    }
    return { ...out, outcome: "closed_needs_republish" };
  }

  // --- título ---
  const brandAttr = (item.attributes ?? []).find((a: { id: string }) => a.id === "BRAND");
  const validatedBrand = brandAttr?.value_name && brandAttr.value_name !== "N/D"
    ? String(brandAttr.value_name)
    : null;
  const san = sanitizeTitle(String(item.title ?? ""), { validatedBrand, maxLength: 60 });
  const needTitle = Boolean(san.title) && san.title !== item.title;
  out.title_fixed = needTitle;

  // --- descrição ---
  const dRes = await mlFetch(`https://api.mercadolibre.com/items/${pub.ml_item_id}/description`, { headers: auth });
  const current = await dRes.json().catch(() => ({}));
  const rawDesc = String(current?.plain_text ?? current?.text ?? "");
  const descDirty = Boolean(rawDesc) && (looksLikeMLDom(rawDesc) || rawDesc !== stripMLHtml(rawDesc));
  let safeDesc = "";
  if (descDirty) {
    safeDesc = await buildSafeDescription({
      title: san.title || String(item.title ?? ""),
      attributes: item.attributes ?? [],
      rawDescription: rawDesc,
    });
  }
  out.description_fixed = descDirty;

  // --- imagens ---
  const urls: string[] = (item.pictures ?? [])
    .map((p: { secure_url?: string; url?: string }) => String(p.secure_url ?? p.url ?? ""))
    .filter(Boolean);
  const filtered = await filterCleanImages(urls, { useVision: true, max: 8 });
  const needImages = filtered.rejected.length > 0 && filtered.clean.length >= MIN_REQUIRED_IMAGES;
  out.images_fixed = needImages;
  if (filtered.rejected.length > 0 && filtered.clean.length < MIN_REQUIRED_IMAGES) {
    console.log(`[ml-fix-noncompliant] ${pub.ml_item_id} fotos recusadas:`,
      JSON.stringify(filtered.rejected.slice(0, 8)));
    out.error = `apenas ${filtered.clean.length} de ${urls.length} foto(s) dentro das diretrizes: ${
      filtered.rejected[0]?.reason ?? ""
    }`;
    out.outcome = "needs_new_photos";
  }

  if (!apply) {
    return out;
  }

  // --- aplica ---
  const patch: Record<string, unknown> = {};
  if (needTitle) patch.title = san.title;
  if (needImages) patch.pictures = filtered.clean.map((source) => ({ source }));

  const putItem = async (body: Record<string, unknown>) =>
    await mlFetch(`https://api.mercadolibre.com/items/${pub.ml_item_id}`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  if (Object.keys(patch).length > 0) {
    let putRes = await putItem(patch);
    if (!putRes.ok) {
      const t = await putRes.text();
      // Anúncios com variações (family_name) não aceitam alteração de título
      // pelo item; nesse caso aplicamos só as fotos e seguimos o reparo.
      if (t.includes("family_name") && patch.title) {
        delete patch.title;
        out.title_fixed = false;
        out.error = "título não pode ser alterado (anúncio com variações)";
        if (Object.keys(patch).length > 0) {
          putRes = await putItem(patch);
          if (!putRes.ok) {
            const t2 = await putRes.text();
            return { ...out, outcome: "ml_error", error: `PUT item ${putRes.status}: ${t2.slice(0, 300)}` };
          }
        }
      } else {
        return { ...out, outcome: "ml_error", error: `PUT item ${putRes.status}: ${t.slice(0, 300)}` };
      }
    }
  }

  if (descDirty && safeDesc) {
    const putDesc = await mlFetch(`https://api.mercadolibre.com/items/${pub.ml_item_id}/description`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ plain_text: safeDesc }),
    });
    if (!putDesc.ok) {
      out.description_fixed = false;
      out.error = `PUT description ${putDesc.status}`;
    }
  }

  // --- reativação ---
  if (statusBefore === "paused" || statusBefore === "inactive") {
    const act = await mlFetch(`https://api.mercadolibre.com/items/${pub.ml_item_id}`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    out.reactivated = act.ok;
    if (!act.ok) out.error = `reativação ${act.status}: ${(await act.text()).slice(0, 200)}`;
  }

  await sleep(1200);
  const checkRes = await mlFetch(
    `https://api.mercadolibre.com/items/${pub.ml_item_id}?attributes=status,sub_status`,
    { headers: auth },
  );
  const check = await checkRes.json().catch(() => ({}));
  out.status_after = String(check?.status ?? statusBefore);

  await supabase
    .from("user_publications")
    .update({ status: out.status_after })
    .eq("id", pub.id);


  return out;
}

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
    const isServiceRole = token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const repairToken = Deno.env.get("ML_REPAIR_TOKEN");
    const hasRepairToken = Boolean(repairToken) &&
      req.headers.get("x-repair-token") === repairToken;
    if (!isServiceRole && !hasRepairToken) {
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ error: "não autenticado" }, 401);
      const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!isAdmin) return json({ error: "acesso restrito a administradores" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const apply = body?.apply === true;
    const limit = Math.min(Number(body?.limit ?? 10), 30);
    const ids: string[] | null = Array.isArray(body?.ml_item_ids) ? body.ml_item_ids.map(String) : null;

    let query = supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id, title, status")
      .not("ml_item_id", "is", null);

    query = ids
      ? query.in("ml_item_id", ids)
      : query.in("status", ["under_review", "inactive", "paused"]).order("published_at", { ascending: false });

    // Sem lista explícita, nunca reprocessa o mesmo anúncio: o cron precisa
    // avançar na fila em vez de bater sempre nos primeiros itens.
    if (!ids) query = query.limit(limit * 20);
    else query = query.limit(limit);

    const { data: allPubs, error } = await query;
    if (error) return json({ error: error.message }, 500);

    let pubs = (allPubs ?? []) as Pub[];
    if (!ids && pubs.length) {
      const { data: done } = await supabase
        .from("ml_compliance_fixes")
        .select("ml_item_id")
        .eq("kind", "noncompliant_repair")
        .in("ml_item_id", pubs.map((p) => p.ml_item_id));
      const already = new Set((done ?? []).map((r) => String(r.ml_item_id)));
      pubs = pubs.filter((p) => !already.has(p.ml_item_id)).slice(0, limit);
    }

    const results: Result[] = [];
    for (const pub of (pubs ?? []) as Pub[]) {
      let r: Result;
      try {
        r = await processItem(supabase, pub, apply);
      } catch (err) {
        r = { ml_item_id: pub.ml_item_id, outcome: "error", error: String(err).slice(0, 300) };
      }
      results.push(r);
      // Registra sempre — inclusive falhas — para que o anúncio não volte à
      // fila indefinidamente e o histórico mostre o que ainda precisa de ação.
      if (apply) {
        const { error: logErr } = await supabase.from("ml_compliance_fixes").insert({
          kind: "noncompliant_repair",
          ml_item_id: pub.ml_item_id,
          publication_id: pub.id,
          seller_id: pub.user_id,
          batch: "repair",
          status: r.outcome === "ok" ? "success" : r.outcome,
          ml_status_before: r.status_before ?? pub.status,
          ml_status: r.status_after ?? r.status_before ?? pub.status,
          before_value: (pub.title ?? "").slice(0, 4000),
          error_message: r.error ?? null,
          processed_at: new Date().toISOString(),
        });
        if (logErr) console.error("[ml-fix-noncompliant] falha ao registrar histórico:", logErr.message);
      }
      await sleep(GAP_MS);
    }

    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
      return acc;
    }, {});

    return json({ apply, processed: results.length, summary, results });
  } catch (err) {
    console.error("[ml-fix-noncompliant]", err);
    return json({ error: String(err) }, 500);
  }
});
