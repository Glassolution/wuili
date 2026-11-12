// admin-close-aliexpress-listings
// --------------------------------
// Ação única ordenada pelo dono: encerra (closed) no Mercado Livre todos os
// anúncios de produtos AliExpress, de qualquer conta. Encerrar NÃO tem volta no ML.
// - Só admins (user_roles).
// - mode "preview": só lista, não toca no ML.
// - mode "execute": exige confirm = "ENCERRAR_ALIEXPRESS"; processa até `limit` por chamada.
// - Cada tentativa fica registrada em aliexpress_listing_closures (append-only).
// - Atualiza user_publications com compare-and-set no status anterior.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mlFetch } from "../_shared/mlClient.ts";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TARGET_STATUSES = ["active", "paused", "under_review", "inactive"];
const CONFIRM = "ENCERRAR_ALIEXPRESS";

type Pub = { id: string; user_id: string; ml_item_id: string; catalog_product_id: string | null; status: string | null };

async function aliexpressKeys(db: SupabaseClient): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("catalog_products").select("id, external_id")
      .eq("source", "aliexpress").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      keys.add(String(r.id));
      if (r.external_id) keys.add(String(r.external_id));
    }
    if (!data || data.length < 1000) break;
  }
  return keys;
}

async function targets(db: SupabaseClient): Promise<Pub[]> {
  const keys = [...(await aliexpressKeys(db))];
  const out: Pub[] = [];
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await db.from("user_publications")
      .select("id, user_id, ml_item_id, catalog_product_id, status")
      .in("catalog_product_id", keys.slice(i, i + 200))
      .in("status", TARGET_STATUSES);
    if (error) throw error;
    out.push(...((data ?? []) as Pub[]));
  }
  return out.sort((a, b) => a.user_id.localeCompare(b.user_id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Não autenticado." }, 401);
    const { data: role } = await db.from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Acesso restrito a admins." }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "execute" ? "execute" : body?.mode === "inspect" ? "inspect" : "preview";
    const limit = Math.min(Math.max(Number(body?.limit) || 20, 1), 40);

    const all = await targets(db);
    const byStatus: Record<string, number> = {};
    for (const p of all) byStatus[p.status ?? "?"] = (byStatus[p.status ?? "?"] ?? 0) + 1;
    if (mode === "preview") {
      return json({ mode, remaining: all.length, users: new Set(all.map((p) => p.user_id)).size, byStatus });
    }
    if (body?.mode === "inspect") {
      // Só leitura: status atual no ML dos que restaram.
      const seen = new Map<string, string | null>();
      const counts: Record<string, number> = {};
      for (const p of all) {
        let token = seen.get(p.user_id);
        if (token === undefined) {
          const t = await getSellerAccessToken(db, p.user_id);
          token = t.ok ? t.accessToken : null;
          seen.set(p.user_id, token);
        }
        let k = `velo:${p.status}|ml:sem_token`;
        if (token) {
          const g = await mlFetch(`https://api.mercadolibre.com/items/${p.ml_item_id}`, { headers: { Authorization: `Bearer ${token}` } });
          const gi = await g.json().catch(() => ({}));
          k = `velo:${p.status}|ml:${gi?.status ?? g.status}/${(gi?.sub_status ?? []).join(",")}`;
        }
        counts[k] = (counts[k] ?? 0) + 1;
      }
      return json({ mode: "inspect", counts });
    }
    if (body?.confirm !== CONFIRM) return json({ error: `Confirmação obrigatória: ${CONFIRM}` }, 400);

    // Pula quem já falhou por falta de token nesta mesma ordem (evita repetir sem fim).
    const { data: failedTok } = await db.from("aliexpress_listing_closures")
      .select("publication_id").eq("result", "sem_token");
    const skip = new Set((failedTok ?? []).map((r) => r.publication_id));
    const skipFailed = body?.retry_failed !== true;
    const { data: failedMl } = skipFailed
      ? await db.from("aliexpress_listing_closures").select("publication_id").eq("result", "falha_ml")
      : { data: [] as { publication_id: string }[] };
    for (const r of failedMl ?? []) skip.add(r.publication_id);

    const batch = all.filter((p) => !skip.has(p.id)).slice(0, limit);
    const tokens = new Map<string, string | null>();
    const results: Record<string, number> = {};
    const failures: { ml_item_id: string; status: number | null; msg: string }[] = [];

    for (const p of batch) {
      let token = tokens.get(p.user_id);
      if (token === undefined) {
        const t = await getSellerAccessToken(db, p.user_id);
        token = t.ok ? t.accessToken : null;
        tokens.set(p.user_id, token);
      }
      let result: string;
      let http: number | null = null;
      let resp = "";
      if (!token) {
        result = "sem_token";
      } else {
        const url = `https://api.mercadolibre.com/items/${p.ml_item_id}`;
        let res: Response;
        try {
          res = await mlFetch(url, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "closed" }),
          });
        } catch (e) {
          // Disjuntor do ML aberto ou rede: para o lote sem registrar falha definitiva.
          console.error("[admin-close-aliexpress-listings] ml indisponível", e);
          return json({ mode, processed: Object.values(results).reduce((a, b) => a + b, 0), results, failures, stopped: "ml_indisponivel" });
        }
        http = res.status;
        resp = (await res.text()).slice(0, 500);
        if (res.ok) {
          result = "encerrado";
        } else {
          // Confere se já está encerrado no ML.
          const g = await mlFetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const gi = await g.json().catch(() => ({}));
          result = gi?.status === "closed" ? "ja_encerrado" : "falha_ml";
        }
      }
      await db.from("aliexpress_listing_closures").insert({
        publication_id: p.id, user_id: p.user_id, ml_item_id: p.ml_item_id,
        catalog_product_id: p.catalog_product_id, previous_status: p.status,
        result, ml_http_status: http, ml_response: resp || null, requested_by: u.user.id,
      });
      if (result === "encerrado" || result === "ja_encerrado") {
        await db.from("user_publications").update({
          status: "closed", ml_closed_at: new Date().toISOString(),
          paused_reason: "aliexpress_somente_admin", updated_at: new Date().toISOString(),
        }).eq("id", p.id).eq("status", p.status ?? "");
      } else {
        failures.push({ ml_item_id: p.ml_item_id, status: http, msg: resp.slice(0, 160) || result });
      }
      results[result] = (results[result] ?? 0) + 1;
    }

    return json({ mode, processed: batch.length, results, failures, remaining_before: all.length });
  } catch (err) {
    console.error("[admin-close-aliexpress-listings] erro:", err);
    return json({ error: "Erro inesperado." }, 500);
  }
});
