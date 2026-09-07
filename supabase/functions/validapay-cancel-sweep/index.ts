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

const SCOPE =
  "checkouts/write checkouts/read subscriptions/write subscriptions/read pix.cob/read pix.cob/write accounts/read wallet/read wallet/write";

// A ValidaPay encerra recorrência com DELETE /v1/subscriptions/{id}
// (?immediate=true corta na hora; sem o parâmetro, agenda para o fim do ciclo).
const CANDIDATES = (id: string, immediate: boolean) => [
  { method: "GET", path: `/v1/subscriptions/${encodeURIComponent(id)}`, body: undefined as string | undefined },
  {
    method: "DELETE",
    path: `/v1/subscriptions/${encodeURIComponent(id)}${immediate ? "?immediate=true" : ""}`,
    body: undefined,
  },
  { method: "DELETE", path: `/v1/subscriptions/${encodeURIComponent(id)}`, body: undefined },
];


/** Algumas assinaturas guardam o id da sessão de checkout (cs_...): resolve o sub_. */
async function resolveSubId(id: string, token: string): Promise<string> {
  if (!id.startsWith("cs_")) return id;
  try {
    const resp = await fetch(`${VALIDAPAY_API_URL}/v1/checkout-sessions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return id;
    const data = await resp.json().catch(() => null) as Record<string, unknown> | null;
    const found = (data?.subscriptionId ?? data?.subscription_id ??
      (data?.subscription as Record<string, unknown> | undefined)?.id) as string | undefined;
    return found ?? id;
  } catch {
    return id;
  }
}

async function inspectSession(id: string) {
  const token = await getValidaPayToken(SCOPE);
  const out: Record<string, unknown> = {};
  for (const path of [`/v1/checkout-sessions/${encodeURIComponent(id)}`, `/v1/subscriptions?checkoutId=${encodeURIComponent(id)}`]) {
    const resp = await fetch(`${VALIDAPAY_API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    out[path] = { status: resp.status, body: (await resp.text()).slice(0, 900) };
  }
  return out;
}

async function tryCancel(rawId: string, probe = false, immediate = false) {

  const token = await getValidaPayToken(SCOPE);
  const subId = await resolveSubId(rawId, token);
  const attempts: Array<{ method: string; path: string; status: number; body: string }> = [];
  for (const c of CANDIDATES(subId, immediate)) {
    if (!probe && c.method === "GET") continue;


    try {
      const resp = await fetch(`${VALIDAPAY_API_URL}${c.path}`, {
        method: c.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(c.body ? { body: c.body } : {}),
      });
      const body = (await resp.text()).slice(0, 300);
      attempts.push({ method: c.method, path: c.path, status: resp.status, body });
      if (resp.ok && c.method !== "GET") return { ok: true, attempts };
    } catch (e) {
      attempts.push({ method: c.method, path: c.path, status: 0, body: String(e).slice(0, 200) });
    }
  }
  return { ok: false, attempts };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const inspect = url.searchParams.get("inspect");
    if (inspect) return json(await inspectSession(inspect));
    const probe = url.searchParams.get("probe");

    if (probe) return json(await tryCancel(probe, true));

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
      // Período já vencido: corta na hora. Ainda vigente: agenda para o fim.
      const vencida = !s.current_period_end || new Date(s.current_period_end as string).getTime() < Date.now();
      const r = await tryCancel(s.validapay_subscription_id as string, false, vencida);

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
