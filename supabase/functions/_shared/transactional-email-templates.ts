const VERIFY_EMAIL_TEMPLATE = "\u003c!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\"\u003e\n\u003chtml dir=\"ltr\" lang=\"pt-BR\"\u003e\n\u003chead\u003e\n\u003cmeta content=\"width=device-width\" name=\"viewport\"/\u003e\n\u003cmeta content=\"text/html; charset=UTF-8\" http-equiv=\"Content-Type\"/\u003e\n\u003cmeta name=\"x-apple-disable-message-reformatting\"/\u003e\n\u003cmeta content=\"IE=edge\" http-equiv=\"X-UA-Compatible\"/\u003e\n\u003cmeta content=\"telephone=no,address=no,email=no,date=no,url=no\" name=\"format-detection\"/\u003e\n\u003ctitle\u003eConfirme seu email.\u003c/title\u003e\n\u003cstyle\u003e@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}\u003c/style\u003e\n\u003c/head\u003e\n\u003cbody dir=\"ltr\" lang=\"pt-BR\" style=\"background-color:#ffffff\"\u003e\n\u003cdiv style=\"display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0\" data-skip-in-text=\"true\"\u003e\nConfirme seu email para ativar sua conta.\n\u003c/div\u003e\n\n\u003ctable border=\"0\" width=\"100%\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" align=\"center\"\u003e\n\u003ctbody\u003e\u003ctr\u003e\u003ctd dir=\"ltr\" lang=\"pt-BR\" style=\"background-color:#ffffff\"\u003e\n\u003ctable align=\"left\" width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"max-width:600px;align:left;width:100%;color:#000000;background-color:#ffffff;border-radius:0px;border-color:#000000\"\u003e\n\u003ctbody\u003e\u003ctr style=\"width:100%\"\u003e\u003ctd style=\"padding:0\"\u003e\n\n\u003ctable width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0;padding:48px 0;background-color:#F4F4F0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd align=\"center\" data-id=\"__react-email-column\" style=\"margin:0;padding:0\"\u003e\n\n\u003ctable width=\"560\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0;padding:0;background-color:#ffffff;border-radius:16px;overflow:hidden\"\u003e\n\u003ctbody\u003e\n\n\u003c!-- Header --\u003e\n\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:32px 48px;background-color:#000000\"\u003e\n\u003cimg alt=\"Logo\" height=\"48\" src=\"{{logo_url}}\" style=\"display:block;outline:none;border:none;text-decoration:none;max-width:100%;height:auto\" width=\"48\"/\u003e\n\u003c/td\u003e\u003c/tr\u003e\n\n\u003c!-- Body --\u003e\n\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:40px 48px 48px 48px\"\u003e\n\n\u003c!-- Badge --\u003e\n\u003ctable border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0 0 16px 0;padding:0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:4px 12px;background-color:#EFF6FF;border-radius:20px\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0\"\u003e\n\u003cspan style=\"color:#2563EB;font-size:12px;font-weight:600;letter-spacing:0.05em\"\u003eVERIFICAÇÃO\u003c/span\u003e\n\u003c/p\u003e\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003ch1 style=\"margin:0 0 8px 0;padding:0;font-weight:700;font-size:26px;color:#111111;line-height:1.25;letter-spacing:-0.5px\"\u003eConfirme seu email!\u003c/h1\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0 0 32px 0;padding:0;font-size:14px;color:#9CA3AF;line-height:1.5\"\u003eFalta pouco, {{user_name}}. Clique no botão abaixo pra confirmar seu email e ativar sua conta na Velo.\u003c/p\u003e\n\n\u003c!-- CTA --\u003e\n\u003ctable border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0 0 24px 0;padding:0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:0;background-color:#111111;border-radius:10px\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0\"\u003e\n\u003ca href=\"{{verification_url}}\" rel=\"noopener noreferrer nofollow\" style=\"color:#ffffff;text-decoration:none;display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:-0.2px\" target=\"_blank\"\u003eVerificar email →\u003c/a\u003e\n\u003c/p\u003e\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c!-- Expiry note --\u003e\n\u003ctable width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0;padding:0;background:#F9FAFB;border-radius:12px\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:16px 20px\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0;font-size:13px;color:#9CA3AF;line-height:1.5\"\u003eEste link expira em {{expiration_time}}. Se você não criou uma conta na Velo, pode ignorar este email.\u003c/p\u003e\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\n\n\u003c!-- Footer --\u003e\n\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:28px 48px;background-color:#F9FAFB;border-top:1px solid #F3F4F6\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0 0 4px 0;padding:0;font-size:12px;color:#9CA3AF;text-align:center\"\u003eVocê está recebendo este email porque criou uma conta na Velo.\u003c/p\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0;font-size:12px;color:#9CA3AF;text-align:center\"\u003e\n\u003ca href=\"https://velods.com.br\" rel=\"noopener noreferrer nofollow\" style=\"color:#111111;text-decoration:none;font-weight:500\" target=\"_blank\"\u003evelods.com.br\u003c/a\u003e\n\u0026nbsp;·\u0026nbsp;\n\u003ca href=\"{{support_url}}\" rel=\"noopener noreferrer nofollow\" style=\"color:#9CA3AF;text-decoration:none\" target=\"_blank\"\u003eSuporte\u003c/a\u003e\n\u003c/p\u003e\n\u003c/td\u003e\u003c/tr\u003e\n\n\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\u003c/body\u003e\n\u003c/html\u003e\n";

