import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com", "lucassrby@gmail.com"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderTicketReplyEmail({
  ticketUrl,
  supportUrl,
  unsubscribeUrl,
  logoUrl,
}: {
  ticketUrl: string;
  supportUrl: string;
  unsubscribeUrl: string;
  logoUrl: string;
}) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="pt-BR">
<head>
<meta content="width=device-width" name="viewport"/>
<meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/>
<meta name="x-apple-disable-message-reformatting"/>
<meta content="IE=edge" http-equiv="X-UA-Compatible"/>
<meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection"/>
<title>O suporte respondeu sua mensagem.</title>
<style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style>
</head>
<body dir="ltr" lang="pt-BR" style="background-color:#ffffff">
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0" data-skip-in-text="true">O suporte respondeu sua mensagem.</div>
<table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center">
<tbody><tr><td dir="ltr" lang="pt-BR" style="background-color:#ffffff">
<table align="left" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:600px;align:left;width:100%;color:#000000;background-color:#ffffff;border-radius:0px;border-color:#000000">
<tbody><tr style="width:100%"><td style="padding:0">
<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:48px 0;background-color:#F4F4F0">
<tbody><tr style="margin:0;padding:0"><td align="center" data-id="__react-email-column" style="margin:0;padding:0">
<table width="560" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:0;background-color:#ffffff;border-radius:16px;overflow:hidden">
<tbody>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:32px 48px;background-color:#000000">
<img alt="Logo" height="48" src="${escapeHtml(logoUrl)}" style="display:block;outline:none;border:none;text-decoration:none;max-width:100%;height:auto" width="48"/>
</td></tr>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:40px 48px 48px 48px">
<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 16px 0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:4px 12px;background-color:#F0FDF4;border-radius:20px">
<p class="node-paragraph" style="margin:0;padding:0"><span style="color:#16A34A;font-size:12px;font-weight:600;letter-spacing:0.05em">TICKET ABERTO</span></p>
</td></tr></tbody></table>
<h1 style="margin:0 0 8px 0;padding:0;font-weight:700;font-size:26px;color:#111111;line-height:1.25;letter-spacing:-0.5px">Você foi respondido!</h1>
<p class="node-paragraph" style="margin:0 0 32px 0;padding:0;font-size:14px;color:#9CA3AF;line-height:1.5">Nossa equipe de suporte já deu retorno à sua mensagem. Confira os detalhes e continue a conversa quando quiser.</p>
<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:0;background-color:#111111;border-radius:10px">
<p class="node-paragraph" style="margin:0;padding:0"><a href="${escapeHtml(ticketUrl)}" rel="noopener noreferrer nofollow" style="color:#ffffff;text-decoration:none;display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:-0.2px" target="_blank">Ver resposta no suporte →</a></p>
</td></tr></tbody></table>
</td></tr>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:28px 48px;background-color:#F9FAFB;border-top:1px solid #F3F4F6">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:12px;color:#9CA3AF;text-align:center">Você está recebendo este email porque abriu um chamado de suporte na Velo.</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:12px;color:#9CA3AF;text-align:center">Velo&nbsp;·&nbsp;<a href="${escapeHtml(supportUrl)}" rel="noopener noreferrer nofollow" style="color:#9CA3AF;text-decoration:none" target="_blank">Suporte</a>&nbsp;·&nbsp;<a href="${escapeHtml(unsubscribeUrl)}" rel="noopener noreferrer nofollow" style="color:#9CA3AF;text-decoration:none" target="_blank">Descadastrar</a></p>
</td></tr>
</tbody></table>
</td></tr></tbody></table>
</td></tr></tbody></table>
</td></tr></tbody></table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.velods.com.br";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Supabase não configurado" }, 500);
    if (!resendApiKey) return json({ error: "RESEND_API_KEY não configurada" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: authError } = await userClient.auth.getUser();
    const currentUser = userData.user;
    if (authError || !currentUser) return json({ error: "Não autenticado" }, 401);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = roleData?.role === "admin" || ADMIN_EMAILS.has((currentUser.email ?? "").toLowerCase());
    if (!isAdmin) return json({ error: "Acesso negado" }, 403);

    const body = await req.json().catch(() => ({}));
    const ticketId = typeof body.ticketId === "string" ? body.ticketId : "";
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    if (!ticketId || !messageId) return json({ error: "ticketId e messageId são obrigatórios" }, 400);

    const { data: message, error: messageError } = await adminClient
      .from("support_messages")
      .select("id,ticket_id,sender")
      .eq("id", messageId)
      .eq("ticket_id", ticketId)
      .maybeSingle();

    if (messageError) return json({ error: "Erro ao buscar mensagem" }, 500);
    if (!message || message.sender !== "admin") return json({ error: "Mensagem de admin não encontrada" }, 404);

    const { data: ticket, error: ticketError } = await adminClient
      .from("support_tickets")
      .select("id,user_id")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError) return json({ error: "Erro ao buscar ticket" }, 500);
    if (!ticket) return json({ error: "Ticket não encontrado" }, 404);

    const { data: targetUserData } = await adminClient.auth.admin.getUserById(ticket.user_id);
    const recipientEmail = targetUserData.user?.email;
    if (!recipientEmail) return json({ sent: false, reason: "Usuário sem email cadastrado" });

    const supportUrl = `${siteUrl}/dashboard/configuracoes?tab=Suporte`;
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Velo <noreply@velods.com.br>",
        to: recipientEmail,
        subject: "O suporte respondeu sua mensagem",
        html: renderTicketReplyEmail({
          ticketUrl: supportUrl,
          supportUrl,
          unsubscribeUrl: supportUrl,
          logoUrl: `${siteUrl}/ticket-reply-logo.png`,
        }),
      }),
    });

    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      console.error("Resend ticket reply email failed:", emailResponse.status, detail);
      return json({ error: "Não foi possível enviar o email" }, 502);
    }

    return json({ sent: true });
  } catch (error) {
    console.error("send-ticket-reply-email error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
