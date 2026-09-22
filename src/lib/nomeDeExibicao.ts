/*
  Nome usado para exibir o usuário dentro da Velo.

  O cadastro guarda o nome completo (e é ele que continua salvo em
  `profiles.display_name`), mas na interface só mostramos os dois primeiros
  nomes — "Luis Felipe Ferreira Xavier" virava "Luis Felipe Ferreira X..."
  cortado na lateral. Quando não há nome utilizável, cai para a parte local
  do e-mail.

  Importante: use isto apenas para EXIBIR. Formulários que editam e salvam o
  nome devem continuar trabalhando com o valor completo, senão o primeiro
  salvamento apaga o resto do nome.
*/
const PADRAO = "Usuário";
const NOMES_GENERICOS = new Set([
  "usuario",
  "usuário",
  "usuaria",
  "usuária",
  "user",
  "teste",
  "test",
  "admin",
  "cliente",
  "velo",
]);

const partesDoNome = (nomeCompleto?: string | null): string[] => {
  const limpo = (nomeCompleto ?? "").replace(/\s+/g, " ").trim();
  if (!limpo || limpo.includes("@")) return [];
  return limpo.split(" ").filter(Boolean);
};

export const nomeDeExibicao = (nomeCompleto?: string | null, email?: string | null): string => {
  const partes = partesDoNome(nomeCompleto);
  if (partes.length > 0) return partes.slice(0, 2).join(" ");

  const local = (email ?? "").split("@")[0]?.trim();
  return local || PADRAO;
};

// Só o primeiro nome — para saudações ("Bem-vindo, Luis!").
export const primeiroNome = (nomeCompleto?: string | null, email?: string | null): string =>
  nomeDeExibicao(nomeCompleto, email).split(" ")[0] || PADRAO;

/**
 * Primeiro nome para "Olá, Kristin" — só vale nome de pessoa.
 * E-mail, pedaço do e-mail com número e placeholders do cadastro não entram.
 */
export const primeiroNomeSaudacao = (...candidatos: (string | null | undefined)[]): string => {
  for (const candidato of candidatos) {
    const primeiro = partesDoNome(candidato)[0] ?? "";
    if (primeiro.length < 2 || primeiro.length > 24) continue;
    if (/[^\p{L}]/u.test(primeiro)) continue;
    if (NOMES_GENERICOS.has(primeiro.toLowerCase())) continue;
    return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
  }
  return "";
};