const SUBSCRIPTION_CONFIRMED_TEMPLATE = "\u003c!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\"\u003e\n\u003chtml dir=\"ltr\" lang=\"pt-BR\"\u003e\n\u003chead\u003e\n\u003cmeta content=\"width=device-width\" name=\"viewport\"/\u003e\n\u003cmeta content=\"text/html; charset=UTF-8\" http-equiv=\"Content-Type\"/\u003e\n\u003cmeta name=\"x-apple-disable-message-reformatting\"/\u003e\n\u003cmeta content=\"IE=edge\" http-equiv=\"X-UA-Compatible\"/\u003e\n\u003cmeta content=\"telephone=no,address=no,email=no,date=no,url=no\" name=\"format-detection\"/\u003e\n\u003ctitle\u003eSua assinatura foi confirmada.\u003c/title\u003e\n\u003cstyle\u003e@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}\u003c/style\u003e\n\u003c/head\u003e\n\u003cbody dir=\"ltr\" lang=\"pt-BR\" style=\"background-color:#ffffff\"\u003e\n\u003cdiv style=\"display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0\" data-skip-in-text=\"true\"\u003e\nSua assinatura foi confirmada.\n\u003c/div\u003e\n\n\u003ctable border=\"0\" width=\"100%\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" align=\"center\"\u003e\n\u003ctbody\u003e\u003ctr\u003e\u003ctd dir=\"ltr\" lang=\"pt-BR\" style=\"background-color:#ffffff\"\u003e\n\u003ctable align=\"left\" width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"max-width:600px;align:left;width:100%;color:#000000;background-color:#ffffff;border-radius:0px;border-color:#000000\"\u003e\n\u003ctbody\u003e\u003ctr style=\"width:100%\"\u003e\u003ctd style=\"padding:0\"\u003e\n\n\u003ctable width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0;padding:48px 0;background-color:#F4F4F0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd align=\"center\" data-id=\"__react-email-column\" style=\"margin:0;padding:0\"\u003e\n\n\u003ctable width=\"560\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0;padding:0;background-color:#ffffff;border-radius:16px;overflow:hidden\"\u003e\n\u003ctbody\u003e\n\n\u003c!-- Header --\u003e\n\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:32px 48px;background-color:#000000\"\u003e\n\u003cimg alt=\"Logo\" height=\"48\" src=\"{{logo_url}}\" style=\"display:block;outline:none;border:none;text-decoration:none;max-width:100%;height:auto\" width=\"48\"/\u003e\n\u003c/td\u003e\u003c/tr\u003e\n\n\u003c!-- Body --\u003e\n\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:40px 48px 48px 48px\"\u003e\n\n\u003c!-- Badge --\u003e\n\u003ctable border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0 0 16px 0;padding:0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:4px 12px;background-color:#F0FDF4;border-radius:20px\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0\"\u003e\n\u003cspan style=\"color:#16A34A;font-size:12px;font-weight:600;letter-spacing:0.05em\"\u003eASSINATURA ATIVA\u003c/span\u003e\n\u003c/p\u003e\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003ch1 style=\"margin:0 0 8px 0;padding:0;font-weight:700;font-size:26px;color:#111111;line-height:1.25;letter-spacing:-0.5px\"\u003eSua assinatura foi confirmada!\u003c/h1\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0 0 32px 0;padding:0;font-size:14px;color:#9CA3AF;line-height:1.5\"\u003eRecebemos seu pagamento e seu plano já está ativo. Aproveite!\u003c/p\u003e\n\n\u003c!-- Plan card --\u003e\n\u003ctable width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0 0 24px 0;padding:0;background:#F9FAFB;border-radius:12px\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:20px\"\u003e\n\u003ctable width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0;padding:0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\n\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:0;vertical-align:top\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0 0 4px 0;padding:0;font-size:14px;font-weight:600;color:#111111;line-height:1.4\"\u003ePlano {{plan_name}}\u003c/p\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0;font-size:13px;color:#9CA3AF\"\u003eCobrança {{billing_cycle}}\u003c/p\u003e\n\u003c/td\u003e\n\u003ctd align=\"right\" data-id=\"__react-email-column\" style=\"margin:0;padding:0;vertical-align:top;text-align:right\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0;font-size:16px;font-weight:700;color:#111111\"\u003eR$ {{plan_price}}\u003c/p\u003e\n\u003c/td\u003e\n\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c!-- Info cards --\u003e\n\u003ctable width=\"100%\" border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0 0 24px 0;padding:0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\n\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:0;padding-right:8px;vertical-align:top\"\u003e\n\u003cdiv style=\"margin:0;padding:16px;background:#F9FAFB;border-radius:12px\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em\"\u003ePagamento\u003c/p\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0;font-size:14px;font-weight:700;color:#111111\"\u003e{{payment_method}}\u003c/p\u003e\n\u003c/div\u003e\n\u003c/td\u003e\n\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:0;vertical-align:top\"\u003e\n\u003cdiv style=\"margin:0;padding:16px;background:#F0FDF4;border-radius:12px\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#16A34A;text-transform:uppercase;letter-spacing:0.06em\"\u003ePróxima cobrança\u003c/p\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0;font-size:14px;font-weight:700;color:#16A34A\"\u003e{{next_billing_date}}\u003c/p\u003e\n\u003c/div\u003e\n\u003c/td\u003e\n\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c!-- CTA --\u003e\n\u003ctable border=\"0\" cellPadding=\"0\" cellSpacing=\"0\" role=\"presentation\" style=\"margin:0;padding:0\"\u003e\n\u003ctbody\u003e\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:0;background-color:#111111;border-radius:10px\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0\"\u003e\n\u003ca href=\"{{account_url}}\" rel=\"noopener noreferrer nofollow\" style=\"color:#ffffff;text-decoration:none;display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:-0.2px\" target=\"_blank\"\u003eAcessar minha conta →\u003c/a\u003e\n\u003c/p\u003e\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\n\n\u003c!-- Footer --\u003e\n\u003ctr style=\"margin:0;padding:0\"\u003e\u003ctd data-id=\"__react-email-column\" style=\"margin:0;padding:28px 48px;background-color:#F9FAFB;border-top:1px solid #F3F4F6\"\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0 0 4px 0;padding:0;font-size:12px;color:#9CA3AF;text-align:center\"\u003eVocê está recebendo este email porque assinou um plano na Velo.\u003c/p\u003e\n\u003cp class=\"node-paragraph\" style=\"margin:0;padding:0;font-size:12px;color:#9CA3AF;text-align:center\"\u003e\n\u003ca href=\"https://velods.com.br\" rel=\"noopener noreferrer nofollow\" style=\"color:#111111;text-decoration:none;font-weight:500\" target=\"_blank\"\u003evelods.com.br\u003c/a\u003e\n\u0026nbsp;·\u0026nbsp;\n\u003ca href=\"{{support_url}}\" rel=\"noopener noreferrer nofollow\" style=\"color:#9CA3AF;text-decoration:none\" target=\"_blank\"\u003eSuporte\u003c/a\u003e\n\u0026nbsp;·\u0026nbsp;\n\u003ca href=\"{{unsubscribe_url}}\" rel=\"noopener noreferrer nofollow\" style=\"color:#9CA3AF;text-decoration:none\" target=\"_blank\"\u003eDescadastrar\u003c/a\u003e\n\u003c/p\u003e\n\u003c/td\u003e\u003c/tr\u003e\n\n\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\n\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\n\u003c/table\u003e\n\u003c/body\u003e\n\u003c/html\u003e\n";

