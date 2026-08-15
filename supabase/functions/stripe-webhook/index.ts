import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18";

const PLAN_BY_PRICE: Record<string, string> = {
  price_1TzdtHK2OTowcUADkDXpKexM: "base",
  price_1TzdtiK2OTowcUADAmVRrwfC: "pro",
  price_1Tzdu6K2OTowcUADyONxqMSF: "business",
};

const stripe = new Stripe(Deno.env.get("STRIPE_RESTRICTED_API_KEY")!, {
  apiVersion: "2025-08-27.basil",
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const planFromSubscription = (sub: Stripe.Subscription): string | null => {
  const priceId = sub.items?.data?.[0]?.price?.id ?? "";
  return PLAN_BY_PRICE[priceId] ?? (sub.metadata?.plan as string | undefined) ?? null;
};

const userIdFromSubscription = async (sub: Stripe.Subscription): Promise<string | null> => {
  const metaUser = sub.metadata?.user_id as string | undefined;
  if (metaUser) return metaUser;
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  return data?.user_id ?? null;
};

const upsertSubscription = async (params: {
  userId: string;
  plan: string;
  status: string;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  amount?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
}) => {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", params.stripeSubscriptionId)
    .maybeSingle();

  const payload = {
    user_id: params.userId,
    plan: params.plan,
    status: params.status,
    provider: "stripe",
    payment_method: "stripe",
    amount: params.amount ?? 0,
    stripe_subscription_id: params.stripeSubscriptionId,
    stripe_customer_id: params.stripeCustomerId ?? null,
    current_period_start: params.periodStart ?? null,
    current_period_end: params.periodEnd ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await admin.from("subscriptions").update(payload).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert(payload);
  }

  await admin
    .from("profiles")
    .update({ plano: params.status === "active" ? params.plan : "gratis" })
    .eq("user_id", params.userId);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature || !webhookSecret) {
      console.error("stripe-webhook: assinatura ou STRIPE_WEBHOOK_SECRET ausente");
      return new Response("missing_signature", { status: 400 });
    }
    event = await stripe.webhooks.constructEventAsync(raw, signature, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook: assinatura inválida", err);
    return new Response("invalid_signature", { status: 400 });
  }

  console.log("stripe-webhook evento", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata?.user_id as string) ?? session.client_reference_id;
        if (!userId || !session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(String(session.subscription));
        const plan = planFromSubscription(sub) ?? (session.metadata?.plan as string) ?? "base";
        const item = sub.items.data[0];
        await upsertSubscription({
          userId,
          plan,
          status: "active",
          stripeSubscriptionId: sub.id,
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          amount: (item?.price?.unit_amount ?? 0) / 100,
          periodStart: item?.current_period_start
            ? new Date(item.current_period_start * 1000).toISOString()
            : null,
          periodEnd: item?.current_period_end
            ? new Date(item.current_period_end * 1000).toISOString()
            : null,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          (invoice as unknown as { subscription?: string | null }).subscription ??
          invoice.lines?.data?.[0]?.subscription ??
          null;
        if (!subId) break;
        await admin
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", String(subId));
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdFromSubscription(sub);
        await admin
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
        if (userId) {
          await admin.from("profiles").update({ plano: "gratis" }).eq("user_id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdFromSubscription(sub);
        const plan = planFromSubscription(sub);
        if (!userId || !plan) break;
        const item = sub.items.data[0];
        const status = ["active", "trialing"].includes(sub.status)
          ? "active"
          : sub.status === "past_due" || sub.status === "unpaid"
            ? "past_due"
            : sub.status === "canceled"
              ? "cancelled"
              : sub.status;
        await upsertSubscription({
          userId,
          plan,
          status,
          stripeSubscriptionId: sub.id,
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          amount: (item?.price?.unit_amount ?? 0) / 100,
          periodStart: item?.current_period_start
            ? new Date(item.current_period_start * 1000).toISOString()
            : null,
          periodEnd: item?.current_period_end
            ? new Date(item.current_period_end * 1000).toISOString()
            : null,
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("stripe-webhook: erro ao processar", event.type, err);
    return new Response("processing_error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
