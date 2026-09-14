/**
 * Encargos do checkout das páginas de vendas.
 * Mantidos em um único lugar para que carrinho, checkout e a Edge Function
 * `public-sales-checkout` cheguem sempre no mesmo "Total a pagar".
 *
 * Gorjeta e "Impostos" foram removidos: eram resquício de template de
 * food/delivery e não fazem sentido no modelo de e-commerce da Velo.
 */
export const SERVICE_FEE_BRL = 1.5;

export const computeCartTotals = (unitPrice: number, qty: number) => {
  const subtotal = Number((unitPrice * qty).toFixed(2));
  const total = Number((subtotal + SERVICE_FEE_BRL).toFixed(2));
  return { subtotal, serviceFee: SERVICE_FEE_BRL, total };
};