type TemplateValues = Record<string, string | number | null | undefined>;

type EmailRecipient = string | string[];

export type SubscriptionEmailInput = {
  id?: string | null;
  user_id?: string | null;
  plan?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_charge_at?: string | null;
  confirmation_email_sent_at?: string | null;
};

// Supabase Edge Functions do not bundle the generated database types, so the
// admin client is intentionally typed by the small method surface used here.
type SupabaseAdminClient = {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    update: (values: Record<string, unknown>) => unknown;
  };
  auth: {
    admin: {
      getUserById: (userId: string) => Promise<{ data?: { user?: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null } | null }>;
    };
  };
};

type QueryChain = {
  eq: (column: string, value: string) => QueryChain;
  maybeSingle: () => Promise<{ data?: Record<string, unknown> | null; error?: unknown }>;
};

type MutationChain = {
  eq: (column: string, value: string) => Promise<{ error?: unknown }>;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const renderTemplate = (template: string, values: TemplateValues) =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => escapeHtml(String(values[key] ?? "")));

const normalizeSiteUrl = (siteUrl: string) => siteUrl.replace(/\/+$/, "");

export const getTransactionalSiteUrl = () =>
  normalizeSiteUrl(Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("APP_URL") ?? "https://www.velods.com.br");

export const getTransactionalLogoUrl = (siteUrl = getTransactionalSiteUrl()) => `${normalizeSiteUrl(siteUrl)}/ticket-reply-logo.png`;

