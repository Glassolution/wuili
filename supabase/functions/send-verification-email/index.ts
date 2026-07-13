import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  getTransactionalLogoUrl,
  getTransactionalSiteUrl,
  renderVerificationEmail,
  sendResendEmail,
} from "../_shared/transactional-email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("DB_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = getTransactionalSiteUrl();

    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase não configurado" }, 500);
    if (!resendApiKey) return json({ error: "RESEND_API_KEY não configurada" }, 500);

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const userName =
      typeof body.userName === "string" && body.userName.trim()
        ? body.userName.trim()
        : email.split("@")[0] || "Vendedor";
    const redirectTo =
      typeof body.redirectTo === "string" && body.redirectTo.startsWith("http")
        ? body.redirectTo
        : `${siteUrl}/setup`;

    if (!isValidEmail(email)) return json({ error: "Email inválido" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (error) return json({ error: "Não foi possível gerar o link de verificação", detail: error.message }, 400);

    const actionLink = (data?.properties as { action_link?: string } | undefined)?.action_link;
    if (!actionLink) return json({ error: "Link de verificação indisponível" }, 500);

    const result = await sendResendEmail({
      apiKey: resendApiKey,
      to: email,
      subject: "Confirme seu email na Velo",
      html: renderVerificationEmail({
        userName,
        verificationUrl: actionLink,
        expirationTime: "24 horas",
        supportUrl: `${siteUrl}/dashboard/configuracoes?tab=Suporte`,
        logoUrl: getTransactionalLogoUrl(siteUrl),
      }),
    });

    if (!result.sent) {
      return json({ error: "Não foi possível enviar o email", provider: "resend", ...result }, 502);
    }

    return json({ sent: true, id: result.id });
  } catch (error) {
    console.error("send-verification-email error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "Erro interno", message }, 500);
  }
});
