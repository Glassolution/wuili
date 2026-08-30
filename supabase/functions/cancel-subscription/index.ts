import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { validaPayFetch } from "../_shared/validapay.ts";

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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Token inválido" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { subscription_id, reason, reason_details } = (body ?? {}) as {
      subscription_id?: string;
      reason?: string;
      reason_details?: string;
    };
    if (!subscription_id) return json({ error: "subscription_id é obrigatório" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub) return json({ error: "Assinatura não encontrada" }, 404);
    if (!["active", "paid", "approved", "trialing"].includes(String(sub.status))) {
      return json({ error: "Esta assinatura não está ativa." }, 400);
    }
    if (sub.cancel_at_period_end) {
      return json({
        success: true,
        already: true,
        access_until: sub.current_period_end,
        message: "Sua assinatura já está cancelada e não será renovada.",
      });
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        cancelled_at: nowIso,
        cancellation_reason: [reason, reason_details].filter(Boolean).join(" — ") || null,
        updated_at: nowIso,
      })
      .eq("id", sub.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Tenta encerrar a recorrência no gateway. Se falhar, o bloqueio local no
    // webhook já garante que nenhuma renovação seja aceita.
    let providerCancelled = false;
    if (sub.validapay_subscription_id) {
      for (const path of [
        `/v1/subscriptions/${encodeURIComponent(sub.validapay_subscription_id)}/cancel`,
        `/v1/subscriptions/${encodeURIComponent(sub.validapay_subscription_id)}`,
      ]) {
        try {
          await validaPayFetch(path, { method: path.endsWith("/cancel") ? "POST" : "DELETE" });
          providerCancelled = true;
          break;
        } catch (e) {
          console.error("cancel-subscription: gateway", path, String(e));
        }
      }
    }

    const accessUntil = sub.current_period_end as string | null;
    await admin.from("notifications").insert({
      user_id: userId,
      title: "Assinatura cancelada",
      message: accessUntil
        ? `Sua assinatura não será renovada. Você mantém acesso até ${new Date(accessUntil).toLocaleDateString("pt-BR")}.`
        : "Sua assinatura não será renovada. Você mantém acesso até o fim do período já pago.",
      type: "subscription",
    });

    return json({
      success: true,
      provider_cancelled: providerCancelled,
      access_until: accessUntil,
      message: accessUntil
        ? `Assinatura cancelada. Você mantém acesso até ${new Date(accessUntil).toLocaleDateString("pt-BR")} e não haverá nova cobrança.`
        : "Assinatura cancelada. Você mantém acesso até o fim do período já pago e não haverá nova cobrança.",
    });
  } catch (err) {
    console.error("cancel-subscription error:", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
