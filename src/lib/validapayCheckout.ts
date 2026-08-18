import { supabase } from "@/integrations/supabase/client";

export type VelloPlanId = "base" | "pro" | "business";
export type VelloBillingCycle = "monthly" | "annual";

/**
 * Leva o usuário para o CHECKOUT TRANSPARENTE da Velo (`/assinar/:plan`).
 * O pagamento (Pix e cartão) é processado pela ValidaPay via API dentro do
 * nosso domínio — sem redirecionamento para o checkout hospedado, para que a
 * marca e a interface sejam totalmente nossas.
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
  _customer?: VelloCheckoutCustomer,
): Promise<{ ok: boolean; error?: string }> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente na Velo para assinar." };
  }

  const params = new URLSearchParams({ cycle });
  if (coupon) params.set("coupon", coupon);
  window.location.href = `/assinar/${plan}?${params.toString()}`;
  return { ok: true };
};
