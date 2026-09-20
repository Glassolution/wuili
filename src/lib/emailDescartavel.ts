/**
 * Domínios de e-mail temporário/descartável.
 *
 * Como a Velo não exige mais confirmação de e-mail, esta lista é a barreira que
 * impede a criação em massa de contas gratuitas só para consumir recursos que
 * custam dinheiro (imagens com IA, Atlas). A mesma lista existe em
 * `supabase/functions/_shared/disposableEmail.ts` — mudou aqui, mude lá.
 */
export const DOMINIOS_DESCARTAVEIS = new Set<string>([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "33mail.com",
  "anonbox.net",
  "burnermail.io",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "gmx.us",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamailblock.com",
  "harakirimail.com",
  "inboxbear.com",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mailsac.com",
  "mintemail.com",
  "mohmal.com",
  "moakt.com",
  "mytemp.email",
  "nowmymail.com",
  "sharklasers.com",
  "spam4.me",
  "spambog.com",
  "spamgourmet.com",
  "temp-mail.io",
  "temp-mail.org",
  "tempail.com",
  "tempinbox.com",
  "tempmail.com",
  "tempmail.dev",
  "tempmailo.com",
  "tempr.email",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

/** true quando o e-mail usa um domínio de caixa temporária. */
export const emailEhDescartavel = (email: string): boolean => {
  const dominio = email.trim().toLowerCase().split("@")[1];
  if (!dominio) return false;
  if (DOMINIOS_DESCARTAVEIS.has(dominio)) return true;
  // Subdomínios do tipo "mail.yopmail.com".
  return [...DOMINIOS_DESCARTAVEIS].some((d) => dominio.endsWith(`.${d}`));
};

export const MENSAGEM_EMAIL_DESCARTAVEL =
  "Use um e-mail pessoal de verdade (Gmail, Outlook, Hotmail...). E-mails temporários não são aceitos.";
