import crypto from "node:crypto";

const affiliates = new Map();
const sales = new Map();
const processedPayments = new Set();

export const PLAN = {
  id: "mensal",
  title: "Plano Velo Mensal",
  price: 147.9,
  commissionRate: 0.2,
};

export function generateRef() {
  let ref = crypto.randomBytes(4).toString("hex");

  while (affiliates.has(ref)) {
    ref = crypto.randomBytes(4).toString("hex");
  }

  return ref;
}

export function createAffiliate({ name, email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = Array.from(affiliates.values()).find(
    (affiliate) => affiliate.email === normalizedEmail,
  );

  if (existing) return existing;

  const now = new Date().toISOString();
  const affiliate = {
    id: crypto.randomUUID(),
    ref: generateRef(),
    name: name.trim(),
    email: normalizedEmail,
    createdAt: now,
  };

  affiliates.set(affiliate.ref, affiliate);
  return affiliate;
}

export function getAffiliate(ref) {
  if (!ref) return null;
  return affiliates.get(String(ref).trim()) ?? null;
}

export function listAffiliates() {
  return Array.from(affiliates.values()).map((affiliate) => getAffiliateSummary(affiliate.ref));
}

export function hasProcessedPayment(paymentId) {
  return processedPayments.has(String(paymentId));
}

export function recordApprovedSale({ affiliateRef, paymentId, preferenceId, plan, amount, metadata }) {
  const affiliate = getAffiliate(affiliateRef);
  if (!affiliate) {
    throw new Error("Afiliado não encontrado para este pagamento.");
  }

  const normalizedPaymentId = String(paymentId);
  if (processedPayments.has(normalizedPaymentId)) {
    return sales.get(normalizedPaymentId);
  }

  const commission = Number((amount * PLAN.commissionRate).toFixed(2));
  const now = new Date().toISOString();
  const sale = {
    id: crypto.randomUUID(),
    affiliateRef,
    paymentId: normalizedPaymentId,
    preferenceId: preferenceId ?? null,
    plan,
    amount,
    commission,
    commissionRate: PLAN.commissionRate,
    status: "approved",
    metadata: metadata ?? {},
    createdAt: now,
    approvedAt: now,
  };

  sales.set(normalizedPaymentId, sale);
  processedPayments.add(normalizedPaymentId);
  return sale;
}

export function getSalesByAffiliate(ref) {
  return Array.from(sales.values())
    .filter((sale) => sale.affiliateRef === ref)
    .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());
}

export function getAffiliateSummary(ref) {
  const affiliate = getAffiliate(ref);
  if (!affiliate) return null;

  const affiliateSales = getSalesByAffiliate(ref);
  const totalSales = affiliateSales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalCommission = affiliateSales.reduce((sum, sale) => sum + sale.commission, 0);

  return {
    ...affiliate,
    totalSales: Number(totalSales.toFixed(2)),
    totalCommission: Number(totalCommission.toFixed(2)),
    salesCount: affiliateSales.length,
    sales: affiliateSales,
  };
}

