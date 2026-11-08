// Verificação das assinaturas ValidaPay ativas com validade vencida: só leitura,
// devolve contagens agregadas. Separada do Deno.serve para ser testada sem gateway.

export type OverdueSub = {
  id: string;
  validapay_subscription_id: string | null;
  validapay_charge_id: string | null;
  current_period_end: string;
};

export type GatewaySub = { status: string; cancelAtPeriodEnd?: boolean } | null;

export type GatewayCharge = {
  chargeId: string;
  subscriptionId?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export type OverdueClass =
  | "pagou_depois_de_vencer"
  | "ativa_no_gateway_sem_cobranca"
  | "cancelamento_agendado_sem_cobranca"
  | "em_atraso_no_gateway"
  | "cancelada_no_gateway"
  | "nao_existe_no_gateway"
  | "status_desconhecido"
  | "sem_id_no_gateway"
  | "sem_prova_varredura_incompleta"
  | "erro_na_consulta";

// A renovação pode ser cobrada um pouco antes da validade calculada pela Velo.
const RENEWAL_TOLERANCE_MS = 5 * 24 * 3600_000;

/** Cobrança paga desta assinatura no gateway, depois da que a Velo já conhece. */
export function hasPaidRenewal(
  sub: OverdueSub,
  charges: GatewayCharge[],
  isPaid: (status?: string | null) => boolean,
): boolean {
  const from = new Date(sub.current_period_end).getTime() - RENEWAL_TOLERANCE_MS;
  return charges.some((c) =>
    c.subscriptionId === sub.validapay_subscription_id &&
    c.chargeId !== sub.validapay_charge_id &&
    isPaid(c.status) &&
    new Date(c.createdAt ?? 0).getTime() >= from
  );
}

/**
 * Cobrança paga vale mais que o status do gateway. Sem ela, só afirma que não houve
 * pagamento se a lista de cobranças foi lida até a data necessária.
 */
export function classifyOverdue(
  gateway: GatewaySub,
  paidRenewal: boolean,
  chargesComplete: boolean,
): OverdueClass {
  if (paidRenewal) return "pagou_depois_de_vencer";
  if (!chargesComplete) return "sem_prova_varredura_incompleta";
  if (!gateway) return "nao_existe_no_gateway";
  const s = gateway.status.toUpperCase();
  if (s === "ACTIVE") return gateway.cancelAtPeriodEnd ? "cancelamento_agendado_sem_cobranca" : "ativa_no_gateway_sem_cobranca";
  if (["PAST_DUE", "PENDING", "INCOMPLETE", "UNPAID"].includes(s)) return "em_atraso_no_gateway";
  if (["CANCELLED", "CANCELED", "EXPIRED", "ENDED"].includes(s)) return "cancelada_no_gateway";
  return "status_desconhecido";
}

// deno-lint-ignore no-explicit-any -- cliente supabase admin
export async function isAdminCaller(admin: any, userId: string): Promise<boolean> {
  const [{ data: role }, { data: profile }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    admin.from("profiles").select("is_admin").eq("user_id", userId).maybeSingle(),
  ]);
  return Boolean(role) || profile?.is_admin === true;
}

export type OverdueCheckDeps = {
  // deno-lint-ignore no-explicit-any -- cliente supabase admin
  admin: any;
  fetchGatewaySub: (id: string) => Promise<GatewaySub>;
  scanCharges: (sinceIso: string) => Promise<{ charges: GatewayCharge[]; complete: boolean }>;
  isPaid: (status?: string | null) => boolean;
  now?: () => number;
  deadlineMs?: number;
  pauseMs?: number;
};

export async function runOverdueCheck(deps: OverdueCheckDeps, offset: number, limit: number) {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const deadline = startedAt + (deps.deadlineMs ?? 110_000);
  const { data, count, error } = await deps.admin.from("subscriptions")
    .select("id,validapay_subscription_id,validapay_charge_id,current_period_end", { count: "exact" })
    .eq("provider", "validapay").eq("status", "active").neq("purchase_kind", "lifetime")
    .lt("current_period_end", new Date(startedAt).toISOString())
    .order("id").range(offset, offset + limit - 1);
  if (error) throw new Error(`leitura de assinaturas falhou: ${error.message}`);

  const subs = (data ?? []) as OverdueSub[];
  const counts: Record<string, number> = {};
  const desconhecidos: Record<string, number> = {};
  const bump = (bag: Record<string, number>, key: string) => { bag[key] = (bag[key] ?? 0) + 1; };

  let charges: GatewayCharge[] = [];
  let chargesComplete = true;
  if (subs.length) {
    const oldest = Math.min(...subs.map((s) => new Date(s.current_period_end).getTime()));
    const scan = await deps.scanCharges(new Date(oldest - RENEWAL_TOLERANCE_MS).toISOString());
    charges = scan.charges;
    chargesComplete = scan.complete;
  }

  let processed = 0;
  for (const sub of subs) {
    if (now() > deadline) break;
    processed++;
    if (!sub.validapay_subscription_id) { bump(counts, "sem_id_no_gateway"); continue; }
    try {
      const gateway = await deps.fetchGatewaySub(sub.validapay_subscription_id);
      const cls = classifyOverdue(gateway, hasPaidRenewal(sub, charges, deps.isPaid), chargesComplete);
      bump(counts, cls);
      if (cls === "status_desconhecido") bump(desconhecidos, gateway!.status.toUpperCase() || "VAZIO");
    } catch (err) {
      console.error("validapay-overdue-check: consulta falhou", sub.id, String(err));
      bump(counts, "erro_na_consulta");
    }
    if (deps.pauseMs) await new Promise((r) => setTimeout(r, deps.pauseMs)); // respeita rate limit do gateway
  }

  const nextOffset = offset + processed;
  return {
    total: count ?? 0,
    offset,
    processados: processed,
    next_offset: nextOffset < (count ?? 0) ? nextOffset : null,
    cobrancas_lidas: charges.length,
    cobrancas_completas: chargesComplete,
    // Se vier zerado com cobranças lidas, o gateway não liga cobrança à assinatura e o resultado não prova falta de pagamento.
    cobrancas_pagas_ligadas_a_assinatura: charges.filter((c) => c.subscriptionId && deps.isPaid(c.status)).length,
    counts,
    desconhecidos,
  };
}
