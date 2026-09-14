// Regularização das assinaturas ativadas indevidamente pelo bug do polling.
//
// Modos (admin apenas):
//  - preview: apenas lista os alvos, não altera nada
//  - apply:   marca as assinaturas como "pending_regularization" (acesso pausado)
//             e dispara o e-mail de regularização
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  renderRegularizationEmail,
  WHATSAPP_DISPLAY,
  WHATSAPP_NUMBER,
} from "../_shared/regularization-email.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://www.velods.com.br";

const PLAN_LABEL: Record<string, string> = {
  base: "Base",
  pro: "Pro",
  business: "Business",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const callerId = claimsData?.claims?.sub as string | undefined;
  if (!callerId) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: callerId });
  if (!isAdmin) return json({ error: "not_admin" }, 403);

  let body: { mode?: string; subscription_ids?: string[]; send_email?: boolean } = {};
  try {
    body = await req.json();
  } catch { /* corpo vazio */ }

  const mode = body.mode === "apply" ? "apply" : "preview";
  const ids = Array.isArray(body.subscription_ids) ? body.subscription_ids.filter(Boolean) : [];
  if (!ids.length) return json({ error: "subscription_ids obrigatório" }, 400);

  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("id,user_id,plan,amount,status,created_at")
    .in("id", ids);
  if (error) return json({ error: error.message }, 500);

  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id,display_name,email")
    .in("user_id", userIds);
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const targets = (subs ?? []).map((s) => ({
    subscription_id: s.id,
    user_id: s.user_id,
    plan: s.plan,
    amount: s.amount,
    status: s.status,
    activated_at: s.created_at,
    name: byUser.get(s.user_id)?.display_name ?? null,
    email: byUser.get(s.user_id)?.email ?? null,
  }));

  if (mode === "preview") return json({ mode, count: targets.length, targets });

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const sendEmail = body.send_email !== false;
  if (sendEmail && !resendApiKey) return json({ error: "RESEND_API_KEY não configurada" }, 500);

  const now = new Date().toISOString();
  const result = { suspended: 0, emails_sent: 0, email_errors: [] as string[] };

  for (const t of targets) {
    const { error: upErr } = await admin
      .from("subscriptions")
      .update({ status: "pending_regularization", updated_at: now })
      .eq("id", t.subscription_id);
    if (upErr) {
      console.error("regularize: falha ao pausar", t.subscription_id, upErr.message);
      continue;
    }
    await admin.from("profiles").update({ plano: "gratis" }).eq("user_id", t.user_id);
    result.suspended++;

    if (!sendEmail || !t.email) continue;

    const html = renderRegularizationEmail({
      customer_name: t.name ?? "tudo bem?",
      plan_name: PLAN_LABEL[String(t.plan).toLowerCase()] ?? String(t.plan),
      payment_url: `${APP_URL}/regularizar-pagamento`,
      whatsapp_url:
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Recebi o e-mail sobre regularização de pagamento e quero enviar meu comprovante.")}`,
      whatsapp_display: WHATSAPP_DISPLAY,
      support_url: `${APP_URL}/dashboard/suporte`,
    });

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Velo <noreply@velods.com.br>",
          to: [t.email],
          subject: "Precisamos regularizar seu pagamento",
          html,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error("regularize: resend falhou", res.status, detail);
        result.email_errors.push(`${t.email}: ${res.status}`);
        continue;
      }
      result.emails_sent++;
    } catch (err) {
      console.error("regularize: erro de envio", t.email, String(err));
      result.email_errors.push(`${t.email}: erro de rede`);
    }
  }

  console.log("regularize-subscriptions:", JSON.stringify(result));
  return json({ mode, count: targets.length, ...result });
});
