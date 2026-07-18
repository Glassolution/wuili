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

function renderProjectInviteEmail(params: {
  inviterName: string;
  projectName: string;
  permissionLevel: string;
  inviteUrl: string;
  expirationTime: string;
  supportUrl: string;
  logoUrl: string;
}) {
  const inviterName = escapeHtml(params.inviterName);
  const projectName = escapeHtml(params.projectName);
  const permissionLevel = escapeHtml(params.permissionLevel);
  const inviteUrl = escapeHtml(params.inviteUrl);
  const expirationTime = escapeHtml(params.expirationTime);
  const supportUrl = escapeHtml(params.supportUrl);
  const logoUrl = escapeHtml(params.logoUrl);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="pt-BR">
<head>
<meta content="width=device-width" name="viewport"/>
<meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/>
<meta name="x-apple-disable-message-reformatting"/>
<meta content="IE=edge" http-equiv="X-UA-Compatible"/>
<meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection"/>
<title>Você foi convidado para colaborar em um projeto na Velo.</title>
<style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style>
</head>
<body dir="ltr" lang="pt-BR" style="background-color:#ffffff">
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0" data-skip-in-text="true">
Você foi convidado para colaborar em um projeto na Velo.
</div>
<table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center">
<tbody><tr><td dir="ltr" lang="pt-BR" style="background-color:#ffffff">
<table align="left" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:600px;align:left;width:100%;color:#000000;background-color:#ffffff;border-radius:0px;border-color:#000000">
<tbody><tr style="width:100%"><td style="padding:0">
<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:48px 0;background-color:#F4F4F0">
<tbody><tr style="margin:0;padding:0"><td align="center" data-id="__react-email-column" style="margin:0;padding:0">
<table width="560" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:0;background-color:#ffffff;border-radius:16px;overflow:hidden">
<tbody>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:32px 48px;background-color:#000000">
<img alt="Logo" height="48" src="${logoUrl}" style="display:block;outline:none;border:none;text-decoration:none;max-width:100%;height:auto" width="48"/>
</td></tr>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:40px 48px 48px 48px">
<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 16px 0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:4px 12px;background-color:#EFF6FF;border-radius:20px">
<p class="node-paragraph" style="margin:0;padding:0">
<span style="color:#2563EB;font-size:12px;font-weight:600;letter-spacing:0.05em">CONVITE PARA COLABORADOR</span>
</p>
</td></tr></tbody>
</table>
<h1 style="margin:0 0 8px 0;padding:0;font-weight:700;font-size:26px;color:#111111;line-height:1.25;letter-spacing:-0.5px">${inviterName} te chamou pra ajudar!</h1>
<p class="node-paragraph" style="margin:0 0 32px 0;padding:0;font-size:14px;color:#9CA3AF;line-height:1.5">Você foi convidado como colaborador para ajudar no Cowork do projeto e da página de vendas na Velo. Aceite o convite pra começar a editar junto.</p>
<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 24px 0;padding:0;background:#F9FAFB;border-radius:12px">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:20px">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em">Projeto</p>
<p class="node-paragraph" style="margin:0 0 16px 0;padding:0;font-size:14px;font-weight:600;color:#111111">${projectName}</p>
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em">Permissão</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:14px;font-weight:600;color:#111111">${permissionLevel}</p>
</td></tr></tbody>
</table>
<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 24px 0;padding:0">
<tbody><tr style="margin:0;padding:0">
<td data-id="__react-email-column" style="margin:0;padding:0;vertical-align:top">
<div style="margin:0;padding:16px;background:#F0FDF4;border-radius:12px">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#16A34A;text-transform:uppercase;letter-spacing:0.06em">Convidado por</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:14px;font-weight:700;color:#16A34A">${inviterName}</p>
</div>
</td>
</tr></tbody>
</table>
<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 24px 0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:0;background-color:#111111;border-radius:10px">
<p class="node-paragraph" style="margin:0;padding:0">
<a href="${inviteUrl}" rel="noopener noreferrer nofollow" style="color:#ffffff;text-decoration:none;display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:-0.2px" target="_blank">Aceitar convite →</a>
</p>
</td></tr></tbody>
</table>
<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0;padding:0;background:#F9FAFB;border-radius:12px">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:16px 20px">
<p class="node-paragraph" style="margin:0;padding:0;font-size:13px;color:#9CA3AF;line-height:1.5">Este convite expira em ${expirationTime}. Se você não esperava este email, pode ignorá-lo.</p>
</td></tr></tbody>
</table>
</td></tr>
<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:28px 48px;background-color:#F9FAFB;border-top:1px solid #F3F4F6">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:12px;color:#9CA3AF;text-align:center">Você recebeu este email porque ${inviterName} te convidou para colaborar em um projeto na Velo.</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:12px;color:#9CA3AF;text-align:center">
<a href="https://velods.com.br" rel="noopener noreferrer nofollow" style="color:#111111;text-decoration:none;font-weight:500" target="_blank">velods.com.br</a>
&nbsp;·&nbsp;
<a href="${supportUrl}" rel="noopener noreferrer nofollow" style="color:#9CA3AF;text-decoration:none" target="_blank">Suporte</a>
</p>
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
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role === "viewer" ? "viewer" : "editor";
    if (!projectId || !email || !email.includes("@")) {
      return json({ error: "projectId e email são obrigatórios" }, 400);
    }

    // Só o dono do projeto pode disparar o convite.
    const { data: project, error: projectError } = await adminClient
      .from("user_projects")
      .select("id,user_id,nome")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) return json({ error: "Erro ao buscar projeto" }, 500);
    if (!project) return json({ error: "Projeto não encontrado" }, 404);
    if (project.user_id !== currentUser.id) return json({ error: "Apenas o dono pode convidar" }, 403);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_id,id,full_name,display_name,email")
      .or(`user_id.eq.${currentUser.id},id.eq.${currentUser.id}`)
      .limit(1)
      .maybeSingle();

    const inviterName =
      profile?.full_name || profile?.display_name || currentUser.email?.split("@")[0] || "Alguém";
    const projectName = project.nome || "Projeto sem nome";
    const permissionLevel = role === "viewer"
      ? "Visualizador — pode apenas ver o projeto"
      : "Editor — pode editar o projeto";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Velo <noreply@velods.com.br>",
        to: [email],
        subject: `${inviterName} te convidou para colaborar na Velo`,
        html: renderProjectInviteEmail({
          inviterName,
          projectName,
          permissionLevel,
          inviteUrl: `${siteUrl}/login`,
          expirationTime: "7 dias",
          supportUrl: `${siteUrl}/docs`,
          logoUrl: `${siteUrl}/ticket-reply-logo.png`,
        }),
      }),
    });

    if (!emailResponse.ok) {
      const detail = await getResendErrorDetail(emailResponse);
      console.error("Resend project invite email failed:", emailResponse.status, detail);
      return json({ error: "Não foi possível enviar o email", provider: "resend", status: emailResponse.status, detail }, 502);
    }

    const result = await emailResponse.json().catch(() => ({}));
    return json({ sent: true, id: (result as { id?: string }).id });
  } catch (error) {
    console.error("send-project-invite-email error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "Erro interno", message }, 500);
  }
});
