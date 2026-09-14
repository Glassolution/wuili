// Verificação sob demanda do pagamento do próprio usuário.
//
// Motivo: quando o webhook da ValidaPay atrasa ou não chega, o cliente pagava e
// ficava sem acesso até o cron de reconciliação rodar. Esta função é chamada
// pela tela "Assinatura confirmada" e consulta o gateway na hora, liberando o
// plano em segundos em vez de minutos.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isConfirmedPayment, lookupPaymentStatus } from "../_shared/validapay.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !userId) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // Já ativo? Garante também que o perfil reflita o plano pago.
    const { data: activeSub } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSub) {
      await admin.from("profiles").update({ plano: activeSub.plan }).eq("user_id", userId);
      return json({ active: true, plan: activeSub.plan, source: "database" });
    }

    const { data: pendings } = await admin
      .from("subscriptions")
      .select("id,plan,amount,validapay_charge_id,validapay_subscription_id,created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 3 * 24 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    for (const sub of pendings ?? []) {
      const reference = sub.validapay_charge_id ?? sub.validapay_subscription_id;
      if (!reference) continue;

      // Apenas cobrança real (PAID/APPROVED/...) libera o plano.
      const info = await lookupPaymentStatus(reference);

      if (!isConfirmedPayment(info) || !info) continue;

      const now = new Date();
      await admin.from("subscriptions").update({
        status: "active",
        provider: "validapay",
        payment_method: (info.paymentMethod ?? "pix").toString().toLowerCase(),
        validapay_charge_id: info.chargeId ?? sub.validapay_charge_id,
        current_period_start: now.toISOString(),
        current_period_end: addMonths(now, 1).toISOString(),
        updated_at: now.toISOString(),
      }).eq("id", sub.id);
      await admin.from("profiles").update({ plano: sub.plan }).eq("user_id", userId);

      console.log("subscription-sync-self: plano liberado sem webhook", { userId, plan: sub.plan });
      return json({ active: true, plan: sub.plan, source: "gateway" });
    }

    return json({ active: false });
  } catch (err) {
    console.error("subscription-sync-self erro", String(err));
    return json({ active: false, error: "verification_failed" }, 200);
  }
});
