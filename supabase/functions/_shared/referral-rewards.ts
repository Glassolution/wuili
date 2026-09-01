// Recompensa de indicação: os DOIS ganham 15% de desconto na primeira assinatura.
//
// - Convidado: 15% na primeira cobrança, aplicado automaticamente no checkout.
// - Convidador: ganha um crédito de 15% quando o amigo convidado paga. O crédito
//   só vale se ele ainda NÃO assinou (é usado na primeira assinatura dele).
// - O crédito pendente do convidador fica em `referrals.inviter_rewarded = true`
//   e é consumido quando o pagamento dele é confirmado.
// - Substitui a antiga mecânica de 3 meses grátis.

// deno-lint-ignore no-explicit-any -- cliente Supabase tipado genericamente entre funções
type AdminClient = any;

export const REFERRAL_DISCOUNT_PERCENT = 15;

/**
 * Convidado pagou → marca a indicação como concluída e libera o crédito de 15%
 * para quem convidou. Idempotente: reexecutar apenas reescreve os mesmos campos.
 */
export async function grantInviterDiscountForPaidInvitee(
  admin: AdminClient,
  params: { invitedUserId: string; referralId?: string | null },
): Promise<{ ok: boolean; code: string; details?: unknown }> {
  const { invitedUserId } = params;
  if (!invitedUserId) return { ok: false, code: "missing_params" };

  try {
    let referralId = params.referralId ?? null;

    if (!referralId) {
      const { data: referral } = await admin
        .from("referrals")
        .select("id,status")
        .eq("invited_user_id", invitedUserId)
        .in("status", ["linked", "pending", "subscribed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      referralId = referral?.id ?? null;
    }

    if (!referralId) return { ok: true, code: "no_referral" };

    const { error } = await admin
      .from("referrals")
      .update({
        status: "subscribed",
        subscribed_at: new Date().toISOString(),
        invited_rewarded: true,
        inviter_rewarded: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", referralId);

    if (error) {
      console.error("referral discount update failed:", JSON.stringify(error));
      return { ok: false, code: "update_error", details: error };
    }

    console.log("referral discount liberado para o convidador:", referralId);
    return { ok: true, code: "granted" };
  } catch (err) {
    console.error("referral discount error:", String(err));
    return { ok: false, code: "exception", details: String(err) };
  }
}

/**
 * Consome o crédito de 15% do convidador depois que o pagamento dele é confirmado.
 */
export async function consumeInviterReferralDiscount(admin: AdminClient, referralId?: string | null) {
  if (!referralId) return false;
  try {
    const { error } = await admin
      .from("referrals")
      .update({ inviter_rewarded: false, updated_at: new Date().toISOString() })
      .eq("id", referralId);
    if (error) {
      console.error("consume inviter discount failed:", JSON.stringify(error));
      return false;
    }
    return true;
  } catch (err) {
    console.error("consume inviter discount error:", String(err));
    return false;
  }
}
