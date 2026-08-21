/**
 * Encargos do checkout das páginas de vendas.
 * Mantidos em um único lugar para que carrinho, checkout e a Edge Function
 * `public-sales-checkout` cheguem sempre no mesmo "Total a pagar".
 */
export const SERVICE_FEE_BRL = 1.5;
export const TAX_BRL = 3.5;
export const MAX_TIP_BRL = 500;

export const sanitizeTip = (value: unknown): number => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Number(Math.min(MAX_TIP_BRL, n).toFixed(2));
};

export const computeCartTotals = (unitPrice: number, qty: number, tip: number) => {
  const subtotal = Number((unitPrice * qty).toFixed(2));
  const cleanTip = sanitizeTip(tip);
  const total = Number((subtotal + SERVICE_FEE_BRL + TAX_BRL + cleanTip).toFixed(2));
  return { subtotal, serviceFee: SERVICE_FEE_BRL, tax: TAX_BRL, tip: cleanTip, total };
};
