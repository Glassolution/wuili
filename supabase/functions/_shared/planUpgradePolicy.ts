export const UPGRADE_MONTHLY_PRICES: Record<string, number> = { base: 39.9, pro: 79.8, business: 189.9 };
export function upgradeDifference(current: string, target: string): number {
  const oldPrice = UPGRADE_MONTHLY_PRICES[current];
  const newPrice = UPGRADE_MONTHLY_PRICES[target];
  if (!oldPrice || !newPrice || newPrice <= oldPrice) throw new Error("Selecione um plano maior que o atual.");
  return Math.round((newPrice - oldPrice) * 100) / 100;
}
export function sameBillingDate(a: string, b: string): boolean {
  return Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b);
}
export function upgradePaymentMatches(expected: number, actual: number | null): boolean {
  return actual !== null && Math.round(expected * 100) === Math.round(actual * 100);
}