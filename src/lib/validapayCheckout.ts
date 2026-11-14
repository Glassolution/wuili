import { supabase } from "@/integrations/supabase/client";
import { getReferralCode } from "@/lib/affiliateFunnel";
import { VELO_PLAN_PRICES } from "@/lib/planPricing";
import { metaVeloInicioCheckout } from "@/lib/veloMetaPixel";

export type VelloPlanId = "base" | "pro" | "business";
export type VelloBillingCycle = "monthly" | "annual" | "lifetime";
export type UpgradeQuote = { upgrade: boolean; id?: string; fromPlan?: string; toPlan?: string;
  amount?: number; recurringAmount?: number; nextChargeDate?: string; state?: string;
  payment?: { pix?: { emv?: string; qrCode?: string } } | null };
export async function requestPlanUpgrade(body: Record<string, unknown>): Promise<UpgradeQuote> {
  const { data, error } = await supabase.functions.invoke("validapay-checkout", { body });
  if (error) {
    const response = (error as unknown as { context?: Response }).context;
    let message = "Não foi possível conferir o upgrade. Nenhuma nova assinatura foi aberta.";
    try { const details = await response?.json(); if (details?.error) message = String(details.error); } catch { /* non JSON */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as UpgradeQuote;
}

/**
 * Cria uma sessão de checkout na ValidaPay (Pix + cartão) para o usuário logado
 * e redireciona a própria aba para a URL hospedada.
 *
 * O checkout transparente foi revertido: a API de charges da ValidaPay retornou
 * a cobrança já como "PAID" sem pagamento real, o que ativava a assinatura
 * indevidamente. Enquanto o gateway não devolver Pix/cartão de forma confiável,
 * o checkout hospedado continua sendo o único fluxo válido.
 */
export type VelloCheckoutCustomer = {
  name?: string;
  document?: string;
  phone?: string;
  method?: "pix" | "credit_card";
};

export const startValidaPayCheckout = async (
  plan: VelloPlanId,
  cycle: VelloBillingCycle = "monthly",
  coupon?: string | null,
  customer?: VelloCheckoutCustomer,
): Promise<{ ok: boolean; error?: string }> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente na Velo para assinar." };
  }

  // Indicação é opcional: sem cookie/localStorage de afiliado nada é enviado.
  const affiliateCode = getReferralCode();

  const { data, error: invokeError } = await supabase.functions.invoke("validapay-checkout", {
    body: {
      plan,
      cycle,
      ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
      ...(coupon ? { coupon } : {}),
      ...(customer ? { customer } : {}),
    },
  });

  if (invokeError || typeof data?.url !== "string") {
    let message = invokeError?.message ?? "Não foi possível iniciar o checkout.";
    const context = (invokeError as unknown as { context?: Response })?.context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) message = String(body.error);
      } catch {
        // A resposta pode não ser JSON.
      }
    }
    return { ok: false, error: message };
  }

  try {
    const checkoutUrl = new URL(data.url);
    if (checkoutUrl.protocol !== "https:") throw new Error("invalid_protocol");
    // Pixel da Velo: valor de tabela do plano (cupom e indicação são aplicados na ValidaPay).
    metaVeloInicioCheckout({ plano: plan, ciclo: cycle, valor: VELO_PLAN_PRICES[plan]?.[cycle] ?? 0 });
    window.location.href = checkoutUrl.toString();
    return { ok: true };
  } catch {
    return { ok: false, error: "A ValidaPay retornou um endereço de checkout inválido. Tente novamente." };
  }
};
