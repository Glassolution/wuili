import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

export const resend = new Resend(resendApiKey);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY não configurada");
  }

  if (!to || !subject || !html) {
    throw new Error("Parâmetros obrigatórios ausentes");
  }

  return resend.emails.send({
    from: "Velo <noreply@velods.com.br>",
    to,
    subject,
    html,
  });
}

export function isEmailServiceConfigured(): boolean {
  return Boolean(resendApiKey);
}