export function renderVerificationEmail(values: {
  userName: string;
  verificationUrl: string;
  expirationTime?: string;
  supportUrl?: string;
  logoUrl?: string;
}) {
  const siteUrl = getTransactionalSiteUrl();
  return renderTemplate(VERIFY_EMAIL_TEMPLATE, {
    user_name: values.userName,
    verification_url: values.verificationUrl,
    expiration_time: values.expirationTime ?? "24 horas",
    support_url: values.supportUrl ?? `${siteUrl}/dashboard/configuracoes?tab=Suporte`,
    logo_url: values.logoUrl ?? getTransactionalLogoUrl(siteUrl),
  });
}

export function renderSubscriptionConfirmedEmail(values: {
  userName?: string;
  planName: string;
  billingCycle: string;
  planPrice: string;
  paymentMethod: string;
  nextBillingDate: string;
  accountUrl?: string;
  supportUrl?: string;
  unsubscribeUrl?: string;
  logoUrl?: string;
}) {
  const siteUrl = getTransactionalSiteUrl();
  const html = renderTemplate(SUBSCRIPTION_CONFIRMED_TEMPLATE, {
    plan_name: values.planName,
    billing_cycle: values.billingCycle,
    plan_price: values.planPrice,
    payment_method: values.paymentMethod,
    next_billing_date: values.nextBillingDate,
    account_url: values.accountUrl ?? `${siteUrl}/dashboard`,
    support_url: values.supportUrl ?? `${siteUrl}/dashboard/configuracoes?tab=Suporte`,
    unsubscribe_url: values.unsubscribeUrl ?? `${siteUrl}/dashboard/configuracoes?tab=Notificações`,
    logo_url: values.logoUrl ?? getTransactionalLogoUrl(siteUrl),
  });

  if (!values.userName) return html;
  return html.replace(
    "Recebemos seu pagamento e seu plano já está ativo. Aproveite!",
    `Recebemos seu pagamento, ${escapeHtml(values.userName)}. Seu plano já está ativo. Aproveite!`,
  );
}

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

