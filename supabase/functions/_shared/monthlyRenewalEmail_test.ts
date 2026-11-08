import { renderSubscriptionConfirmedEmail } from "./transactional-email-templates.ts";
import { CANCEL_PAGE_PATH } from "./refundPolicy.ts";

Deno.test("monthly confirmation provides cancellation while lifetime has no recurring disclosure", () => {
  const input = { planName: "Pro", planPrice: "79,80", paymentMethod: "Cartão", nextBillingDate: "07/12/2026" };
  const monthly = renderSubscriptionConfirmedEmail({ ...input, billingCycle: "mensal" });
  const lifetime = renderSubscriptionConfirmedEmail({ ...input, billingCycle: "pagamento único" });
  if (!monthly.includes("Como cancelar") || !monthly.includes(CANCEL_PAGE_PATH)) throw new Error("Monthly cancellation link missing");
  if (lifetime.includes("renova automaticamente") || lifetime.includes("Como cancelar")) throw new Error("Lifetime recurring notice is forbidden");
});