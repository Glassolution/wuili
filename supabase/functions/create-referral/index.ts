import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sendResendEmail } from "../_shared/transactional-email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PENDING = 10;

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Você foi convidado para a Velo</title></head>
<body style="background:#F4F4F0;margin:0;padding:48px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="padding:32px 48px;background:#000"><div style="color:#fff;font-weight:700;font-size:20px">Velo</div></td></tr>
<tr><td style="padding:40px 48px 48px">
<div style="display:inline-block;padding:4px 12px;background:#EFF6FF;border-radius:20px;color:#2563EB;font-size:12px;font-weight:600;letter-spacing:.05em;margin-bottom:16px">CONVITE</div>
<h1 style="margin:0 0 8px;font-size:26px;color:#111;line-height:1.25;letter-spacing:-0.5px">{{inviter_name}} te chamou pra Velo!</h1>
<p style="margin:0 0 32px;font-size:14px;color:#9CA3AF;line-height:1.5">A Velo é a plataforma de dropshipping pra quem vende no Mercado Livre. Seu amigo achou que você ia curtir e te convidou pra criar sua conta.</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;background:#F0FDF4;border-radius:12px"><tr><td style="padding:20px">
<p style="margin:0 0 4px;font-size:11px;font-weight:500;color:#16A34A;text-transform:uppercase;letter-spacing:.06em">Os dois ganham</p>
<p style="margin:0;font-size:14px;color:#111;line-height:1.5">Se você criar sua conta e assinar um plano, tanto você quanto {{inviter_name}} ganham 15% de desconto na assinatura. Uma boa forma de retribuir o toque.</p>
</td></tr></table>
<div style="margin:0 0 24px"><a href="{{invite_url}}" style="background:#111;color:#fff;text-decoration:none;display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:-0.2px;border-radius:10px">Entrar na Velo →</a></div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F9FAFB;border-radius:12px"><tr><td style="padding:16px 20px">
<p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5">Este convite expira em {{expiration_time}}. Se você não esperava este email, pode ignorá-lo.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:28px 48px;background:#F9FAFB;border-top:1px solid #F3F4F6;text-align:center">
<p style="margin:0 0 4px;font-size:12px;color:#9CA3AF">Você recebeu este email porque {{inviter_name}} te convidou para a Velo.</p>
<p style="margin:0;font-size:12px;color:#9CA3AF"><a href="https://velods.com.br" style="color:#111;text-decoration:none;font-weight:500">velods.com.br</a></p>
</td></tr>
</table></td></tr></table></body></html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) return json({ error: "Token inválido" }, 401);

    const inviterId = claimsData.claims.sub as string;
    const inviterEmail = String(claimsData.claims.email ?? "").toLowerCase();

    const body = await req.json().catch(() => ({}));
    const rawEmail = String(body?.email ?? "").trim().toLowerCase();
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return json({ error: "Email inválido" }, 400);
    }
    if (rawEmail === inviterEmail) {
      return json({ error: "Você não pode se autoconvidar" }, 400);
    }

    // Limite de convites pendentes
    const { count: pendingCount } = await admin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", inviterId)
      .in("status", ["pending", "linked"]);
    if ((pendingCount ?? 0) >= MAX_PENDING) {
      return json({ error: `Limite de ${MAX_PENDING} convites ativos atingido` }, 400);
    }

    // Convite duplicado ativo
    const { data: existing } = await admin
      .from("referrals")
      .select("id,status,expires_at")
      .eq("inviter_id", inviterId)
      .ilike("invited_email", rawEmail)
      .in("status", ["pending", "linked"])
      .maybeSingle();
    if (existing) {
      return json({ error: "Você já convidou este email. Aguarde a resposta ou o convite expirar." }, 409);
    }

    // Nome do convidador
    const { data: prof } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", inviterId)
      .maybeSingle();
    const inviterName = prof?.display_name || inviterEmail.split("@")[0] || "Um amigo";

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { data: created, error: insErr } = await admin
      .from("referrals")
      .insert({
        inviter_id: inviterId,
        invited_email: rawEmail,
        invite_token: token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select("id,invite_token,expires_at")
      .single();
    if (insErr) return json({ error: "Erro ao criar convite", details: insErr.message }, 500);

    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("APP_URL") ?? "https://www.velods.com.br";
    const inviteUrl = `${siteUrl.replace(/\/$/, "")}/convite/${token}`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    if (resendKey) {
      const html = renderTemplate(EMAIL_TEMPLATE, {
        inviter_name: inviterName,
        invite_url: inviteUrl,
        expiration_time: "7 dias",
      });
      const r = await sendResendEmail({
        apiKey: resendKey,
        to: rawEmail,
        subject: `${inviterName} te chamou pra Velo`,
        html,
      });
      emailSent = r.sent === true;
      if (!emailSent) console.error("Resend fail:", r);
    }

    return json({ ok: true, referral_id: created.id, invite_url: inviteUrl, email_sent: emailSent });
  } catch (e) {
    console.error("create-referral error:", e);
    return json({ error: "Erro interno" }, 500);
  }
});
