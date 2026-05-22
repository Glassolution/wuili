import { Router } from "express";
import {
  PLAN,
  createAffiliate,
  getAffiliate,
  getAffiliateSummary,
  hasProcessedPayment,
  listAffiliates,
  recordApprovedSale,
} from "./store.js";
import { createCheckoutPreference, getPayment } from "./mercadoPago.js";

const router = Router();

const PUBLIC_APP_URL = (
  process.env.VITE_PUBLIC_APP_URL ??
  process.env.PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://velods.com.br"
).replace(/\/+$/, "");
const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? PUBLIC_APP_URL;

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeAffiliateRef(ref) {
  return String(ref ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function buildAffiliateLink(ref) {
  return `${PUBLIC_APP_URL}/ref/${normalizeAffiliateRef(ref)}`;
}

function getPaymentIdFromWebhook(payload) {
  return payload?.data?.id ?? payload?.id ?? payload?.resource?.split("/").pop() ?? null;
}

function normalizeMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

router.post("/afiliados", (req, res) => {
  const { nome, name, email } = req.body ?? {};
  const affiliateName = nome ?? name;

  if (typeof affiliateName !== "string" || affiliateName.trim().length < 2) {
    return res.status(400).json({ error: "Nome do afiliado é obrigatório." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "E-mail válido do afiliado é obrigatório." });
  }

  const affiliate = createAffiliate({ name: affiliateName, email });

  return res.status(201).json({
    affiliate,
    link: buildAffiliateLink(affiliate.ref),
  });
});

router.post("/checkout", async (req, res, next) => {
  try {
    const { plano, plan, ref, email } = req.body ?? {};
    const requestedPlan = plano ?? plan ?? PLAN.id;

    if (requestedPlan !== PLAN.id) {
      return res.status(400).json({ error: "Plano inválido. Use o plano mensal." });
    }

    const affiliate = getAffiliate(ref);
    if (!affiliate) {
      return res.status(404).json({ error: "Afiliado não encontrado para o ref informado." });
    }

    const preference = await createCheckoutPreference({
      affiliateRef: affiliate.ref,
      buyerEmail: isValidEmail(email) ? email.trim().toLowerCase() : undefined,
      notificationUrl: `${PUBLIC_API_BASE_URL.replace(/\/$/, "")}/webhook/mp`,
    });

    return res.status(201).json({
      checkoutUrl: preference.init_point,
      sandboxCheckoutUrl: preference.sandbox_init_point,
      preferenceId: preference.id,
      plan: PLAN,
      affiliate: {
        ref: affiliate.ref,
        name: affiliate.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/webhook/mp", async (req, res, next) => {
  try {
    const paymentId = getPaymentIdFromWebhook(req.body);

    if (!paymentId) {
      return res.status(400).json({ error: "ID do pagamento não encontrado no webhook." });
    }

    if (hasProcessedPayment(paymentId)) {
      return res.status(200).json({ ok: true, duplicated: true });
    }

    const payment = await getPayment(paymentId);

    if (payment.status !== "approved") {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: `Pagamento com status ${payment.status}.`,
      });
    }

    const metadata = normalizeMetadata(payment.metadata);
    const affiliateRef = metadata.affiliate_ref ?? payment.external_reference;

    if (!affiliateRef) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "Pagamento aprovado sem ref de afiliado nos metadados.",
      });
    }

    const amount = Number(payment.transaction_amount ?? PLAN.price);
    const sale = recordApprovedSale({
      affiliateRef,
      paymentId,
      preferenceId: payment.preference_id,
      plan: metadata.plan ?? PLAN.id,
      amount,
      metadata,
    });

    return res.status(200).json({
      ok: true,
      sale,
      commissionCredited: sale.commission,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/afiliados/:ref", (req, res) => {
  const summary = getAffiliateSummary(req.params.ref);

  if (!summary) {
    return res.status(404).json({ error: "Afiliado não encontrado." });
  }

  return res.json(summary);
});

router.get("/admin/afiliados", (_req, res) => {
  return res.json({
    affiliates: listAffiliates(),
  });
});

export default router;
