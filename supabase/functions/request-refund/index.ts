import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requestProviderCancellation } from "../_shared/providerCancellation.ts";
import { identityAlreadyRefunded } from "../_shared/refundIdentity.ts";
import { formatRefundFeedback, getRefundMode, PRAZO_REEMBOLSO, REFUNDABLE_SUBSCRIPTION_STATUSES } from "../_shared/refundPolicy.ts";

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
    const { subscription_id, reason_details, had_error, can_contact } = body ?? {};
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const sandboxRequested = body?.sandbox === true || body?.sandbox === "true";
    // refund_chat: cartão do atendimento de reembolso (/ajuda/reembolso); help_center: formulário antigo do artigo.
    const source = body?.source === "refund_chat" || body?.source === "help_center" ? body.source : "settings";
    if (typeof subscription_id !== "string" || !subscription_id || !reason || reason.length > 207) {
      return json({ error: "Informe a assinatura e o motivo do reembolso." }, 400);
    }
    // O cliente precisa marcar que entende que o acesso acaba se o reembolso for aprovado.
    if (body?.access_end_acknowledged !== true) {
      return json({ error: "Confirme que você entende que o acesso será encerrado se o reembolso for aprovado." }, 400);
    }
    const detalhes = formatRefundFeedback(reason_details, had_error, can_contact);
    if (!detalhes) {
      return json({ error: "Preencha todos os campos do pedido de reembolso." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let sandboxAllowed = false;
    if (sandboxRequested) {
      const { data: profile } = await admin
        .from("profiles")
        .select("is_admin")
        .eq("user_id", userId)
        .maybeSingle();
      sandboxAllowed = profile?.is_admin === true;

      if (!sandboxAllowed) {
        const { data: role } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        sandboxAllowed = role?.role === "admin";
      }

      if (!sandboxAllowed) {
        return json({ error: "Sandbox disponível apenas para administradores." }, 403);
      }
    }

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub) return json({ error: "Assinatura não encontrada" }, 404);
    if (!REFUNDABLE_SUBSCRIPTION_STATUSES.includes(String(sub.status))) {
      return json({ error: "Esta assinatura não está ativa." }, 400);
    }
    const isSandboxSubscription =
      String(sub.provider ?? "").toLowerCase() === "sandbox" ||
      String(sub.payment_method ?? "").toLowerCase() === "sandbox";
    if (sandboxAllowed && !isSandboxSubscription) {
      return json({ error: "Sandbox só pode reembolsar assinaturas de teste." }, 400);
    }

    // Mesma regra que a página de Configurações mostra (_shared/refundPolicy.ts).
    const { data: prevRequests } = await admin
      .from("refund_requests")
      .select("subscription_id, status")
      .eq("user_id", userId);
    const mode = getRefundMode(sub, prevRequests ?? []);
    if (mode !== "reembolso" && !sandboxAllowed) {
      const erro =
        mode === "em_analise" ? "Você já tem uma solicitação de reembolso em análise."
        : mode === "aprovado" ? "O reembolso desta assinatura já foi aprovado."
        : (prevRequests ?? []).some((r: { status: string | null }) => ["processed", "approved"].includes(String(r.status ?? "").toLowerCase()))
          ? "Você já teve um reembolso processado anteriormente. Não é possível solicitar novamente. Você ainda pode cancelar a renovação."
          : "O prazo de 7 dias para solicitar reembolso já expirou. Você ainda pode cancelar a renovação.";
      return json({ error: erro, mode }, mode === "em_analise" || mode === "aprovado" ? 409 : 400);
    }

    // Mesma pessoa (e-mail ou Pix) já reembolsada em outra conta, ex.: excluiu e recriou.
    if (!sandboxAllowed) {
      const authEmail = (claimsData.claims as { email?: string }).email ?? null;
      if (await identityAlreadyRefunded(admin, userId, authEmail)) {
        return json(
          { error: "Já existe um reembolso concluído para estes dados em outra conta. Não é possível solicitar novamente." },
          409,
        );
      }
    }

    const { data: refund, error: insErr } = await admin.from("refund_requests").insert({
      user_id: userId,
      subscription_id: sub.id,
      payment_id: sub.mp_payment_id,
      reason,
      reason_details: `${sandboxAllowed ? "[Sandbox] " : ""}${detalhes}`,
      status: "pending",
      refund_amount: sub.amount,
      requested_at: new Date().toISOString(),
      source,
      access_end_acknowledged_at: new Date().toISOString(),
    }).select().single();
    if (insErr) {
      // Índice único: só um pedido pendente por cliente (clique duplo ou nova tentativa).
      if (insErr.code === "23505") {
        return json({ error: "Você já tem uma solicitação de reembolso em análise.", mode: "em_analise" }, 409);
      }
      return json({ error: "Não foi possível salvar o pedido agora. Tente de novo em instantes." }, 500);
    }

    // Pedido de reembolso = cancelamento da assinatura. Marcamos para não
    // renovar já na solicitação; a aprovação encerra e estorna de fato.
    const { error: cancellationError } = await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: `${sandboxAllowed ? "Sandbox - " : ""}Reembolso: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    if (cancellationError) throw new Error(`refund_cancellation_save:${cancellationError.message}`);
    const providerCancelled = await requestProviderCancellation(admin, sub, `Reembolso: ${reason}`);

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
            from: "Velo <noreply@velods.com.br>",
            to: [ADMIN_EMAIL],
            subject: "Novo pedido de reembolso",
            html: `<p>Motivo: <b>${String(reason).replace(/</g, "&lt;")}</b></p><p>${detalhes.replace(/</g, "&lt;")}</p>`,
          }),
        });
      }
    } catch (e) { console.error("email admin error", e); }

    return json({
      success: true,
      refund,
      provider_cancelled: providerCancelled,
      message: `Recebemos o seu pedido de reembolso. ${PRAZO_REEMBOLSO}`,
    });
  } catch (err) {
    console.error("request-refund error:", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
