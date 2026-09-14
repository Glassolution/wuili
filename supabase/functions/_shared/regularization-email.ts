// Template de e-mail de regularização de pagamento (padrão visual Velo).
// Placeholders: customer_name, plan_name, payment_url, whatsapp_url,
// whatsapp_display, support_url.

export const WHATSAPP_NUMBER = "5547999286334";
export const WHATSAPP_DISPLAY = "(47) 99928-6334";

type Vars = {
  customer_name: string;
  plan_name: string;
  payment_url: string;
  whatsapp_url: string;
  whatsapp_display: string;
  support_url: string;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const TEMPLATE = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="pt-BR">
<head>
<meta content="width=device-width" name="viewport"/>
<meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/>
<meta name="x-apple-disable-message-reformatting"/>
<meta content="IE=edge" http-equiv="X-UA-Compatible"/>
<meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection"/>
<title>Precisamos regularizar seu pagamento</title>
<style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style>
</head>
<body dir="ltr" lang="pt-BR" style="background-color:#ffffff">
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0" data-skip-in-text="true">
Identificamos uma falha no pagamento da sua assinatura. Regularize em até 24h.
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
<img alt="Velo" height="48" src="https://resend-attachments.s3.amazonaws.com/0db71d93-1d43-406d-8fa7-ff13475d6d0e" style="display:block;outline:none;border:none;text-decoration:none;max-width:100%;height:auto" width="48"/>
</td></tr>

<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:40px 48px 48px 48px">

<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 16px 0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:4px 12px;background-color:#FEF2F2;border-radius:20px">
<p class="node-paragraph" style="margin:0;padding:0">
<span style="color:#DC2626;font-size:12px;font-weight:600;letter-spacing:0.05em">AÇÃO NECESSÁRIA</span>
</p>
</td></tr></tbody>
</table>

<h1 style="margin:0 0 8px 0;padding:0;font-weight:700;font-size:26px;color:#111111;line-height:1.25;letter-spacing:-0.5px">Precisamos regularizar seu pagamento</h1>
<p class="node-paragraph" style="margin:0 0 32px 0;padding:0;font-size:14px;color:#9CA3AF">Olá, {{customer_name}}</p>

<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 24px 0;padding:0;background:#F9FAFB;border-radius:12px">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:20px">
<p class="node-paragraph" style="margin:0 0 12px 0;padding:0;font-size:14px;color:#374151;line-height:1.6">Identificamos uma falha técnica no nosso sistema de pagamentos que ativou sua assinatura sem confirmar o pagamento corretamente. Isso foi um erro nosso, não seu, e queremos resolver isso com transparência.</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:14px;color:#374151;line-height:1.6">Sua assinatura do plano <strong>{{plan_name}}</strong> está ativa, mas não encontramos o pagamento correspondente processado. Pra manter seu acesso sem interrupção, você precisa concluir o pagamento nas próximas 24 horas.</p>
</td></tr></tbody>
</table>

<table width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 24px 0;padding:0">
<tbody><tr style="margin:0;padding:0">
<td data-id="__react-email-column" style="margin:0;padding:0;vertical-align:top">
<div style="margin:0;padding:16px;background:#FEF2F2;border-radius:12px">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:11px;font-weight:500;color:#DC2626;text-transform:uppercase;letter-spacing:0.06em">Prazo para regularizar</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:16px;font-weight:700;color:#DC2626">24 horas</p>
</div>
</td>
</tr></tbody>
</table>

<table border="0" cellPadding="0" cellSpacing="0" role="presentation" style="margin:0 0 24px 0;padding:0">
<tbody><tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:0;background-color:#111111;border-radius:10px">
<p class="node-paragraph" style="margin:0;padding:0">
<a href="{{payment_url}}" rel="noopener noreferrer nofollow" style="color:#ffffff;text-decoration:none;display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:-0.2px" target="_blank">Regularizar pagamento →</a>
</p>
</td></tr></tbody>
</table>

<p class="node-paragraph" style="margin:0;padding:0;font-size:13px;color:#9CA3AF;line-height:1.6">Se você já pagou e acha que isso é um engano, é só mandar mensagem no WhatsApp com o comprovante que a gente confere na hora: <a href="{{whatsapp_url}}" rel="noopener noreferrer nofollow" style="color:#111111;text-decoration:none;font-weight:500" target="_blank">{{whatsapp_display}}</a></p>

</td></tr>

<tr style="margin:0;padding:0"><td data-id="__react-email-column" style="margin:0;padding:28px 48px;background-color:#F9FAFB;border-top:1px solid #F3F4F6">
<p class="node-paragraph" style="margin:0 0 4px 0;padding:0;font-size:12px;color:#9CA3AF;text-align:center">Você está recebendo este email porque tem uma assinatura ativa na Velo.</p>
<p class="node-paragraph" style="margin:0;padding:0;font-size:12px;color:#9CA3AF;text-align:center">
<a href="https://velods.com.br" rel="noopener noreferrer nofollow" style="color:#111111;text-decoration:none;font-weight:500" target="_blank">velods.com.br</a>
&nbsp;·&nbsp;
<a href="{{support_url}}" rel="noopener noreferrer nofollow" style="color:#9CA3AF;text-decoration:none" target="_blank">Suporte</a>
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

export function renderRegularizationEmail(vars: Vars): string {
  return TEMPLATE.replace(
    /\{\{(\w+)\}\}/g,
    (_m, key: string) => escapeHtml(String((vars as Record<string, string>)[key] ?? "")),
  );
}
