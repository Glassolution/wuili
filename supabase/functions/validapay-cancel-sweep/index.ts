// Reconciliação de recorrências: encerra no gateway (ValidaPay) as assinaturas
// que já não deveriam mais cobrar (canceladas/expiradas do nosso lado).
// Sem isso o cliente continua sendo cobrado mesmo depois de cancelar.
//
// GET  ?inspect=1                        -> resumo da listagem no gateway
// POST { dry_run?: boolean, limit?: n }  -> reconcilia (dry_run padrão true)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getValidaPayToken, VALIDAPAY_API_URL } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCOPE =
  "checkouts/write checkouts/read subscriptions/write subscriptions/read pix.cob/read accounts/read";

const ACTIVE_DB_STATUSES = ["active", "trialing", "paid", "approved"];

type GwSub = {
  subscriptionId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  metadata?: { user_id?: string; plan?: string } | null;
  nextCycleChargeDate?: string | null;
  currentCycleAmount?: number | null;
};

/** Lista todas as assinaturas do gateway (paginação por lastKey). */
async function listGatewaySubs(token: string): Promise<GwSub[]> {
  const all: GwSub[] = [];
  let lastKey: string | null = null;
  for (let page = 0; page < 30; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (lastKey) qs.set("lastKey", lastKey);
    const resp = await fetch(`${VALIDAPAY_API_URL}/v1/subscriptions?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) break;
    const data = await resp.json() as { items?: GwSub[]; pagination?: { hasMore?: boolean; lastKey?: string } };
    all.push(...(data.items ?? []));
    if (!data.pagination?.hasMore || !data.pagination?.lastKey) break;
    lastKey = data.pagination.lastKey;
  }
  return all;
}

/** DELETE /v1/subscriptions/{id} — sem ?immediate, encerra ao fim do ciclo pago. */
async function cancelAtGateway(token: string, subId: string) {
  const resp = await fetch(`${VALIDAPAY_API_URL}/v1/subscriptions/${encodeURIComponent(subId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  return { ok: resp.ok, status: resp.status, body: (await resp.text()).slice(0, 200) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = await getValidaPayToken(SCOPE);
    const url = new URL(req.url);

    if (url.searchParams.get("inspect")) {
      const subs = await listGatewaySubs(token);
      return json({
        total: subs.length,
        cobrando: subs.filter((s) => s.status === "ACTIVE" && !s.cancelAtPeriodEnd).length,
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    const limit = Math.min(Number(body?.limit ?? 50), 200);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const gw = (await listGatewaySubs(token)).filter(
      (s) => String(s.status).toUpperCase() === "ACTIVE" && !s.cancelAtPeriodEnd,
    );

    // Quem realmente deve continuar cobrando: tem assinatura ativa e não cancelada no nosso banco.
    const { data: okRows } = await admin
      .from("subscriptions")
      .select("user_id")
      .in("status", ACTIVE_DB_STATUSES)
      .eq("cancel_at_period_end", false);
    const legit = new Set((okRows ?? []).map((r: { user_id: string }) => r.user_id));

    const alvos = gw.filter((s) => {
      const uid = s.metadata?.user_id;
      return !!uid && !legit.has(uid);
    });

    if (dryRun) {
      return json({
        dry_run: true,
        cobrando_no_gateway: gw.length,
        a_cancelar: alvos.length,
        exemplos: alvos.slice(0, 5).map((s) => ({
          sub: s.subscriptionId,
          user: s.metadata?.user_id,
          proxima_cobranca: s.nextCycleChargeDate,
        })),
      });
    }

    let ok = 0;
    const falhas: unknown[] = [];
    for (const s of alvos.slice(0, limit)) {
      const r = await cancelAtGateway(token, s.subscriptionId);
      if (r.ok) {
        ok++;
        await admin
          .from("subscriptions")
          .update({ provider_cancelled_at: new Date().toISOString(), cancel_at_period_end: true })
          .eq("user_id", s.metadata!.user_id!)
          .in("status", [...ACTIVE_DB_STATUSES, "expired", "cancelled"]);
      } else {
        falhas.push({ sub: s.subscriptionId, ...r });
      }
    }
    return json({
      alvos: alvos.length,
      processados: Math.min(alvos.length, limit),
      cancelados: ok,
      falhas: falhas.length,
      exemplos_falha: falhas.slice(0, 3),
    });
  } catch (err) {
    console.error("validapay-cancel-sweep:", err);
    return json({ error: String(err) }, 500);
  }
});
