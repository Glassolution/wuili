// Encerra no gateway (ValidaPay) as recorrências de assinaturas que já foram
// canceladas no nosso banco. Sem isso o cliente continua sendo cobrado.
//
// GET  ?probe=sub_xxx  -> testa os caminhos da API e devolve os status
// POST { dry_run?: boolean, limit?: number } -> varre e cancela
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getValidaPayToken, VALIDAPAY_API_URL } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CANDIDATES = (id: string) => [
  { method: "POST", path: `/v1/subscriptions/${encodeURIComponent(id)}/cancel` },
  { method: "DELETE", path: `/v1/subscriptions/${encodeURIComponent(id)}` },
  { method: "POST", path: `/subscriptions/${encodeURIComponent(id)}/cancel` },
  { method: "DELETE", path: `/subscriptions/${encodeURIComponent(id)}` },
  { method: "POST", path: `/v1/recurrences/${encodeURIComponent(id)}/cancel` },
  { method: "DELETE", path: `/v1/recurrences/${encodeURIComponent(id)}` },
];

async function tryCancel(subId: string) {
  const token = await getValidaPayToken();
  const attempts: Array<{ method: string; path: string; status: number; body: string }> = [];
  for (const c of CANDIDATES(subId)) {
    try {
      const resp = await fetch(`${VALIDAPAY_API_URL}${c.path}`, {
        method: c.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const body = (await resp.text()).slice(0, 300);
      attempts.push({ ...c, status: resp.status, body });
      if (resp.ok) return { ok: true, attempts };
    } catch (e) {
      attempts.push({ ...c, status: 0, body: String(e).slice(0, 200) });
    }
  }
  return { ok: false, attempts };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const probe = url.searchParams.get("probe");
    if (probe) return json(await tryCancel(probe));

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    const limit = Math.min(Number(body?.limit ?? 200), 500);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs } = await admin
      .from("subscriptions")
      .select("id,user_id,validapay_subscription_id,provider_cancelled_at,current_period_end")
      .eq("cancel_at_period_end", true)
      .is("provider_cancelled_at", null)
      .not("validapay_subscription_id", "is", null)
      .limit(limit);

    const rows = subs ?? [];
    if (dryRun) return json({ dry_run: true, pendentes: rows.length });

    let ok = 0;
    const failures: unknown[] = [];
    for (const s of rows) {
      const r = await tryCancel(s.validapay_subscription_id as string);
      if (r.ok) {
        ok++;
        await admin
          .from("subscriptions")
          .update({ provider_cancelled_at: new Date().toISOString() })
          .eq("id", s.id);
      } else {
        failures.push({ id: s.id, sub: s.validapay_subscription_id, attempts: r.attempts.slice(0, 2) });
      }
    }
    return json({ total: rows.length, cancelados: ok, falhas: failures.length, exemplos: failures.slice(0, 3) });
  } catch (err) {
    console.error("validapay-cancel-sweep:", err);
    return json({ error: String(err) }, 500);
  }
});
