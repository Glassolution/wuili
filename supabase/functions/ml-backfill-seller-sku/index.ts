// One-off: grava SELLER_SKU = id do produto do catálogo nos anúncios ativos
// antigos, para a Velo reconhecer o anúncio mesmo se o vendedor mudar título/fotos.
// Segurança: só admin (JWT com role admin) ou service role.
// Nunca sobrescreve um SKU que o próprio vendedor colocou; pula anúncios com
// variações (SKU fica por variação). Processa em lotes (cursor por id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Sb = ReturnType<typeof createClient>;

async function getFreshToken(sb: Sb, userId: string): Promise<string | null> {
  const { data: integ } = await sb.from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId).eq("platform", "mercadolivre").maybeSingle();
  if (!integ?.access_token) return null;
  const exp = integ.expires_at ? new Date(integ.expires_at as string) : new Date(0);
  if (exp > new Date(Date.now() + 60_000)) return integ.access_token as string;
  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: (integ.refresh_token as string) ?? "",
    }),
  });
  const rd = await r.json().catch(() => ({}));
  if (!r.ok || !rd.access_token) return null;
  await sb.from("user_integrations").update({
    access_token: rd.access_token,
    refresh_token: rd.refresh_token,
    expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("platform", "mercadolivre");
  return rd.access_token as string;
}

type Row = { id: string; user_id: string; ml_item_id: string; catalog_product_id: string };

async function processItem(token: string, row: Row, externalId: string, dryRun: boolean) {
  const g = await fetch(
    `https://api.mercadolibre.com/items/${row.ml_item_id}?attributes=id,status,attributes,variations`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!g.ok) return { outcome: "failed_get", error: `GET ${g.status}` };
  const item = await g.json();
  if (item?.status === "closed") return { outcome: "closed" };
  if (Array.isArray(item?.variations) && item.variations.length > 0) return { outcome: "has_variations" };
  const attrs: Array<Record<string, unknown>> = Array.isArray(item?.attributes) ? item.attributes : [];
  const cur = String(attrs.find((a) => a?.id === "SELLER_SKU")?.value_name ?? "").trim();
  if (cur === row.catalog_product_id) return { outcome: "already_ok" };
  const replaceable = cur === "" || cur === "SKU-001" || (externalId && cur === externalId);
  if (!replaceable) return { outcome: "custom_sku_kept", current: cur };
  if (dryRun) return { outcome: "would_fix", current: cur };
  const p = await fetch(`https://api.mercadolibre.com/items/${row.ml_item_id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ attributes: [{ id: "SELLER_SKU", value_name: row.catalog_product_id }] }),
  });
  if (!p.ok) return { outcome: "failed_put", error: `PUT ${p.status}: ${(await p.text().catch(() => "")).slice(0, 300)}` };
  return { outcome: "fixed" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);
    if (jwt !== serviceKey) {
      const { data: u } = await sb.auth.getUser(jwt);
      if (!u?.user) return json({ error: "unauthorized" }, 401);
      const { data: roleRow } = await sb.from("user_roles").select("id").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ error: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 300);
    const after = typeof body.after === "string" ? body.after : "00000000-0000-0000-0000-000000000000";
    const dryRun = body.dry_run === true;

    const { data: rows, error } = await sb.from("user_publications")
      .select("id, user_id, ml_item_id, catalog_product_id")
      .eq("status", "active").not("ml_item_id", "is", null).not("catalog_product_id", "is", null)
      .gt("id", after).order("id").limit(limit);
    if (error) return json({ error: error.message }, 500);
    const list = (rows ?? []) as Row[];

    const ids = [...new Set(list.map((r) => r.catalog_product_id))];
    const extMap = new Map<string, string>();
    if (ids.length) {
      const { data: cps } = await sb.from("catalog_products").select("id, external_id").in("id", ids);
      for (const c of cps ?? []) extMap.set(String(c.id), String(c.external_id ?? ""));
    }

    const tokens = new Map<string, Promise<string | null>>();
    const counts: Record<string, number> = {};
    const failures: unknown[] = [];
    const queue = [...list];
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        if (!tokens.has(row.user_id)) tokens.set(row.user_id, getFreshToken(sb, row.user_id));
        const token = await tokens.get(row.user_id)!;
        let res: { outcome: string; error?: string; current?: string };
        if (!token) res = { outcome: "no_token" };
        else {
          try { res = await processItem(token, row, extMap.get(row.catalog_product_id) ?? "", dryRun); }
          catch (e) { res = { outcome: "failed_put", error: String(e) }; }
        }
        counts[res.outcome] = (counts[res.outcome] ?? 0) + 1;
        if (res.outcome.startsWith("failed")) failures.push({ ml_item_id: row.ml_item_id, ...res });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    return json({
      processed: list.length,
      next_after: list.length === limit ? list[list.length - 1].id : null,
      dry_run: dryRun,
      counts,
      failures: failures.slice(0, 20),
    });
  } catch (e) {
    console.error("ml-backfill-seller-sku", e);
    return json({ error: String(e) }, 500);
  }
});
