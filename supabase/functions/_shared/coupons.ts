// Cupons promocionais da Velo.
// Regra atual: VELONACIONAL = 20% de desconto na PRIMEIRA cobrança,
// válido só no ciclo mensal e apenas nos planos Pro (R$ 79,80) e Business (R$ 159,60).
// A validação definitiva acontece na edge function `validapay-checkout`.

export type CouponRule = {
  code: string;
  percentOff: number;
  plans: string[];
  cycles: string[];
  /** Apenas a 1ª cobrança recebe o desconto. */
  firstChargeOnly: boolean;
  expiresAt: string; // ISO
};

export const COUPONS: CouponRule[] = [
  {
    code: "VELONACIONAL",
    percentOff: 20,
    plans: ["pro", "business"],
    cycles: ["monthly"],
    firstChargeOnly: true,
    // Uma semana de campanha.
    expiresAt: "2026-08-10T23:59:59-03:00",
  },
];

export const normalizeCouponCode = (code: string) =>
  code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export type CouponValidation = {
  ok: boolean;
  reason: "not_found" | "expired" | "plan" | "cycle" | null;
  coupon: CouponRule | null;
  discount: number;
  total: number;
};

export const validateCoupon = (
  rawCode: string,
  plan: string,
  cycle: string,
  amount: number,
  now: Date = new Date(),
): CouponValidation => {
  const fail = (reason: CouponValidation["reason"]): CouponValidation => ({
    ok: false,
    reason,
    coupon: null,
    discount: 0,
    total: amount,
  });

  const code = normalizeCouponCode(rawCode);
  const coupon = COUPONS.find((item) => item.code === code);
  if (!coupon) return fail("not_found");
  if (now.getTime() > new Date(coupon.expiresAt).getTime()) return fail("expired");
  if (!coupon.cycles.includes(cycle)) return fail("cycle");
  if (!coupon.plans.includes(plan)) return fail("plan");

  const discount = Math.round(amount * coupon.percentOff) / 100;
  return {
    ok: true,
    reason: null,
    coupon,
    discount,
    total: Math.round((amount - discount) * 100) / 100,
  };
};

export const COUPON_MESSAGES: Record<string, string> = {
  not_found: "Cupom inválido.",
  expired: "Este cupom expirou.",
  cycle: "Este cupom vale apenas para o plano mensal.",
  plan: "Este cupom vale apenas para os planos Pro e Business.",
};
