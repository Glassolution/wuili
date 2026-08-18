// Recompensa de indicação: quando o AMIGO CONVIDADO conclui o primeiro pagamento
// da assinatura, quem convidou ganha 3 meses grátis (extensão do período pago).
//
// - Cumulativo: cada indicação paga soma +3 meses, sem teto.
// - Permanente: não há data de expiração da mecânica.
// - Idempotente: a concessão é registrada em public.referral_rewards com índices
//   únicos por indicação e por pagamento, então webhooks repetidos não duplicam.
// - Não altera o desconto de 15% do convidado nem o programa de afiliados.

// deno-lint-ignore no-explicit-any -- cliente Supabase tipado genericamente entre funções
type AdminClient = any;

export const REFERRAL_FREE_MONTHS = 3;

/**
 * Concede os 3 meses grátis ao convidador a partir do pagamento confirmado do convidado.
 * `paymentRef` deve ser um identificador estável do pagamento (id do provedor).
 */
export async function grantInviterMonthsForPaidInvitee(
  admin: AdminClient,
  params: { invitedUserId: string; paymentRef: string; referralId?: string | null },
): Promise<{ ok: boolean; code: string; details?: unknown }> {
  const { invitedUserId, paymentRef } = params;
  if (!invitedUserId || !paymentRef) return { ok: false, code: "missing_params" };

  try {
    let referralId = params.referralId ?? null;

    if (!referralId) {
      const { data: referral } = await admin
        .from("referrals")
        .select("id,status")
        .eq("invited_user_id", invitedUserId)
        .in("status", ["linked", "subscribed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      referralId = referral?.id ?? null;
    }

    if (!referralId) return { ok: true, code: "no_referral" };

    const { data, error } = await admin.rpc("grant_referral_inviter_months", {
      p_referral_id: referralId,
      p_payment_ref: String(paymentRef),
      p_months: REFERRAL_FREE_MONTHS,
    });

    if (error) {
      console.error("referral reward rpc failed:", JSON.stringify(error));
      return { ok: false, code: "rpc_error", details: error };
    }

    console.log("referral reward:", JSON.stringify({ referralId, paymentRef, result: data }));
    return { ok: true, code: "granted", details: data };
  } catch (err) {
    console.error("referral reward error:", String(err));
    return { ok: false, code: "exception", details: String(err) };
  }
}

/**
 * Aplica recompensas pendentes (usuário ganhou meses quando ainda não tinha
 * assinatura ativa) assim que ele passa a ter uma assinatura ativa.
 */
export async function applyPendingReferralRewards(admin: AdminClient, userId: string) {
  if (!userId) return 0;
  try {
    const { data, error } = await admin.rpc("apply_pending_referral_rewards", { p_user_id: userId });
    if (error) {
      console.error("apply_pending_referral_rewards failed:", JSON.stringify(error));
      return 0;
    }
    return Number(data ?? 0);
  } catch (err) {
    console.error("apply_pending_referral_rewards error:", String(err));
    return 0;
  }
}
