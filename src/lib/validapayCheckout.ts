import { supabase } from "@/integrations/supabase/client";
import { getReferralCode } from "@/lib/affiliateFunnel";

export type VelloPlanId = "base" | "pro" | "business";
export type VelloBillingCycle = "monthly" | "annual";

/**
 * Cria uma sessão de checkout na ValidaPay (Pix Automático) para o usuário logado
 * e redireciona a própria aba para a URL hospedada.
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
    window.location.href = checkoutUrl.toString();
    return { ok: true };
  } catch {
    return { ok: false, error: "A ValidaPay retornou um endereço de checkout inválido. Tente novamente." };
  }
};