export async function sendResendEmail({
  apiKey,
  to,
  subject,
  html,
}: {
  apiKey: string;
  to: EmailRecipient;
  subject: string;
  html: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Velo <noreply@velods.com.br>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    return {
      sent: false,
      status: response.status,
      detail: await getResendErrorDetail(response),
    };
  }

  const result = await response.json().catch(() => ({}));
  return { sent: true, id: (result as { id?: string }).id };
}

const formatPlanName = (plan?: string | null) => {
  const normalized = String(plan ?? "").toLowerCase();
  const labels: Record<string, string> = {
    pro: "Pro",
    business: "Business",
    plus: "Plus",
    gratis: "Grátis",
  };
  return labels[normalized] ?? (plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)}` : "Velo");
};

const formatPlanPrice = (amount?: number | string | null) => {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
};

const formatDate = (value?: string | null) => {
  if (!value) return "A definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "A definir";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

const getBillingCycle = (subscription: SubscriptionEmailInput) => {
  const start = subscription.current_period_start ? new Date(subscription.current_period_start).getTime() : 0;
  const end = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
  const days = start && end ? Math.round((end - start) / 86400000) : 30;
  return days > 45 ? "anual" : "mensal";
};

const formatPaymentMethod = (method?: string | null) => {
  const normalized = String(method ?? "").toLowerCase();
  const labels: Record<string, string> = {
    pix: "Pix",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    account_money: "Saldo Mercado Pago",
  };
  return labels[normalized] ?? (method ? method : "Pagamento aprovado");
};

const chain = (value: unknown) => value as QueryChain;
const mutation = (value: unknown) => value as MutationChain;

export async function sendSubscriptionConfirmationEmailOnce({
  adminClient,
  subscription,
  resendApiKey,
  siteUrl = getTransactionalSiteUrl(),
}: {
  adminClient: SupabaseAdminClient;
  subscription: SubscriptionEmailInput;
  resendApiKey?: string | null;
  siteUrl?: string;
}) {
  if (!resendApiKey) return { sent: false, skipped: true, reason: "RESEND_API_KEY ausente" };
  if (!subscription.id || !subscription.user_id) return { sent: false, skipped: true, reason: "Assinatura sem usuário" };
  if (subscription.confirmation_email_sent_at) return { sent: false, skipped: true, reason: "Email já enviado" };

  const profileQuery = chain(adminClient.from("profiles").select("full_name,display_name,email"));
  const { data: profile } = await profileQuery.eq("user_id", subscription.user_id).maybeSingle();
  const { data: userData } = await adminClient.auth.admin.getUserById(subscription.user_id);

  const authUser = userData?.user ?? null;
  const profileEmail = typeof profile?.email === "string" ? profile.email : null;
  const email = authUser?.email ?? profileEmail;
  if (!email) return { sent: false, skipped: true, reason: "Usuário sem email" };

  const metadataName = typeof authUser?.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : null;
  const name =
    (typeof profile?.full_name === "string" && profile.full_name) ||
    (typeof profile?.display_name === "string" && profile.display_name) ||
    metadataName ||
    email.split("@")[0];

  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const html = renderSubscriptionConfirmedEmail({
    userName: name,
    planName: formatPlanName(subscription.plan),
    billingCycle: getBillingCycle(subscription),
    planPrice: formatPlanPrice(subscription.amount),
    paymentMethod: formatPaymentMethod(subscription.payment_method),
    nextBillingDate: formatDate(subscription.next_charge_at ?? subscription.current_period_end),
    accountUrl: `${normalizedSiteUrl}/dashboard`,
    supportUrl: `${normalizedSiteUrl}/dashboard/configuracoes?tab=Suporte`,
    unsubscribeUrl: `${normalizedSiteUrl}/dashboard/configuracoes?tab=Notificações`,
    logoUrl: getTransactionalLogoUrl(normalizedSiteUrl),
  });

  const emailResult = await sendResendEmail({
    apiKey: resendApiKey,
    to: email,
    subject: "Sua assinatura Velo foi confirmada",
    html,
  });

  if (!emailResult.sent) return emailResult;

  const updateQuery = mutation(adminClient.from("subscriptions").update({ confirmation_email_sent_at: new Date().toISOString() }));
  const { error } = await updateQuery.eq("id", subscription.id);
  if (error) console.error("Falha ao marcar email de assinatura como enviado:", error);

  return emailResult;
}
