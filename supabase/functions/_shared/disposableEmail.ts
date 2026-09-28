/**
 * Espelho de `src/lib/emailDescartavel.ts` para as edge functions.
 *
 * Usado para barrar contas descartáveis em recursos que geram custo por uso.
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

export const emailEhDescartavel = (email: string | null | undefined): boolean => {
  const dominio = (email ?? "").trim().toLowerCase().split("@")[1];
  if (!dominio) return false;
  if (DOMINIOS_DESCARTAVEIS.has(dominio)) return true;
  return [...DOMINIOS_DESCARTAVEIS].some((d) => dominio.endsWith(`.${d}`));
};

export const MENSAGEM_EMAIL_DESCARTAVEL =
  "Este recurso não está disponível para contas criadas com e-mail temporário. Cadastre um e-mail pessoal para usar a IA da Velo.";
