import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { PLAN } from "./store.js";

const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.warn("[afiliados] MP_ACCESS_TOKEN não definido. O checkout só funcionará com a variável configurada.");
}

const client = accessToken
  ? new MercadoPagoConfig({ accessToken })
  : null;

export async function createCheckoutPreference({ affiliateRef, buyerEmail, notificationUrl }) {
  if (!client) {
    throw new Error("MP_ACCESS_TOKEN não configurado.");
  }

  const preference = new Preference(client);
  const metadata = {
    affiliate_ref: affiliateRef,
    plan: PLAN.id,
    plan_price: PLAN.price,
    commission_rate: PLAN.commissionRate,
  };

  return preference.create({
    body: {
      items: [
        {
          id: PLAN.id,
          title: PLAN.title,
          description: "Assinatura mensal da plataforma Velo",
          quantity: 1,
          unit_price: PLAN.price,
          currency_id: "BRL",
        },
      ],
      payer: buyerEmail ? { email: buyerEmail } : undefined,
      metadata,
      external_reference: affiliateRef,
      notification_url: notificationUrl,
      auto_return: "approved",
    },
  });
}

export async function getPayment(paymentId) {
  if (!client) {
    throw new Error("MP_ACCESS_TOKEN não configurado.");
  }

  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

