// Diagnóstico TEMPORÁRIO das assinaturas ativas vencidas (nov/2026). Apagar depois.
// Somente leitura e restrito a admins: não grava nada, não altera planos e devolve
// só contagens, sem IDs nem dados pessoais.
//
// POST { offset?: number, limit?: number } -> repita com next_offset até vir null.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isPaidStatus, validaPayFetch, ValidaPayError } from "../_shared/validapay.ts";
import { type GatewayCharge, isAdminCaller, runOverdueCheck } from "../_shared/overdueCheck.ts";

const SUB_SCOPE = "subscriptions/read checkouts/read pix.cob/read accounts/read";
const CHARGE_SCOPE = "checkouts/read pix.cob/read accounts/read wallet/read";
const MAX_CHARGE_PAGES = 120;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function fetchGatewaySub(id: string) {
  try {
    // deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
    const data = await validaPayFetch<any>(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: "GET", scope: SUB_SCOPE });
    const node = data?.data ?? data;
    return { status: String(node?.status ?? ""), cancelAtPeriodEnd: node?.cancelAtPeriodEnd };
  } catch (err) {
    if ((err as ValidaPayError)?.status === 404) return null;
    throw err;
  }
}

/** A ValidaPay ignora o filtro por assinatura em /v1/charges: lê as páginas até a data pedida. */
async function scanCharges(sinceIso: string) {
  const since = new Date(sinceIso).getTime();
  const charges: GatewayCharge[] = [];
  let lastKey: string | null = null;
  for (let page = 0; page < MAX_CHARGE_PAGES; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (lastKey) qs.set("lastKey", lastKey);
    // deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
    const data = await validaPayFetch<any>(`/v1/charges?${qs}`, { method: "GET", scope: CHARGE_SCOPE });
    // deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
    const items: any[] = data?.items ?? [];
    for (const it of items) {
      charges.push({ chargeId: String(it.chargeId ?? it.id), subscriptionId: it.subscriptionId ?? null, status: it.status ?? null, createdAt: it.createdAt ?? null });
    }
    const oldest = items[items.length - 1]?.createdAt;
    lastKey = data?.pagination?.lastKey ?? null;
    if (!items.length || !lastKey || data?.pagination?.hasMore === false) return { charges, complete: true };
    if (oldest && new Date(oldest).getTime() < since) return { charges, complete: true };
  }
  return { charges, complete: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const userId = claims?.claims?.sub as string | undefined;
  if (claimsError || !userId) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  if (!(await isAdminCaller(admin, userId))) return json({ error: "Apenas administradores" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const offset = Math.max(0, Number(body?.offset ?? 0) || 0);
    const limit = Math.min(Math.max(1, Number(body?.limit ?? 100) || 100), 100);
    return json(await runOverdueCheck({ admin, fetchGatewaySub, scanCharges, isPaid: isPaidStatus, pauseMs: 120 }, offset, limit));
  } catch (err) {
    console.error("validapay-overdue-check:", String(err));
    return json({ error: "Falha na verificação" }, 500);
  }
});
