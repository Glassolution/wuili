import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TicketRow = {
  id: string;
  user_id: string;
  category: string | null;
  subject: string | null;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  sender: string;
};

type ProfileRow = {
  user_id?: string | null;
  id?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

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

const getResendErrorDetail = async (response: Response) => {
  const text = await response.text();
  if (!text) return `Resend respondeu com status ${response.status}`;

  try {
    const body = JSON.parse(text);
    return body?.message || body?.error || text;
  } catch {
    return text;
  }
};

const formatCategory = (category: string | null) => {
  const labels: Record<string, string> = {
    financeiro: "Financeiro",
    bug: "Bug / Erro",
    integracao: "Integrações",
    conta: "Conta",
    reembolso: "Reembolso",
    outros: "Outros",
  };

  return labels[category ?? ""] ?? "Outros";
};

function renderNewSupportTicketEmail({
  customerName,
  ticketCategory,
  ticketSubject,
  ticketMessage,
  ticketUrl,
  supportUrl,
  logoUrl,
}: {
  customerName: string;
  ticketCategory: string;
  ticketSubject: string;
  ticketMessage: string;
  ticketUrl: string;
  supportUrl: string;
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
<title>Novo ticket de suporte aberto.</title>
<style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style>
</head>
<body dir="ltr" lang="pt-BR" style="background-color:#ffffff">
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0" data-skip-in-text="true">Novo ticket de suporte aberto.</div>
<table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center">
<tbody><tr><td dir="ltr" lang="pt-BR" style="background-color:#ffffff">
<table align="left" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:600px;align:left;width:100%;color:#000000;background-color:#ffffff;border-radius:0px;border-color:#000000">
<tbody><tr style="width:100%"><td style="padding:0">
<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:48px 0;background-color:#F4F4F0">
<tbody><tr style="margin:0;padding:0"><td align="center" data-id="__react-email-column" style="margin:0;padding:0">
<table width="560" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:0;background-color:#ffffff;border-radius:16px;overflow:hidden">
<tbody>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:32px 48px;background-color:#000000">
<img alt="Logo Velo" height="48" src="${escapeHtml(logoUrl)}" style="display:block;outline:none;border:none;text-decoration:none;max-width:100%;height:auto" width="48"/>
</td></tr>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:40px 48px 48px 48px">
<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 16px 0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:4px 12px;background-color:#FFFBEB;border-radius:20px">
<p class="node-paragraph" style="margin:0;padding:0"><span style="color:#D97706;font-size:12px;font-weight:600;letter-spacing:0.05em">NOVO TICKET</span></p>
</td></tr></tbody>
</table>
<h1 style="margin:0 0 8px 0;padding:0;font-weight:700;font-size:26px;color:#111111;line-height:1.25;letter-spacing:-0.5px">Um ticket foi aberto!</h1>
<p class="node-paragraph" style="margin:0 0 32px 0;padding:0;font-size:14px;color:#9CA3AF;line-height:1.5">${escapeHtml(customerName)} abriu um novo chamado de suporte. Dê uma olhada quando puder pra dar retorno.</p>
<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 24px 0;padding:0;background:#F9FAFB;border-radius:12px">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:20px">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em">Setor</p>
<p class="node-paragraph" style="margin:0 0 16px 0;padding:0;font-size:14px;font-weight:600;color:#111111">${escapeHtml(ticketCategory)}</p>
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em">Assunto</p>
<p class="node-paragraph" style="margin:0 0 16px 0;padding:0;font-size:14px;font-weight:600;color:#111111">${escapeHtml(ticketSubject)}</p>
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em">Mensagem</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:14px;color:#111111;line-height:1.5">${escapeHtml(ticketMessage)}</p>
</td></tr></tbody>
</table>
<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:0;background-color:#111111;border-radius:10px">
<p class="node-paragraph" style="margin:0;padding:0"><a href="${escapeHtml(ticketUrl)}" rel="noopener noreferrer nofollow" style="color:#ffffff;text-decoration:none;display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:-0.2px" target="_blank">Ver ticket no painel →</a></p>
</td></tr></tbody>
</table>
</td></tr>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:28px 48px;background-color:#F9FAFB;border-top:1px solid #F3F4F6">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:12px;color:#9CA3AF;text-align:center">Você está recebendo este email porque faz parte da equipe de suporte da Velo.</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:12px;color:#9CA3AF;text-align:center"><a href="https://velods.com.br" rel="noopener noreferrer nofollow" style="color:#111111;text-decoration:none;font-weight:500" target="_blank">velods.com.br</a>&nbsp;·&nbsp;<a href="${escapeHtml(supportUrl)}" rel="noopener noreferrer nofollow" style="color:#9CA3AF;text-decoration:none" target="_blank">Painel</a></p>
</td></tr>
</tbody>
</table>
</td></tr></tbody>
</table>
</td></tr></tbody>
</table>
</td></tr></tbody>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

    const body = await req.json().catch(() => ({}));
    const ticketId = typeof body.ticketId === "string" ? body.ticketId : "";
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    if (!ticketId || !messageId) return json({ error: "ticketId e messageId são obrigatórios" }, 400);

    const { data: ticket, error: ticketError } = await adminClient
      .from("support_tickets")
      .select("id,user_id,category,subject")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError) return json({ error: "Erro ao buscar ticket" }, 500);
    if (!ticket) return json({ error: "Ticket não encontrado" }, 404);
    const supportTicket = ticket as TicketRow;
    if (supportTicket.user_id !== currentUser.id) return json({ error: "Acesso negado" }, 403);

    const { data: message, error: messageError } = await adminClient
      .from("support_messages")
      .select("id,ticket_id,user_id,message,sender")
      .eq("id", messageId)
      .eq("ticket_id", ticketId)
      .maybeSingle();

    if (messageError) return json({ error: "Erro ao buscar mensagem" }, 500);
    if (!message) return json({ error: "Mensagem inicial não encontrada" }, 404);
    const supportMessage = message as MessageRow;
    if (supportMessage.sender !== "user" || supportMessage.user_id !== currentUser.id) {
      return json({ error: "Mensagem inicial não encontrada" }, 404);
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_id,id,full_name,display_name,email")
      .or(`user_id.eq.${currentUser.id},id.eq.${currentUser.id}`)
      .limit(1)
      .maybeSingle();

    const { data: roleRows, error: rolesError } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) return json({ error: "Erro ao buscar admins" }, 500);

    const { data: profileAdmins, error: profileAdminsError } = await adminClient
      .from("profiles")
      .select("user_id,id,email")
      .eq("is_admin", true);

    if (profileAdminsError) return json({ error: "Erro ao buscar perfis admin" }, 500);

    const adminIds = new Set<string>();
    for (const row of roleRows ?? []) {
      if (row.user_id) adminIds.add(row.user_id);
    }
    for (const row of profileAdmins ?? []) {
      const id = row.user_id ?? row.id;
      if (id) adminIds.add(id);
    }

    const recipients = new Set<string>();
    for (const row of profileAdmins ?? []) {
      if (typeof row.email === "string" && row.email.includes("@")) recipients.add(row.email.toLowerCase());
    }

    await Promise.all(
      [...adminIds].map(async (adminId) => {
        const { data } = await adminClient.auth.admin.getUserById(adminId);
        const email = data.user?.email;
        if (email) recipients.add(email.toLowerCase());
      }),
    );

    if (recipients.size === 0) return json({ sent: false, reason: "Nenhum admin com email encontrado" });

    const supportUrl = `${siteUrl}/admin/suporte`;
    const userProfile = profile as ProfileRow | null;
    const customerName = userProfile?.full_name || userProfile?.display_name || currentUser.email || "Um usuário";
    const subject = supportTicket.subject || supportMessage.message.slice(0, 120) || "Novo ticket de suporte";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Velo <noreply@velods.com.br>",
        to: [...recipients],
        subject: `Novo ticket de suporte: ${subject}`,
        html: renderNewSupportTicketEmail({
          customerName,
          ticketCategory: formatCategory(supportTicket.category),
          ticketSubject: subject,
          ticketMessage: supportMessage.message,
          ticketUrl: supportUrl,
          supportUrl,
          logoUrl: `${siteUrl}/ticket-reply-logo.png`,
        }),
      }),
    });

    if (!emailResponse.ok) {
      const detail = await getResendErrorDetail(emailResponse);
      console.error("Resend new support ticket email failed:", emailResponse.status, detail);
      return json({ error: "Não foi possível enviar o email", provider: "resend", status: emailResponse.status, detail }, 502);
    }

    const result = await emailResponse.json().catch(() => ({}));
    return json({ sent: true, recipients: recipients.size, id: (result as { id?: string }).id });
  } catch (error) {
    console.error("send-new-support-ticket-email error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "Erro interno", message }, 500);
  }
});
