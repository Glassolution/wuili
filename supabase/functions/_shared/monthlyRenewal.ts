import { CANCEL_PAGE_PATH } from "./refundPolicy.ts";

export const MONTHLY_RENEWAL_NOTICE = "Esta assinatura renova automaticamente todo mês no mesmo cartão, até você cancelar. Você pode cancelar a qualquer momento.";

export function monthlyRenewalDisclosure(cycle: string) {
  return ["monthly", "mensal"].includes(cycle.toLowerCase())
    ? { text: MONTHLY_RENEWAL_NOTICE, cancelPath: CANCEL_PAGE_PATH }
    : null;
}