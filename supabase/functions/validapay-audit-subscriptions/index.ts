// Diagnóstico TEMPORÁRIO da auditoria de pagamentos (out/2026).
// Somente leitura: consulta a ValidaPay, o Mercado Pago e o Stripe e devolve
// CONTAGENS agregadas (nunca dados pessoais). Apagar depois da auditoria.
//
// POST { mode: "gateway-list" }                    -> paginação completa da listagem do gateway
// POST { mode: "audit", offset?, limit? }          -> consulta por ID as assinaturas vencidas
// POST { mode: "renewed-check" }                   -> confere os renewed sem chargeId
// POST { mode: "mp" }                              -> situação das vencidas do Mercado Pago
// POST { mode: "stripe" }                          -> situação das vencidas do Stripe
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  getValidaPayToken,
  isConfirmedPayment,
  lookupPaymentStatus,
  VALIDAPAY_API_URL,
} from "../_shared/validapay.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const VP_SCOPE = "subscriptions/read checkouts/read pix.cob/read accounts/read";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GwSub = {
  subscriptionId: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  nextCycleChargeDate?: string | null;
};

/** Lista TODAS as assinaturas do gateway, percorrendo todas as páginas. */
async function listAllGatewaySubs(token: string) {
  const all: GwSub[] = [];
  let lastKey: string | null = null;
  let pages = 0;
  for (let page = 0; page < 60; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (lastKey) qs.set("lastKey", lastKey);
    const resp = await fetch(`${VALIDAPAY_API_URL}/v1/subscriptions?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return { all, pages, error: `HTTP ${resp.status}` };
    const data = await resp.json() as {
      items?: GwSub[];
      pagination?: { hasMore?: boolean; lastKey?: string };
    };
    pages++;
    all.push(...(data.items ?? []));
    if (!data.pagination?.hasMore || !data.pagination?.lastKey) break;
    if (data.pagination.lastKey === lastKey) break; // proteção contra loop
    lastKey = data.pagination.lastKey;
  }
  return { all, pages };
}

/** Consulta UMA assinatura no gateway pelo ID. */
async function getGatewaySub(token: string, id: string): Promise<{ status: string; cancelAtPeriodEnd?: boolean } | null> {
  const resp = await fetch(`${VALIDAPAY_API_URL}/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const node = (data?.data ?? data) as GwSub;
  return { status: String(node.status ?? ""), cancelAtPeriodEnd: node.cancelAtPeriodEnd };
}

function classify(sub: { status: string; cancelAtPeriodEnd?: boolean } | null): string {
  if (!sub) return "nao_existe_no_gateway";
  const s = sub.status.toUpperCase();
  if (s === "ACTIVE" && !sub.cancelAtPeriodEnd) return "pagando";
  if (s === "ACTIVE" && sub.cancelAtPeriodEnd) return "cancelada_ao_fim_do_periodo";
  if (["PAST_DUE", "PENDING", "INCOMPLETE", "UNPAID"].includes(s)) return "cobranca_em_aberto";
  if (["CANCELLED", "CANCELED", "EXPIRED", "ENDED"].includes(s)) return "cancelada";
  return `outro:${s || "vazio"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const mode = String(body?.mode ?? "");

  try {
    if (mode === "gateway-list") {
      const token = await getValidaPayToken(VP_SCOPE);
      const { all, pages, error } = await listAllGatewaySubs(token);
      const byStatus: Record<string, number> = {};
      for (const s of all) {
        const key = `${String(s.status).toUpperCase()}${s.cancelAtPeriodEnd ? "+cancel_ao_fim" : ""}`;
        byStatus[key] = (byStatus[key] ?? 0) + 1;
      }
      return json({ total: all.length, paginas_percorridas: pages, erro: error ?? null, por_status: byStatus });
    }

    if (mode === "audit") {
      const offset = Math.max(0, Number(body?.offset ?? 0));
      const limit = Math.min(Math.max(1, Number(body?.limit ?? 60)), 60);
      const { data: rows, error } = await admin
        .from("subscriptions")
        .select("validapay_subscription_id")
        .eq("provider", "validapay")
        .eq("status", "active")
        .lt("current_period_end", new Date().toISOString())
        .not("validapay_subscription_id", "is", null)
        .order("validapay_subscription_id")
        .range(offset, offset + limit - 1);
      if (error) return json({ error: error.message }, 500);

      const token = await getValidaPayToken(VP_SCOPE);
      const counts: Record<string, number> = {};
      const detalhe: Array<{ id: string; grupo: string }> = [];
      const falhas: string[] = [];
      for (const r of rows ?? []) {
        const id = String(r.validapay_subscription_id);
        try {
          const grupo = classify(await getGatewaySub(token, id));
          counts[grupo] = (counts[grupo] ?? 0) + 1;
          detalhe.push({ id, grupo });
        } catch (err) {
          falhas.push(`${id}: ${String(err)}`);
        }
        await sleep(120); // respeita rate limit do gateway
      }
      return json({ offset, processados: (rows ?? []).length, counts, falhas, detalhe });
    }

    if (mode === "renewed-check") {
      const { data: events } = await admin
        .from("validapay_webhook_events")
        .select("subscription_id, created_at")
        .eq("event", "subscription.renewed")
        .is("charge_id", null)
        .order("created_at");
      const resultado: Array<{ subscription_id: string; evento_em: string; pago_confirmado: boolean; status: string | null; fonte: string | null }> = [];
      for (const e of events ?? []) {
        const sid = String(e.subscription_id);
        try {
          const info = await lookupPaymentStatus(sid);
          resultado.push({
            subscription_id: sid,
            evento_em: e.created_at,
            pago_confirmado: isConfirmedPayment(info),
            status: info?.status ?? null,
            fonte: info?.source ?? null,
          });
        } catch (err) {
          resultado.push({ subscription_id: sid, evento_em: e.created_at, pago_confirmado: false, status: `erro: ${String(err)}`, fonte: null });
        }
        await sleep(150);
      }
      return json({
        total: resultado.length,
        pagos_confirmados: resultado.filter((r) => r.pago_confirmado).length,
        resultado,
      });
    }

    if (mode === "mp") {
      const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!mpToken) return json({ error: "MERCADOPAGO_ACCESS_TOKEN ausente" }, 500);
      const { data: rows } = await admin
        .from("subscriptions")
        .select("id, mp_subscription_id, mp_payment_id")
        .eq("provider", "mercadopago")
        .eq("status", "active")
        .lt("current_period_end", new Date().toISOString());

      const counts: Record<string, number> = {};
      let comRecorrencia = 0;
      for (const r of rows ?? []) {
        let grupo = "sem_identificador_mp";
        if (r.mp_subscription_id) {
          const resp = await fetch(`https://api.mercadopago.com/preapproval/${r.mp_subscription_id}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
          });
          if (resp.status === 404) grupo = "recorrencia_nao_existe";
          else if (!resp.ok) grupo = `erro_http_${resp.status}`;
          else {
            const d = await resp.json();
            grupo = `recorrencia_${String(d.status ?? "?").toLowerCase()}`;
            if (d.status === "authorized" || d.status === "active") comRecorrencia++;
          }
        } else if (r.mp_payment_id) {
          // Pagamento avulso: confere o status, mas pagamento avulso não é recorrência.
          const resp = await fetch(`https://api.mercadopago.com/v1/payments/${r.mp_payment_id}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
          });
          if (resp.status === 404) grupo = "pagamento_nao_existe";
          else if (!resp.ok) grupo = `erro_http_${resp.status}`;
          else {
            const d = await resp.json();
            grupo = `pagamento_avulso_${String(d.status ?? "?").toLowerCase()}`;
          }
        }
        counts[grupo] = (counts[grupo] ?? 0) + 1;
        await sleep(150);
      }
      return json({ total: (rows ?? []).length, com_recorrencia_ativa: comRecorrencia, counts });
    }

    if (mode === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY ausente" }, 500);
      const { data: rows } = await admin
        .from("subscriptions")
        .select("id, stripe_subscription_id")
        .eq("provider", "stripe")
        .eq("status", "active")
        .lt("current_period_end", new Date().toISOString());
      const resultado: Array<{ id: string; status_stripe: string }> = [];
      for (const r of rows ?? []) {
        if (!r.stripe_subscription_id) {
          resultado.push({ id: r.id, status_stripe: "sem_id" });
          continue;
        }
        const resp = await fetch(`https://api.stripe.com/v1/subscriptions/${r.stripe_subscription_id}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        resultado.push({
          id: r.id,
          status_stripe: resp.ok ? String((await resp.json()).status ?? "?") : `erro_http_${resp.status}`,
        });
      }
      return json({ total: (rows ?? []).length, resultado });
    }

    return json({ error: "mode inválido" }, 400);
  } catch (err) {
    console.error("validapay-audit-subscriptions:", err);
    return json({ error: String(err) }, 500);
  }
});
