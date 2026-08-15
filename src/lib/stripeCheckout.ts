import { supabase } from "@/integrations/supabase/client";

export type StripePlanId = "base" | "pro" | "business";

/**
 * Cria uma Stripe Checkout Session e redireciona o usuário para a URL retornada.
 * Retorna false se não foi possível iniciar o checkout.
 */
export const startStripeCheckout = async (
  plan: StripePlanId,
): Promise<{ ok: boolean; error?: string }> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: "not_authenticated" };
  }

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { plan },
  });

  if (error || !data?.url) {
    let message = error?.message ?? "Não foi possível iniciar o checkout.";
    // Extrai a mensagem real retornada pela edge function (FunctionsHttpError).
    const ctx = (error as unknown as { context?: Response })?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) message = String(body.error);
      } catch {
        /* corpo não é JSON */
      }
    }
    return { ok: false, error: message };
  }

  window.location.href = data.url as string;
  return { ok: true };

};
