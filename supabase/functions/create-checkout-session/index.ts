import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import Stripe from "npm:stripe@18";

const PRICE_IDS: Record<string, string> = {
  base: "price_1TzdtHK2OTowcUADkDXpKexM",
  pro: "price_1TzdtiK2OTowcUADAmVRrwfC",
  business: "price_1Tzdu6K2OTowcUADyONxqMSF",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Não autenticado" }, 401);

    const userId = claimsData.claims.sub as string;
    const email = (claimsData.claims.email as string | undefined) ?? undefined;

    let body: { plan?: string } = {};
    try {
      body = await req.json();
    } catch {
      /* corpo vazio */
    }
    const plan = String(body.plan ?? "").toLowerCase();
    const priceId = PRICE_IDS[plan];
    if (!priceId) return json({ error: "Plano inválido. Use base, pro ou business." }, 400);

    const stripeKey = Deno.env.get("STRIPE_RESTRICTED_API_KEY");
    if (!stripeKey) {
      console.error("STRIPE_RESTRICTED_API_KEY ausente — checkout abortado");
      return json({ error: "Pagamento indisponível no momento." }, 500);
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const origin =
      req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "https://wuili.lovable.app";

    // Reaproveita o customer se o usuário já comprou antes
    let customerId: string | undefined;
    if (email) {
      const found = await stripe.customers.list({ email, limit: 1 });
      customerId = found.data[0]?.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      client_reference_id: userId,
      metadata: { user_id: userId, plan },
      subscription_data: { metadata: { user_id: userId, plan } },
      allow_promotion_codes: true,
      success_url: `${origin}/dashboard?checkout=sucesso&plan=${plan}`,
      cancel_url: `${origin}/dashboard/planos?checkout=cancelado`,
    });

    console.log("checkout session criada", { userId, plan, sessionId: session.id });
    return json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("create-checkout-session erro", message);
    return json({ error: `Checkout indisponível: ${message}` }, 500);
  }
});
