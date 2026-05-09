import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Token inválido" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { subscription_id, reason, reason_details } = body ?? {};
    if (!subscription_id || !reason) return json({ error: "subscription_id e reason são obrigatórios" }, 400);
    if (!reason_details || String(reason_details).trim().length < 30) {
      return json({ error: "Conte-nos mais sobre o motivo (mínimo 30 caracteres)." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub) return json({ error: "Assinatura não encontrada" }, 404);
    if (sub.status !== "active") return json({ error: "Apenas assinaturas ativas podem ser reembolsadas" }, 400);

    // Bloqueia múltiplos pedidos pendentes para a mesma assinatura
    const { data: existing } = await admin
      .from("refund_requests")
      .select("id, status")
      .eq("subscription_id", sub.id)
      .in("status", ["pending", "reembolso_solicitado"])
      .maybeSingle();
    if (existing) return json({ error: "Já existe um pedido de reembolso em análise para esta assinatura." }, 409);

    const { data: refund, error: insErr } = await admin.from("refund_requests").insert({
      user_id: userId,
      subscription_id: sub.id,
      payment_id: sub.mp_payment_id,
      reason,
      reason_details: String(reason_details).trim(),
      status: "pending",
      refund_amount: sub.amount,
      requested_at: new Date().toISOString(),
    }).select().single();
    if (insErr) return json({ error: insErr.message }, 500);

    // Notificar todos os admins (in-app)
    try {
      const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      if (admins?.length) {
        const rows = admins.map((a: any) => ({
          user_id: a.user_id,
          title: "Novo pedido de reembolso",
          message: `Motivo: ${reason}`,
          type: "refund",
          action_url: "/admin/reembolsos",
          metadata: { refund_id: refund.id, subscription_id: sub.id },
        }));
        await admin.from("notifications").insert(rows);
      }
    } catch (e) { console.error("notify admin error", e); }

    // Email opcional para ADMIN_EMAIL via Resend (se configurado)
    try {
      const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
      const RESEND = Deno.env.get("RESEND_API_KEY");
      if (ADMIN_EMAIL && RESEND) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Velo <onboarding@resend.dev>",
            to: [ADMIN_EMAIL],
            subject: "Novo pedido de reembolso",
            html: `<p>Motivo: <b>${reason}</b></p><p>${String(reason_details).replace(/</g, "&lt;")}</p>`,
          }),
        });
      }
    } catch (e) { console.error("email admin error", e); }

    return json({
      success: true,
      refund,
      message: "Sua solicitação foi recebida. O reembolso será analisado em até 48 horas.",
    });
  } catch (err) {
    console.error("request-refund error:", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
